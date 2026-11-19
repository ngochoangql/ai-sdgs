# AI-SDGS ARCHITECTURAL & DESIGN DECISION LOG

**Purpose:** Single authoritative ledger of human-ratified architectural decisions across Milestone 1 and Milestone 2.

---

## 1. RATIFIED DECISIONS (`APPROVED` — FROZEN `v1.0.0` BASELINE)

| ID | Title | Status | Approved Phase | Decision Summary |
| :--- | :--- | :--- | :--- | :--- |
| `DEC-001` | **Two-Milestone Delivery Roadmap** | `APPROVED` | Master v2.0.0 | Build AI-SDGS across Milestone 1 (Standards, Schemas, Templates, Adapters, Specs: Phases 0–7) and Milestone 2 (Executable `aisdgs` CLI & Validators: Phases 8–10). |
| `DEC-002` | **Proportional Multi-Tier & Multi-Pathway Governance** | `APPROVED` | Master v2.0.0 | Support 3 Adoption Tiers (`Lite`, `Standard`, `Strict`), 3 Onboarding Pathways (`Greenfield`, `Brownfield`, `Iterative`), and 2 Change Tracks (`CR-FAST`, `CR-FULL`) + `EMERGENCY`. |
| `DEC-003` | **3-Tier Progressive Context & 3-Layer Control Model** | `APPROVED` | Master v2.0.0 | Enforce `AGENTS.md ≤ 150 lines` as Context Tier 0 router, Tier 1 playbooks (`≤ 250 lines`), and Tier 2 reference/schemas; map rules to `L1-Advisory`, `L2-Deterministic`, or `L3-Semantic-Audit`. |
| `DEC-004` | **Deferred Evidence-Based CLI Stack Selection** | `APPROVED` | Master v2.0.0 | Defer final CLI implementation language selection to Phase 6 ADR based on zero-dependency distribution, schema tooling, and verified host build capability. |
| `DEC-005` | **Freeze Core Catalog at Exactly 12 Standards (`STD-001`..`STD-012`)** | `APPROVED` | Phase 0 Gate | Lock universal catalog at 12 orthogonal standards organized in a strict Directed Acyclic Graph (zero circular dependencies). |
| `DEC-006` | **Strict Separation Between `ai-sdgs` Source Repo and `TARGET-PROJECT` Layout** | `APPROVED` | Phase 0 Gate | Keep source monorepo paths (`standard/`, `schemas/`, `policies/`, `templates/`, `adapters/`, `cli/`, `dist/`) strictly separate from materialized consumer paths (`.aisdgs/`, `governance/`). |
| `DEC-007` | **Defense-in-Depth Against Local Agent Self-Approval (`RISK-01`)** | `APPROVED` | Phase 0 Gate | Combine Ring 1 (adapter deny-globs), Ring 2 (SHA-256 baseline/lockfile & Git working-tree diff verification), and Ring 3 (out-of-band CI PR enforcement for `TIER-2`/`TIER-3`). |
| `DEC-008` | **Bilingual Collaboration / English Normative Artifact Policy** | `APPROVED` | Phase 0 Gate | Author all repository deliverables and code in precision English; conduct phase reviews and architectural collaboration in Vietnamese. |
| `DEC-009` | **Track-Independent CR Identifiers (`CR-XXXX`)** | `APPROVED` | Phase 1 Gate | Use `CR-[0-9]{4}` as canonical Change Request ID and store `track: FAST \| FULL \| EMERGENCY` in YAML frontmatter to preserve links on track escalation. |
| `DEC-010` | **Thin Vendor Bridge Adapters (`≤ 40 lines`)** | `APPROVED` | Phase 1 Gate | Restrict vendor-specific files (`CLAUDE.md`, `GEMINI.md`, `.cursor/rules/aisdgs.mdc`, etc.) to `≤ 40 lines` delegating to `AGENTS.md` (`≤ 150 lines`). |
| `DEC-011` | **Atomic Rule IDs (`STD-XXX-Rnn`) & `[NON-WAIVABLE]` Tags** | `APPROVED` | Phase 1 Gate | Number every normative requirement (`STD-001-R01`, etc.) and tag each `[NON-WAIVABLE]` (`48` rules) or `[WAIVABLE]` (`48` rules). |
| `DEC-012` | **Brownfield `ANCHORED` Baseline & Govern-on-Touch Protocol** | `APPROVED` | Phase 1 Gate | Support `< 30 min` legacy onboarding via `baseline_state: ANCHORED` plus progressive module micro-baselining on touch. |
| `DEC-013` | **LF-Normalized SHA-256 Hashing for Lockfiles & Baselines** | `APPROVED` | Phase 2 Gate | Normalize text file line endings (`\r\n` → `\n`) before computing SHA-256 digests so Windows and Linux/macOS CI produce identical hashes. |
| `DEC-014` | **Native Schema Delegation as Baseline SSoT (`STD-004-R07`)** | `APPROVED` | Phase 2 Gate | Allow executable schema files (`openapi.yaml`, `.proto`, `.graphql`, `.sql`) to be hashed directly in `PROJECT-BASELINE.md` without redundant Markdown duplication. |
| `DEC-015` | **Four-Group Default `protected_paths` Preset (`STD-010-R02` & `STD-012-R03`)** | `APPROVED` | Phase 3 Gate | Ship `.aisdgs/config.yaml` with default globs protecting `.aisdgs/**`, `governance/**` + adapters, multi-ecosystem package manifests/lockfiles, and DB migrations + CI workflows. |
| `DEC-016` | **72h / 48h Automatic Reconciliation Deadline on `CR-EMERGENCY` (`STD-012-R07`)** | `APPROVED` | Phase 3 Gate | Permit `< 2 min` `EMERGENCY_ACTIVE` hotfix records while automatically failing `aisdgs validate` (`Exit Code 1`) once 72h (`LITE`/`STANDARD`) or 48h (`STRICT`) elapses. |
| `DEC-017` | **Zero-Dependency `{{TOKEN_NAME}}` Template Substitution Contract** | `APPROVED` | Phase 4 Gate | Standardize all project and artifact templates on plain `{{TOKEN_NAME}}` string substitution (`DOC-PLT-001`). |
| `DEC-018` | **Schema-Level AI Approver Rejection (`not.pattern` Guard)** | `APPROVED` | Phase 4 Gate | Embed negative regex assertions inside JSON Schemas blocking AI prefixes (`AI-`, `agent`, `claude`, `gemini`, `gpt`, `copilot`, `bot`) in `roles` and `approved_by`. |
| `DEC-019` | **Deterministic `<!-- aisdgs-sync: ... config_sha256=... -->` Adapter Header** | `APPROVED` | Phase 5 Gate | Embed HTML sync comment header on `AGENTS.md` and bridges for invisible, deterministic adapter drift detection. |
| `DEC-020` | **Non-Destructive Ring 1 `.claude/settings.json` Permission Merge** | `APPROVED` | Phase 5 Gate | Merge Ring 1 `deny`/`ask` permission rules via array union without overwriting existing user tool settings. |
| `DEC-021` | **Select Option B (`Node.js v24` Zero-External-Dep TypeScript + SEA) for `aisdgs` CLI** | `APPROVED` | Phase 6 Gate | Implement Milestone 2 `cli/` in `Node.js v24` native TypeScript using `node:*` built-in modules (`dependencies: {}`, `node:test`). |
| `DEC-022` | **Embedded Offline Standard Bundle & Zero Default Telemetry** | `APPROVED` | Phase 6 Gate | Embed default approved `standard/`, `schemas/`, `policies/`, `templates/`, and `adapters/` bundle offline inside `aisdgs` with zero outbound network telemetry. |
| `DEC-023` | **Ratify Milestone 1 Release Baseline (`v1.0.0-spec`) & Authorize Milestone 2 (`cli/`)** | `APPROVED` | Phase 7 Gate | Freeze Milestone 1 normative baseline and begin Milestone 2 `cli/` implementation. |
| `DEC-024` | **Erasable Native TypeScript + Auto-Generated `embedded-bundle.ts`** | `APPROVED` | Phase 8 Gate | Run `.ts` directly on `Node.js v24` with zero external packages and 44 embedded bundle files. |
| `DEC-025` | **Bounded `# >>> AI-SDGS-HOOK START/END` Chaining & Hash-Verified Staged Baseline Pass** | `APPROVED` | Phase 9 Gate | Preserve pre-existing Git hooks on `install`/`uninstall` and treat staged files matching locked `SHA256-UTF8-LF` digests as authorized state. |

---

## 2. FINAL RELEASE PACKAGING DECISION (`PHASE 10`)

| ID | Title | Status | Decision Summary |
| :--- | :--- | :--- | :--- |
| `DEC-026` | **Single-File Portable Release Bundle (`dist/aisdgs-standalone.mjs`) via `node:module` `stripTypeScriptTypes`** | `PROPOSED` / `VERIFIED` | Emit a single 338.6 KB pure-ESM file (`dist/aisdgs-standalone.mjs`) + OS shims + `sea-config.json` + `RELEASE-MANIFEST.json` using built-in `Node.js v24` APIs (zero bundler dependencies), verified in isolated E2E subprocess execution (`E2E-04`). |
