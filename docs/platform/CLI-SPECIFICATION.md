---
id: DOC-PLT-004
title: AI-SDGS Command-Line Interface (aisdgs) Specification
version: 1.0.0
status: APPROVED
artifact_class: NORMATIVE_SPEC
normative_references:
  - STD-002
  - STD-005
  - STD-006
  - STD-007
  - STD-009
  - STD-011
  - STD-012
  - DOC-PLT-003
last_updated: 2026-11-18
---

# COMMAND-LINE INTERFACE (`aisdgs`) SPECIFICATION

## 1. GLOBAL CLI CONVENTIONS & EXIT CODES

- **Executable Name:** `aisdgs`
- **Global Flags:** `--cwd <dir>` (target workspace root, default `.`), `--json` (machine-readable JSON stdout), `--no-color`, `--help`, `--version`.
- **Canonical Exit Codes (`STD-002-R07`):**
  - **`0` (`PASS / COMPLIANT`):** Operation succeeded; repository is `COMPLIANT` or `COMPLIANT_WITH_WAIVERS`.
  - **`1` (`COMPLIANCE_VIOLATION`):** One or more governance, schema, link, budget, protected-path, baseline-drift, or expired-waiver/emergency rules failed.
  - **`2` (`USAGE_OR_CONFIG_ERROR`):** Invalid CLI arguments, uninitialized workspace (`.aisdgs/config.yaml` missing), or unreadable filesystem path.
  - **`3` (`INTEGRITY_COMPROMISED`):** Tampered `.aisdgs/standard-lock.yaml` digest or suspected local self-approval spoofing (`DEC-007`).

### 1.1 Standard `--json` Output Envelope
Every command supporting `--json` MUST emit valid UTF-8 JSON to `stdout`:
```json
{
  "command": "validate",
  "ok": false,
  "compliance_state": "NON_COMPLIANT",
  "exit_code": 1,
  "timestamp": "2026-11-18T11:30:00Z",
  "summary": { "errors": 2, "warnings": 1, "active_waivers": 0 },
  "diagnostics": [
    {
      "severity": "ERROR",
      "rule_id": "STD-011-R03",
      "file": "AGENTS.md",
      "message": "Context Tier 0 router exceeds budget (164 lines > 150 max)."
    }
  ],
  "data": {}
}
```

---

## 2. COMMAND GROUP SPECIFICATIONS

### 2.1 `aisdgs init`
- **Synopsis:** `aisdgs init [--tier lite|standard|strict] [--mode greenfield|brownfield|iterative] [--id <slug>] [--name <title>] [--owner <human>] [--targets agents,claude,gemini,cursor] [--bundle <dir>] [--force]`
- **Preconditions:** Target directory exists; fails with `Exit Code 2` if `.aisdgs/config.yaml` already exists unless `--force` (which still refuses to overwrite `governance/**` or `docs/**`).
- **Behavior:**
  1. Auto-detects `BROWNFIELD` if source files already exist and `--mode` is omitted; otherwise defaults to `GREENFIELD` (`--tier standard`).
  2. Installs read-only `.aisdgs/{standard,schemas,policies}/` from embedded (or `--bundle`) snapshot and writes `.aisdgs/standard-lock.yaml` (`SHA256-UTF8-LF`).
  3. Materializes tier-proportional files per `DOC-PLT-001` §2 (zero empty placeholder folders).
  4. Runs `adapter sync` automatically to render `AGENTS.md` + selected vendor bridges.
- **Audit:** Appends `INIT` event row to `changes/CHANGELOG-GOVERNANCE.md`.

### 2.2 `aisdgs status`
- **Synopsis:** `aisdgs status [--json]`
- **Preconditions:** Initialized AI-SDGS workspace.
- **Output:** Displays project ID, Tier, Onboarding Mode, `standard_version` + lock health, `baseline_state` (`UNINITIALIZED` | `ANCHORED` | `LOCKED` | `DRIFT_DETECTED`), active `CR-*` count (highlighting any `EMERGENCY_ACTIVE` countdown), active/expiring `EXC-*` count, and hook installation status.
- **Exit Code:** `0` (informational snapshot; `2` if uninitialized).

### 2.3 `aisdgs standard`
- **Subcommands:**
  - `aisdgs standard list [--json]` — Lists installed `STD-001`..`STD-012` titles, domains, versions, and applicability from `adoption-profile.yaml`.
  - `aisdgs standard show <STD-ID>` — Prints the local `.aisdgs/standard/<STD-ID>.md` content (or specific `--rule <STD-XXX-Rnn>`).
  - `aisdgs standard verify-lock [--json]` — Recomputes `SHA256-UTF8-LF` across `.aisdgs/{standard,schemas,policies}/` against `standard-lock.yaml`, flagging modified, missing, or injected files (`Exit Code 0` or `3`).

### 2.4 `aisdgs adapter`
- **Subcommands:**
  - `aisdgs adapter sync [--targets <csv>] [--with-permissions]` — Computes `CONFIG_SHA256` from `.aisdgs/config.yaml`, renders `AGENTS.md` (`≤ 150` lines) and enabled vendor bridges (`≤ 40` lines), and optionally merges Ring 1 `.claude/settings.json` permissions (`DOC-PLT-002`).
  - `aisdgs adapter sync --check [--json]` — Verifies zero drift and strict line-budget compliance without mutating files (`Exit Code 0` or `1`).

### 2.5 `aisdgs validate`
- **Synopsis:** `aisdgs validate [--strict] [--json]`
- **Behavior:** Executes the complete 8-Stage Deterministic `L2` Validation Engine (`DOC-PLT-005`). Under `--strict` (or automatically when `adoption_tier == STRICT`), promotes `SHOULD` warnings to `ERROR` (`Exit Code 1`).
- **Exit Codes:** `0` (`COMPLIANT` / `COMPLIANT_WITH_WAIVERS`), `1` (`NON_COMPLIANT`), `2` (uninitialized), `3` (`INTEGRITY_COMPROMISED`).

### 2.6 `aisdgs baseline`
- **Subcommands:**
  - `aisdgs baseline status [--json]` — Reports current `baseline_version`, `baseline_state`, `approved_by`, `locked_at`, and artifact count.
  - `aisdgs baseline diff [--json]` — Lists added, modified, or deleted baseline/protected files relative to `PROJECT-BASELINE.md`.
  - `aisdgs baseline verify [--json]` — Verifies 100% hash match on `PROJECT-BASELINE.md` artifacts + Ring 2 self-approval/protected-path git diff checks (`Exit Code 0`, `1`, or `3`).
  - `aisdgs baseline lock [--anchor] --approver <human-name> [--bump major|minor|patch] [--cr <CR-ID>]` — Validates `approver` is not an AI identifier (`DEC-018`), verifies zero `L2` schema/link errors on target specs, computes `SHA256-UTF8-LF` digests into `PROJECT-BASELINE.md`, sets state to `ANCHORED` (`--anchor`) or `LOCKED`, increments `baseline_version`, and appends an audit line to `changes/CHANGELOG-GOVERNANCE.md`.

### 2.7 `aisdgs change`
- **Subcommands:**
  - `aisdgs change create --track fast|full|emergency --title "<title>" [--class <category>] [--incident <id>] [--approver <human>]` — Scans `changes/records/` for next monotonic `CR-XXXX` ID, renders the matching template (`CR-FAST`, `CR-FULL`, or `CR-EMERGENCY`), and prints the created file path.
  - `aisdgs change status [--json]` — Lists all Change Requests grouped by `cr_status`, flagging overdue `EMERGENCY_ACTIVE` records (`> 72h` / `> 48h`) and concurrent file-lease overlaps (`STD-006-R07`).
  - `aisdgs change verify <CR-ID> [--json]` — Validates `CR-XXXX.md` against `change-request.schema.json`, verifies referenced `REQ-*`/`ADR-*` IDs exist, checks working-tree/branch `git diff --name-only` containment within `affected_files` globs (`STD-006-R02`), and verifies escalation rules (`STD-006-R05`).

### 2.8 `aisdgs audit`
- **Synopsis:** `aisdgs audit [--cr <CR-ID>] [--base <git-ref>] [--output <path>] [--json]`
- **Behavior:** Assembles a deterministic **`L3` Semantic Audit Bundle** (`DOC-PLT-005` §3) combining: (a) `git diff` stat and hunks against `--base` (default `HEAD`), (b) touched `protected_paths` matches, (c) full text of linked `CR-*`, `REQ-*`, and `ADR-*` specs, (d) automated `L2` pre-check results, and (e) the 6-dimension `AUD-01..06` rubric from `SEMANTIC-AUDIT-REPORT.template.md`. Writes Markdown bundle/report to `--output` (or `stdout`).

### 2.9 `aisdgs hooks`
- **Subcommands:**
  - `aisdgs hooks install` — Installs non-destructive POSIX/Windows-compatible `.git/hooks/pre-commit` (runs `aisdgs validate`) and `.git/hooks/pre-push` (runs `aisdgs validate` + `aisdgs baseline verify`), chaining any pre-existing user hook safely.
  - `aisdgs hooks uninstall | status` — Removes or inspects AI-SDGS hook markers.

### 2.10 `aisdgs update`
- **Subcommands:**
  - `aisdgs update --check [--bundle <dir>]` — Compares installed `standard-lock.yaml` `standard_version` against CLI-embedded (or `--bundle`) release version.
  - `aisdgs update plan [--bundle <dir>] [--promote-tier standard|strict]` — Outputs a read-only compatibility & migration plan listing changed `STD-*` files, schema diffs, or missing artifacts required for Tier promotion (`STD-007-R07..08`).
  - `aisdgs update apply [--bundle <dir>] --approver <human>` — Updates `.aisdgs/{standard,schemas,policies}/` and `standard-lock.yaml` strictly inside the Level 1 write-barrier (never touching `governance/**` or `docs/**`), refreshes adapters, and logs event to `CHANGELOG-GOVERNANCE.md`.

### 2.11 `aisdgs report`
- **Synopsis:** `aisdgs report [--format md|json] [--output <path>]`
- **Behavior:** Generates an executive Governance & Compliance Posture Report summarizing Tier, Baseline lock state, validation diagnostics, traceability graph metrics (`REQ-*`, `ADR-*`, `CR-*` counts), active/expiring `EXC-*` waivers, and recent `CHANGELOG-GOVERNANCE.md` events.
