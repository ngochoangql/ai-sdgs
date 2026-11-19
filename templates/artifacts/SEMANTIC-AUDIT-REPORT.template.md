---
id: "AUDIT-{{CR_ID}}"
title: "L3 Semantic Governance Audit — {{CR_ID}}"
version: 1.0.0
status: DRAFT
artifact_class: GOVERNANCE_RECORD
last_updated: "{{DATE_ISO}}"
---

# LAYER 3 SEMANTIC GOVERNANCE AUDIT — {{CR_ID}}

- **Target Change Request:** `{{CR_ID}}`
- **Base / Head Git Ref:** `{{BASE_REF}}..{{HEAD_REF}}`
- **Reviewer Identity:** `{{REVIEWER_ID}}` *(Independent `AI-VERIFY` session + `HUM-*` sign-off per `STD-009-R05`, `STD-010-R07`)*

## 1. DETERMINISTIC INPUT BUNDLE SUMMARY
- **Touched Files (`git diff --name-only`):** Listed and checked against `{{CR_ID}}` `affected_files`.
- **Linked Specifications Inspected:** `REQ-*`, `ADR-*`, and contract schemas loaded into audit context.

## 2. SEMANTIC COMPLIANCE RUBRIC (`PASS` | `FAIL` | `N/A`)

| Check ID | Audit Dimension | Verdict | Findings & File:Line Evidence |
| :--- | :--- | :--- | :--- |
| `AUD-01` | **Scope Containment (`STD-006-R02`):** Zero undeclared feature smuggling or drive-by edits. | `PASS` | |
| `AUD-02` | **Requirement Fidelity (`STD-005-R02`):** Code logic satisfies all acceptance criteria of linked `REQ-*`. | `PASS` | |
| `AUD-03` | **Architecture Invariants (`STD-008-R02`):** Zero forbidden cross-module couplings or ADR violations. | `PASS` | |
| `AUD-04` | **Contract & Migration Safety (`STD-008-R04..05`):** Backward compatibility & rollback safety verified. | `PASS` | |
| `AUD-05` | **Test Integrity (`STD-009-R02..03`):** Meaningful assertions added; zero skipped/weakened tests. | `PASS` | |
| `AUD-06` | **Security & Secret Hygiene (`STD-012-R01..04`):** Zero hardcoded secrets, auth bypasses, or unsafe sinks. | `PASS` | |

## 3. FINAL AUDIT VERDICT
- **Overall Result:** `COMPLIANT` | `REVISIONS_REQUIRED`
- **Required Remediation Actions (if any):** None.
