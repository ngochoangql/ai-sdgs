---
id: POLICY-003
title: Verification, Test Integrity & Evidence Reporting Playbook
version: 1.0.0
status: APPROVED
artifact_class: NORMATIVE_SPEC
normative_references:
  - STD-003
  - STD-009
  - STD-011
last_updated: 2026-11-18
---

# TIER 1 PLAYBOOK — VERIFICATION, TEST INTEGRITY & EVIDENCE REPORTING

Load this playbook before completing **any** mutating task (`BUG_FIX`, `REFACTORING`, `CR-FAST`, `CR-FULL`, `CR-EMERGENCY`, or `GOVERNANCE_OR_DOC_SYNC`).

---

## 1. ANTI-TAMPERING TEST INTEGRITY RULES (`STD-009-R01..03`)

1. **Zero Test Sabotage (`[NON-WAIVABLE]`):** You MUST NEVER:
   - Delete, comment out, or add `.skip` / `xit` / `#[ignore]` / `@pytest.mark.skip` to failing tests to obtain a green exit code.
   - Loosen assertions or hardcode fake return values in production code (`if (isTest) return true`) to satisfy tests.
   - Commit or push with `--no-verify` to bypass Git hooks.
   *(Existing acceptance tests may be modified ONLY when the underlying `REQ-*` or contract changed under an `APPROVED` `CR-*`.)*
2. **Required Test Coverage by Action:**
   - **`BUG_FIX`:** Add or update a regression test reproducing the bug and proving the fix (`SHOULD` in `LITE`; `MUST` in `STANDARD`/`STRICT` where test harness exists).
   - **`FEATURE_REQUEST` / `TECHNICAL_CHANGE`:** Add automated tests verifying every acceptance criterion (`AC-*`) of affected `REQ-*` items (`STD-005-R02`).
3. **Handling Requests to "Skip Verification" (`STD-009-R06`):**
   - If the user says *"skip tests and mark it done"*, **refuse to fabricate `VERIFIED` status**. State clearly that tests were skipped at user direction and report status strictly as `IMPLEMENTED (UNVERIFIED)`.

---

## 2. THREE-STEP PRE-COMPLETION VERIFICATION GATE (`STD-009-R04..05`, `STD-003-R08`)

Before declaring a task or Change Request ready for closure:

1. **Step 1 — Synchronous Doc & Scope Check:**
   - Run `git status` / `git diff --name-only`.
   - Confirm zero unintended files outside authorized scope (`STD-006-R02`, `STD-010-R01`) were modified.
   - Confirm all affected `REQ-*`, `ADR-*`, and contract docs were updated in the same atomic change (`STD-003-R08`).
2. **Step 2 — Deterministic `L2` Execution:**
   - Run the project's canonical build, linter, typechecker, and test command(s) declared in `PROJECT-CONSTITUTION.md`.
   - Run `aisdgs validate` (or `aisdgs validate --strict` in `STRICT` tier) and `aisdgs change verify <CR-ID>` (if under a CR).
   - Confirm `Exit Code 0` (`COMPLIANT` or `COMPLIANT_WITH_WAIVERS`).
3. **Step 3 — Assisted `L3` Semantic Audit (When Applicable):**
   - For `CR-FULL` with `MEDIUM` / `HIGH` / `CRITICAL` risk (`SHOULD` in `STANDARD`; `MUST` in `STRICT`), generate and inspect `aisdgs audit --cr <CR-ID>` against the 6-point rubric (`AUD-01`..`AUD-06`).

---

## 3. FACTUAL CLAIM-STATE REPORTING PROTOCOL (`STD-011-R06`)

Every mutating task summary and CR verification block MUST state the exact **Claim Maturity State**:

| Claim State | When to Use | Mandatory Disclosure in Response |
| :--- | :--- | :--- |
| **`PROPOSED`** | Analysis, options, or `DRAFT`/`ANALYZED` CR/ADR written; awaiting human sign-off. | Affected IDs/files + explicit decision needed from `HUM-*`. |
| **`APPROVED`** | Human signed off on spec/CR, implementation not yet finished. | Authorized scope & next implementation step. |
| **`IMPLEMENTED`** | Code/docs edited on disk, **verification commands NOT yet executed or failing**. | Modified files + **exact reason why verification is incomplete/failing**. |
| **`VERIFIED`** | Code/docs complete **AND** build/test + `aisdgs validate` actually executed and passed. | Modified files + linked `CR-*`/`REQ-*` + **exact commands run & pass results**. |

Never run `aisdgs baseline lock` autonomously to clear a hash mismatch; summarize verified changes and prompt the Human Authority to authorize/execute baseline re-locking (`STD-005-R07`).
