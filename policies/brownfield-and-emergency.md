---
id: POLICY-004
title: Brownfield Legacy Onboarding, Waivers & Emergency Hotfix Playbook
version: 1.0.0
status: APPROVED
artifact_class: NORMATIVE_SPEC
normative_references:
  - STD-002
  - STD-007
  - STD-012
last_updated: 2026-11-18
---

# TIER 1 PLAYBOOK — BROWNFIELD LEGACY, WAIVERS (`EXC-*`) & EMERGENCY HOTFIXES

Load this playbook when operating inside a `BROWNFIELD` (`baseline_state: ANCHORED`) codebase, proposing a temporary governance waiver (`EXC-*`), or mitigating a P0 production incident (`EMERGENCY_CHANGE`).

---

## 1. BROWNFIELD `ANCHORED` & GOVERN-ON-TOUCH PROTOCOL (`STD-007-R04..05`)

Legacy repositories onboard onto AI-SDGS without halting ongoing maintenance:

1. **Establishing Initial Safety (`< 30 Minutes`):**
   - Ensure `.aisdgs/config.yaml` protects `.aisdgs/**`, `governance/**`, package manifests, DB migrations, public API contracts, and CI workflows (`protected_paths`).
   - Capture known top-level stack and boundary invariants in `PROJECT-CONSTITUTION.md` and `ADR-001` (or `PROJECT-BASELINE.md` §2.1), obtain `HUM-OWNER` approval, and lock as `baseline_state: ANCHORED`.
2. **Operating Under `baseline_state: ANCHORED` ("Govern-on-Touch"):**
   - **Untouched Legacy Modules:** Do NOT block unrelated tasks demanding retroactive documentation of the entire repository.
   - **Spec-Restoring `BUG_FIX`:** Proceed immediately inside affected legacy files (respecting `protected_paths` and adding a regression test where feasible).
   - **Feature, Contract, or Architectural Edits to Legacy Code:** Before mutating an undocumented legacy module under a `FEATURE_REQUEST`, `TECHNICAL_CHANGE`, or `ARCHITECTURAL_CHANGE`, include a **Micro-Baseline Slice** (`REQ-*` + current interface contract summary) inside that `CR-*` and lock those newly documented specs upon CR closure.
3. **Handling Pre-Existing Code-Documentation Divergence:**
   - If you discover existing code already contradicts an older project doc, **do NOT silently "fix" code or overwrite the doc**. Report the divergence (`STD-001-R08`) so `HUM-OWNER` / `HUM-ARCH` decides whether code or doc represents intended truth.

---

## 2. CONTROLLED WAIVERS & TACTICAL TECH DEBT (`STD-002-R03..08`)

1. **Check Waivability First:** Consult `.aisdgs/standard/STD-XXX.md` (or `DOC-PLT-001` §3). The **48 `[NON-WAIVABLE]` rules** (human authority, lockfile integrity, secret isolation, test non-tampering, etc.) can **NEVER** be waived.
2. **Drafting a Valid `EXC-XXXX` Waiver:**
   - Add a `DRAFT` entry in `governance/EXCEPTIONS.md` specifying: `id` (`EXC-XXXX`), `waives_rules` (`STD-XXX-Rnn`), `affected_scope`, `risk_level` (`LOW` | `MEDIUM` | `HIGH` — `CRITICAL` is forbidden), `justification`, `compensating_control`, `remediation_plan`, and `expires_at` (`≤ 180d` `LITE`, `≤ 90d` `STANDARD`, `≤ 60d` `STRICT`).
   - Present to `HUM-OWNER` (`LOW`/`MED`) or `HUM-ARCH` + `HUM-SEC` (`HIGH` / `STRICT`) for activation (`status: ACTIVE`).

---

## 3. P0 INCIDENT `EMERGENCY_CHANGE` PROTOCOL (`STD-012-R06..07`)

Use **ONLY** during an active production outage, severe data-corruption event, or actively exploited security vulnerability when human incident leadership grants `EMERGENCY_EXPEDITED_APPROVAL`:

1. **Step 1 — Rapid Registration (`< 2 Minutes`):**
   - Create `changes/records/CR-XXXX.md` with `track: EMERGENCY`, `classification: EMERGENCY_CHANGE`, `cr_status: EMERGENCY_ACTIVE`, `incident_id`, ISO `created_at` timestamp, and `approved_by` (`HUM-OWNER` or on-call `HUM-SEC`).
2. **Step 2 — Surgical Mitigation Only:**
   - Apply the **minimum code/config diff** necessary to stop customer/security impact. Zero opportunistic cleanup, zero unrelated dependency upgrades.
   - Run fastest available targeted tests/smoke checks without delaying service restoration.
3. **Step 3 — Mandatory Post-Incident Reconciliation (`≤ 72h` `LITE`/`STD`, `≤ 48h` `STRICT`):**
   - Backfill root-cause & impact analysis, permanent regression test (`STD-009-R03`), and synchronized `REQ-*`/`ADR-*`/contract updates.
   - Run `aisdgs audit --cr CR-XXXX` + `aisdgs validate`, re-lock `PROJECT-BASELINE.md` under `HUM-SEC` / `HUM-ARCH` review, and transition `CR-XXXX` to `VERIFIED` → `CLOSED` before the deadline expires.
