import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { CLI_VERSION } from '../core/constants.ts';
import type { ChangeTrack } from '../core/types.ts';
import { runValidation } from '../core/validator.ts';
import { runAdapterSync } from './adapter.ts';
import { runAudit } from './audit-report.ts';
import { runBaselineDiff, runBaselineStatus } from './baseline.ts';
import { runChangeCreate, runChangeVerify } from './change.ts';
import { runStatus } from './status-standard.ts';

export const MCP_PROTOCOL_VERSION = '2024-11-05';

export interface McpRpcRequest {
  jsonrpc: string;
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface McpRpcResponse {
  jsonrpc: '2.0';
  id?: string | number | null;
  result?: Record<string, unknown>;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export const MCP_TOOL_DEFINITIONS = [
  {
    name: 'aisdgs_status',
    description:
      'Inspect AI-SDGS governance status, adoption tier, lockfile integrity, active Change Requests, and baseline state.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: 'aisdgs_validate',
    description:
      'Execute the 8-stage deterministic L2 validation engine. Verifies standard lockfile hashes, JSON Schemas, symbol table, DAG cycles, waiver validity, context line budgets, baseline drift, and Ring 2 anti-spoofing.',
    inputSchema: {
      type: 'object',
      properties: {
        strict: {
          type: 'boolean',
          description: 'Enforce strict zero-warning compliance policy (treat all warnings as errors).'
        }
      },
      additionalProperties: false
    }
  },
  {
    name: 'aisdgs_change_create',
    description:
      'Create a new Change Request (CR) before modifying code, public contracts, dependencies, or architectural boundaries.',
    inputSchema: {
      type: 'object',
      properties: {
        track: {
          type: 'string',
          enum: ['fast', 'full', 'emergency'],
          description: "Governance track: 'fast' (5-field for minor/refactor), 'full' (14-field formal), or 'emergency' (P0 hotfix)."
        },
        title: {
          type: 'string',
          description: 'Clear summary description of the planned change.'
        },
        affects: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional list of file paths or globs that this change is authorized to modify.'
        }
      },
      required: ['track', 'title'],
      additionalProperties: false
    }
  },
  {
    name: 'aisdgs_change_verify',
    description:
      'Verify whether current workspace modifications strictly adhere to the declared scope and authorization status of a Change Request.',
    inputSchema: {
      type: 'object',
      properties: {
        crId: {
          type: 'string',
          description: "Identifier of the Change Request (e.g. 'CR-0001')."
        }
      },
      required: ['crId'],
      additionalProperties: false
    }
  },
  {
    name: 'aisdgs_baseline_status',
    description:
      'Inspect the status of the cryptographic project baseline (PROJECT-BASELINE.md) and locked artifact hashes.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: 'aisdgs_baseline_diff',
    description:
      'Compute cryptographic differences between on-disk artifacts and the approved baseline to detect unauthorized drift.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: 'aisdgs_adapter_sync',
    description:
      'Synchronize or verify vendor adapter bridges (AGENTS.md, CLAUDE.md, GEMINI.md, .cursor/rules) against .aisdgs/config.yaml.',
    inputSchema: {
      type: 'object',
      properties: {
        checkOnly: {
          type: 'boolean',
          description: 'If true, checks for drift without modifying files.'
        }
      },
      additionalProperties: false
    }
  },
  {
    name: 'aisdgs_audit',
    description:
      'Generate an L3 semantic audit context bundle for human or AI review according to the 6-point rubric (AUD-01..AUD-06).',
    inputSchema: {
      type: 'object',
      properties: {
        crId: {
          type: 'string',
          description: 'Change Request identifier to audit.'
        },
        baseRef: {
          type: 'string',
          description: 'Base Git reference to compare against (defaults to HEAD~1 or origin/main).'
        }
      },
      additionalProperties: false
    }
  }
];

export const MCP_RESOURCE_DEFINITIONS = [
  {
    uri: 'aisdgs://agents',
    name: 'Root Governance Router (AGENTS.md)',
    description: 'Context Tier 0 supreme routing rules for AI coding agents',
    mimeType: 'text/markdown'
  },
  {
    uri: 'aisdgs://constitution',
    name: 'Project Constitution (PROJECT-CONSTITUTION.md)',
    description: 'Constitutional rules and authority hierarchy of the project',
    mimeType: 'text/markdown'
  },
  {
    uri: 'aisdgs://baseline',
    name: 'Project Baseline (PROJECT-BASELINE.md)',
    description: 'Cryptographic snapshot of locked project specifications',
    mimeType: 'text/markdown'
  }
];

export function handleMcpToolCall(
  workspaceRoot: string,
  name: string,
  args: Record<string, unknown> = {}
): { content: Array<{ type: 'text'; text: string }>; isError?: boolean } {
  switch (name) {
    case 'aisdgs_status': {
      const st = runStatus(workspaceRoot);
      if (!st.ok) {
        return {
          content: [
            {
              type: 'text',
              text: `[AI-SDGS] Workspace not initialized at ${workspaceRoot}. Run 'aisdgs init' first.`
            }
          ],
          isError: true
        };
      }
      const text = `Project: ${st.project_name} (${st.project_id})
Tier: ${st.adoption_tier} | Mode: ${st.onboarding_mode}
Standard Version: v${st.standard_version} (Lockfile: ${st.lockfile_intact ? 'INTACT' : 'COMPROMISED'})
Baseline: ${st.baseline_state} (v${st.baseline_version}, ${st.baseline_artifacts_count} artifacts)
Active CRs: ${st.active_crs.length}
Active Waivers: ${st.active_waivers_count}
Git Hooks: pre-commit=${st.hooks_installed.preCommit}, pre-push=${st.hooks_installed.prePush}`;
      return {
        content: [
          { type: 'text', text },
          { type: 'text', text: JSON.stringify(st, null, 2) }
        ],
        isError: false
      };
    }

    case 'aisdgs_validate': {
      const strict = Boolean(args.strict);
      const report = runValidation(workspaceRoot, { strict });
      const diagSummary =
        report.diagnostics.length === 0
          ? '  (No issues found. Repository is 100% compliant.)'
          : report.diagnostics
              .map(
                (d) =>
                  `  [${d.severity}] Stage ${d.stage} (${d.rule_id}) at ${d.file}: ${d.message}`
              )
              .join('\n');
      const text = `[AI-SDGS Validation] State: ${report.compliance_state} (Exit Code: ${report.exit_code})
Summary: Errors: ${report.summary.errors}, Warnings: ${report.summary.warnings}, Active Waivers: ${report.summary.active_waivers}
Diagnostics:
${diagSummary}`;
      return {
        content: [
          { type: 'text', text },
          { type: 'text', text: JSON.stringify(report, null, 2) }
        ],
        isError: report.exit_code !== 0
      };
    }

    case 'aisdgs_change_create': {
      const track = (typeof args.track === 'string' ? args.track.toLowerCase() : 'fast') as ChangeTrack;
      const title = String(args.title || 'Untitled Change');
      const files = Array.isArray(args.affects) ? (args.affects as string[]) : undefined;
      const res = runChangeCreate(workspaceRoot, { track, title, files });
      return {
        content: [
          { type: 'text', text: `[AI-SDGS] ${res.message}` },
          { type: 'text', text: JSON.stringify(res, null, 2) }
        ],
        isError: !res.ok
      };
    }

    case 'aisdgs_change_verify': {
      const crId = String(args.crId || '');
      if (!crId) {
        return {
          content: [{ type: 'text', text: "Missing required argument 'crId'." }],
          isError: true
        };
      }
      const res = runChangeVerify(workspaceRoot, crId);
      const msg = `[AI-SDGS Change Verify: ${crId}] ${res.message}
Errors:
${res.errors.length === 0 ? '  (None)' : res.errors.map((m) => `  - ${m}`).join('\n')}`;
      return {
        content: [
          { type: 'text', text: msg },
          { type: 'text', text: JSON.stringify(res, null, 2) }
        ],
        isError: !res.ok
      };
    }

    case 'aisdgs_baseline_status': {
      const res = runBaselineStatus(workspaceRoot);
      const text = `[AI-SDGS Baseline Status] State: ${res.state} (v${res.version})
Approver: ${res.approvedBy} | Locked at: ${res.lockedAt}
Artifacts: ${res.artifacts.length} locked`;
      return {
        content: [
          { type: 'text', text },
          { type: 'text', text: JSON.stringify(res, null, 2) }
        ],
        isError: !res.ok
      };
    }

    case 'aisdgs_baseline_diff': {
      const res = runBaselineDiff(workspaceRoot);
      const text = `[AI-SDGS Baseline Diff] Status: ${res.ok ? 'CLEAN (No drift)' : 'DRIFT DETECTED'}
Modified: ${res.modified.length}
Added: ${res.added.length}
Removed: ${res.removed.length}`;
      return {
        content: [
          { type: 'text', text },
          { type: 'text', text: JSON.stringify(res, null, 2) }
        ],
        isError: !res.ok
      };
    }

    case 'aisdgs_adapter_sync': {
      const checkOnly = Boolean(args.checkOnly);
      const res = runAdapterSync(workspaceRoot, { checkOnly });
      const text = `[AI-SDGS Adapter Sync] ${res.ok ? 'OK' : 'FAILED'}
Synced: ${res.syncedFiles.join(', ') || 'None'}
Drifted: ${res.driftedFiles.join(', ') || 'None'}
Messages: ${res.messages.join('; ')}`;
      return {
        content: [
          { type: 'text', text },
          { type: 'text', text: JSON.stringify(res, null, 2) }
        ],
        isError: !res.ok
      };
    }

    case 'aisdgs_audit': {
      const crId = typeof args.crId === 'string' ? args.crId : undefined;
      const baseRef = typeof args.baseRef === 'string' ? args.baseRef : undefined;
      const res = runAudit(workspaceRoot, { crId, baseRef });
      return {
        content: [
          { type: 'text', text: res.bundleMarkdown }
        ],
        isError: !res.ok
      };
    }

    default:
      return {
        content: [{ type: 'text', text: `Unknown tool '${name}'.` }],
        isError: true
      };
  }
}

export function handleMcpMessage(
  workspaceRoot: string,
  rawMsg: unknown
): McpRpcResponse | null {
  if (!rawMsg || typeof rawMsg !== 'object') {
    return {
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: 'Parse error: Expected JSON-RPC object.' }
    };
  }

  const req = rawMsg as McpRpcRequest;
  const id = req.id ?? null;

  // Handle Notifications (no ID)
  if (req.id === undefined) {
    // notifications/initialized or cancelled
    return null;
  }

  const method = req.method;
  const params = (req.params || {}) as Record<string, unknown>;

  switch (method) {
    case 'initialize': {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {
            tools: { listChanged: false },
            resources: { listChanged: false }
          },
          serverInfo: {
            name: 'ai-sdgs-mcp',
            version: CLI_VERSION
          },
          instructions:
            'AI-SDGS Governance MCP Server. Always call aisdgs_status or aisdgs_validate to verify constraints before mutating code. Use aisdgs_change_create to create Change Requests before modifying protected files.'
        }
      };
    }

    case 'ping': {
      return { jsonrpc: '2.0', id, result: {} };
    }

    case 'tools/list': {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tools: MCP_TOOL_DEFINITIONS
        }
      };
    }

    case 'tools/call': {
      const toolName = String(params.name || '');
      const toolArgs = (params.arguments || {}) as Record<string, unknown>;
      const toolResult = handleMcpToolCall(workspaceRoot, toolName, toolArgs);
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: toolResult.content,
          isError: Boolean(toolResult.isError)
        }
      };
    }

    case 'resources/list': {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          resources: MCP_RESOURCE_DEFINITIONS
        }
      };
    }

    case 'resources/read': {
      const uri = String(params.uri || '');
      let relPath = '';
      if (uri === 'aisdgs://agents') relPath = 'AGENTS.md';
      else if (uri === 'aisdgs://constitution') relPath = 'governance/PROJECT-CONSTITUTION.md';
      else if (uri === 'aisdgs://baseline') relPath = 'governance/PROJECT-BASELINE.md';

      if (!relPath) {
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32602, message: `Resource not found: '${uri}'` }
        };
      }

      const absPath = path.join(workspaceRoot, relPath);
      if (!fs.existsSync(absPath)) {
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32602, message: `Resource file '${relPath}' does not exist on disk.` }
        };
      }

      const text = fs.readFileSync(absPath, 'utf8');
      return {
        jsonrpc: '2.0',
        id,
        result: {
          contents: [
            {
              uri,
              mimeType: 'text/markdown',
              text
            }
          ]
        }
      };
    }

    default:
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: `Method not found: '${method}'`
        }
      };
  }
}

export function startMcpServer(
  workspaceRootInput: string,
  inputStream: NodeJS.ReadableStream = process.stdin,
  outputStream: NodeJS.WritableStream = process.stdout
): void {
  const workspaceRoot = path.resolve(workspaceRootInput);
  process.stderr.write(`[AI-SDGS MCP] Server started on stdio (workspace: ${workspaceRoot})\n`);

  const rl = readline.createInterface({
    input: inputStream,
    terminal: false
  });

  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const parsed = JSON.parse(trimmed);
      const res = handleMcpMessage(workspaceRoot, parsed);
      if (res !== null) {
        outputStream.write(JSON.stringify(res) + '\n');
      }
    } catch (err) {
      const parseErr: McpRpcResponse = {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: `Parse error: ${(err as Error).message}` }
      };
      outputStream.write(JSON.stringify(parseErr) + '\n');
    }
  });

  rl.on('close', () => {
    process.stderr.write('[AI-SDGS MCP] Server connection closed.\n');
  });
}
