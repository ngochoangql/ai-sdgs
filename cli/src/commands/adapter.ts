import fs from 'node:fs';
import path from 'node:path';
import { loadStandardBundle } from '../core/bundle.ts';
import { ADAPTER_TARGET_PATHS, CONTEXT_BUDGETS } from '../core/constants.ts';
import {
  countLinesLf,
  renderTemplate,
  sha256FileLf,
  writeFileAtomicLf
} from '../core/crypto-fs.ts';
import type { AdapterTarget, ExitCode, ProjectConfig } from '../core/types.ts';
import { parseYaml, stringifyYaml } from '../core/yaml-frontmatter.ts';

export interface AdapterSyncOptions {
  targets?: AdapterTarget[];
  checkOnly?: boolean;
  withPermissions?: boolean;
}

export interface AdapterSyncResult {
  ok: boolean;
  exitCode: ExitCode;
  syncedFiles: string[];
  driftedFiles: string[];
  messages: string[];
}

export function runAdapterSync(
  workspaceRootInput: string,
  options: AdapterSyncOptions = {}
): AdapterSyncResult {
  const workspaceRoot = path.resolve(workspaceRootInput);
  const configPath = path.join(workspaceRoot, '.aisdgs', 'config.yaml');
  if (!fs.existsSync(configPath)) {
    return {
      ok: false,
      exitCode: 2,
      syncedFiles: [],
      driftedFiles: [],
      messages: ["Missing .aisdgs/config.yaml. Run 'aisdgs init' first."]
    };
  }

  let cfg = parseYaml(fs.readFileSync(configPath, 'utf8')) as unknown as ProjectConfig;

  // If --targets passed and not --check, persist updated targets into config.yaml first
  if (options.targets && options.targets.length > 0 && !options.checkOnly) {
    const mergedTargets = Array.from(new Set<AdapterTarget>(['agents', ...options.targets]));
    cfg.adapters.targets = mergedTargets;
    writeFileAtomicLf(configPath, stringifyYaml(cfg as unknown as Record<string, unknown>));
    cfg = parseYaml(fs.readFileSync(configPath, 'utf8')) as unknown as ProjectConfig;
  }

  const configSha256 = sha256FileLf(configPath);
  const bundle = loadStandardBundle();

  const tokens: Record<string, string> = {
    PROJECT_ID: cfg.project.id,
    PROJECT_NAME: cfg.project.name,
    PROJECT_DESCRIPTION: cfg.project.description ?? cfg.project.name,
    STANDARD_VERSION: cfg.governance.standard_version,
    ADOPTION_TIER: cfg.governance.adoption_tier,
    ONBOARDING_MODE: cfg.governance.onboarding_mode,
    HUM_OWNER: cfg.roles['HUM-OWNER'],
    HUM_PROD: cfg.roles['HUM-PROD'],
    HUM_ARCH: cfg.roles['HUM-ARCH'],
    HUM_SEC: cfg.roles['HUM-SEC'],
    CONFIG_SHA256: configSha256
  };

  const activeTargets = Array.from(
    new Set<AdapterTarget>(['agents', ...(options.targets ?? cfg.adapters.targets ?? [])])
  );

  const syncedFiles: string[] = [];
  const driftedFiles: string[] = [];
  const messages: string[] = [];

  for (const target of activeTargets) {
    const spec = ADAPTER_TARGET_PATHS[target];
    if (!spec) continue;

    const templateContent = bundle.files[spec.template];
    const rendered = renderTemplate(templateContent, tokens);
    const maxLines =
      target === 'agents'
        ? CONTEXT_BUDGETS.ROOT_ROUTER_MAX_LINES
        : CONTEXT_BUDGETS.VENDOR_BRIDGE_MAX_LINES;
    const renderedLines = countLinesLf(rendered);
    if (renderedLines > maxLines) {
      return {
        ok: false,
        exitCode: 1,
        syncedFiles,
        driftedFiles: [spec.dest],
        messages: [`Rendered '${spec.dest}' (${renderedLines} lines) exceeds ${maxLines}-line ceiling.`]
      };
    }

    const absDest = path.join(workspaceRoot, spec.dest);
    if (options.checkOnly) {
      if (!fs.existsSync(absDest)) {
        driftedFiles.push(spec.dest);
        messages.push(`Missing adapter file '${spec.dest}'.`);
      } else {
        const existing = fs.readFileSync(absDest, 'utf8');
        const exLines = countLinesLf(existing);
        const shaMatch = existing.match(/config_sha256=([a-f0-9]{64})/);
        if (exLines > maxLines) {
          driftedFiles.push(spec.dest);
          messages.push(`Adapter '${spec.dest}' exceeds ${maxLines}-line budget (${exLines} lines).`);
        } else if (!shaMatch || shaMatch[1] !== configSha256) {
          driftedFiles.push(spec.dest);
          messages.push(`Adapter '${spec.dest}' config_sha256 does not match .aisdgs/config.yaml.`);
        } else {
          syncedFiles.push(spec.dest);
        }
      }
    } else {
      writeFileAtomicLf(absDest, rendered);
      syncedFiles.push(spec.dest);
    }
  }

  // Non-destructive Ring 1 .claude/settings.json permission union merge (DEC-020)
  const shouldMergePerms =
    !options.checkOnly &&
    activeTargets.includes('claude') &&
    (options.withPermissions || cfg.governance.adoption_tier === 'STRICT');

  if (shouldMergePerms) {
    const presetRaw = bundle.files['adapters/claude-settings-permissions.template.json'];
    const preset = JSON.parse(presetRaw) as {
      permissions: { deny: string[]; ask: string[] };
    };
    const claudeSettingsPath = path.join(workspaceRoot, '.claude', 'settings.json');
    let currentObj: Record<string, unknown> = {};
    if (fs.existsSync(claudeSettingsPath)) {
      try {
        currentObj = JSON.parse(fs.readFileSync(claudeSettingsPath, 'utf8')) as Record<string, unknown>;
      } catch {
        currentObj = {};
      }
    }
    const existingPerms =
      typeof currentObj.permissions === 'object' && currentObj.permissions !== null
        ? (currentObj.permissions as Record<string, unknown>)
        : {};
    const curDeny = Array.isArray(existingPerms.deny) ? (existingPerms.deny as string[]) : [];
    const curAsk = Array.isArray(existingPerms.ask) ? (existingPerms.ask as string[]) : [];

    currentObj.permissions = {
      ...existingPerms,
      deny: Array.from(new Set([...curDeny, ...preset.permissions.deny])),
      ask: Array.from(new Set([...curAsk, ...preset.permissions.ask]))
    };

    writeFileAtomicLf(claudeSettingsPath, JSON.stringify(currentObj, null, 2) + '\n');
    syncedFiles.push('.claude/settings.json');
  }

  if (options.checkOnly && driftedFiles.length > 0) {
    return {
      ok: false,
      exitCode: 1,
      syncedFiles,
      driftedFiles,
      messages
    };
  }

  return {
    ok: true,
    exitCode: 0,
    syncedFiles,
    driftedFiles: [],
    messages:
      messages.length > 0
        ? messages
        : [`Synchronized ${syncedFiles.length} AI adapter file(s) (config_sha256=${configSha256.slice(0, 12)}...).`]
  };
}
