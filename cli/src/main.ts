import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { CLI_VERSION } from './core/constants.ts';
import type { AdapterTarget, AdoptionTier, ChangeTrack, ExitCode, OnboardingMode } from './core/types.ts';
import { runValidation } from './core/validator.ts';
import { runAdapterSync } from './commands/adapter.ts';
import { runAudit, runExecutiveReport } from './commands/audit-report.ts';
import {
  runBaselineDiff,
  runBaselineLock,
  runBaselineStatus,
  runBaselineVerify
} from './commands/baseline.ts';
import {
  runChangeCreate,
  runChangeStatus,
  runChangeVerify
} from './commands/change.ts';
import {
  runHooksCommand,
  runUpdateApply,
  runUpdatePlanOrCheck
} from './commands/hooks-update.ts';
import { runInit } from './commands/init.ts';
import { startMcpServer } from './commands/mcp.ts';
import {
  runStandardList,
  runStandardShow,
  runStatus,
  verifyLockOnly
} from './commands/status-standard.ts';

export interface CliExecutionOutput {
  exitCode: ExitCode;
  stdout: string;
  stderr: string;
}

const HELP_TEXT = `AI-SDGS Governance & Enforcement CLI v${CLI_VERSION}

Usage:
  aisdgs <command> [subcommand] [flags]

Commands:
  init        [--tier lite|standard|strict] [--mode greenfield|brownfield|iterative] [--owner <human>]
  status      [--json]
  standard    list | show <STD-ID> [--rule <RULE-ID>] | verify-lock [--json]
  adapter     sync [--targets agents,claude,gemini,cursor,copilot,kilocode] [--check] [--with-permissions]
  validate    [--strict] [--json]
  baseline    status | diff | verify | lock [--anchor] --approver <human> [--bump major|minor|patch]
  change      create --track fast|full|emergency --title "<summary>" | status | verify <CR-ID>
  audit       [--cr <CR-ID>] [--base <git-ref>] [--output <path>] [--json]
  hooks       install | uninstall | status [--json]
  update      --check | plan [--promote-tier <tier>] | apply --approver <human>
  report      [--format md|json] [--output <path>]
  mcp         Start native Model Context Protocol (MCP) server over stdio

Global Flags:
  --cwd <dir>   Target repository root (defaults to current directory)
  --json        Emit deterministic JSON envelope to stdout
  --help, -h    Show this help guide
  --version     Print CLI version
`;

function jsonEnvelope(
  command: string,
  ok: boolean,
  exitCode: ExitCode,
  data: Record<string, unknown>,
  message?: string
): string {
  return (
    JSON.stringify(
      {
        command,
        ok,
        exit_code: exitCode,
        timestamp: new Date().toISOString(),
        ...(message ? { message } : {}),
        data
      },
      null,
      2
    ) + '\n'
  );
}

export function executeCli(rawArgv: string[]): CliExecutionOutput {
  let parsed;
  try {
    parsed = parseArgs({
      args: rawArgv,
      allowPositionals: true,
      strict: false,
      options: {
        cwd: { type: 'string' },
        json: { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false },
        version: { type: 'boolean', short: 'v', default: false },
        tier: { type: 'string' },
        mode: { type: 'string' },
        id: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string' },
        owner: { type: 'string' },
        targets: { type: 'string' },
        bundle: { type: 'string' },
        force: { type: 'boolean', default: false },
        strict: { type: 'boolean', default: false },
        check: { type: 'boolean', default: false },
        'with-permissions': { type: 'boolean', default: false },
        rule: { type: 'string' },
        anchor: { type: 'boolean', default: false },
        approver: { type: 'string' },
        bump: { type: 'string' },
        cr: { type: 'string' },
        track: { type: 'string' },
        title: { type: 'string' },
        class: { type: 'string' },
        incident: { type: 'string' },
        files: { type: 'string' },
        base: { type: 'string' },
        output: { type: 'string' },
        format: { type: 'string' },
        'promote-tier': { type: 'string' }
      }
    });
  } catch (err) {
    return {
      exitCode: 2,
      stdout: '',
      stderr: `Argument error: ${(err as Error).message}\n`
    };
  }

  const opts = parsed.values;
  const pos = parsed.positionals;

  if (opts.version) {
    return { exitCode: 0, stdout: `${CLI_VERSION}\n`, stderr: '' };
  }
  if (opts.help || pos.length === 0) {
    return { exitCode: 0, stdout: HELP_TEXT, stderr: '' };
  }

  const cwd = typeof opts.cwd === 'string' ? opts.cwd : process.cwd();
  const asJson = Boolean(opts.json);
  const cmd = pos[0].toLowerCase();
  const sub = pos[1]?.toLowerCase();

  try {
    switch (cmd) {
      case 'init': {
        const tier = typeof opts.tier === 'string' ? (opts.tier.toUpperCase() as AdoptionTier) : undefined;
        const mode = typeof opts.mode === 'string' ? (opts.mode.toUpperCase() as OnboardingMode) : undefined;
        if (tier && !['LITE', 'STANDARD', 'STRICT'].includes(tier)) {
          return { exitCode: 2, stdout: '', stderr: "Invalid '--tier'; expected lite, standard, or strict.\n" };
        }
        if (mode && !['GREENFIELD', 'BROWNFIELD', 'ITERATIVE'].includes(mode)) {
          return { exitCode: 2, stdout: '', stderr: "Invalid '--mode'; expected greenfield, brownfield, or iterative.\n" };
        }
        const targets =
          typeof opts.targets === 'string'
            ? (opts.targets.split(',').map((s) => s.trim().toLowerCase()) as AdapterTarget[])
            : undefined;
        const res = runInit(cwd, {
          tier,
          mode,
          id: typeof opts.id === 'string' ? opts.id : undefined,
          name: typeof opts.name === 'string' ? opts.name : undefined,
          description: typeof opts.description === 'string' ? opts.description : undefined,
          owner: typeof opts.owner === 'string' ? opts.owner : undefined,
          targets,
          bundleDir: typeof opts.bundle === 'string' ? opts.bundle : undefined,
          force: Boolean(opts.force)
        });
        if (asJson) {
          return {
            exitCode: res.exitCode,
            stdout: jsonEnvelope('init', res.ok, res.exitCode, res as unknown as Record<string, unknown>, res.message),
            stderr: ''
          };
        }
        return {
          exitCode: res.exitCode,
          stdout: res.ok ? `[AI-SDGS] ${res.message}\n` : '',
          stderr: res.ok ? '' : `[AI-SDGS] ${res.message}\n`
        };
      }

      case 'status': {
        const st = runStatus(cwd);
        if (asJson) {
          return {
            exitCode: st.exitCode,
            stdout: jsonEnvelope('status', st.ok, st.exitCode, st as unknown as Record<string, unknown>),
            stderr: ''
          };
        }
        if (!st.ok) {
          return { exitCode: st.exitCode, stdout: '', stderr: "[AI-SDGS] Workspace not initialized. Run 'aisdgs init'.\n" };
        }
        const lines = [
          `Project:          ${st.project_name} (${st.project_id})`,
          `Tier / Mode:      ${st.adoption_tier} / ${st.onboarding_mode}`,
          `Standard Version: v${st.standard_version} (Lockfile: ${st.lockfile_intact ? 'INTACT' : 'COMPROMISED'})`,
          `Baseline State:   ${st.baseline_state} (v${st.baseline_version}, ${st.baseline_artifacts_count} locked artifacts)`,
          `Active CRs:       ${st.active_crs.length}`,
          `Active Waivers:   ${st.active_waivers_count}`,
          `Git Hooks:        pre-commit=${st.hooks_installed.preCommit}, pre-push=${st.hooks_installed.prePush}`
        ];
        for (const cr of st.active_crs) {
          if (cr.status === 'EMERGENCY_ACTIVE') {
            lines.push(`  ! WARNING: Emergency ${cr.id} active (${cr.remaining_emergency_hours}h remaining to reconcile)`);
          }
        }
        return { exitCode: 0, stdout: lines.join('\n') + '\n', stderr: '' };
      }

      case 'standard': {
        if (sub === 'list' || !sub) {
          const res = runStandardList(cwd);
          if (asJson) {
            return { exitCode: res.exitCode, stdout: jsonEnvelope('standard list', res.ok, res.exitCode, { standards: res.standards }), stderr: '' };
          }
          if (!res.ok) return { exitCode: res.exitCode, stdout: '', stderr: '[AI-SDGS] Standard snapshot not found.\n' };
          const out = res.standards.map((s) => `${s.id}  [${s.applicability}]  ${s.title} (v${s.version})`).join('\n');
          return { exitCode: 0, stdout: out + '\n', stderr: '' };
        }
        if (sub === 'show') {
          const stdId = pos[2];
          if (!stdId) return { exitCode: 2, stdout: '', stderr: 'Usage: aisdgs standard show <STD-ID> [--rule <RULE-ID>]\n' };
          const res = runStandardShow(cwd, stdId, typeof opts.rule === 'string' ? opts.rule : undefined);
          if (asJson) {
            return { exitCode: res.exitCode, stdout: jsonEnvelope('standard show', res.ok, res.exitCode, { id: stdId, content: res.content }), stderr: '' };
          }
          return { exitCode: res.exitCode, stdout: res.ok ? res.content + '\n' : '', stderr: res.ok ? '' : res.content + '\n' };
        }
        if (sub === 'verify-lock') {
          const res = verifyLockOnly(cwd);
          if (asJson) {
            return { exitCode: res.exitCode, stdout: jsonEnvelope('standard verify-lock', res.ok, res.exitCode, res), stderr: '' };
          }
          if (res.ok) {
            return { exitCode: 0, stdout: `[AI-SDGS] Verified ${res.checkedCount} Level 1 snapshot files (v${res.standardVersion}) — INTACT.\n`, stderr: '' };
          }
          return { exitCode: res.exitCode, stdout: '', stderr: `[AI-SDGS] INTEGRITY_COMPROMISED:\n` + res.failures.map((f) => `  - ${f}`).join('\n') + '\n' };
        }
        return { exitCode: 2, stdout: '', stderr: `Unknown subcommand 'standard ${sub}'.\n` };
      }

      case 'adapter': {
        if (sub && sub !== 'sync') {
          return { exitCode: 2, stdout: '', stderr: "Usage: aisdgs adapter sync [--targets ...] [--check] [--with-permissions]\n" };
        }
        const targets =
          typeof opts.targets === 'string'
            ? (opts.targets.split(',').map((s) => s.trim().toLowerCase()) as AdapterTarget[])
            : undefined;
        const res = runAdapterSync(cwd, {
          targets,
          checkOnly: Boolean(opts.check),
          withPermissions: Boolean(opts['with-permissions'])
        });
        if (asJson) {
          return { exitCode: res.exitCode, stdout: jsonEnvelope('adapter sync', res.ok, res.exitCode, res as unknown as Record<string, unknown>), stderr: '' };
        }
        const msg = res.messages.join('\n') + '\n';
        return { exitCode: res.exitCode, stdout: res.ok ? `[AI-SDGS] ${msg}` : '', stderr: res.ok ? '' : `[AI-SDGS] ${msg}` };
      }

      case 'validate': {
        const rep = runValidation(cwd, { strict: Boolean(opts.strict) });
        if (asJson) {
          return { exitCode: rep.exit_code, stdout: JSON.stringify(rep, null, 2) + '\n', stderr: '' };
        }
        const header = `[AI-SDGS] Compliance: ${rep.compliance_state} (Errors: ${rep.summary.errors}, Warnings: ${rep.summary.warnings}, Active Waivers: ${rep.summary.active_waivers})`;
        const details = rep.diagnostics
          .map((d) => `  [${d.severity}] (Stage ${d.stage} | ${d.rule_id}) ${d.file ? d.file + ': ' : ''}${d.message}`)
          .join('\n');
        const body = details ? `${header}\n${details}\n` : `${header}\n`;
        return { exitCode: rep.exit_code, stdout: rep.ok ? body : '', stderr: rep.ok ? '' : body };
      }

      case 'baseline': {
        if (sub === 'status' || !sub) {
          const res = runBaselineStatus(cwd);
          if (asJson) return { exitCode: res.exitCode, stdout: jsonEnvelope('baseline status', res.ok, res.exitCode, res), stderr: '' };
          if (!res.ok) return { exitCode: res.exitCode, stdout: '', stderr: '[AI-SDGS] PROJECT-BASELINE.md missing.\n' };
          return {
            exitCode: 0,
            stdout: `Baseline State: ${res.state} | Version: v${res.version} | Approved By: ${res.approvedBy || '-'} | Artifacts: ${res.artifacts.length}\n`,
            stderr: ''
          };
        }
        if (sub === 'diff') {
          const res = runBaselineDiff(cwd);
          if (asJson) return { exitCode: res.exitCode, stdout: jsonEnvelope('baseline diff', res.ok, res.exitCode, res), stderr: '' };
          const out = [
            `Added (${res.added.length}): ${res.added.join(', ') || 'none'}`,
            `Modified (${res.modified.length}): ${res.modified.join(', ') || 'none'}`,
            `Removed (${res.removed.length}): ${res.removed.join(', ') || 'none'}`
          ].join('\n') + '\n';
          return { exitCode: res.exitCode, stdout: out, stderr: '' };
        }
        if (sub === 'verify') {
          const res = runBaselineVerify(cwd);
          if (asJson) return { exitCode: res.exitCode, stdout: jsonEnvelope('baseline verify', res.ok, res.exitCode, res), stderr: '' };
          const text = `[AI-SDGS] Baseline (${res.state}):\n` + res.messages.map((m) => `  - ${m}`).join('\n') + '\n';
          return { exitCode: res.exitCode, stdout: res.ok ? text : '', stderr: res.ok ? '' : text };
        }
        if (sub === 'lock') {
          const bump = typeof opts.bump === 'string' ? (opts.bump.toLowerCase() as 'major' | 'minor' | 'patch') : undefined;
          const res = runBaselineLock(cwd, {
            approver: typeof opts.approver === 'string' ? opts.approver : '',
            anchor: Boolean(opts.anchor),
            bump,
            crId: typeof opts.cr === 'string' ? opts.cr.toUpperCase() : undefined
          });
          if (asJson) return { exitCode: res.exitCode, stdout: jsonEnvelope('baseline lock', res.ok, res.exitCode, res, res.message), stderr: '' };
          return { exitCode: res.exitCode, stdout: res.ok ? `[AI-SDGS] ${res.message}\n` : '', stderr: res.ok ? '' : `[AI-SDGS] ${res.message}\n` };
        }
        return { exitCode: 2, stdout: '', stderr: `Unknown subcommand 'baseline ${sub}'.\n` };
      }

      case 'change': {
        if (sub === 'create') {
          const files =
            typeof opts.files === 'string'
              ? opts.files.split(',').map((s) => s.trim()).filter(Boolean)
              : undefined;
          const res = runChangeCreate(cwd, {
            track: typeof opts.track === 'string' ? (opts.track.toUpperCase() as ChangeTrack) : 'FAST',
            title: typeof opts.title === 'string' ? opts.title : '',
            classification: typeof opts.class === 'string' ? opts.class : undefined,
            incidentId: typeof opts.incident === 'string' ? opts.incident : undefined,
            approver: typeof opts.approver === 'string' ? opts.approver : undefined,
            files
          });
          if (asJson) return { exitCode: res.exitCode, stdout: jsonEnvelope('change create', res.ok, res.exitCode, res, res.message), stderr: '' };
          return { exitCode: res.exitCode, stdout: res.ok ? `[AI-SDGS] ${res.message}\n` : '', stderr: res.ok ? '' : `[AI-SDGS] ${res.message}\n` };
        }
        if (sub === 'status' || !sub) {
          const res = runChangeStatus(cwd);
          if (asJson) return { exitCode: res.exitCode, stdout: jsonEnvelope('change status', res.ok, res.exitCode, res), stderr: '' };
          if (res.records.length === 0) return { exitCode: 0, stdout: '[AI-SDGS] Zero Change Requests recorded.\n', stderr: '' };
          const out = res.records.map((r) => `${r.id}  [${r.track} | ${r.status}]  ${r.title}${r.overdue_emergency ? '  (! OVERDUE RECONCILIATION)' : ''}`).join('\n') + '\n';
          return { exitCode: 0, stdout: out, stderr: '' };
        }
        if (sub === 'verify') {
          const crId = pos[2];
          if (!crId) return { exitCode: 2, stdout: '', stderr: 'Usage: aisdgs change verify <CR-ID>\n' };
          const res = runChangeVerify(cwd, crId);
          if (asJson) return { exitCode: res.exitCode, stdout: jsonEnvelope('change verify', res.ok, res.exitCode, res, res.message), stderr: '' };
          const body = res.ok
            ? `[AI-SDGS] ${res.message}\n`
            : `[AI-SDGS] ${res.message}\n` + res.errors.map((e) => `  - ${e}`).join('\n') + '\n';
          return { exitCode: res.exitCode, stdout: res.ok ? body : '', stderr: res.ok ? '' : body };
        }
        return { exitCode: 2, stdout: '', stderr: `Unknown subcommand 'change ${sub}'.\n` };
      }

      case 'audit': {
        const res = runAudit(cwd, {
          crId: typeof opts.cr === 'string' ? opts.cr : undefined,
          baseRef: typeof opts.base === 'string' ? opts.base : undefined,
          outputPath: typeof opts.output === 'string' ? opts.output : undefined
        });
        if (asJson) {
          return { exitCode: res.exitCode, stdout: jsonEnvelope('audit', res.ok, res.exitCode, res), stderr: '' };
        }
        if (!res.ok) return { exitCode: res.exitCode, stdout: '', stderr: `[AI-SDGS] ${res.bundleMarkdown}\n` };
        if (res.outputPath) {
          return { exitCode: 0, stdout: `[AI-SDGS] Wrote L3 Semantic Audit Bundle to '${res.outputPath}' (L2 state: ${res.l2ComplianceState}).\n`, stderr: '' };
        }
        return { exitCode: 0, stdout: res.bundleMarkdown, stderr: '' };
      }

      case 'hooks': {
        const action = (sub ?? 'status') as 'install' | 'uninstall' | 'status';
        if (!['install', 'uninstall', 'status'].includes(action)) {
          return { exitCode: 2, stdout: '', stderr: 'Usage: aisdgs hooks install | uninstall | status\n' };
        }
        const res = runHooksCommand(cwd, action);
        if (asJson) return { exitCode: res.exitCode, stdout: jsonEnvelope(`hooks ${action}`, res.ok, res.exitCode, res, res.message), stderr: '' };
        return { exitCode: res.exitCode, stdout: res.ok ? `[AI-SDGS] ${res.message}\n` : '', stderr: res.ok ? '' : `[AI-SDGS] ${res.message}\n` };
      }

      case 'update': {
        const bundleDir = typeof opts.bundle === 'string' ? opts.bundle : undefined;
        if (opts.check || sub === 'plan' || !sub) {
          const promoteTier =
            typeof opts['promote-tier'] === 'string'
              ? (opts['promote-tier'].toUpperCase() as AdoptionTier)
              : undefined;
          const res = runUpdatePlanOrCheck(cwd, { bundleDir, promoteTier });
          if (asJson) return { exitCode: res.exitCode, stdout: jsonEnvelope('update plan', res.ok, res.exitCode, res as unknown as Record<string, unknown>, res.message), stderr: '' };
          let txt = `[AI-SDGS] ${res.message}\n`;
          if (res.tierPromotionChecklist.length > 0) {
            txt += 'Tier Promotion Checklist:\n' + res.tierPromotionChecklist.map((c) => `  - ${c}`).join('\n') + '\n';
          }
          return { exitCode: res.exitCode, stdout: res.ok ? txt : '', stderr: res.ok ? '' : txt };
        }
        if (sub === 'apply') {
          const res = runUpdateApply(cwd, {
            bundleDir,
            approver: typeof opts.approver === 'string' ? opts.approver : ''
          });
          if (asJson) return { exitCode: res.exitCode, stdout: jsonEnvelope('update apply', res.ok, res.exitCode, res, res.message), stderr: '' };
          return { exitCode: res.exitCode, stdout: res.ok ? `[AI-SDGS] ${res.message}\n` : '', stderr: res.ok ? '' : `[AI-SDGS] ${res.message}\n` };
        }
        return { exitCode: 2, stdout: '', stderr: 'Usage: aisdgs update --check | plan | apply --approver <human>\n' };
      }

      case 'report': {
        const fmt = opts.format === 'json' || asJson ? 'json' : 'md';
        const res = runExecutiveReport(cwd, fmt, typeof opts.output === 'string' ? opts.output : undefined);
        if (!res.ok) return { exitCode: res.exitCode, stdout: '', stderr: `[AI-SDGS] ${res.output}\n` };
        if (res.savedPath && !asJson) {
          return { exitCode: 0, stdout: `[AI-SDGS] Saved compliance posture report to '${res.savedPath}'.\n`, stderr: '' };
        }
        return { exitCode: 0, stdout: res.output, stderr: '' };
      }

      case 'sync': {
        const res = runAdapterSync(cwd);
        if (asJson) return { exitCode: res.exitCode, stdout: jsonEnvelope('adapter sync', res.ok, res.exitCode, res as unknown as Record<string, unknown>), stderr: '' };
        return { exitCode: res.exitCode, stdout: res.ok ? `[AI-SDGS] ${res.messages.join('\n')}\n` : '', stderr: res.ok ? '' : `[AI-SDGS] ${res.messages.join('\n')}\n` };
      }

      case 'mcp': {
        startMcpServer(cwd);
        return { exitCode: 0, stdout: '', stderr: '' };
      }

      default:
        return {
          exitCode: 2,
          stdout: '',
          stderr: `Unknown command '${cmd}'. Run 'aisdgs --help' for usage.\n`
        };
    }
  } catch (err) {
    return {
      exitCode: 2,
      stdout: '',
      stderr: `[AI-SDGS] Unexpected CLI error: ${(err as Error).message}\n`
    };
  }
}

// Execute when invoked directly as script (case-insensitive path normalization for Windows & POSIX)
const selfPath = path.resolve(fileURLToPath(import.meta.url));
const argvPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (
  argvPath &&
  (selfPath === argvPath || selfPath.toLowerCase() === argvPath.toLowerCase())
) {
  const out = executeCli(process.argv.slice(2));
  if (out.stdout) process.stdout.write(out.stdout);
  if (out.stderr) process.stderr.write(out.stderr);
  process.exitCode = out.exitCode;
}
