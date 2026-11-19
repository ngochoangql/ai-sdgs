---
id: "{{CR_ID}}"
title: "{{CR_TITLE}}"
version: 1.0.0
artifact_class: GOVERNANCE_RECORD
track: FAST
classification: ENHANCEMENT
cr_status: DRAFT
affected_requirements: []
affected_files:
  - "src/example/path"
last_updated: "{{DATE_ISO}}"
---

# {{CR_ID}} [FAST TRACK] — {{CR_TITLE}}

## 1. TRIGGER & SCOPE SUMMARY (`STD-006-R03`)
- **Prompt / Request Trigger:** Summarize the bounded enhancement, refactoring, or `LITE` feature request.
- **Containment Check (`STD-006-R05`):** Confirm zero breaking public API changes, zero unapproved new dependencies, zero destructive DB migrations, and zero architectural boundary shifts. *(If any apply, upgrade `track: FULL` immediately.)*

## 2. PROPOSED CHANGE
- Describe the exact behavioral or structural modification within `affected_files`.

## 3. AUTHORIZATION & VERIFICATION EVIDENCE (`STD-009-R01`)
- **Required Approval:** `HUM-OWNER` *(Populate `approved_by: ["<name>"]` in YAML frontmatter upon human confirmation).*
- **Verification Commands & Results:** *(Populate `verification_evidence` in YAML frontmatter before marking `VERIFIED`/`CLOSED`.)*
