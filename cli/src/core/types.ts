export type AdoptionTier = 'LITE' | 'STANDARD' | 'STRICT';
export type OnboardingMode = 'GREENFIELD' | 'BROWNFIELD' | 'ITERATIVE';
export type ComplianceState =
  | 'COMPLIANT'
  | 'COMPLIANT_WITH_WAIVERS'
  | 'NON_COMPLIANT'
  | 'INTEGRITY_COMPROMISED';

export type ExitCode = 0 | 1 | 2 | 3;
export type Severity = 'ERROR' | 'WARNING' | 'INFO';

export type DocStatus =
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'AMENDING'
  | 'SUPERSEDED'
  | 'DEPRECATED';

export type BaselineState =
  | 'UNINITIALIZED'
  | 'ANCHORED'
  | 'LOCKED'
  | 'DRIFT_DETECTED';

export type ChangeTrack = 'FAST' | 'FULL' | 'EMERGENCY';
export type CrStatus =
  | 'DRAFT'
  | 'ANALYZED'
  | 'APPROVED'
  | 'REJECTED'
  | 'IN_PROGRESS'
  | 'EMERGENCY_ACTIVE'
  | 'VERIFIED'
  | 'CLOSED';

export type AdapterTarget =
  | 'agents'
  | 'claude'
  | 'gemini'
  | 'cursor'
  | 'copilot'
  | 'kilocode';

export interface Diagnostic {
  severity: Severity;
  stage: number;
  rule_id: string;
  file?: string;
  message: string;
  integrity_failure?: boolean;
}

export interface ValidationReport {
  command: string;
  ok: boolean;
  compliance_state: ComplianceState;
  exit_code: ExitCode;
  timestamp: string;
  summary: {
    errors: number;
    warnings: number;
    infos: number;
    active_waivers: number;
  };
  diagnostics: Diagnostic[];
  data: Record<string, unknown>;
}

export interface ProjectConfig {
  schema_version: string;
  project: {
    id: string;
    name: string;
    description?: string;
    registered_at: string;
  };
  governance: {
    standard_version: string;
    adoption_tier: AdoptionTier;
    onboarding_mode: OnboardingMode;
    strict_validation?: boolean;
  };
  roles: {
    'HUM-OWNER': string;
    'HUM-PROD': string;
    'HUM-ARCH': string;
    'HUM-SEC': string;
  };
  protected_paths: string[];
  adapters: {
    root_router: 'AGENTS.md';
    targets: AdapterTarget[];
  };
}

export interface LockfileEntry {
  path: string;
  category: 'STANDARD' | 'SCHEMA' | 'POLICY';
  sha256: string;
}

export interface StandardLockfile {
  lockfile_version: 1;
  standard_version: string;
  release_id: string;
  hash_normalization: 'SHA256-UTF8-LF';
  installed_at: string;
  files: LockfileEntry[];
}

export interface BaselineArtifactEntry {
  path: string;
  id?: string;
  version?: string;
  kind?: string;
  sha256: string;
}
