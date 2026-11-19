---
id: "{{CR_ID}}"
title: "{{CR_TITLE}}"
version: 1.0.0
artifact_class: GOVERNANCE_RECORD
track: FULL
classification: FEATURE_REQUEST
cr_status: DRAFT
request_source: "{{HUM_OWNER}}"
risk_level: MEDIUM
affected_requirements:
  - "REQ-FUNC-001"
affected_adrs: []
affected_docs:
  - "docs/requirements/REQ-FUNC-001.md"
affected_files:
  - "src/**"
  - "docs/requirements/REQ-FUNC-001.md"
dependency_impact: "None (zero new external packages)"
rollback_summary: "Revert commit(s) and restore prior baseline lock; zero destructive schema changes."
required_approvals:
  - "HUM-PROD"
  - "HUM-ARCH"
last_updated: "{{DATE_ISO}}"
---

# {{CR_ID}} [FULL TRACK] — {{CR_TITLE}}

## 1. REQUEST DESCRIPTION & JUSTIFICATION (`STD-006-R04`)
- **Problem / Business Need:** State why this baseline mutation is requested.
- **Baseline Conflict Check (`STD-006-R07`):** Identify any existing `REQ-*`, `ADR-*`, or concurrent `CR-*` impacted or superseded.

## 2. SIX-DIMENSION IMPACT & RISK ANALYSIS (`STD-006-R06`)
1. **Requirements & Business Logic:** Detail new/modified `REQ-*` items and acceptance criteria.
2. **Architecture & Module Boundaries:** Confirm alignment with `ADR-*` (or link new `ADR-*`).
3. **Database & Persistent State (`STD-008-R04`):** Migration forward/backward compatibility and data-loss check.
4. **Public API & Integration Contracts (`STD-008-R05`):** Breaking vs. backward-compatible contract impact.
5. **Security, Privacy & Performance (`STD-012-R04`):** Auth, secret, input validation, and latency implications.
6. **Test & Documentation Sync Scope (`STD-003-R08`):** Exact specs and regression/acceptance tests to update atomically.

## 3. PROPOSED SOLUTION & IMPLEMENTATION PLAN
1. Step-by-step scoped implementation plan inside `affected_files`.
2. Rejected alternative(s) and trade-off rationale.

## 4. VERIFICATION EVIDENCE & CLOSURE (`STD-006-R08`, `STD-009-R01`)
- **Executed Commands & Test Outputs:** *(Populate `verification_evidence` array in frontmatter after actual execution).*
- **Baseline Re-Lock Version:** *(Record `relocked_baseline_version` upon `aisdgs baseline lock`).*
