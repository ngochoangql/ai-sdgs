---
id: POLICY-001
title: Prompt Classification, Change Control & Multi-Agent Playbook
version: 1.0.0
status: APPROVED
artifact_class: NORMATIVE_SPEC
normative_references:
  - STD-005
  - STD-006
  - STD-010
  - STD-011
last_updated: 2026-11-18
---

# TIER 1 PLAYBOOK — PROMPT CLASSIFICATION, CHANGE CONTROL & MULTI-AGENT LEASES

Load this playbook whenever an incoming request is classified as `ENHANCEMENT`, `FEATURE_REQUEST`, `TECHNICAL_CHANGE`, `ARCHITECTURAL_CHANGE`, a compound mutating prompt, or a multi-agent task.

---

## 1. PRE-EXECUTION TRIAGE & COMPOUND DECOMPOSITION (`STD-011-R01..02`)

1. **Check Baseline Readiness (`STD-005-R03`):** Inspect `governance/PROJECT-BASELINE.md`. If `baseline_state == UNINITIALIZED`, do **NOT** implement features; guide the human through establishing the initial baseline first (`STD-007`).
2. **Decompose Compound Prompts:** If a prompt mixes read-only questions with code/architecture changes:
   - Answer the read-only portion immediately.
   - Isolate each mutating intent and apply the governance gate of the **highest-risk** category before touching governed files.
3. **Clarify Material Ambiguity (`STD-011-R07`):** If data models, public API contracts, auth rules, or third-party dependencies are underspecified, ask concise clarifying questions or present options (`PROPOSED`) before mutating files.

---

## 2. SELECTING `FAST` VS. `FULL` TRACK (`STD-006-R01..05`)

### Track A — `CR-FAST` (`track: FAST`, 5 Core Attributes)
Use **ONLY** when ALL of the following hold:
- Tier is `LITE` (for non-architectural changes) OR change is a bounded `ENHANCEMENT` / multi-file `REFACTORING` in `STANDARD` / `BUG_FIX` in `STRICT`.
- **Zero** breaking public API/CLI/event changes.
- **Zero** new external runtime/build packages (`STD-008-R03`).
- **Zero** database migrations or persistent schema alterations (`STD-008-R04`).
- **Zero** module boundary or `ADR-*` invariant shifts (`STD-008-R02`).

**`CR-FAST` Execution Steps:**
1. Create `changes/records/CR-XXXX.md` (`aisdgs change create --track fast`) with `cr_status: DRAFT`, `classification`, `affected_requirements`, and explicit `affected_files` globs.
2. Present scope to `HUM-OWNER` and wait for confirmation (`approved_by` populated → `cr_status: APPROVED`).
3. Switch to `AI-IMPL`, edit **only** `affected_files`, verify tests + `aisdgs validate`, populate `verification_evidence`, and re-lock baseline if any baselined doc changed.

### Track B — `CR-FULL` (`track: FULL`, 14 Attributes + 6D Impact)
Mandatory across **all tiers** for `ARCHITECTURAL_CHANGE`, and mandatory in **`STANDARD`/`STRICT`** for `FEATURE_REQUEST`, `TECHNICAL_CHANGE`, security-sensitive work, or cross-module changes.

**`CR-FULL` Execution Steps:**
1. Create `changes/records/CR-XXXX.md` (`aisdgs change create --track full`) in `AI-ANALYST` profile (`cr_status: DRAFT`).
2. Perform **6-Dimension Impact Analysis (`STD-006-R06`)**:
   - (1) `REQ-*` additions/modifications/conflicts
   - (2) Module & `ADR-*` architectural boundaries
   - (3) Database schema & migration forward/backward safety
   - (4) Public API / integration compatibility
   - (5) Security, privacy & performance risk (`LOW` | `MEDIUM` | `HIGH` | `CRITICAL`)
   - (6) Synchronized test & documentation scope
3. Transition to `cr_status: ANALYZED`, summarize blast radius + `rollback_summary`, and **STOP for required `HUM-*` sign-off** (`HUM-PROD`, `HUM-ARCH`, `HUM-SEC` per matrix).
4. Once `HUM-*` authorizes (`cr_status: APPROVED` → `IN_PROGRESS`), implement strictly inside `affected_files`, update `affected_docs` atomically (`STD-003-R08`), verify (`STD-009`), and re-lock `PROJECT-BASELINE.md` upon human closure sign-off.

### Mandatory In-Flight Escalation (`STD-006-R05`)
If during a Zero-CR `BUG_FIX` or `CR-FAST` you discover you must alter a DB table, install a package, change an API contract, or touch files outside `affected_files`: **HALT code edits immediately**, upgrade the CR in-place to `track: FULL` (keeping the same `CR-XXXX` ID), and request human approval.

---

## 3. CONFLICT DETECTION & MULTI-AGENT WRITE LEASES (`STD-006-R07`, `STD-010-R05..06`)

1. **Check Active CR Collisions:** Inspect `changes/records/` for any other `APPROVED` or `IN_PROGRESS` CR whose `affected_files` overlap yours. Do not silently overwrite concurrent work; report overlap for human sequencing.
2. **Parallel Subagent Coordination:**
   - Freeze shared contracts (`docs/contracts/**`, shared types/interfaces, DB schemas) **before** fanning out parallel workers.
   - Assign each subagent a disjoint `allowed_write_globs` lease.
   - If a worker needs a shared contract change mid-task, it MUST stop and escalate to the coordinator rather than mutating shared files directly.
