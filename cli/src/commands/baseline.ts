import fs from 'node:fs';
import path from 'node:path';
import { AI_NAME_GUARD } from '../core/constants.ts';
import { sha256FileLf, toPosixPath, walkFiles, writeFileAtomicLf } from '../core/crypto-fs.ts';
import type { BaselineArtifactEntry, ExitCode } from '../core/types.ts';
import { runValidation } from '../core/validator.ts';
import {
  parseMarkdownFrontmatter,
  serializeMarkdownWithFrontmatter
} from '../core/yaml-frontmatter.ts';

function bumpSemver(ver: string, level: 'major' | 'minor' | 'patch'): string {
  const parts = ver.split('.').map((n) => Number.parseInt(n, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return '1.0.0';
  if (level === 'major') return `${parts[0] + 1}.0.0`;
  if (level === 'minor') return `${parts[0]}.${parts[1] + 1}.0`;
  return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
}

/**
 * Discovers all candidate artifacts eligible for baseline SHA256-UTF8-LF locking (STD-005-R04, DEC-014).
 */
export function collectCandidateBaselineArtifacts(workspaceRoot: string): BaselineArtifactEntry[] {
  const candidates: BaselineArtifactEntry[] = [];

  const addFile = (relPath: string, kind: string, id?: string, version?: string): void => {
    const abs = path.join(workspaceRoot, relPath);
    if (!fs.existsSync(abs)) return;
    candidates.push({
      path: toPosixPath(relPath),
      ...(id ? { id } : {}),
      ...(version ? { version } : {}),
      kind,
      sha256: sha256FileLf(abs)
    });
  };

  addFile('.aisdgs/config.yaml', 'CONFIG', 'CFG-001', '1.0.0');
  addFile('.aisdgs/adoption-profile.yaml', 'CONFIG', 'PROFILE-001', '1.0.0');

  const constPath = path.join(workspaceRoot, 'governance', 'PROJECT-CONSTITUTION.md');
  if (fs.existsSync(constPath)) {
    const fm = parseMarkdownFrontmatter(fs.readFileSync(constPath, 'utf8')).frontmatter;
    addFile(
      'governance/PROJECT-CONSTITUTION.md',
      'CONSTITUTION',
      String(fm.id ?? 'CONST-001'),
      String(fm.version ?? '1.0.0')
    );
  }

  const excPath = path.join(workspaceRoot, 'governance', 'EXCEPTIONS.md');
  if (fs.existsSync(excPath)) {
    const fm = parseMarkdownFrontmatter(fs.readFileSync(excPath, 'utf8')).frontmatter;
    addFile(
      'governance/EXCEPTIONS.md',
      'CONSTITUTION',
      String(fm.id ?? 'EXCEPTIONS-001'),
      String(fm.version ?? '1.0.0')
    );
  }

  for (const sub of ['requirements', 'architecture', 'contracts']) {
    const absDir = path.join(workspaceRoot, 'docs', sub);
    for (const f of walkFiles(absDir)) {
      const rel = toPosixPath(path.relative(workspaceRoot, f));
      if (f.endsWith('.md')) {
        try {
          const fm = parseMarkdownFrontmatter(fs.readFileSync(f, 'utf8')).frontmatter;
          if (fm.status === 'APPROVED') {
            const kind =
              sub === 'requirements'
                ? 'REQUIREMENT'
                : sub === 'architecture'
                  ? 'ADR'
                  : 'CONTRACT_MD';
            addFile(rel, kind, String(fm.id ?? ''), String(fm.version ?? '1.0.0'));
          }
        } catch {
          // Invalid frontmatter caught in validator
        }
      } else {
        // Native contract schema delegation (DEC-014: openapi.yaml, .proto, .sql, .graphql, .json)
        addFile(rel, 'CONTRACT_NATIVE');
      }
    }
  }

  return candidates.sort((a, b) => a.path.localeCompare(b.path));
}

export function runBaselineStatus(workspaceRootInput: string): {
  ok: boolean;
  exitCode: ExitCode;
  state: string;
  version: string;
  approvedBy: string;
  lockedAt: string;
  artifacts: BaselineArtifactEntry[];
} {
  const workspaceRoot = path.resolve(workspaceRootInput);
  const baselinePath = path.join(workspaceRoot, 'governance', 'PROJECT-BASELINE.md');
  if (!fs.existsSync(baselinePath)) {
    return {
      ok: false,
      exitCode: 2,
      state: 'UNINITIALIZED',
      version: '0.0.0',
      approvedBy: '',
      lockedAt: '',
      artifacts: []
    };
  }
  const fm = parseMarkdownFrontmatter(fs.readFileSync(baselinePath, 'utf8')).frontmatter;
  return {
    ok: true,
    exitCode: 0,
    state: String(fm.baseline_state ?? 'UNINITIALIZED'),
    version: String(fm.baseline_version ?? '0.1.0'),
    approvedBy: String(fm.approved_by ?? ''),
    lockedAt: String(fm.locked_at ?? ''),
    artifacts: (Array.isArray(fm.artifacts) ? fm.artifacts : []) as BaselineArtifactEntry[]
  };
}

export function runBaselineDiff(workspaceRootInput: string): {
  ok: boolean;
  exitCode: ExitCode;
  added: string[];
  modified: string[];
  removed: string[];
} {
  const workspaceRoot = path.resolve(workspaceRootInput);
  const status = runBaselineStatus(workspaceRoot);
  if (!status.ok) {
    return { ok: false, exitCode: 2, added: [], modified: [], removed: [] };
  }

  const currentCandidates = collectCandidateBaselineArtifacts(workspaceRoot);
  const lockedMap = new Map(status.artifacts.map((a) => [a.path, a.sha256]));
  const currentMap = new Map(currentCandidates.map((c) => [c.path, c.sha256]));

  const added: string[] = [];
  const modified: string[] = [];
  const removed: string[] = [];

  for (const [p, sha] of currentMap.entries()) {
    if (!lockedMap.has(p)) added.push(p);
    else if (lockedMap.get(p) !== sha) modified.push(p);
  }
  for (const p of lockedMap.keys()) {
    if (!currentMap.has(p)) removed.push(p);
  }

  return { ok: true, exitCode: 0, added, modified, removed };
}

export function runBaselineVerify(workspaceRootInput: string): {
  ok: boolean;
  exitCode: ExitCode;
  state: string;
  drifted: string[];
  messages: string[];
} {
  const workspaceRoot = path.resolve(workspaceRootInput);
  const status = runBaselineStatus(workspaceRoot);
  if (!status.ok) {
    return {
      ok: false,
      exitCode: 2,
      state: 'UNINITIALIZED',
      drifted: [],
      messages: ['governance/PROJECT-BASELINE.md not found.']
    };
  }
  if (status.state === 'UNINITIALIZED') {
    return {
      ok: false,
      exitCode: 1,
      state: 'UNINITIALIZED',
      drifted: [],
      messages: ["Project baseline is UNINITIALIZED. Approve specs and run 'aisdgs baseline lock --approver <human>'."]
    };
  }

  const drifted: string[] = [];
  const messages: string[] = [];
  for (const art of status.artifacts) {
    const abs = path.join(workspaceRoot, art.path);
    if (!fs.existsSync(abs)) {
      drifted.push(art.path);
      messages.push(`Deleted baseline artifact: ${art.path}`);
    } else {
      const actual = sha256FileLf(abs);
      if (actual !== art.sha256) {
        drifted.push(art.path);
        messages.push(`Hash mismatch on '${art.path}' (expected ${art.sha256.slice(0, 12)}..., got ${actual.slice(0, 12)}...).`);
      }
    }
  }

  // Also check Ring 2 spoofing / integrity errors from validator
  const valReport = runValidation(workspaceRoot);
  if (valReport.exit_code === 3) {
    return {
      ok: false,
      exitCode: 3,
      state: 'INTEGRITY_COMPROMISED',
      drifted,
      messages: valReport.diagnostics.map((d) => d.message)
    };
  }

  if (drifted.length > 0) {
    return {
      ok: false,
      exitCode: 1,
      state: 'DRIFT_DETECTED',
      drifted,
      messages
    };
  }

  return {
    ok: true,
    exitCode: 0,
    state: status.state,
    drifted: [],
    messages: [`Verified ${status.artifacts.length} locked artifact(s) in ${status.state} baseline v${status.version}.`]
  };
}

export interface BaselineLockOptions {
  approver: string;
  anchor?: boolean;
  bump?: 'major' | 'minor' | 'patch';
  crId?: string;
  now?: Date;
}

export function runBaselineLock(
  workspaceRootInput: string,
  options: BaselineLockOptions
): {
  ok: boolean;
  exitCode: ExitCode;
  baselineVersion: string;
  baselineState: string;
  lockedCount: number;
  message: string;
} {
  const workspaceRoot = path.resolve(workspaceRootInput);
  const approver = (options.approver ?? '').trim();
  if (approver.length < 2 || AI_NAME_GUARD.test(approver)) {
    return {
      ok: false,
      exitCode: 1,
      baselineVersion: '',
      baselineState: '',
      lockedCount: 0,
      message: "STD-001-R02 Violation: '--approver' is mandatory and must be a valid Human Authority identity (AI agent names are forbidden)."
    };
  }

  const baselinePath = path.join(workspaceRoot, 'governance', 'PROJECT-BASELINE.md');
  const constPath = path.join(workspaceRoot, 'governance', 'PROJECT-CONSTITUTION.md');
  if (!fs.existsSync(baselinePath) || !fs.existsSync(constPath)) {
    return {
      ok: false,
      exitCode: 2,
      baselineVersion: '',
      baselineState: '',
      lockedCount: 0,
      message: 'Workspace governance files missing. Run aisdgs init first.'
    };
  }

  const now = options.now ?? new Date();
  const dateIso = now.toISOString().slice(0, 10);
  const tsIso = now.toISOString();

  // Promote PROJECT-CONSTITUTION.md from DRAFT to APPROVED when human explicitly locks baseline
  const parsedConst = parseMarkdownFrontmatter(fs.readFileSync(constPath, 'utf8'));
  if (parsedConst.frontmatter.status === 'DRAFT' || parsedConst.frontmatter.status === 'IN_REVIEW') {
    parsedConst.frontmatter.status = 'APPROVED';
    parsedConst.frontmatter.approved_by = approver;
    parsedConst.frontmatter.last_updated = dateIso;
    writeFileAtomicLf(
      constPath,
      serializeMarkdownWithFrontmatter(parsedConst.frontmatter, parsedConst.body)
    );
  }

  // On initial lock, also promote starter DRAFT ADR-001 / REQ-FUNC-001 if clean (zero TODOs)
  for (const sub of ['requirements', 'architecture']) {
    for (const f of walkFiles(path.join(workspaceRoot, 'docs', sub))) {
      if (!f.endsWith('.md')) continue;
      const pm = parseMarkdownFrontmatter(fs.readFileSync(f, 'utf8'));
      if (pm.frontmatter.status === 'DRAFT' && !/\b(TODO|TBD)\b/.test(pm.body)) {
        pm.frontmatter.status = 'APPROVED';
        pm.frontmatter.approved_by = approver;
        pm.frontmatter.last_updated = dateIso;
        writeFileAtomicLf(f, serializeMarkdownWithFrontmatter(pm.frontmatter, pm.body));
      }
    }
  }

  const parsedBase = parseMarkdownFrontmatter(fs.readFileSync(baselinePath, 'utf8'));
  const prevState = String(parsedBase.frontmatter.baseline_state ?? 'UNINITIALIZED');
  const prevVer = String(parsedBase.frontmatter.baseline_version ?? '0.1.0');
  const nextVer =
    prevState === 'UNINITIALIZED' && !options.bump
      ? '1.0.0'
      : bumpSemver(prevVer, options.bump ?? 'minor');
  const nextState = options.anchor ? 'ANCHORED' : 'LOCKED';

  const artifacts = collectCandidateBaselineArtifacts(workspaceRoot);

  const updatedFm: Record<string, unknown> = {
    id: 'BASELINE-001',
    title: String(parsedBase.frontmatter.title ?? 'Approved Project Baseline Manifest'),
    version: nextVer,
    status: 'APPROVED',
    artifact_class: 'CONSTITUTIONAL',
    baseline_version: nextVer,
    baseline_state: nextState,
    hash_normalization: 'SHA256-UTF8-LF',
    approved_by: approver,
    locked_at: tsIso,
    last_updated: dateIso,
    artifacts
  };

  writeFileAtomicLf(
    baselinePath,
    serializeMarkdownWithFrontmatter(updatedFm, parsedBase.body)
  );

  // Append audit event to CHANGELOG-GOVERNANCE.md (STD-005-R08)
  const changelogPath = path.join(workspaceRoot, 'changes', 'CHANGELOG-GOVERNANCE.md');
  if (fs.existsSync(changelogPath)) {
    const refId = options.crId ?? 'STD-005';
    const row = `| \`${dateIso}\` | \`BASELINE_LOCK\` | \`${refId}\` | \`${nextVer}\` | \`${approver}\` | Locked ${artifacts.length} artifact(s) in \`${nextState}\` state. |\n`;
    const curLog = fs.readFileSync(changelogPath, 'utf8').trimEnd() + '\n' + row;
    writeFileAtomicLf(changelogPath, curLog);
  }

  // Run validation check to guarantee the newly locked baseline is 100% compliant
  const check = runValidation(workspaceRoot, { now });
  if (!check.ok) {
    return {
      ok: false,
      exitCode: check.exit_code,
      baselineVersion: nextVer,
      baselineState: nextState,
      lockedCount: artifacts.length,
      message: `Baseline manifest written, but validation reported ${check.summary.errors} error(s): ${check.diagnostics[0]?.message ?? ''}`
    };
  }

  return {
    ok: true,
    exitCode: 0,
    baselineVersion: nextVer,
    baselineState: nextState,
    lockedCount: artifacts.length,
    message: `Locked baseline v${nextVer} (${nextState}) with ${artifacts.length} SHA256-UTF8-LF artifact digest(s) approved by '${approver}'.`
  };
}
