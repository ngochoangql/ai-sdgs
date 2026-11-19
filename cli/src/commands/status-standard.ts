import fs from 'node:fs';
import path from 'node:path';
import { MAX_EMERGENCY_HOURS_BY_TIER } from '../core/constants.ts';
import { sha256FileLf, toPosixPath, walkFiles } from '../core/crypto-fs.ts';
import type { ExitCode, ProjectConfig, StandardLockfile } from '../core/types.ts';
import { parseMarkdownFrontmatter, parseYaml } from '../core/yaml-frontmatter.ts';

export interface StatusSnapshot {
  ok: boolean;
  exitCode: ExitCode;
  project_id: string;
  project_name: string;
  adoption_tier: string;
  onboarding_mode: string;
  standard_version: string;
  lockfile_intact: boolean;
  baseline_state: string;
  baseline_version: string;
  baseline_artifacts_count: number;
  active_crs: Array<{ id: string; track: string; status: string; remaining_emergency_hours?: number }>;
  active_waivers_count: number;
  hooks_installed: { preCommit: boolean; prePush: boolean };
}

export function verifyLockOnly(workspaceRootInput: string): {
  ok: boolean;
  exitCode: ExitCode;
  standardVersion: string;
  checkedCount: number;
  failures: string[];
} {
  const workspaceRoot = path.resolve(workspaceRootInput);
  const lockPath = path.join(workspaceRoot, '.aisdgs', 'standard-lock.yaml');
  if (!fs.existsSync(lockPath)) {
    return {
      ok: false,
      exitCode: 2,
      standardVersion: '',
      checkedCount: 0,
      failures: ['Missing .aisdgs/standard-lock.yaml.']
    };
  }

  let lock: StandardLockfile;
  try {
    lock = parseYaml(fs.readFileSync(lockPath, 'utf8')) as unknown as StandardLockfile;
  } catch (err) {
    return {
      ok: false,
      exitCode: 3,
      standardVersion: '',
      checkedCount: 0,
      failures: [`Corrupted standard-lock.yaml: ${(err as Error).message}`]
    };
  }

  const failures: string[] = [];
  const recorded = new Set<string>();
  for (const item of lock.files ?? []) {
    recorded.add(item.path);
    const abs = path.join(workspaceRoot, item.path);
    if (!fs.existsSync(abs)) {
      failures.push(`Missing pinned file: ${item.path}`);
    } else {
      const actual = sha256FileLf(abs);
      if (actual !== item.sha256) {
        failures.push(`Modified pinned file: ${item.path}`);
      }
    }
  }

  for (const sub of ['standard', 'schemas', 'policies']) {
    const dir = path.join(workspaceRoot, '.aisdgs', sub);
    for (const f of walkFiles(dir)) {
      const rel = toPosixPath(path.relative(workspaceRoot, f));
      if (!recorded.has(rel)) {
        failures.push(`Unrecorded file injected into snapshot: ${rel}`);
      }
    }
  }

  return {
    ok: failures.length === 0,
    exitCode: failures.length === 0 ? 0 : 3,
    standardVersion: lock.standard_version,
    checkedCount: recorded.size,
    failures
  };
}

export function runStatus(workspaceRootInput: string, now = new Date()): StatusSnapshot {
  const workspaceRoot = path.resolve(workspaceRootInput);
  const configPath = path.join(workspaceRoot, '.aisdgs', 'config.yaml');
  if (!fs.existsSync(configPath)) {
    return {
      ok: false,
      exitCode: 2,
      project_id: '',
      project_name: '',
      adoption_tier: '',
      onboarding_mode: '',
      standard_version: '',
      lockfile_intact: false,
      baseline_state: 'UNINITIALIZED',
      baseline_version: '0.0.0',
      baseline_artifacts_count: 0,
      active_crs: [],
      active_waivers_count: 0,
      hooks_installed: { preCommit: false, prePush: false }
    };
  }

  const cfg = parseYaml(fs.readFileSync(configPath, 'utf8')) as unknown as ProjectConfig;
  const lockCheck = verifyLockOnly(workspaceRoot);

  let baselineState = 'UNINITIALIZED';
  let baselineVersion = '0.0.0';
  let baselineArtifactsCount = 0;
  const baselinePath = path.join(workspaceRoot, 'governance', 'PROJECT-BASELINE.md');
  if (fs.existsSync(baselinePath)) {
    try {
      const bm = parseMarkdownFrontmatter(fs.readFileSync(baselinePath, 'utf8')).frontmatter;
      baselineState = String(bm.baseline_state ?? 'UNINITIALIZED');
      baselineVersion = String(bm.baseline_version ?? '0.1.0');
      baselineArtifactsCount = Array.isArray(bm.artifacts) ? bm.artifacts.length : 0;
    } catch {
      baselineState = 'DRIFT_DETECTED';
    }
  }

  const activeCrs: StatusSnapshot['active_crs'] = [];
  const crDir = path.join(workspaceRoot, 'changes', 'records');
  for (const crFile of walkFiles(crDir)) {
    if (!crFile.endsWith('.md')) continue;
    try {
      const fm = parseMarkdownFrontmatter(fs.readFileSync(crFile, 'utf8')).frontmatter;
      const st = String(fm.cr_status ?? '');
      if (st && st !== 'CLOSED' && st !== 'REJECTED') {
        const entry: StatusSnapshot['active_crs'][number] = {
          id: String(fm.id ?? path.basename(crFile, '.md')),
          track: String(fm.track ?? 'FAST'),
          status: st
        };
        if (st === 'EMERGENCY_ACTIVE' && typeof fm.created_at === 'string') {
          const maxH = MAX_EMERGENCY_HOURS_BY_TIER[cfg.governance.adoption_tier];
          const elapsed = (now.getTime() - Date.parse(fm.created_at)) / (1000 * 60 * 60);
          entry.remaining_emergency_hours = Number((maxH - elapsed).toFixed(1));
        }
        activeCrs.push(entry);
      }
    } catch {
      // Validator reports parse errors
    }
  }

  let activeWaivers = 0;
  const excPath = path.join(workspaceRoot, 'governance', 'EXCEPTIONS.md');
  if (fs.existsSync(excPath)) {
    try {
      const fm = parseMarkdownFrontmatter(fs.readFileSync(excPath, 'utf8')).frontmatter;
      if (Array.isArray(fm.waivers)) {
        activeWaivers = (fm.waivers as Array<Record<string, unknown>>).filter(
          (w) => w.status === 'ACTIVE'
        ).length;
      }
    } catch {
      // Ignored in status snapshot
    }
  }

  const preCommitPath = path.join(workspaceRoot, '.git', 'hooks', 'pre-commit');
  const prePushPath = path.join(workspaceRoot, '.git', 'hooks', 'pre-push');
  const hasMarker = (p: string) =>
    fs.existsSync(p) && fs.readFileSync(p, 'utf8').includes('# AI-SDGS-HOOK');

  return {
    ok: true,
    exitCode: 0,
    project_id: cfg.project.id,
    project_name: cfg.project.name,
    adoption_tier: cfg.governance.adoption_tier,
    onboarding_mode: cfg.governance.onboarding_mode,
    standard_version: cfg.governance.standard_version,
    lockfile_intact: lockCheck.ok,
    baseline_state: baselineState,
    baseline_version: baselineVersion,
    baseline_artifacts_count: baselineArtifactsCount,
    active_crs: activeCrs,
    active_waivers_count: activeWaivers,
    hooks_installed: {
      preCommit: hasMarker(preCommitPath),
      prePush: hasMarker(prePushPath)
    }
  };
}

export function runStandardList(workspaceRootInput: string): {
  ok: boolean;
  exitCode: ExitCode;
  standards: Array<{ id: string; title: string; domain: string; version: string; applicability: string }>;
} {
  const workspaceRoot = path.resolve(workspaceRootInput);
  const stdDir = path.join(workspaceRoot, '.aisdgs', 'standard');
  if (!fs.existsSync(stdDir)) {
    return { ok: false, exitCode: 2, standards: [] };
  }

  const applicabilityMap = new Map<string, string>();
  const profPath = path.join(workspaceRoot, '.aisdgs', 'adoption-profile.yaml');
  if (fs.existsSync(profPath)) {
    try {
      const prof = parseYaml(fs.readFileSync(profPath, 'utf8'));
      if (Array.isArray(prof.standards)) {
        for (const s of prof.standards as Array<Record<string, unknown>>) {
          if (typeof s.id === 'string' && typeof s.applicability === 'string') {
            applicabilityMap.set(s.id, s.applicability);
          }
        }
      }
    } catch {
      // Fallback to MANDATORY
    }
  }

  const list: Array<{ id: string; title: string; domain: string; version: string; applicability: string }> = [];
  for (const f of walkFiles(stdDir)) {
    if (!f.endsWith('.md')) continue;
    const fm = parseMarkdownFrontmatter(fs.readFileSync(f, 'utf8')).frontmatter;
    const id = String(fm.id ?? path.basename(f, '.md'));
    list.push({
      id,
      title: String(fm.title ?? ''),
      domain: String(fm.domain ?? ''),
      version: String(fm.version ?? '1.0.0'),
      applicability: applicabilityMap.get(id) ?? 'MANDATORY'
    });
  }
  return { ok: true, exitCode: 0, standards: list };
}

export function runStandardShow(
  workspaceRootInput: string,
  stdId: string,
  ruleId?: string
): { ok: boolean; exitCode: ExitCode; content: string } {
  const workspaceRoot = path.resolve(workspaceRootInput);
  const normalizedId = stdId.toUpperCase();
  const targetFile = path.join(workspaceRoot, '.aisdgs', 'standard', `${normalizedId}.md`);
  if (!fs.existsSync(targetFile)) {
    return {
      ok: false,
      exitCode: 2,
      content: `Standard '${normalizedId}' not found in .aisdgs/standard/.`
    };
  }
  const fullText = fs.readFileSync(targetFile, 'utf8');
  if (!ruleId) {
    return { ok: true, exitCode: 0, content: fullText };
  }
  const upperRule = ruleId.toUpperCase();
  const matchLine = fullText
    .split('\n')
    .find((l) => l.includes(`\`${upperRule}\``));
  if (!matchLine) {
    return {
      ok: false,
      exitCode: 2,
      content: `Rule '${upperRule}' not found inside '${normalizedId}'.`
    };
  }
  return { ok: true, exitCode: 0, content: matchLine.trim() };
}
