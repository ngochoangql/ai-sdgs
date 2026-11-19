---
id: DOC-ARCH-003
title: AI-SDGS Role, Approval, Tier & Onboarding Model
version: 1.0.0
status: APPROVED
phase: PHASE-1
normative_references:
  - DOC-ARCH-001
  - DOC-ARCH-002
  - DEC-002
  - DEC-007
last_updated: 2026-11-18
---

# ROLE, APPROVAL, TIER & ONBOARDING MODEL

## 1. HUMAN AUTHORITY & AI ROLE TAXONOMY

### 1.1 Human Authority Roles (`[NON-WAIVABLE]` Ownership)

| Role ID | Role Title | Core Governance Authority | Role Collapse Rule (Small Teams / Solo) |
| :--- | :--- | :--- | :--- |
| `HUM-OWNER` | **Project Owner** | Constitutional authority, Tier selection, Baseline lock sign-off, budget/timeline waivers. | Default holder of all unassigned human roles in `TIER-1: LITE` and small `TIER-2` teams. |
| `HUM-PROD` | **Product Authority** | Functional requirements (`REQ-FUNC-*`), feature scope (`CR-FULL` functional sign-off), acceptance criteria. | Collapses into `HUM-OWNER` if unstaffed. |
| `HUM-ARCH` | **Architecture Authority** | `ADR-*` sign-off, module boundaries, external dependencies, DB/API contract mutations. | Collapses into `HUM-OWNER` or Lead Engineer in `TIER-1`/`TIER-2`; **MUST** be distinct or explicitly named in `TIER-3`. |
| `HUM-SEC` | **Security & Ops Authority** | `REQ-SEC-*`, auth/crypto/secret boundaries, CI/CD pipelines, protected path waivers, emergency reconciliation. | Collapses into `HUM-OWNER` in `TIER-1`; **MUST** be explicitly assigned in `TIER-3: STRICT`. |

> **Constitutional Boundary:** Regardless of team size, **no AI agent role may ever inherit or impersonate a `HUM-*` authority role.** Even for a solo developer (`TIER-1`), human sign-off means explicit confirmation by that human developer.

### 1.2 AI Logical Execution Profiles

A project MAY run a single general-purpose AI coding assistant switching profiles by task or multiple specialized subagents:

| Profile ID | Logical AI Role | Permitted Analysis Actions | Permitted Write/Execute Scope (When Authorized) | Hard Prohibitions |
| :--- | :--- | :--- | :--- | :--- |
| `AI-ANALYST` | **AI Architect / Analyst** | Classify prompts, inspect repo, detect baseline conflicts, draft `CR-*` / `ADR-*` / `REQ-*` (`DRAFT` status). | `changes/records/*` (`DRAFT`/`ANALYZED`), `docs/**` (`DRAFT` only). | **MUST NOT** set `status: APPROVED`, lock baselines, or mutate production code during analysis. |
| `AI-IMPL` | **AI Implementer** | Read scoped policies, specs, and code modules within assigned CR/task boundary. | Source code, unit/integration tests, and contract implementations explicitly listed in authorized scope. | **MUST NOT** modify `.aisdgs/**`, `PROJECT-CONSTITUTION.md`, `PROJECT-BASELINE.md`, or out-of-scope modules. |
| `AI-VERIFY` | **AI Verifier / Reviewer** | Execute test suites, run `aisdgs validate` / `aisdgs audit`, inspect diffs against `REQ-*` / `ADR-*`. | `quality/reports/*` and verification evidence sections of active `CR-*`. | **MUST NOT** silently alter failing tests or weaken assertions to manufacture green status. |
| `AI-STEWARD` | **AI Governance Steward** | Detect drift, check cross-links, prepare baseline sync updates and `CHANGELOG-GOVERNANCE.md` entries. | `changes/CHANGELOG-GOVERNANCE.md`, adapter sync outputs (`aisdgs adapter sync`). | **MUST NOT** waive violations (`EXC-*`) or approve Change Requests without human sign-off. |

---

## 2. PROMPT CLASSIFICATION TO GOVERNANCE ROUTING MATRIX

Every incoming user request MUST be mapped deterministically to its required CR track, approval gate, and baseline sync obligation:

| Prompt Category | Typical Examples | Analysis Allowed? | Required CR Track by Tier (`Lite` / `Standard` / `Strict`) | Required Execution Approval | Baseline Re-Lock Needed? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`QUESTION`** / **`INFORMATION_REQUEST`** | "How does auth token refresh work?" | Always | `NONE` / `NONE` / `NONE` | `AUTO_AUTHORIZED_LOW_RISK` (Read-only) | No |
| **`GOVERNANCE_OR_DOC_SYNC`** | "Run `aisdgs validate` and update status report" | Always | `NONE` / `NONE` / `NONE` | `AUTO_AUTHORIZED_LOW_RISK` (Non-normative) | No |
| **`BUG_REPORT`** / **`BUG_FIX`** *(Spec-Restoring)* | "Null pointer when email is uppercase" (no spec change) | Always | `NONE` / `NONE` / `CR-FAST` | `AUTO_AUTHORIZED_LOW_RISK` (`Lite`/`Std`); `HUM-OWNER` (`Strict`) | Only if protected file touched |
| **`REFACTORING`** *(Contract-Preserving)* | "Extract private helper inside `billing/calc`" | Always | `NONE` / `CR-FAST` *(if multi-file)* / `CR-FAST` | `AUTO_AUTHORIZED_LOW_RISK` (`Lite`); `HUM-ARCH` or `HUM-OWNER` (`Std`/`Strict`) | No (invariants unchanged) |
| **`ENHANCEMENT`** *(Bounded)* | "Add pagination sort option on internal admin table" | Always | `CR-FAST` / `CR-FAST` / `CR-FULL` | `HUM-OWNER` (`Lite`/`Std`); `HUM-PROD` + `HUM-ARCH` (`Strict`) | If `REQ-*` updated |
| **`FEATURE_REQUEST`** | "Add OAuth2 SSO login for enterprise workspaces" | Always | `CR-FAST` / `CR-FULL` / `CR-FULL` | `HUM-OWNER` (`Lite`); `HUM-PROD` + `HUM-ARCH` (`Std`/`Strict`) | **Yes (`MUST`)** |
| **`TECHNICAL_CHANGE`** | "Add Redis client package / alter `orders` DB table" | Always | `CR-FAST` / `CR-FULL` / `CR-FULL` | `HUM-OWNER` (`Lite`); `HUM-ARCH` (`Std`); `HUM-ARCH` + `HUM-SEC` (`Strict`) | **Yes (`MUST`)** |
| **`ARCHITECTURAL_CHANGE`** | "Split monolith payment module into gRPC service" | Always | `CR-FULL` / `CR-FULL` / `CR-FULL` | `HUM-OWNER` (`Lite`); `HUM-ARCH` + `HUM-OWNER` (`Std`); Full Board (`Strict`) | **Yes (`MUST` + `ADR-*`)** |
| **`EMERGENCY_CHANGE`** | "Hotfix P0 production crash / active CVE exploit" | Always | `CR-EMERGENCY` (all tiers) | `EMERGENCY_EXPEDITED_APPROVAL` (`HUM-OWNER` or on-call `HUM-SEC`) | **Yes (≤ 72h post-incident)** |

**Mandatory Escalation Rule:** If during a `BUG_FIX` or `REFACTORING` the AI agent discovers that fixing the issue requires altering a public API, database schema, external dependency, or approved `REQ-*` behavior, execution **MUST HALT immediately** and escalate classification to `TECHNICAL_CHANGE` or `FEATURE_REQUEST`.

---

## 3. PROPORTIONAL ADOPTION TIERS SPECIFICATION

| Dimension | `TIER-1: LITE` (Solo / MVP / Prototype) | `TIER-2: STANDARD` (Product Team / Production App) | `TIER-3: STRICT` (Enterprise / Regulated / Critical) |
| :--- | :--- | :--- | :--- |
| **Target Users** | Solo builders, hackathons, early validation MVPs | Commercial SaaS, multi-dev engineering teams | Fintech, healthcare, infrastructure, core platforms |
| **Required Governance Files** | `AGENTS.md`, `.aisdgs/{config,standard-lock,adoption-profile}.yaml`, `governance/{PROJECT-CONSTITUTION,PROJECT-BASELINE}.md`, `changes/CHANGELOG-GOVERNANCE.md` | All `LITE` + `governance/EXCEPTIONS.md`, structured `docs/{requirements,architecture,contracts}/`, `changes/records/CR-*.md` | All `STANDARD` + dedicated `quality/reports/` audit archive, multi-party role assignments, risk register |
| **Requirements & ADRs** | Compact summary inside `PROJECT-BASELINE.md` or lightweight `REQ-*`/`ADR-*` files | Mandatory discrete `REQ-*` & `ADR-*` artifacts with bidirectional links | Mandatory discrete `REQ-*`, `ADR-*`, `RISK-*`, and contract schemas with 100% link coverage |
| **`aisdgs validate` Mode** | Standard (`MUST` = Error, `SHOULD` = Warning) | Standard locally; `--strict` recommended on CI | `--strict` **mandatory** locally (pre-push) and on protected-branch CI |
| **Git Hooks & CI** | Local `pre-commit` recommended (`SHOULD`) | Local `pre-commit` + CI PR gate **mandatory (`MUST`)** | Local hooks + signed/protected CI gate + `CODEOWNERS` human approval **mandatory (`MUST`)** |
| **Exception Waivers (`EXC-*`)** | Allowed in `EXCEPTIONS.md` (max 180 days default) | Requires justification, mitigation & ≤ 90-day expiry | Requires dual `HUM-ARCH` + `HUM-SEC` sign-off & ≤ 60-day hard expiry (CI fails on expired `EXC-*`) |

### 3.1 Seamless Tier Promotion (`Lite` → `Standard` → `Strict`)
Projects evolve without discarding prior governance history:
1. Run `aisdgs update plan --promote-tier standard` (or edit `.aisdgs/config.yaml` under a `CR-FULL`).
2. Extract inline `TIER-1` baseline items into discrete `docs/requirements/` and `docs/architecture/` files preserving existing `REQ-*` and `ADR-*` IDs.
3. Run `aisdgs validate --strict` and `aisdgs baseline lock` under human sign-off.

---

## 4. THREE ONBOARDING PATHWAYS OPERATIONAL SPECIFICATION

### Pathway A — `GREENFIELD` (Clean-Slate Projects)
- **Entry Condition:** Empty or newly scaffolded repository prior to domain feature coding.
- **Gate to Implementation:** Baseline MUST reach `LOCKED` state (approved `PROJECT-CONSTITUTION.md`, core `REQ-*`, foundational `ADR-001` stack/boundary architecture, and `PROJECT-BASELINE.md`) before `FEATURE_REQUEST` coding begins.

### Pathway B — `BROWNFIELD` (Existing / Legacy Codebases)
- **Entry Condition:** Active production or legacy repository with pre-existing source code and partial, outdated, or missing documentation.
- **Zero-Freeze Onboarding Protocol (< 30 Minutes to Initial Safety):**
  1. **Initialize & Inventory:** Run `aisdgs init --mode brownfield` to generate `.aisdgs/` and `AGENTS.md`.
  2. **Anchor Baseline (`baseline_state: ANCHORED`):** Define `PROJECT-CONSTITUTION.md`, declare critical **Protected Paths** (e.g., `db/migrations/**`, `auth/**`, `api/openapi.yaml`, deployment configs), and record top known architectural invariants (`ADR-001`). Lock Anchor Baseline immediately.
  3. **Govern-on-Touch Rule:** Existing untouched legacy modules do NOT require retroactive documentation upfront. However:
     - Urgent Spec-Restoring `BUG_FIX` work proceeds immediately within protected-path rules.
     - Any module targeted by a `FEATURE_REQUEST`, `TECHNICAL_CHANGE`, or `ARCHITECTURAL_CHANGE` MUST first capture its current contract/requirements slice ("micro-baseline on touch") as part of that `CR-*` before mutation.
  4. **Convergence to `LOCKED`:** Once core system domains have baseline coverage, promote `baseline_state` from `ANCHORED` to `LOCKED`.

### Pathway C — `ITERATIVE` (Agile / Vertical-Slice Delivery)
- **Entry Condition:** Product teams building iteratively in sprints or milestones where future feature requirements are intentionally emergent.
- **Slice Protocol:** Lock system-wide constitutional and architectural invariants upfront (`ADR-*`, security model, core data ownership), then author, approve, and lock `REQ-*` + contract deltas incrementally per vertical slice via `CR-FULL` (or Milestone Baseline increments) prior to coding each slice.
