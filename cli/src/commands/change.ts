import fs from 'node:fs';
import path from 'node:path';
import { loadStandardBundle } from '../core/bundle.ts';
import { MAX_EMERGENCY_HOURS_BY_TIER } from '../core/constants.ts';
import {
  matchesAnyGlob,
  renderTemplate,
  toPosixPath,
  walkFiles,
  writeFileAtomicLf
} from '../core/crypto-fs.ts';
import { getWorkingTreeChangedFiles, isGitRepository } from '../core/git-vcs.ts';
import { validateJsonSchema } from '../core/json-schema.ts';
import type { ChangeTrack, ExitCode, ProjectConfig } from '../core/types.ts';
import {
  parseMarkdownFrontmatter,
  parseYaml,
  serializeMarkdownWithFrontmatter
} from '../core/yaml-frontmatter.ts';

export interface ChangeCreateOptions {
  track?: ChangeTrack;
  title: string;
  classification?: string;
  incidentId?: string;
  approver?: string;
  files?: string[];
  now?: Date;
}

function nextCrId(recordsDir: string): string {
  let maxNum = 0;
  for (const f of walkFiles(recordsDir)) {
    const m = path.basename(f).match(/^CR-(\d{4,})\.md$/i);
    if (m) {
      const n = Number.parseInt(m[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  return `CR-${String(maxNum + 1).padStart(4, '0')}`;
}

export function runChangeCreate(
  workspaceRootInput: string,
  options: ChangeCreateOptions
): {
  ok: boolean;
  exitCode: ExitCode;
  crId: string;
  filePath: string;
  track: ChangeTrack;
  message: string;
} {
  const workspaceRoot = path.resolve(workspaceRootInput);
  const cfgPath = path.join(workspaceRoot, '.aisdgs', 'config.yaml');
  if (!fs.existsSync(cfgPath)) {
    return {
      ok: false,
      exitCode: 2,
      crId: '',
      filePath: '',
      track: options.track ?? 'FAST',
      message: "Workspace is not initialized. Run 'aisdgs init' first."
    };
  }
  if (!options.title || options.title.trim().length < 3) {
    return {
      ok: false,
      exitCode: 2,
      crId: '',
      filePath: '',
      track: options.track ?? 'FAST',
      message: "Missing or invalid '--title <summary>' (minimum 3 characters)."
    };
  }

  const cfg = parseYaml(fs.readFileSync(cfgPath, 'utf8')) as unknown as ProjectConfig;
  const track: ChangeTrack = (options.track ?? 'FAST').toUpperCase() as ChangeTrack;
  if (!['FAST', 'FULL', 'EMERGENCY'].includes(track)) {
    return {
      ok: false,
      exitCode: 2,
      crId: '',
      filePath: '',
      track,
      message: "Invalid '--track'; expected fast, full, or emergency."
    };
  }

  const now = options.now ?? new Date();
  const dateIso = now.toISOString().slice(0, 10);
  const tsIso = now.toISOString();
  const recordsDir = path.join(workspaceRoot, 'changes', 'records');
  const crId = nextCrId(recordsDir);
  const relDest = `changes/records/${crId}.md`;
  const absDest = path.join(workspaceRoot, relDest);

  const bundle = loadStandardBundle();
  const templateName =
    track === 'FULL'
      ? 'templates/artifacts/CR-FULL.template.md'
      : track === 'EMERGENCY'
        ? 'templates/artifacts/CR-EMERGENCY.template.md'
        : 'templates/artifacts/CR-FAST.template.md';

  const rendered = renderTemplate(bundle.files[templateName], {
    CR_ID: crId,
    CR_TITLE: options.title.trim(),
    HUM_OWNER: options.approver ?? cfg.roles['HUM-OWNER'],
    INCIDENT_ID: options.incidentId ?? 'INC-0001',
    DATE_ISO: dateIso,
    TIMESTAMP_ISO: tsIso
  });

  const parsed = parseMarkdownFrontmatter(rendered);
  if (options.classification && track !== 'EMERGENCY') {
    parsed.frontmatter.classification = options.classification.toUpperCase();
  }
  if (options.files && options.files.length > 0) {
    parsed.frontmatter.affected_files = options.files;
  }

  writeFileAtomicLf(
    absDest,
    serializeMarkdownWithFrontmatter(parsed.frontmatter, parsed.body)
  );

  return {
    ok: true,
    exitCode: 0,
    crId,
    filePath: relDest,
    track,
    message: `Created ${track} Change Request '${crId}' at ${relDest}.`
  };
}

export interface CrSummaryItem {
  id: string;
  title: string;
  track: string;
  classification: string;
  status: string;
  file: string;
  affected_files: string[];
  overdue_emergency?: boolean;
}

export function runChangeStatus(
  workspaceRootInput: string,
  now = new Date()
): {
  ok: boolean;
  exitCode: ExitCode;
  records: CrSummaryItem[];
  overlappingPairs: Array<[string, string, string]>;
} {
  const workspaceRoot = path.resolve(workspaceRootInput);
  const cfgPath = path.join(workspaceRoot, '.aisdgs', 'config.yaml');
  if (!fs.existsSync(cfgPath)) {
    return { ok: false, exitCode: 2, records: [], overlappingPairs: [] };
  }
  const cfg = parseYaml(fs.readFileSync(cfgPath, 'utf8')) as unknown as ProjectConfig;
  const maxEmergH = MAX_EMERGENCY_HOURS_BY_TIER[cfg.governance.adoption_tier];

  const records: CrSummaryItem[] = [];
  for (const f of walkFiles(path.join(workspaceRoot, 'changes', 'records'))) {
    if (!f.endsWith('.md')) continue;
    const rel = toPosixPath(path.relative(workspaceRoot, f));
    try {
      const fm = parseMarkdownFrontmatter(fs.readFileSync(f, 'utf8')).frontmatter;
      const st = String(fm.cr_status ?? 'DRAFT');
      let overdue = false;
      if (st === 'EMERGENCY_ACTIVE' && typeof fm.created_at === 'string') {
        const hrs = (now.getTime() - Date.parse(fm.created_at)) / (1000 * 60 * 60);
        overdue = hrs > maxEmergH;
      }
      records.push({
        id: String(fm.id ?? path.basename(f, '.md')),
        title: String(fm.title ?? ''),
        track: String(fm.track ?? 'FAST'),
        classification: String(fm.classification ?? ''),
        status: st,
        file: rel,
        affected_files: Array.isArray(fm.affected_files) ? (fm.affected_files as string[]) : [],
        ...(st === 'EMERGENCY_ACTIVE' ? { overdue_emergency: overdue } : {})
      });
    } catch {
      // Malformed file surfaced in validate
    }
  }

  const inProg = records.filter((r) => r.status === 'IN_PROGRESS');
  const overlappingPairs: Array<[string, string, string]> = [];
  for (let i = 0; i < inProg.length; i++) {
    for (let j = i + 1; j < inProg.length; j++) {
      const a = inProg[i];
      const b = inProg[j];
      const hit = a.affected_files.find(
        (ga) =>
          b.affected_files.includes(ga) ||
          matchesAnyGlob(ga, b.affected_files) ||
          b.affected_files.some((gb) => matchesAnyGlob(gb, [ga]))
      );
      if (hit) overlappingPairs.push([a.id, b.id, hit]);
    }
  }

  return { ok: true, exitCode: 0, records, overlappingPairs };
}

export function runChangeVerify(
  workspaceRootInput: string,
  crIdInput: string
): {
  ok: boolean;
  exitCode: ExitCode;
  crId: string;
  errors: string[];
  message: string;
} {
  const workspaceRoot = path.resolve(workspaceRootInput);
  const crId = crIdInput.toUpperCase();
  const crPath = path.join(workspaceRoot, 'changes', 'records', `${crId}.md`);
  const cfgPath = path.join(workspaceRoot, '.aisdgs', 'config.yaml');

  if (!fs.existsSync(cfgPath) || !fs.existsSync(crPath)) {
    return {
      ok: false,
      exitCode: 2,
      crId,
      errors: [`Change Request file 'changes/records/${crId}.md' not found.`],
      message: `Change Request '${crId}' not found.`
    };
  }

  const cfg = parseYaml(fs.readFileSync(cfgPath, 'utf8')) as unknown as ProjectConfig;
  const tier = cfg.governance.adoption_tier;
  const bundle = loadStandardBundle();
  const crSchema = JSON.parse(bundle.files['schemas/change-request.schema.json']) as Record<
    string,
    unknown
  >;

  const errors: string[] = [];
  const parsed = parseMarkdownFrontmatter(fs.readFileSync(crPath, 'utf8'));
  const fm = parsed.frontmatter;

  for (const e of validateJsonSchema(fm, crSchema)) {
    errors.push(`Schema ${e.path}: ${e.message}`);
  }

  const track = String(fm.track ?? 'FAST');
  const affFiles = Array.isArray(fm.affected_files) ? (fm.affected_files as string[]) : [];
  const affDocs = Array.isArray(fm.affected_docs) ? (fm.affected_docs as string[]) : [];
  const allScopeGlobs = [...new Set([...affFiles, ...affDocs])];

  // STD-006-R05 Escalation check: FAST CR in STANDARD/STRICT cannot touch dependencies or migrations
  const fullOnlyTrigger = /(?:^|\/)(?:package\.json|Cargo\.toml|go\.mod|pyproject\.toml|.*\.csproj|migrations\/)/i;
  if (track === 'FAST' && (tier === 'STANDARD' || tier === 'STRICT')) {
    const violatingGlob = allScopeGlobs.find((g) => fullOnlyTrigger.test(g));
    if (violatingGlob) {
      errors.push(
        `STD-006-R05 Track Escalation Required: FAST Change Request '${crId}' touches dependency/migration path '${violatingGlob}' in ${tier} tier. Upgrade 'track: FULL'.`
      );
    }
  }

  // Verify referenced REQ-* and ADR-* IDs exist on disk or in PROJECT-BASELINE.md
  const knownSpecIds = new Set<string>();
  const basePath = path.join(workspaceRoot, 'governance', 'PROJECT-BASELINE.md');
  if (fs.existsSync(basePath)) {
    const baseTxt = fs.readFileSync(basePath, 'utf8');
    for (const m of baseTxt.matchAll(/`(REQ-(?:FUNC|NFUNC|SEC|DATA|INT)-\d{3,4}|ADR-\d{3,4})`/g)) {
      knownSpecIds.add(m[1]);
    }
  }
  for (const sub of ['requirements', 'architecture']) {
    for (const f of walkFiles(path.join(workspaceRoot, 'docs', sub))) {
      if (!f.endsWith('.md')) continue;
      try {
        const sfm = parseMarkdownFrontmatter(fs.readFileSync(f, 'utf8')).frontmatter;
        if (typeof sfm.id === 'string') knownSpecIds.add(sfm.id);
      } catch {
        // Ignored
      }
    }
  }

  for (const field of ['affected_requirements', 'affected_adrs']) {
    if (Array.isArray(fm[field])) {
      for (const refId of fm[field] as string[]) {
        if (!knownSpecIds.has(refId)) {
          errors.push(`STD-004-R04 Dangling Reference: '${refId}' in '${field}' does not exist.`);
        }
      }
    }
  }

  // STD-006-R02 Git working-tree scope containment check
  if (isGitRepository(workspaceRoot)) {
    const dirty = getWorkingTreeChangedFiles(workspaceRoot).filter(
      (f) => !f.startsWith('changes/') && !f.startsWith('quality/reports/')
    );
    for (const modFile of dirty) {
      if (!matchesAnyGlob(modFile, allScopeGlobs)) {
        errors.push(
          `STD-006-R02 Scope Containment Violation: Modified file '${modFile}' is outside ${crId} authorized affected_files/affected_docs scope.`
        );
      }
      if (track === 'FAST' && (tier === 'STANDARD' || tier === 'STRICT') && fullOnlyTrigger.test(modFile)) {
        errors.push(
          `STD-006-R05 Escalation Violation: Working tree modified '${modFile}' under FAST CR '${crId}'. Upgrade to FULL track.`
        );
      }
    }
  }

  return {
    ok: errors.length === 0,
    exitCode: errors.length === 0 ? 0 : 1,
    crId,
    errors,
    message:
      errors.length === 0
        ? `Change Request '${crId}' (${track}) passed schema, reference, and scope-containment verification.`
        : `Change Request '${crId}' failed verification with ${errors.length} error(s).`
  };
}
