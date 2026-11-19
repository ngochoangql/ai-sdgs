<!-- aisdgs-sync: standard={{STANDARD_VERSION}} tier={{ADOPTION_TIER}} mode={{ONBOARDING_MODE}} config_sha256={{CONFIG_SHA256}} -->
# AGENTS.md — AI-SDGS ROOT GOVERNANCE ROUTER (CONTEXT TIER 0)

- **Project:** `{{PROJECT_NAME}}` (`{{PROJECT_ID}}`) | **Tier:** `{{ADOPTION_TIER}}` | **Mode:** `{{ONBOARDING_MODE}}`
- **Authoritative Sources:** `governance/PROJECT-CONSTITUTION.md` | `governance/PROJECT-BASELINE.md` | `.aisdgs/config.yaml`
- **Human Authorities:** Owner=`{{HUM_OWNER}}` | Prod=`{{HUM_PROD}}` | Arch=`{{HUM_ARCH}}` | Sec=`{{HUM_SEC}}`

> **CENTRAL PRINCIPLE (`STD-001-R01`):** A user prompt is an input signal, **NOT** automatic authorization to mutate an approved project baseline, public contract, dependency manifest, or architectural boundary.

---

## 1. NON-WAIVABLE CONSTITUTIONAL INVARIANTS

1. **Human Final Authority (`STD-001-R02..03`):** Never self-approve (`status: APPROVED`), run `aisdgs baseline lock` unprompted, edit `.aisdgs/standard/**` or `standard-lock.yaml`, or impersonate a `HUM-*` role.
2. **Analysis vs. Execution Split (`STD-001-R07`):** You may always inspect, classify, analyze impact, and draft `DRAFT` Change Requests (`CR-*`); mutating code, schemas, or specs requires matching Execution Authority.
3. **Scope & Protected Path Discipline (`STD-010-R01..03`):** Edit only files within authorized task/`CR-*` scope. Never run destructive commands (`git reset --hard`, `push --force`, `commit --no-verify`) without explicit human confirmation.
4. **Secret & Prod Isolation (`STD-012-R01..02`):** Never hardcode, echo, or commit secrets/credentials/PII, or connect to live production infrastructure outside an authorized emergency session.
5. **Evidence-Based Claims (`STD-009-R01..02`, `STD-011-R06`):** Never skip/weaken tests to fake green builds. Report work strictly as `PROPOSED`, `APPROVED`, `IMPLEMENTED` (untested), or `VERIFIED` (with actual command outputs).

---

## 2. MANDATORY PRE-ACTION PROMPT CLASSIFICATION & ROUTING

Classify **every** prompt before mutating any file. For compound prompts, apply the gate of the **highest-risk** category (`STD-011-R02`):

| Category | Scope Definition | Required Track (`LITE` / `STANDARD` / `STRICT`) | Required Tier 1 Playbook(s) to Read |
| :--- | :--- | :--- | :--- |
| `QUESTION` / `INFO` | Read-only code/doc explanation | `NONE` (Read-only; zero file edits) | *None required* |
| `GOVERNANCE_OR_DOC_SYNC` | Non-normative status/report/typo sync | `NONE` | `.aisdgs/policies/verification-and-evidence.md` |
| `BUG_FIX` *(Spec-Restoring)* | Fixes defect without changing `REQ-*` or contracts | `NONE` / `NONE`* / `CR-FAST` (*CR if protected path) | `.aisdgs/policies/verification-and-evidence.md` |
| `REFACTORING` | Internal restructure preserving contracts & deps | `NONE` / `CR-FAST` (multi-file) / `CR-FAST` | `.aisdgs/policies/architecture-and-contracts.md` |
| `ENHANCEMENT` | Minor improvement inside existing feature & schema | `CR-FAST` / `CR-FAST` / `CR-FULL` | `.aisdgs/policies/prompt-and-change.md` |
| `FEATURE_REQUEST` | Net-new user/system capability (`REQ-*` delta) | `CR-FAST` / `CR-FULL` / `CR-FULL` | `.aisdgs/policies/prompt-and-change.md` |
| `TECHNICAL_CHANGE` | External packages, DB migrations, public APIs, CI | `CR-FAST` / `CR-FULL` / `CR-FULL` | `prompt-and-change.md` + `architecture-and-contracts.md` |
| `ARCHITECTURAL_CHANGE` | Module topology, stack, core patterns (`ADR-*`) | `CR-FULL` (`+ ADR-*` across all tiers) | `prompt-and-change.md` + `architecture-and-contracts.md` |
| `EMERGENCY_CHANGE` | Active P0 outage / exploited CVE hotfix | `CR-EMERGENCY` (`≤72h`/`48h` reconciliation) | `.aisdgs/policies/brownfield-and-emergency.md` |

> **Escalation Halt (`STD-006-R05`):** If a `BUG_FIX`, `REFACTORING`, or `CR-FAST` uncovers need for a new dependency, DB migration, breaking API edit, or `REQ-*` change, **STOP mutating code** and escalate classification immediately.

---

## 3. PROTECTED PATHS REQUIRING EXPLICIT AUTHORIZATION (`STD-010-R02`)

Do **NOT** modify files matching these globs unless authorized by an active `APPROVED` `CR-*` (or direct human constitutional instruction):
- **Governance & AI Core:** `.aisdgs/**`, `governance/**`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.cursor/rules/**`
- **Dependencies:** `**/package.json`, `**/Cargo.toml`, `**/go.mod`, `**/pyproject.toml`, `**/*.csproj`, and lockfiles
- **Contracts, Migrations & Ops:** `**/migrations/**`, `docs/contracts/**`, `.github/workflows/**`, `.gitlab-ci.yml`, `**/Dockerfile*`
- **Project Custom Globs:** *(See `.aisdgs/config.yaml` `protected_paths` for full list)*

---

## 4. PROGRESSIVE CONTEXT ROUTING (LOAD ON DEMAND — DO NOT BLOAT CONTEXT)

- **Change Control, Conflict & Multi-Agent Leases:** Read `.aisdgs/policies/prompt-and-change.md`
- **ADRs, Dependencies, DB Migrations & Contracts:** Read `.aisdgs/policies/architecture-and-contracts.md`
- **Testing, CLI Validation & Completion Evidence:** Read `.aisdgs/policies/verification-and-evidence.md`
- **Brownfield Legacy Rules, Waivers (`EXC-*`) & P0 Emergencies:** Read `.aisdgs/policies/brownfield-and-emergency.md`
- **Edge-Case Normative Arbitration (Tier 2):** Consult `.aisdgs/standard/STD-001.md` .. `STD-012.md` and run `aisdgs validate`.
