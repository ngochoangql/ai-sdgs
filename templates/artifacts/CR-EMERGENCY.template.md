---
id: "{{CR_ID}}"
title: "EMERGENCY HOTFIX — {{CR_TITLE}}"
version: 1.0.0
artifact_class: GOVERNANCE_RECORD
track: EMERGENCY
classification: EMERGENCY_CHANGE
cr_status: EMERGENCY_ACTIVE
incident_id: "{{INCIDENT_ID}}"
created_at: "{{TIMESTAMP_ISO}}"
risk_level: CRITICAL
affected_files:
  - "src/hotfix/target"
approved_by:
  - "{{HUM_OWNER}}"
last_updated: "{{DATE_ISO}}"
---

# {{CR_ID}} [EMERGENCY HOTFIX] — {{CR_TITLE}}

> **MANDATORY RECONCILIATION CLOCK (`STD-012-R06`, `STD-012-R07`):** This record MUST transition from `EMERGENCY_ACTIVE` to `VERIFIED`/`CLOSED` within **72 hours** (`LITE`/`STANDARD`) or **48 hours** (`STRICT`) of `created_at`, or `aisdgs validate` will fail (`Exit Code 1`).

## 1. INCIDENT MITIGATION SCOPE (FILL IMMEDIATELY — < 2 MINUTES)
- **Incident / Outage Summary (`{{INCIDENT_ID}}`):** Describe active production failure or security exploit.
- **Expedited Approver:** `{{HUM_OWNER}}` (`EMERGENCY_EXPEDITED_APPROVAL`).
- **Surgical Fix Boundary:** Minimum diff applied to restore service safety (zero unrelated refactoring).

## 2. POST-INCIDENT RECONCILIATION CHECKLIST (COMPLETE ≤ 72H / 48H)
- [ ] Root-cause & blast-radius impact analysis documented.
- [ ] Automated regression test reproducing the outage/exploit added and passing (`STD-009-R03`).
- [ ] Affected `REQ-*`, `ADR-*`, and contract specifications synchronized (`STD-003-R08`).
- [ ] `aisdgs audit --cr {{CR_ID}}` & `aisdgs validate` passing (`Exit Code 0`).
- [ ] `PROJECT-BASELINE.md` re-locked via `aisdgs baseline lock` under `HUM-SEC` / `HUM-ARCH` review.
