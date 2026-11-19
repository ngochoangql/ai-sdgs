import fs from 'node:fs';
import path from 'node:path';
import { loadStandardBundle } from '../core/bundle.ts';
import {
  renderTemplate,
  sha256Lf,
  toPosixPath,
  walkFiles,
  writeFileAtomicLf
} from '../core/crypto-fs.ts';
import { runGit } from '../core/git-vcs.ts';
import type { AdapterTarget, AdoptionTier, ExitCode, OnboardingMode } from '../core/types.ts';
import { stringifyYaml } from '../core/yaml-frontmatter.ts';
import { runAdapterSync } from './adapter.ts';

export interface InitOptions {
  tier?: AdoptionTier;
  mode?: OnboardingMode;
  id?: string;
  name?: string;
  description?: string;
  owner?: string;
  targets?: AdapterTarget[];
  bundleDir?: string;
  force?: boolean;
  now?: Date;
}

export interface InitResult {
  ok: boolean;
  exitCode: ExitCode;
  projectId: string;
  adoptionTier: AdoptionTier;
  onboardingMode: OnboardingMode;
  standardVersion: string;
  createdFiles: string[];
  message: string;
}

function slugifyProjectId(raw: string): string {
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug.length >= 2) return slug.slice(0, 62);
  return 'governed-project';
}

function detectGitUserName(cwd: string): string {
  const res = runGit(cwd, ['config', 'user.name']);
  const candidate = res.ok ? res.stdout.trim() : '';
  if (candidate.length >= 2 && !/^(AI-|ai-|bot|agent|claude|gemini|gpt|copilot)/i.test(candidate)) {
    return candidate;
  }
  return 'project-owner';
}

function detectExistingSourceCode(cwd: string): boolean {
  const existing = walkFiles(cwd, new Set(['.git', 'node_modules', '.aisdgs']));
  return existing.some((f) => {
    const base = path.basename(f).toLowerCase();
    return base !== 'readme.md' && base !== 'license' && base !== '.gitignore';
  });
}

export function runInit(workspaceRootInput: string, options: InitOptions = {}): InitResult {
  const workspaceRoot = path.resolve(workspaceRootInput);
  fs.mkdirSync(workspaceRoot, { recursive: true });

  const configPath = path.join(workspaceRoot, '.aisdgs', 'config.yaml');
  if (fs.existsSync(configPath) && !options.force) {
    return {
      ok: false,
      exitCode: 2,
      projectId: '',
      adoptionTier: options.tier ?? 'STANDARD',
      onboardingMode: options.mode ?? 'GREENFIELD',
      standardVersion: '',
      createdFiles: [],
      message: "Workspace already contains .aisdgs/config.yaml. Pass '--force' to re-initialize .aisdgs/ (existing governance/ and docs/ files are preserved)."
    };
  }

  const now = options.now ?? new Date();
  const dateIso = now.toISOString().slice(0, 10);
  const timestampIso = now.toISOString();
  const folderBase = path.basename(workspaceRoot);

  const adoptionTier: AdoptionTier = options.tier ?? 'STANDARD';
  const onboardingMode: OnboardingMode =
    options.mode ?? (detectExistingSourceCode(workspaceRoot) ? 'BROWNFIELD' : 'GREENFIELD');
  const projectId = options.id ? slugifyProjectId(options.id) : slugifyProjectId(folderBase);
  const projectName = options.name ?? folderBase;
  const projectDescription =
    options.description ?? `AI-SDGS governed software repository (${adoptionTier} / ${onboardingMode})`;
  const owner = options.owner ?? detectGitUserName(workspaceRoot);
  const targets: AdapterTarget[] =
    options.targets && options.targets.length > 0
      ? Array.from(new Set<AdapterTarget>(['agents', ...options.targets]))
      : ['agents', 'claude', 'gemini', 'cursor'];

  const bundle = loadStandardBundle(options.bundleDir);
  const createdFiles: string[] = [];

  // 1. Materialize read-only Level 1 snapshot (.aisdgs/{standard,schemas,policies}/) + standard-lock.yaml
  const lockEntries: Array<{ path: string; category: string; sha256: string }> = [];
  for (const [rel, content] of Object.entries(bundle.files)) {
    if (rel.startsWith('standard/') || rel.startsWith('schemas/') || rel.startsWith('policies/')) {
      const targetRel = `.aisdgs/${rel}`;
      writeFileAtomicLf(path.join(workspaceRoot, targetRel), content);
      createdFiles.push(targetRel);
      const category = rel.startsWith('standard/')
        ? 'STANDARD'
        : rel.startsWith('schemas/')
          ? 'SCHEMA'
          : 'POLICY';
      lockEntries.push({
        path: targetRel,
        category,
        sha256: sha256Lf(content)
      });
    }
  }

  writeFileAtomicLf(
    path.join(workspaceRoot, '.aisdgs/standard-lock.yaml'),
    stringifyYaml({
      lockfile_version: 1,
      standard_version: bundle.standardVersion,
      release_id: bundle.releaseId,
      hash_normalization: 'SHA256-UTF8-LF',
      installed_at: timestampIso,
      files: lockEntries
    })
  );
  createdFiles.push('.aisdgs/standard-lock.yaml');

  // 2. Render .aisdgs/config.yaml & .aisdgs/adoption-profile.yaml
  const tokens: Record<string, string> = {
    PROJECT_ID: projectId,
    PROJECT_NAME: projectName,
    PROJECT_DESCRIPTION: projectDescription,
    DATE_ISO: dateIso,
    TIMESTAMP_ISO: timestampIso,
    STANDARD_VERSION: bundle.standardVersion,
    ADOPTION_TIER: adoptionTier,
    ONBOARDING_MODE: onboardingMode,
    STRICT_VALIDATION: adoptionTier === 'STRICT' ? 'true' : 'false',
    HUM_OWNER: owner,
    HUM_PROD: owner,
    HUM_ARCH: owner,
    HUM_SEC: owner
  };

  writeFileAtomicLf(
    configPath,
    renderTemplate(bundle.files['templates/project/aisdgs-config.yaml'], tokens)
  );
  createdFiles.push('.aisdgs/config.yaml');

  const profilePath = path.join(workspaceRoot, '.aisdgs/adoption-profile.yaml');
  if (!fs.existsSync(profilePath)) {
    writeFileAtomicLf(
      profilePath,
      renderTemplate(bundle.files['templates/project/adoption-profile.yaml'], tokens)
    );
    createdFiles.push('.aisdgs/adoption-profile.yaml');
  }

  // 3. Materialize tier-proportional project governance files (NEVER overwrite existing project docs!)
  const writeIfMissing = (relDest: string, content: string): void => {
    const abs = path.join(workspaceRoot, relDest);
    if (!fs.existsSync(abs)) {
      writeFileAtomicLf(abs, content);
      createdFiles.push(toPosixPath(relDest));
    }
  };

  writeIfMissing(
    'governance/PROJECT-CONSTITUTION.md',
    renderTemplate(bundle.files['templates/project/PROJECT-CONSTITUTION.md'], tokens)
  );
  writeIfMissing(
    'governance/PROJECT-BASELINE.md',
    renderTemplate(bundle.files['templates/project/PROJECT-BASELINE.md'], tokens)
  );
  writeIfMissing(
    'changes/CHANGELOG-GOVERNANCE.md',
    renderTemplate(bundle.files['templates/project/CHANGELOG-GOVERNANCE.md'], tokens)
  );

  if (adoptionTier === 'STANDARD' || adoptionTier === 'STRICT') {
    writeIfMissing(
      'governance/EXCEPTIONS.md',
      renderTemplate(bundle.files['templates/project/EXCEPTIONS.md'], tokens)
    );
    writeIfMissing(
      'docs/architecture/ADR-001.md',
      renderTemplate(bundle.files['templates/artifacts/ADR.template.md'], {
        ...tokens,
        ADR_ID: 'ADR-001',
        ADR_TITLE: `${projectName} — System Boundaries & Core Stack`
      })
    );
    if (onboardingMode !== 'BROWNFIELD') {
      writeIfMissing(
        'docs/requirements/REQ-FUNC-001.md',
        renderTemplate(bundle.files['templates/artifacts/REQUIREMENT.template.md'], {
          ...tokens,
          REQ_ID: 'REQ-FUNC-001',
          REQ_TITLE: `${projectName} — Core Functional Capability`,
          REQ_DOMAIN: 'core'
        })
      );
    }
  }

  // Ensure .gitignore protects .env and private keys (STD-012-R01)
  const gitignorePath = path.join(workspaceRoot, '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    writeFileAtomicLf(
      gitignorePath,
      '# AI-SDGS Secret Hygiene (STD-012-R01)\n.env\n.env.*\n!.env.example\n*.pem\n*.key\n'
    );
    createdFiles.push('.gitignore');
  } else {
    const existingGi = fs.readFileSync(gitignorePath, 'utf8');
    if (!/^\.env\b/m.test(existingGi)) {
      writeFileAtomicLf(
        gitignorePath,
        existingGi.trimEnd() + '\n\n# AI-SDGS Secret Hygiene\n.env\n.env.*\n!.env.example\n*.pem\n*.key\n'
      );
    }
  }

  // 4. Synchronize root AGENTS.md & thin vendor bridges
  const syncRes = runAdapterSync(workspaceRoot, {
    targets,
    withPermissions: adoptionTier === 'STRICT'
  });
  for (const sf of syncRes.syncedFiles) {
    if (!createdFiles.includes(sf)) createdFiles.push(sf);
  }

  return {
    ok: syncRes.ok,
    exitCode: syncRes.exitCode,
    projectId,
    adoptionTier,
    onboardingMode,
    standardVersion: bundle.standardVersion,
    createdFiles,
    message: `Initialized AI-SDGS v${bundle.standardVersion} (${adoptionTier} / ${onboardingMode}) for '${projectId}' (${createdFiles.length} artifacts prepared).`
  };
}
