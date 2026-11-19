import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadStandardBundle } from '../core/bundle.ts';
import { AI_NAME_GUARD } from '../core/constants.ts';
import {
  assertUpdateWriteBarrier,
  sha256FileLf,
  sha256Lf,
  toPosixPath,
  writeFileAtomicLf
} from '../core/crypto-fs.ts';
import type { AdoptionTier, ExitCode, ProjectConfig, StandardLockfile } from '../core/types.ts';
import { parseYaml, stringifyYaml } from '../core/yaml-frontmatter.ts';
import { runAdapterSync } from './adapter.ts';

const HOOK_START = '# >>> AI-SDGS-HOOK START >>>';
const HOOK_END = '# <<< AI-SDGS-HOOK END <<<';

function resolveCliBinScriptPosix(): string {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const candidateBin = path.resolve(__dirname, '../../bin/aisdgs.mjs');
  if (fs.existsSync(candidateBin)) {
    return candidateBin.replace(/\\/g, '/');
  }
  const currentModulePath = fileURLToPath(import.meta.url);
  return path.resolve(currentModulePath).replace(/\\/g, '/');
}

function buildHookBlock(kind: 'pre-commit' | 'pre-push', cliBinPosix: string): string {
  const cmdLine =
    kind === 'pre-commit'
      ? `if command -v aisdgs >/dev/null 2>&1; then aisdgs validate; else node "${cliBinPosix}" validate; fi`
      : `if command -v aisdgs >/dev/null 2>&1; then aisdgs validate && aisdgs baseline verify; else node "${cliBinPosix}" validate && node "${cliBinPosix}" baseline verify; fi`;

  return `${HOOK_START}
# Managed by AI-SDGS (STD-009-R08) — Do not bypass with --no-verify (STD-009-R02)
${cmdLine}
aisdgs_rc=$?
if [ $aisdgs_rc -ne 0 ]; then
  echo "[AI-SDGS] ${kind} blocked (exit code $aisdgs_rc). Resolve governance diagnostics before proceeding." >&2
  exit $aisdgs_rc
fi
${HOOK_END}`;
}

export function runHooksCommand(
  workspaceRootInput: string,
  action: 'install' | 'uninstall' | 'status'
): {
  ok: boolean;
  exitCode: ExitCode;
  preCommit: boolean;
  prePush: boolean;
  message: string;
} {
  const workspaceRoot = path.resolve(workspaceRootInput);
  const gitHooksDir = path.join(workspaceRoot, '.git', 'hooks');
  if (!fs.existsSync(path.join(workspaceRoot, '.git'))) {
    return {
      ok: false,
      exitCode: 2,
      preCommit: false,
      prePush: false,
      message: "Target workspace does not contain a '.git' directory. Initialize Git ('git init') first."
    };
  }

  fs.mkdirSync(gitHooksDir, { recursive: true });
  const preCommitPath = path.join(gitHooksDir, 'pre-commit');
  const prePushPath = path.join(gitHooksDir, 'pre-push');

  const hasBlock = (p: string) =>
    fs.existsSync(p) && fs.readFileSync(p, 'utf8').includes(HOOK_START);

  if (action === 'status') {
    const pc = hasBlock(preCommitPath);
    const pp = hasBlock(prePushPath);
    return {
      ok: true,
      exitCode: 0,
      preCommit: pc,
      prePush: pp,
      message: `Git hooks status: pre-commit=${pc ? 'INSTALLED' : 'NOT_INSTALLED'}, pre-push=${pp ? 'INSTALLED' : 'NOT_INSTALLED'}.`
    };
  }

  const stripBlock = (text: string): string => {
    const startIdx = text.indexOf(HOOK_START);
    const endIdx = text.indexOf(HOOK_END);
    if (startIdx === -1 || endIdx === -1) return text;
    return (text.slice(0, startIdx) + text.slice(endIdx + HOOK_END.length)).trim();
  };

  if (action === 'uninstall') {
    for (const hp of [preCommitPath, prePushPath]) {
      if (!fs.existsSync(hp)) continue;
      const stripped = stripBlock(fs.readFileSync(hp, 'utf8'));
      if (stripped === '' || stripped === '#!/bin/sh') {
        fs.rmSync(hp, { force: true });
      } else {
        writeFileAtomicLf(hp, stripped + '\n');
      }
    }
    return {
      ok: true,
      exitCode: 0,
      preCommit: false,
      prePush: false,
      message: 'Uninstalled AI-SDGS Git pre-commit and pre-push hooks cleanly.'
    };
  }

  // Install non-destructively (preserving any existing user hook content)
  const cliBinPosix = resolveCliBinScriptPosix();
  for (const [hp, kind] of [
    [preCommitPath, 'pre-commit'],
    [prePushPath, 'pre-push']
  ] as const) {
    let base = '#!/bin/sh\n';
    if (fs.existsSync(hp)) {
      const cleaned = stripBlock(fs.readFileSync(hp, 'utf8'));
      base = cleaned.startsWith('#!') ? cleaned + '\n\n' : `#!/bin/sh\n\n${cleaned}\n\n`;
    }
    const fullHook = `${base.trimEnd()}\n\n${buildHookBlock(kind, cliBinPosix)}\n`;
    writeFileAtomicLf(hp, fullHook);
    try {
      fs.chmodSync(hp, 0o755);
    } catch {
      // No-op on Windows NTFS
    }
  }

  return {
    ok: true,
    exitCode: 0,
    preCommit: true,
    prePush: true,
    message: 'Installed AI-SDGS pre-commit and pre-push enforcement hooks.'
  };
}

export interface UpdatePlanResult {
  ok: boolean;
  exitCode: ExitCode;
  currentVersion: string;
  targetVersion: string;
  updateAvailable: boolean;
  changedStandardFiles: string[];
  addedStandardFiles: string[];
  tierPromotionChecklist: string[];
  message: string;
}

export function runUpdatePlanOrCheck(
  workspaceRootInput: string,
  options: { bundleDir?: string; promoteTier?: AdoptionTier } = {}
): UpdatePlanResult {
  const workspaceRoot = path.resolve(workspaceRootInput);
  const lockPath = path.join(workspaceRoot, '.aisdgs', 'standard-lock.yaml');
  const cfgPath = path.join(workspaceRoot, '.aisdgs', 'config.yaml');
  if (!fs.existsSync(lockPath) || !fs.existsSync(cfgPath)) {
    return {
      ok: false,
      exitCode: 2,
      currentVersion: '',
      targetVersion: '',
      updateAvailable: false,
      changedStandardFiles: [],
      addedStandardFiles: [],
      tierPromotionChecklist: [],
      message: 'Workspace is not initialized.'
    };
  }

  const lock = parseYaml(fs.readFileSync(lockPath, 'utf8')) as unknown as StandardLockfile;
  const cfg = parseYaml(fs.readFileSync(cfgPath, 'utf8')) as unknown as ProjectConfig;
  const bundle = loadStandardBundle(options.bundleDir);

  const lockedShas = new Map(lock.files.map((f) => [f.path, f.sha256]));
  const changedStandardFiles: string[] = [];
  const addedStandardFiles: string[] = [];

  for (const [rel, content] of Object.entries(bundle.files)) {
    if (rel.startsWith('standard/') || rel.startsWith('schemas/') || rel.startsWith('policies/')) {
      const targetRel = `.aisdgs/${rel}`;
      const newSha = sha256Lf(content);
      if (!lockedShas.has(targetRel)) {
        addedStandardFiles.push(targetRel);
      } else if (lockedShas.get(targetRel) !== newSha) {
        changedStandardFiles.push(targetRel);
      }
    }
  }

  const tierPromotionChecklist: string[] = [];
  if (options.promoteTier && options.promoteTier !== cfg.governance.adoption_tier) {
    if (options.promoteTier === 'STANDARD' || options.promoteTier === 'STRICT') {
      if (!fs.existsSync(path.join(workspaceRoot, 'governance/EXCEPTIONS.md'))) {
        tierPromotionChecklist.push('Create governance/EXCEPTIONS.md (mandatory in STANDARD/STRICT).');
      }
      if (!fs.existsSync(path.join(workspaceRoot, 'docs/requirements'))) {
        tierPromotionChecklist.push('Extract inline requirements into discrete docs/requirements/REQ-*.md files.');
      }
      if (!fs.existsSync(path.join(workspaceRoot, 'docs/architecture'))) {
        tierPromotionChecklist.push('Create discrete docs/architecture/ADR-*.md records.');
      }
    }
    if (options.promoteTier === 'STRICT') {
      tierPromotionChecklist.push(
        'Assign explicit HUM-OWNER, HUM-PROD, HUM-ARCH, and HUM-SEC identities in .aisdgs/config.yaml.'
      );
      tierPromotionChecklist.push('Enable strict_validation: true and enforce CI branch-protection gate.');
    }
  }

  const updateAvailable =
    lock.standard_version !== bundle.standardVersion ||
    changedStandardFiles.length > 0 ||
    addedStandardFiles.length > 0;

  return {
    ok: true,
    exitCode: 0,
    currentVersion: lock.standard_version,
    targetVersion: bundle.standardVersion,
    updateAvailable,
    changedStandardFiles,
    addedStandardFiles,
    tierPromotionChecklist,
    message: updateAvailable
      ? `Upgrade plan ready (${lock.standard_version} -> ${bundle.standardVersion}): ${changedStandardFiles.length} modified, ${addedStandardFiles.length} added Level 1 files. Project governance/ and docs/ will NOT be touched.`
      : `Installed standard snapshot v${lock.standard_version} is already up to date.`
  };
}

export function runUpdateApply(
  workspaceRootInput: string,
  options: { bundleDir?: string; approver: string }
): {
  ok: boolean;
  exitCode: ExitCode;
  standardVersion: string;
  updatedCount: number;
  message: string;
} {
  const workspaceRoot = path.resolve(workspaceRootInput);
  const approver = (options.approver ?? '').trim();
  if (approver.length < 2 || AI_NAME_GUARD.test(approver)) {
    return {
      ok: false,
      exitCode: 1,
      standardVersion: '',
      updatedCount: 0,
      message: "STD-007-R07 Violation: '--approver <human>' is mandatory to apply a standard snapshot update."
    };
  }

  const cfgPath = path.join(workspaceRoot, '.aisdgs', 'config.yaml');
  if (!fs.existsSync(cfgPath)) {
    return {
      ok: false,
      exitCode: 2,
      standardVersion: '',
      updatedCount: 0,
      message: 'Workspace is not initialized.'
    };
  }

  const bundle = loadStandardBundle(options.bundleDir);
  const now = new Date();
  const dateIso = now.toISOString().slice(0, 10);
  const tsIso = now.toISOString();

  const lockEntries: Array<{ path: string; category: string; sha256: string }> = [];
  let updatedCount = 0;

  for (const [rel, content] of Object.entries(bundle.files)) {
    if (rel.startsWith('standard/') || rel.startsWith('schemas/') || rel.startsWith('policies/')) {
      const targetRel = `.aisdgs/${rel}`;
      const absDest = path.join(workspaceRoot, targetRel);
      // Enforce hard Level 1 write-barrier (STD-007-R07)
      assertUpdateWriteBarrier(workspaceRoot, absDest, false);
      const newSha = sha256Lf(content);
      const changed = !fs.existsSync(absDest) || sha256FileLf(absDest) !== newSha;
      if (changed) {
        writeFileAtomicLf(absDest, content);
        updatedCount++;
      }
      const category = rel.startsWith('standard/')
        ? 'STANDARD'
        : rel.startsWith('schemas/')
          ? 'SCHEMA'
          : 'POLICY';
      lockEntries.push({ path: toPosixPath(targetRel), category, sha256: newSha });
    }
  }

  const lockPath = path.join(workspaceRoot, '.aisdgs', 'standard-lock.yaml');
  assertUpdateWriteBarrier(workspaceRoot, lockPath, false);
  writeFileAtomicLf(
    lockPath,
    stringifyYaml({
      lockfile_version: 1,
      standard_version: bundle.standardVersion,
      release_id: bundle.releaseId,
      hash_normalization: 'SHA256-UTF8-LF',
      installed_at: tsIso,
      files: lockEntries
    })
  );

  // Update standard_version in .aisdgs/config.yaml & re-sync adapters
  const cfg = parseYaml(fs.readFileSync(cfgPath, 'utf8')) as unknown as ProjectConfig;
  cfg.governance.standard_version = bundle.standardVersion;
  writeFileAtomicLf(cfgPath, stringifyYaml(cfg as unknown as Record<string, unknown>));
  runAdapterSync(workspaceRoot);

  const changelogPath = path.join(workspaceRoot, 'changes', 'CHANGELOG-GOVERNANCE.md');
  if (fs.existsSync(changelogPath)) {
    const row = `| \`${dateIso}\` | \`STANDARD_UPDATE\` | \`STD-007\` | \`-\` | \`${approver}\` | Updated local Level 1 snapshot to \`v${bundle.standardVersion}\` (${updatedCount} file(s) changed). |\n`;
    writeFileAtomicLf(changelogPath, fs.readFileSync(changelogPath, 'utf8').trimEnd() + '\n' + row);
  }

  return {
    ok: true,
    exitCode: 0,
    standardVersion: bundle.standardVersion,
    updatedCount,
    message: `Applied safe Level 1 snapshot update to v${bundle.standardVersion} (${updatedCount} file(s) updated; governance/ and docs/ preserved intact).`
  };
}
