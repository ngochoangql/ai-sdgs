import type { AdapterTarget, AdoptionTier } from './types.ts';

export const CLI_VERSION = '1.0.1';
export const STANDARD_VERSION = '1.0.0';
export const RELEASE_ID = 'ai-sdgs-core-1.0.0';
export const AI_NAME_GUARD = /^(AI-|ai-|bot|agent|claude|gemini|gpt|copilot)/i;

/**
 * Exact 48 [NON-WAIVABLE] rule identifiers across STD-001..012 (STD-002-R04, DOC-PLT-001 §3).
 */
export const NON_WAIVABLE_RULES: ReadonlySet<string> = new Set([
  'STD-001-R01', 'STD-001-R02', 'STD-001-R03', 'STD-001-R04', 'STD-001-R05', 'STD-001-R07',
  'STD-002-R01', 'STD-002-R02', 'STD-002-R03', 'STD-002-R04', 'STD-002-R07',
  'STD-003-R01', 'STD-003-R02', 'STD-003-R05',
  'STD-004-R01', 'STD-004-R02', 'STD-004-R03', 'STD-004-R04',
  'STD-005-R03', 'STD-005-R04', 'STD-005-R05', 'STD-005-R07',
  'STD-006-R01', 'STD-006-R02', 'STD-006-R05', 'STD-006-R08',
  'STD-007-R01', 'STD-007-R03', 'STD-007-R04', 'STD-007-R07',
  'STD-008-R02', 'STD-008-R03', 'STD-008-R04',
  'STD-009-R01', 'STD-009-R02', 'STD-009-R04',
  'STD-010-R01', 'STD-010-R02', 'STD-010-R03',
  'STD-011-R01', 'STD-011-R02', 'STD-011-R03', 'STD-011-R06',
  'STD-012-R01', 'STD-012-R02', 'STD-012-R03', 'STD-012-R06', 'STD-012-R07'
]);

export const MAX_WAIVER_DAYS_BY_TIER: Readonly<Record<AdoptionTier, number>> = {
  LITE: 180,
  STANDARD: 90,
  STRICT: 60
};

export const MAX_EMERGENCY_HOURS_BY_TIER: Readonly<Record<AdoptionTier, number>> = {
  LITE: 72,
  STANDARD: 72,
  STRICT: 48
};

export const CONTEXT_BUDGETS = {
  ROOT_ROUTER_MAX_LINES: 150,
  VENDOR_BRIDGE_MAX_LINES: 40,
  POLICY_MAX_LINES: 250
} as const;

export const ADAPTER_TARGET_PATHS: Readonly<Record<AdapterTarget, { dest: string; template: string }>> = {
  agents: { dest: 'AGENTS.md', template: 'adapters/AGENTS.template.md' },
  claude: { dest: 'CLAUDE.md', template: 'adapters/CLAUDE.template.md' },
  gemini: { dest: 'GEMINI.md', template: 'adapters/GEMINI.template.md' },
  cursor: { dest: '.cursor/rules/aisdgs.mdc', template: 'adapters/cursor-aisdgs.template.mdc' },
  copilot: { dest: '.github/copilot-instructions.md', template: 'adapters/copilot-instructions.template.md' },
  kilocode: { dest: '.kilocode/rules/aisdgs.md', template: 'adapters/kilocode-aisdgs.template.md' }
};

export const DEFAULT_PROTECTED_PATHS: readonly string[] = [
  '.aisdgs/**',
  'governance/**',
  'AGENTS.md',
  'CLAUDE.md',
  'GEMINI.md',
  '.cursor/rules/**',
  '**/package.json',
  '**/package-lock.json',
  '**/pnpm-lock.yaml',
  '**/Cargo.toml',
  '**/Cargo.lock',
  '**/go.mod',
  '**/go.sum',
  '**/pyproject.toml',
  '**/poetry.lock',
  '**/*.csproj',
  '**/migrations/**',
  'docs/contracts/**',
  '.github/workflows/**',
  '.gitlab-ci.yml',
  '**/Dockerfile*'
];

export const SECRET_PATTERNS: ReadonlyArray<{ name: string; regex: RegExp }> = [
  { name: 'PEM Private Key', regex: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/ },
  { name: 'AWS Access Key ID', regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'GitHub PAT', regex: /\bghp_[A-Za-z0-9]{36,}\b/ },
  { name: 'OpenAI/API Secret Key', regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}\b/ }
];

export const TEST_SKIP_PATTERNS: ReadonlyArray<{ name: string; regex: RegExp }> = [
  { name: 'JS/TS .skip()', regex: /\b(?:it|test|describe)\.skip\s*\(/ },
  { name: 'Jasmine/Jest xit/xdescribe', regex: /\b(?:xit|xtest|xdescribe)\s*\(/ },
  { name: 'Rust #[ignore]', regex: /#\[\s*ignore(?:\s*=|\s*\)|\s*\])/ },
  { name: 'Pytest skip', regex: /@pytest\.mark\.skip\b/ },
  { name: 'xUnit Fact Skip', regex: /\[\s*(?:Fact|Theory)\s*\([^)]*Skip\s*=/ }
];
