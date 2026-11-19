import fs from 'node:fs';
import path from 'node:path';
import {
  ADAPTER_TARGET_PATHS,
  CONTEXT_BUDGETS,
  MAX_EMERGENCY_HOURS_BY_TIER,
  MAX_WAIVER_DAYS_BY_TIER,
  NON_WAIVABLE_RULES,
  SECRET_PATTERNS,
  TEST_SKIP_PATTERNS
} from './constants.ts';
import {
  countLinesLf,
  findEmptyDirs,
  matchesAnyGlob,
  sha256FileLf,
  toPosixPath,
  walkFiles
} from './crypto-fs.ts';
import {
  getDiffAddedLinesByFile,
  getUnifiedDiff,
  getWorkingTreeChangedFiles,
  hasHeadCommit,
  isGitRepository
} from './git-vcs.ts';
import { validateJsonSchema } from './json-schema.ts';
import type {
  AdapterTarget,
  AdoptionTier,
  BaselineArtifactEntry,
  ComplianceState,
  Diagnostic,
  ExitCode,
  ProjectConfig,
  StandardLockfile,
  ValidationReport
} from './types.ts';
import { parseMarkdownFrontmatter, parseYaml } from './yaml-frontmatter.ts';
import { loadStandardBundle } from './bundle.ts';

export interface ValidateOptions {
  strict?: boolean;
  now?: Date;
}

interface SymbolEntry {
  id: string;
  file: string;
  status?: string;
  normativeRefs: string[];
}

interface ActiveCrInfo {
  id: string;
  file: string;
  status: string;
  track: string;
  coveredGlobs: string[];
}

function loadSchema(workspaceRoot: string, schemaFileName: string): Record<string, unknown> {
  const localSchemaPath = path.join(workspaceRoot, '.aisdgs', 'schemas', schemaFileName);
  if (fs.existsSync(localSchemaPath)) {
    return JSON.parse(fs.readFileSync(localSchemaPath, 'utf8')) as Record<string, unknown>;
  }
  const embedded = loadStandardBundle();
  const raw = embedded.files[`schemas/${schemaFileName}`];
  if (!raw) throw new Error(`Missing schema '${schemaFileName}'.`);
  return JSON.parse(raw) as Record<string, unknown>;
}

function stripCodeFromMarkdown(body: string): string {
  return body.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
}

function daysBetweenIso(startIso: string, endIso: string): number {
  const startMs = Date.parse(`${startIso.slice(0, 10)}T00:00:00Z`);
  const endMs = Date.parse(`${endIso.slice(0, 10)}T00:00:00Z`);
  return Math.round((endMs - startMs) / (1000 * 60 * 60 * 24));
}

// ============================================================================
// STAGE 1: Standard Lockfile Schema & SHA256-UTF8-LF Snapshot Integrity
// ============================================================================
function validateStage1_Lockfile(
  workspaceRoot: string,
  lockPath: string,
  diagnostics: Diagnostic[]
): StandardLockfile | null {
  let lockData: StandardLockfile | null = null;
  try {
    const parsedLock = parseYaml(fs.readFileSync(lockPath, 'utf8'));
    const lockSchema = loadSchema(workspaceRoot, 'standard-lock.schema.json');
    const lockErrs = validateJsonSchema(parsedLock, lockSchema);
    if (lockErrs.length > 0) {
      for (const e of lockErrs) {
        diagnostics.push({
          severity: 'ERROR',
          stage: 1,
          rule_id: 'STD-007-R01',
          file: '.aisdgs/standard-lock.yaml',
          message: `Lockfile schema error at ${e.path}: ${e.message}`,
          integrity_failure: true
        });
      }
    } else {
      lockData = parsedLock as unknown as StandardLockfile;
    }
  } catch (err) {
    diagnostics.push({
      severity: 'ERROR',
      stage: 1,
      rule_id: 'STD-001-R05',
      file: '.aisdgs/standard-lock.yaml',
      message: `Failed to parse standard-lock.yaml: ${(err as Error).message}`,
      integrity_failure: true
    });
  }

  if (lockData && Array.isArray(lockData.files)) {
    const recordedPaths = new Set<string>();
    for (const entry of lockData.files) {
      recordedPaths.add(entry.path);
      const absTarget = path.join(workspaceRoot, entry.path);
      if (!fs.existsSync(absTarget)) {
        diagnostics.push({
          severity: 'ERROR',
          stage: 1,
          rule_id: 'STD-001-R05',
          file: entry.path,
          message: `Pinned Level 1 artifact '${entry.path}' is missing from disk.`,
          integrity_failure: true
        });
      } else {
        const actualSha = sha256FileLf(absTarget);
        if (actualSha !== entry.sha256) {
          diagnostics.push({
            severity: 'ERROR',
            stage: 1,
            rule_id: 'STD-001-R05',
            file: entry.path,
            message: `Pinned Level 1 artifact '${entry.path}' was modified locally (expected ${entry.sha256.slice(0, 12)}..., got ${actualSha.slice(0, 12)}...).`,
            integrity_failure: true
          });
        }
      }
    }

    for (const sub of ['standard', 'schemas', 'policies']) {
      const subDir = path.join(workspaceRoot, '.aisdgs', sub);
      for (const diskFile of walkFiles(subDir)) {
        const rel = toPosixPath(path.relative(workspaceRoot, diskFile));
        if (!recordedPaths.has(rel)) {
          diagnostics.push({
            severity: 'ERROR',
            stage: 1,
            rule_id: 'STD-001-R05',
            file: rel,
            message: `Unrecorded file '${rel}' injected into read-only .aisdgs/${sub}/ snapshot.`,
            integrity_failure: true
          });
        }
      }
    }
  }

  return lockData;
}

// ============================================================================
// STAGE 2: Configuration & Adoption Profile Validation
// ============================================================================
function validateStage2_ConfigAndProfile(
  workspaceRoot: string,
  configPath: string,
  profilePath: string,
  options: ValidateOptions,
  diagnostics: Diagnostic[]
): {
  configData: ProjectConfig | null;
  configSha256: string;
  tier: AdoptionTier;
  strictMode: boolean;
} {
  let configData: ProjectConfig | null = null;
  const configSha256 = sha256FileLf(configPath);
  try {
    const rawCfg = parseYaml(fs.readFileSync(configPath, 'utf8'));
    const cfgSchema = loadSchema(workspaceRoot, 'config.schema.json');
    const cfgErrs = validateJsonSchema(rawCfg, cfgSchema);
    for (const e of cfgErrs) {
      diagnostics.push({
        severity: 'ERROR',
        stage: 2,
        rule_id: 'STD-001-R06',
        file: '.aisdgs/config.yaml',
        message: `Config schema error at ${e.path}: ${e.message}`
      });
    }
    if (cfgErrs.length === 0) {
      configData = rawCfg as unknown as ProjectConfig;
    }
  } catch (err) {
    diagnostics.push({
      severity: 'ERROR',
      stage: 2,
      rule_id: 'STD-001-R06',
      file: '.aisdgs/config.yaml',
      message: `Failed to parse config.yaml: ${(err as Error).message}`
    });
  }

  const tier: AdoptionTier = configData?.governance.adoption_tier ?? 'STANDARD';
  const strictMode = Boolean(options.strict || tier === 'STRICT' || configData?.governance.strict_validation);

  if (configData) {
    const pp = configData.protected_paths;
    const hasAisdgs = pp.some((g) => g.startsWith('.aisdgs'));
    const hasGov = pp.some((g) => g.startsWith('governance'));
    const hasAgents = pp.some((g) => g === 'AGENTS.md' || g === '*');
    const hasPkg = pp.some((g) => /(package\.json|Cargo\.toml|go\.mod|pyproject\.toml|csproj)/.test(g));
    const hasOpsOrMig = pp.some((g) => /(migrations|workflows|gitlab-ci|Dockerfile|contracts)/.test(g));
    if (!hasAisdgs || !hasGov || !hasAgents || !hasPkg || !hasOpsOrMig) {
      diagnostics.push({
        severity: 'ERROR',
        stage: 2,
        rule_id: 'STD-010-R02',
        file: '.aisdgs/config.yaml',
        message: 'protected_paths must cover all 4 mandatory groups (.aisdgs/**, governance/** + AGENTS.md, dependency manifests, and migrations/CI workflows).'
      });
    }
  }

  if (!fs.existsSync(profilePath)) {
    diagnostics.push({
      severity: 'ERROR',
      stage: 2,
      rule_id: 'STD-002-R01',
      file: '.aisdgs/adoption-profile.yaml',
      message: 'Missing required .aisdgs/adoption-profile.yaml.'
    });
  } else {
    try {
      const rawProf = parseYaml(fs.readFileSync(profilePath, 'utf8'));
      const profSchema = loadSchema(workspaceRoot, 'adoption-profile.schema.json');
      const profErrs = validateJsonSchema(rawProf, profSchema);
      for (const e of profErrs) {
        diagnostics.push({
          severity: 'ERROR',
          stage: 2,
          rule_id: 'STD-002-R01',
          file: '.aisdgs/adoption-profile.yaml',
          message: `Adoption profile error at ${e.path}: ${e.message}`
        });
      }
    } catch (err) {
      diagnostics.push({
        severity: 'ERROR',
        stage: 2,
        rule_id: 'STD-002-R01',
        file: '.aisdgs/adoption-profile.yaml',
        message: `Failed to parse adoption-profile.yaml: ${(err as Error).message}`
      });
    }
  }

  return { configData, configSha256, tier, strictMode };
}

// ============================================================================
// STAGE 3: Tier Topology, Empty Dir & Anti-Stub Scan
// ============================================================================
function validateStage3_Topology(
  workspaceRoot: string,
  tier: AdoptionTier,
  diagnostics: Diagnostic[]
): void {
  const requiredByAll = [
    'AGENTS.md',
    'governance/PROJECT-CONSTITUTION.md',
    'governance/PROJECT-BASELINE.md',
    'changes/CHANGELOG-GOVERNANCE.md'
  ];
  for (const reqRel of requiredByAll) {
    if (!fs.existsSync(path.join(workspaceRoot, reqRel))) {
      diagnostics.push({
        severity: 'ERROR',
        stage: 3,
        rule_id: 'STD-007-R02',
        file: reqRel,
        message: `Missing required governance artifact '${reqRel}' for tier ${tier}.`
      });
    }
  }
  if ((tier === 'STANDARD' || tier === 'STRICT') && !fs.existsSync(path.join(workspaceRoot, 'governance/EXCEPTIONS.md'))) {
    diagnostics.push({
      severity: 'ERROR',
      stage: 3,
      rule_id: 'STD-007-R02',
      file: 'governance/EXCEPTIONS.md',
      message: `governance/EXCEPTIONS.md is mandatory in ${tier} tier.`
    });
  }

  for (const govFolder of ['governance', 'docs', 'changes', 'quality']) {
    const absFolder = path.join(workspaceRoot, govFolder);
    if (!fs.existsSync(absFolder)) continue;
    const filesInside = walkFiles(absFolder);
    if (filesInside.length === 0) {
      diagnostics.push({
        severity: 'ERROR',
        stage: 3,
        rule_id: 'STD-007-R02',
        file: govFolder,
        message: `Empty governance directory '${govFolder}/' violates anti-bloat rule STD-007-R02.`
      });
    } else {
      for (const emptySub of findEmptyDirs(absFolder)) {
        const relEmpty = toPosixPath(path.relative(workspaceRoot, emptySub));
        diagnostics.push({
          severity: 'ERROR',
          stage: 3,
          rule_id: 'STD-007-R02',
          file: relEmpty,
          message: `Empty placeholder directory '${relEmpty}/' violates STD-007-R02.`
        });
      }
    }
  }
}

// ============================================================================
// STAGE 4 & STAGE 5: Frontmatter Schemas, Symbol Table, References & DAG
// ============================================================================
interface Stages4And5Result {
  symbolTable: Map<string, SymbolEntry>;
  activeCrs: ActiveCrInfo[];
  allActiveOrApprovedCrs: ActiveCrInfo[];
  baselineFrontmatter: Record<string, unknown> | null;
  exceptionsFrontmatter: Record<string, unknown> | null;
  governedMdFiles: string[];
}

function validateStages4And5_FrontmatterAndDAG(
  workspaceRoot: string,
  tier: AdoptionTier,
  now: Date,
  diagnostics: Diagnostic[]
): Stages4And5Result {
  const symbolTable = new Map<string, SymbolEntry>();
  const allRefChecks: Array<{ fromFile: string; field: string; targetId: string }> = [];
  const activeCrs: ActiveCrInfo[] = [];
  const allActiveOrApprovedCrs: ActiveCrInfo[] = [];
  let baselineFrontmatter: Record<string, unknown> | null = null;
  let exceptionsFrontmatter: Record<string, unknown> | null = null;

  // Register Level 1 STD-* and STD-*-R* symbols from .aisdgs/standard/
  const stdDir = path.join(workspaceRoot, '.aisdgs', 'standard');
  for (const stdFile of walkFiles(stdDir)) {
    if (!stdFile.endsWith('.md')) continue;
    const rel = toPosixPath(path.relative(workspaceRoot, stdFile));
    const txt = fs.readFileSync(stdFile, 'utf8');
    try {
      const parsed = parseMarkdownFrontmatter(txt);
      if (typeof parsed.frontmatter.id === 'string') {
        symbolTable.set(parsed.frontmatter.id, {
          id: parsed.frontmatter.id,
          file: rel,
          status: String(parsed.frontmatter.status ?? 'APPROVED'),
          normativeRefs: []
        });
      }
      for (const m of txt.matchAll(/\*\*`(STD-\d{3}-R\d{2})`/g)) {
        symbolTable.set(m[1], { id: m[1], file: rel, status: 'APPROVED', normativeRefs: [] });
      }
    } catch {
      // Handled in Stage 1 if tampered
    }
  }

  const frontmatterSchema = loadSchema(workspaceRoot, 'frontmatter.schema.json');
  const baselineSchema = loadSchema(workspaceRoot, 'baseline.schema.json');
  const crSchema = loadSchema(workspaceRoot, 'change-request.schema.json');
  const excSchema = loadSchema(workspaceRoot, 'exception.schema.json');

  const governedMdFiles: string[] = [];
  for (const scanDir of ['governance', 'docs', 'changes/records', 'quality/reports']) {
    const absScan = path.join(workspaceRoot, scanDir);
    for (const f of walkFiles(absScan)) {
      if (f.endsWith('.md')) governedMdFiles.push(f);
    }
  }

  for (const absMd of governedMdFiles) {
    const rel = toPosixPath(path.relative(workspaceRoot, absMd));
    const rawMd = fs.readFileSync(absMd, 'utf8');
    let parsed;
    try {
      parsed = parseMarkdownFrontmatter(rawMd);
    } catch (err) {
      diagnostics.push({
        severity: 'ERROR',
        stage: 4,
        rule_id: 'STD-004-R02',
        file: rel,
        message: `YAML frontmatter parse error: ${(err as Error).message}`
      });
      continue;
    }

    if (!parsed.hasFrontmatter) {
      diagnostics.push({
        severity: 'ERROR',
        stage: 4,
        rule_id: 'STD-004-R02',
        file: rel,
        message: `Governed Markdown artifact '${rel}' is missing opening YAML frontmatter.`
      });
      continue;
    }

    const fm = parsed.frontmatter;
    let schemaToUse = frontmatterSchema;
    let schemaRule = 'STD-004-R02';
    if (rel === 'governance/PROJECT-BASELINE.md') {
      schemaToUse = baselineSchema;
      schemaRule = 'STD-005-R04';
      baselineFrontmatter = fm;
    } else if (rel === 'governance/EXCEPTIONS.md') {
      schemaToUse = excSchema;
      schemaRule = 'STD-002-R05';
      exceptionsFrontmatter = fm;
    } else if (rel.startsWith('changes/records/')) {
      schemaToUse = crSchema;
      schemaRule = 'STD-006-R03';
    }

    const schemaErrs = validateJsonSchema(fm, schemaToUse);
    for (const e of schemaErrs) {
      diagnostics.push({
        severity: 'ERROR',
        stage: 4,
        rule_id: schemaRule,
        file: rel,
        message: `Schema error at ${e.path}: ${e.message}`
      });
    }

    // Stage 3 anti-stub scan on APPROVED documents
    const docStatus = String(fm.status ?? fm.cr_status ?? '');
    if (docStatus === 'APPROVED') {
      const stripped = stripCodeFromMarkdown(parsed.body).trim();
      if (stripped.length === 0 || /\b(TODO|TBD)\b/.test(stripped)) {
        diagnostics.push({
          severity: 'ERROR',
          stage: 3,
          rule_id: 'STD-003-R07',
          file: rel,
          message: `APPROVED artifact '${rel}' contains unresolved TODO/TBD placeholder or empty body.`
        });
      }
    }

    // Inline REQ-* extraction in PROJECT-BASELINE.md (for LITE tier compact tables when no discrete REQ file owns it)
    if (rel === 'governance/PROJECT-BASELINE.md' && tier === 'LITE') {
      for (const m of parsed.body.matchAll(/`(REQ-(?:FUNC|NFUNC|SEC|DATA|INT)-\d{3,4})`/g)) {
        if (!symbolTable.has(m[1])) {
          symbolTable.set(m[1], {
            id: m[1],
            file: rel,
            status: docStatus === 'APPROVED' ? 'APPROVED' : 'DRAFT',
            normativeRefs: []
          });
        }
      }
    }

    // Symbol registration & uniqueness check
    if (typeof fm.id === 'string') {
      const id = fm.id;
      if (symbolTable.has(id) && symbolTable.get(id)!.file !== rel) {
        diagnostics.push({
          severity: 'ERROR',
          stage: 5,
          rule_id: 'STD-004-R03',
          file: rel,
          message: `Duplicate identifier '${id}' already defined in '${symbolTable.get(id)!.file}'.`
        });
      } else {
        const normRefs = Array.isArray(fm.normative_references)
          ? fm.normative_references.filter((x): x is string => typeof x === 'string')
          : [];
        symbolTable.set(id, { id, file: rel, status: docStatus, normativeRefs: normRefs });
      }
    }

    // Collect cross-references to verify after symbol table is complete
    for (const arrField of ['normative_references', 'affected_requirements', 'affected_adrs', 'supersedes']) {
      if (Array.isArray(fm[arrField])) {
        for (const target of fm[arrField] as unknown[]) {
          if (typeof target === 'string') {
            allRefChecks.push({ fromFile: rel, field: arrField, targetId: target });
          }
        }
      }
    }
    if (typeof fm.superseded_by === 'string') {
      allRefChecks.push({ fromFile: rel, field: 'superseded_by', targetId: fm.superseded_by });
    }

    // Track active CRs for Stage 5, 6 & 7
    if (rel.startsWith('changes/records/') && typeof fm.id === 'string') {
      const crStat = String(fm.cr_status ?? '');
      const track = String(fm.track ?? 'FAST');
      const affFiles = Array.isArray(fm.affected_files) ? (fm.affected_files as string[]) : [];
      const affDocs = Array.isArray(fm.affected_docs) ? (fm.affected_docs as string[]) : [];
      const covered = [...new Set([...affFiles, ...affDocs])];
      if (crStat === 'IN_PROGRESS') {
        activeCrs.push({ id: fm.id, file: rel, status: crStat, track, coveredGlobs: covered });
      }
      if (['APPROVED', 'IN_PROGRESS', 'EMERGENCY_ACTIVE'].includes(crStat)) {
        allActiveOrApprovedCrs.push({ id: fm.id, file: rel, status: crStat, track, coveredGlobs: covered });
      }

      // Stage 6 check on EMERGENCY_ACTIVE clock (STD-012-R07)
      if (crStat === 'EMERGENCY_ACTIVE' && typeof fm.created_at === 'string') {
        const createdMs = Date.parse(fm.created_at);
        if (!Number.isNaN(createdMs)) {
          const elapsedHours = (now.getTime() - createdMs) / (1000 * 60 * 60);
          const maxHours = MAX_EMERGENCY_HOURS_BY_TIER[tier];
          if (elapsedHours > maxHours) {
            diagnostics.push({
              severity: 'ERROR',
              stage: 6,
              rule_id: 'STD-012-R07',
              file: rel,
              message: `Emergency Change '${fm.id}' exceeded mandatory ${maxHours}h post-incident reconciliation deadline (${elapsedHours.toFixed(1)}h elapsed).`
            });
          } else {
            diagnostics.push({
              severity: 'WARNING',
              stage: 6,
              rule_id: 'STD-012-R07',
              file: rel,
              message: `Emergency Change '${fm.id}' is EMERGENCY_ACTIVE (${(maxHours - elapsedHours).toFixed(1)}h remaining to reconcile).`
            });
          }
        }
      }

      // Stage 5: Active CRs in STANDARD/STRICT must not implement DRAFT/DEPRECATED/SUPERSEDED REQ-*
      if (
        (tier === 'STANDARD' || tier === 'STRICT') &&
        ['APPROVED', 'IN_PROGRESS', 'VERIFIED'].includes(crStat) &&
        Array.isArray(fm.affected_requirements)
      ) {
        for (const reqId of fm.affected_requirements as unknown[]) {
          if (typeof reqId === 'string') {
            allRefChecks.push({ fromFile: rel, field: '__active_cr_req_check__', targetId: reqId });
          }
        }
      }
    }
  }

  // Register EXC-* symbols from EXCEPTIONS.md
  if (exceptionsFrontmatter && Array.isArray(exceptionsFrontmatter.waivers)) {
    for (const w of exceptionsFrontmatter.waivers as Array<Record<string, unknown>>) {
      if (typeof w.id === 'string') {
        if (symbolTable.has(w.id)) {
          diagnostics.push({
            severity: 'ERROR',
            stage: 5,
            rule_id: 'STD-004-R03',
            file: 'governance/EXCEPTIONS.md',
            message: `Duplicate waiver identifier '${w.id}'.`
          });
        } else {
          symbolTable.set(w.id, {
            id: w.id,
            file: 'governance/EXCEPTIONS.md',
            status: String(w.status ?? 'DRAFT'),
            normativeRefs: []
          });
        }
      }
    }
  }

  // Resolve cross-references (STD-004-R04 & STD-003-R03)
  for (const ref of allRefChecks) {
    if (ref.field === '__active_cr_req_check__') {
      const target = symbolTable.get(ref.targetId);
      if (target && ['DRAFT', 'SUPERSEDED', 'DEPRECATED'].includes(target.status ?? '')) {
        diagnostics.push({
          severity: 'ERROR',
          stage: 5,
          rule_id: 'STD-003-R03',
          file: ref.fromFile,
          message: `Change Request references '${ref.targetId}' which is in '${target.status}' state (must be APPROVED or AMENDING).`
        });
      }
      continue;
    }
    if (!symbolTable.has(ref.targetId)) {
      diagnostics.push({
        severity: 'ERROR',
        stage: 5,
        rule_id: 'STD-004-R04',
        file: ref.fromFile,
        message: `Dangling reference '${ref.targetId}' in '${ref.field}' does not resolve to any registered entity.`
      });
    }
  }

  // 3-Color DFS Cycle Detection on normative_references (STD-004-R05)
  const visitState = new Map<string, number>();
  function detectCycle(id: string, chain: string[]): void {
    visitState.set(id, 1);
    const node = symbolTable.get(id);
    if (node) {
      for (const dep of node.normativeRefs) {
        const st = visitState.get(dep) ?? 0;
        if (st === 1) {
          diagnostics.push({
            severity: 'ERROR',
            stage: 5,
            rule_id: 'STD-004-R05',
            file: node.file,
            message: `Circular normative dependency detected: ${[...chain, id, dep].join(' -> ')}.`
          });
        } else if (st === 0 && symbolTable.has(dep)) {
          detectCycle(dep, [...chain, id]);
        }
      }
    }
    visitState.set(id, 2);
  }
  for (const id of symbolTable.keys()) {
    if ((visitState.get(id) ?? 0) === 0) detectCycle(id, []);
  }

  return {
    symbolTable,
    activeCrs,
    allActiveOrApprovedCrs,
    baselineFrontmatter,
    exceptionsFrontmatter,
    governedMdFiles
  };
}

// ============================================================================
// STAGE 6: Waivers, Context Line Budgets & Adapter Sync
// ============================================================================
function validateStage6_WaiversAndBudgets(
  workspaceRoot: string,
  tier: AdoptionTier,
  configData: ProjectConfig | null,
  configSha256: string,
  exceptionsFrontmatter: Record<string, unknown> | null,
  symbolTable: Map<string, SymbolEntry>,
  todayIso: string,
  diagnostics: Diagnostic[]
): number {
  let activeWaiversCount = 0;

  if (exceptionsFrontmatter && Array.isArray(exceptionsFrontmatter.waivers)) {
    for (const w of exceptionsFrontmatter.waivers as Array<Record<string, unknown>>) {
      const wId = String(w.id ?? 'EXC-????');
      const wStatus = String(w.status ?? '');
      const rules = Array.isArray(w.waives_rules) ? (w.waives_rules as string[]) : [];

      for (const rId of rules) {
        if (NON_WAIVABLE_RULES.has(rId)) {
          diagnostics.push({
            severity: 'ERROR',
            stage: 6,
            rule_id: 'STD-002-R04',
            file: 'governance/EXCEPTIONS.md',
            message: `Waiver '${wId}' attempts to waive '${rId}', which is [NON-WAIVABLE].`
          });
        } else if (rId.startsWith('STD-') && !symbolTable.has(rId)) {
          diagnostics.push({
            severity: 'ERROR',
            stage: 6,
            rule_id: 'STD-004-R04',
            file: 'governance/EXCEPTIONS.md',
            message: `Waiver '${wId}' references unknown standard rule '${rId}'.`
          });
        }
      }

      if (wStatus === 'ACTIVE') {
        activeWaiversCount++;
        const expiresAt = String(w.expires_at ?? '');
        const approvedAt = String(w.approved_at ?? '');
        if (expiresAt && expiresAt < todayIso) {
          diagnostics.push({
            severity: 'ERROR',
            stage: 6,
            rule_id: 'STD-002-R06',
            file: 'governance/EXCEPTIONS.md',
            message: `Active waiver '${wId}' expired on ${expiresAt} (today is ${todayIso}).`
          });
        } else if (expiresAt) {
          const remainingDays = daysBetweenIso(todayIso, expiresAt);
          if (remainingDays <= 14) {
            diagnostics.push({
              severity: 'WARNING',
              stage: 6,
              rule_id: 'STD-002-R06',
              file: 'governance/EXCEPTIONS.md',
              message: `Active waiver '${wId}' expires in ${remainingDays} day(s) (${expiresAt}).`
            });
          }
        }
        if (approvedAt && expiresAt) {
          const spanDays = daysBetweenIso(approvedAt, expiresAt);
          const maxDays = MAX_WAIVER_DAYS_BY_TIER[tier];
          if (spanDays > maxDays) {
            diagnostics.push({
              severity: 'ERROR',
              stage: 6,
              rule_id: 'STD-002-R06',
              file: 'governance/EXCEPTIONS.md',
              message: `Waiver '${wId}' validity span (${spanDays} days) exceeds ${tier} tier maximum (${maxDays} days).`
            });
          }
        }
      }
    }
  }

  // Context Tier 0 & 0b line budgets & config_sha256 sync check
  const agentsPath = path.join(workspaceRoot, 'AGENTS.md');
  if (fs.existsSync(agentsPath)) {
    const agentsTxt = fs.readFileSync(agentsPath, 'utf8');
    const agentsLines = countLinesLf(agentsTxt);
    if (agentsLines > CONTEXT_BUDGETS.ROOT_ROUTER_MAX_LINES) {
      diagnostics.push({
        severity: 'ERROR',
        stage: 6,
        rule_id: 'STD-011-R03',
        file: 'AGENTS.md',
        message: `AGENTS.md exceeds Context Tier 0 budget (${agentsLines} lines > ${CONTEXT_BUDGETS.ROOT_ROUTER_MAX_LINES} max).`
      });
    }
    const syncMatch = agentsTxt.match(/config_sha256=([a-f0-9]{64})/);
    if (!syncMatch || syncMatch[1] !== configSha256) {
      diagnostics.push({
        severity: 'ERROR',
        stage: 6,
        rule_id: 'STD-011-R08',
        file: 'AGENTS.md',
        message: "AGENTS.md is out of sync with .aisdgs/config.yaml. Run 'aisdgs adapter sync'."
      });
    }
  }

  if (configData) {
    for (const target of configData.adapters.targets) {
      if (target === 'agents') continue;
      const spec = ADAPTER_TARGET_PATHS[target as AdapterTarget];
      if (!spec) continue;
      const bridgeAbs = path.join(workspaceRoot, spec.dest);
      if (!fs.existsSync(bridgeAbs)) {
        diagnostics.push({
          severity: 'ERROR',
          stage: 6,
          rule_id: 'STD-011-R08',
          file: spec.dest,
          message: `Enabled adapter bridge '${spec.dest}' is missing. Run 'aisdgs adapter sync'.`
        });
        continue;
      }
      const bridgeTxt = fs.readFileSync(bridgeAbs, 'utf8');
      const bLines = countLinesLf(bridgeTxt);
      if (bLines > CONTEXT_BUDGETS.VENDOR_BRIDGE_MAX_LINES) {
        diagnostics.push({
          severity: 'ERROR',
          stage: 6,
          rule_id: 'STD-011-R04',
          file: spec.dest,
          message: `Vendor bridge '${spec.dest}' exceeds 40-line budget (${bLines} lines).`
        });
      }
      if (!bridgeTxt.includes('AGENTS.md')) {
        diagnostics.push({
          severity: 'ERROR',
          stage: 6,
          rule_id: 'STD-011-R04',
          file: spec.dest,
          message: `Vendor bridge '${spec.dest}' must delegate explicitly to root AGENTS.md.`
        });
      }
      const bSync = bridgeTxt.match(/config_sha256=([a-f0-9]{64})/);
      if (!bSync || bSync[1] !== configSha256) {
        diagnostics.push({
          severity: 'ERROR',
          stage: 6,
          rule_id: 'STD-011-R08',
          file: spec.dest,
          message: `Vendor bridge '${spec.dest}' is out of sync with .aisdgs/config.yaml. Run 'aisdgs adapter sync'.`
        });
      }
    }
  }

  const polDir = path.join(workspaceRoot, '.aisdgs', 'policies');
  for (const polFile of walkFiles(polDir)) {
    if (!polFile.endsWith('.md')) continue;
    const pLines = countLinesLf(fs.readFileSync(polFile, 'utf8'));
    if (pLines > CONTEXT_BUDGETS.POLICY_MAX_LINES) {
      diagnostics.push({
        severity: 'ERROR',
        stage: 6,
        rule_id: 'STD-011-R05',
        file: toPosixPath(path.relative(workspaceRoot, polFile)),
        message: `Context Tier 1 playbook exceeds ${CONTEXT_BUDGETS.POLICY_MAX_LINES}-line budget (${pLines} lines).`
      });
    }
  }

  return activeWaiversCount;
}

// ============================================================================
// STAGE 7: Baseline Digest Verification, Protected Paths & Ring 2 Guard
// ============================================================================
function validateStage7_BaselineAndRing2(
  workspaceRoot: string,
  configData: ProjectConfig | null,
  configSha256: string,
  lockData: StandardLockfile | null,
  baselineFrontmatter: Record<string, unknown> | null,
  activeCrs: ActiveCrInfo[],
  allActiveOrApprovedCrs: ActiveCrInfo[],
  allAuthorizedGlobs: string[],
  strictMode: boolean,
  diagnostics: Diagnostic[]
): { diffAddedByFile: Map<string, string[]> } {
  if (baselineFrontmatter) {
    const bState = String(baselineFrontmatter.baseline_state ?? 'UNINITIALIZED');
    if ((bState === 'ANCHORED' || bState === 'LOCKED') && Array.isArray(baselineFrontmatter.artifacts)) {
      for (const art of baselineFrontmatter.artifacts as BaselineArtifactEntry[]) {
        const relArt = toPosixPath(art.path);
        const absArt = path.join(workspaceRoot, relArt);
        if (!fs.existsSync(absArt)) {
          const covered = matchesAnyGlob(relArt, allAuthorizedGlobs);
          if (!covered) {
            diagnostics.push({
              severity: 'ERROR',
              stage: 7,
              rule_id: 'STD-005-R05',
              file: relArt,
              message: `Baselined artifact '${relArt}' was deleted without an active authorized Change Request.`
            });
          }
          continue;
        }
        const currentSha = sha256FileLf(absArt);
        if (currentSha !== art.sha256) {
          const coveringCr = allActiveOrApprovedCrs.find((c) => matchesAnyGlob(relArt, c.coveredGlobs));
          if (coveringCr) {
            diagnostics.push({
              severity: 'INFO',
              stage: 7,
              rule_id: 'STD-005-R05',
              file: relArt,
              message: `Baselined artifact '${relArt}' is AMENDING under active Change Request ${coveringCr.id} (re-lock required prior to closure).`
            });
          } else {
            diagnostics.push({
              severity: 'ERROR',
              stage: 7,
              rule_id: 'STD-005-R05',
              file: relArt,
              message: `Baseline drift detected in '${relArt}' without covering Change Request (expected ${art.sha256.slice(0, 12)}..., got ${currentSha.slice(0, 12)}...).`
            });
          }
        }
      }
    }
  }

  // Concurrent IN_PROGRESS CR file-lease overlap check (STD-006-R07)
  for (let i = 0; i < activeCrs.length; i++) {
    for (let j = i + 1; j < activeCrs.length; j++) {
      const a = activeCrs[i];
      const b = activeCrs[j];
      const overlap = a.coveredGlobs.find(
        (ga) => b.coveredGlobs.includes(ga) || matchesAnyGlob(ga, b.coveredGlobs) || b.coveredGlobs.some((gb) => matchesAnyGlob(gb, [ga]))
      );
      if (overlap) {
        diagnostics.push({
          severity: 'ERROR',
          stage: 7,
          rule_id: 'STD-006-R07',
          file: a.file,
          message: `Concurrent IN_PROGRESS Change Requests '${a.id}' and '${b.id}' have overlapping file scope ('${overlap}'). Arbitrate sequence first.`
        });
      }
    }
  }

  const gitActive = isGitRepository(workspaceRoot);
  const diffText = gitActive ? getUnifiedDiff(workspaceRoot) : '';
  const diffAddedByFile = gitActive ? getDiffAddedLinesByFile(diffText) : new Map<string, string[]>();

  if (gitActive && configData && hasHeadCommit(workspaceRoot)) {
    const changedWorkingFiles = getWorkingTreeChangedFiles(workspaceRoot);
    const bState = String(baselineFrontmatter?.baseline_state ?? 'UNINITIALIZED');
    const lockedArtifactShaMap = new Map<string, string>();
    if (Array.isArray(baselineFrontmatter?.artifacts)) {
      for (const a of baselineFrontmatter!.artifacts as BaselineArtifactEntry[]) {
        lockedArtifactShaMap.set(toPosixPath(a.path), a.sha256);
      }
    }
    const stdLockShaMap = new Map<string, string>(
      (lockData?.files ?? []).map((f) => [toPosixPath(f.path), f.sha256])
    );

    if (bState === 'ANCHORED' || bState === 'LOCKED') {
      for (const chFile of changedWorkingFiles) {
        if (chFile.startsWith('changes/records/') || chFile === 'changes/CHANGELOG-GOVERNANCE.md') continue;
        if (chFile === 'governance/PROJECT-BASELINE.md' || chFile === '.aisdgs/standard-lock.yaml') continue;

        // If file content already matches its verified lockfile or baseline hash (or synced adapter), it is authorized locked state
        const absCh = path.join(workspaceRoot, chFile);
        if (fs.existsSync(absCh)) {
          const diskSha = sha256FileLf(absCh);
          if (lockedArtifactShaMap.get(chFile) === diskSha) continue;
          if (stdLockShaMap.get(chFile) === diskSha) continue;
          if (
            ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md', '.cursor/rules/aisdgs.mdc', '.github/copilot-instructions.md', '.kilocode/rules/aisdgs.md'].includes(chFile) &&
            fs.readFileSync(absCh, 'utf8').includes(`config_sha256=${configSha256}`)
          ) {
            continue;
          }
        }

        if (matchesAnyGlob(chFile, configData.protected_paths)) {
          const covered = matchesAnyGlob(chFile, allAuthorizedGlobs);
          if (!covered) {
            diagnostics.push({
              severity: 'ERROR',
              stage: 7,
              rule_id: 'STD-010-R02',
              file: chFile,
              message: `Protected path '${chFile}' has uncommitted modifications not covered by any APPROVED/IN_PROGRESS/EMERGENCY_ACTIVE Change Request.`
            });
          }
        }
      }
    }

    // Ring 2 Self-Approval Spoofing Detection (DEC-007):
    const hasUncommittedCodeChanges = changedWorkingFiles.some(
      (f) => !f.startsWith('changes/') && !f.startsWith('governance/') && !f.startsWith('docs/') && !f.startsWith('.aisdgs/')
    );
    if (hasUncommittedCodeChanges) {
      const flaggedSpoofFiles = new Set<string>();
      for (const [diffFile, addedLines] of diffAddedByFile.entries()) {
        if (
          diffFile.startsWith('changes/records/CR-') &&
          addedLines.some((l) => /^cr_status:\s*(APPROVED|IN_PROGRESS|VERIFIED|CLOSED)\b/.test(l.trim()))
        ) {
          flaggedSpoofFiles.add(diffFile);
        }
      }
      for (const chFile of changedWorkingFiles) {
        if (chFile.startsWith('changes/records/CR-') && !diffAddedByFile.has(chFile)) {
          const absCr = path.join(workspaceRoot, chFile);
          if (fs.existsSync(absCr)) {
            try {
              const cfm = parseMarkdownFrontmatter(fs.readFileSync(absCr, 'utf8')).frontmatter;
              if (['APPROVED', 'IN_PROGRESS', 'VERIFIED', 'CLOSED'].includes(String(cfm.cr_status ?? ''))) {
                flaggedSpoofFiles.add(chFile);
              }
            } catch {
              // Caught in Stage 4
            }
          }
        }
      }
      for (const spoofFile of flaggedSpoofFiles) {
        diagnostics.push({
          severity: strictMode ? 'ERROR' : 'WARNING',
          stage: 7,
          rule_id: 'STD-001-R03',
          file: spoofFile,
          message: `SELF_APPROVAL_SUSPECTED: '${spoofFile}' was marked APPROVED/ACTIVE in the same uncommitted working tree as code edits. Commit human CR approval before executing implementation.`,
          integrity_failure: strictMode
        });
      }
    }
  }

  return { diffAddedByFile };
}

// ============================================================================
// STAGE 8: Secret Hygiene & Test-Tampering Scanner
// ============================================================================
function validateStage8_HygieneScanner(
  workspaceRoot: string,
  tier: AdoptionTier,
  governedMdFiles: string[],
  allAuthorizedGlobs: string[],
  diffAddedByFile: Map<string, string[]>,
  diagnostics: Diagnostic[]
): void {
  const gitActive = isGitRepository(workspaceRoot);
  if (gitActive) {
    const gitignorePath = path.join(workspaceRoot, '.gitignore');
    if (!fs.existsSync(gitignorePath)) {
      diagnostics.push({
        severity: tier === 'LITE' ? 'WARNING' : 'ERROR',
        stage: 8,
        rule_id: 'STD-012-R01',
        file: '.gitignore',
        message: 'Missing .gitignore; repository must exclude .env and private key files (*.pem, *.key).'
      });
    } else {
      const gi = fs.readFileSync(gitignorePath, 'utf8');
      if (!/^\.env\b/m.test(gi)) {
        diagnostics.push({
          severity: tier === 'LITE' ? 'WARNING' : 'ERROR',
          stage: 8,
          rule_id: 'STD-012-R01',
          file: '.gitignore',
          message: "'.gitignore' does not exclude '.env' secret files."
        });
      }
    }
  }

  // Scan governed docs & git diff added lines for plaintext secrets
  for (const absMd of governedMdFiles) {
    const rel = toPosixPath(path.relative(workspaceRoot, absMd));
    const content = fs.readFileSync(absMd, 'utf8');
    for (const sp of SECRET_PATTERNS) {
      if (sp.regex.test(content)) {
        diagnostics.push({
          severity: 'ERROR',
          stage: 8,
          rule_id: 'STD-012-R01',
          file: rel,
          message: `Detected potential plaintext credential (${sp.name}) inside '${rel}'.`
        });
      }
    }
  }

  for (const [diffFile, addedLines] of diffAddedByFile.entries()) {
    const joinedAdded = addedLines.join('\n');
    for (const sp of SECRET_PATTERNS) {
      if (sp.regex.test(joinedAdded)) {
        diagnostics.push({
          severity: 'ERROR',
          stage: 8,
          rule_id: 'STD-012-R01',
          file: diffFile,
          message: `Detected potential plaintext credential (${sp.name}) in uncommitted diff of '${diffFile}'.`
        });
      }
    }

    if (/(?:^|\/)(?:test|tests|__tests__|spec|specs)\/|(?:\.test\.|\.spec\.|_test\.)/i.test(diffFile)) {
      const coveredByCr = matchesAnyGlob(diffFile, allAuthorizedGlobs);
      if (!coveredByCr) {
        for (const tp of TEST_SKIP_PATTERNS) {
          if (tp.regex.test(joinedAdded)) {
            diagnostics.push({
              severity: 'ERROR',
              stage: 8,
              rule_id: 'STD-009-R02',
              file: diffFile,
              message: `Detected unauthorized test-skipping directive (${tp.name}) added in '${diffFile}'.`
            });
          }
        }
      }
    }
  }
}

// ============================================================================
// MAIN VALIDATION ORCHESTRATOR
// ============================================================================
export function runValidation(workspaceRootInput: string, options: ValidateOptions = {}): ValidationReport {
  const workspaceRoot = path.resolve(workspaceRootInput);
  const now = options.now ?? new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const diagnostics: Diagnostic[] = [];

  const configPath = path.join(workspaceRoot, '.aisdgs', 'config.yaml');
  const lockPath = path.join(workspaceRoot, '.aisdgs', 'standard-lock.yaml');
  const profilePath = path.join(workspaceRoot, '.aisdgs', 'adoption-profile.yaml');

  // Uninitialized workspace guard (Exit Code 2)
  if (!fs.existsSync(configPath) || !fs.existsSync(lockPath)) {
    return {
      command: 'validate',
      ok: false,
      compliance_state: 'NON_COMPLIANT',
      exit_code: 2,
      timestamp: now.toISOString(),
      summary: { errors: 1, warnings: 0, infos: 0, active_waivers: 0 },
      diagnostics: [
        {
          severity: 'ERROR',
          stage: 1,
          rule_id: 'STD-007-R01',
          file: '.aisdgs/config.yaml',
          message: "Workspace is not initialized with AI-SDGS (missing .aisdgs/config.yaml or .aisdgs/standard-lock.yaml). Run 'aisdgs init'."
        }
      ],
      data: {}
    };
  }

  // STAGE 1: Standard Lockfile Schema & SHA256-UTF8-LF Snapshot Integrity
  const lockData = validateStage1_Lockfile(workspaceRoot, lockPath, diagnostics);

  // STAGE 2: Configuration & Adoption Profile Validation
  const { configData, configSha256, tier, strictMode } = validateStage2_ConfigAndProfile(
    workspaceRoot,
    configPath,
    profilePath,
    options,
    diagnostics
  );

  // STAGE 3: Tier Topology, Empty Dir & Anti-Stub Scan
  validateStage3_Topology(workspaceRoot, tier, diagnostics);

  // STAGE 4 & STAGE 5: Frontmatter Schemas, Symbol Table, References & DAG
  const {
    symbolTable,
    activeCrs,
    allActiveOrApprovedCrs,
    baselineFrontmatter,
    exceptionsFrontmatter,
    governedMdFiles
  } = validateStages4And5_FrontmatterAndDAG(workspaceRoot, tier, now, diagnostics);

  // STAGE 6: Waivers, Context Line Budgets & Adapter Sync
  const activeWaiversCount = validateStage6_WaiversAndBudgets(
    workspaceRoot,
    tier,
    configData,
    configSha256,
    exceptionsFrontmatter,
    symbolTable,
    todayIso,
    diagnostics
  );

  // STAGE 7: Baseline Digest Verification, Protected Paths & Ring 2 Guard
  const allAuthorizedGlobs = allActiveOrApprovedCrs.flatMap((c) => c.coveredGlobs);
  const { diffAddedByFile } = validateStage7_BaselineAndRing2(
    workspaceRoot,
    configData,
    configSha256,
    lockData,
    baselineFrontmatter,
    activeCrs,
    allActiveOrApprovedCrs,
    allAuthorizedGlobs,
    strictMode,
    diagnostics
  );

  // STAGE 8: Secret Hygiene & Test-Tampering Scanner
  validateStage8_HygieneScanner(
    workspaceRoot,
    tier,
    governedMdFiles,
    allAuthorizedGlobs,
    diffAddedByFile,
    diagnostics
  );

  // FINAL VERDICT & EXIT CODE RESOLUTION
  if (strictMode) {
    for (const d of diagnostics) {
      if (d.severity === 'WARNING') {
        d.severity = 'ERROR';
      }
    }
  }

  const errors = diagnostics.filter((d) => d.severity === 'ERROR').length;
  const warnings = diagnostics.filter((d) => d.severity === 'WARNING').length;
  const infos = diagnostics.filter((d) => d.severity === 'INFO').length;
  const hasIntegrityFailure = diagnostics.some((d) => d.integrity_failure === true);

  let exitCode: ExitCode = 0;
  let complianceState: ComplianceState = activeWaiversCount > 0 ? 'COMPLIANT_WITH_WAIVERS' : 'COMPLIANT';

  if (hasIntegrityFailure) {
    exitCode = 3;
    complianceState = 'INTEGRITY_COMPROMISED';
  } else if (errors > 0) {
    exitCode = 1;
    complianceState = 'NON_COMPLIANT';
  }

  return {
    command: 'validate',
    ok: exitCode === 0,
    compliance_state: complianceState,
    exit_code: exitCode,
    timestamp: now.toISOString(),
    summary: {
      errors,
      warnings,
      infos,
      active_waivers: activeWaiversCount
    },
    diagnostics,
    data: {
      adoption_tier: tier,
      strict_mode: strictMode,
      registered_symbols: symbolTable.size
    }
  };
}
