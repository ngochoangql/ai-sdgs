---
id: "{{REQ_ID}}"
title: "{{REQ_TITLE}}"
version: 1.0.0
status: DRAFT
artifact_class: NORMATIVE_SPEC
domain: "{{REQ_DOMAIN}}"
priority: MUST
normative_references: []
acceptance_criteria:
  - "Given <precondition>, when <action>, then <verifiable outcome>."
last_updated: "{{DATE_ISO}}"
---

# {{REQ_ID}} — {{REQ_TITLE}}

## 1. NORMATIVE REQUIREMENT STATEMENT (`STD-005-R01`, `STD-005-R02`)
The system **MUST** ... *(state unambiguous, atomic, testable behavior or constraint without vague adjectives).*

## 2. INPUTS, PRECONDITIONS & INVARIANTS
- **Inputs / Contracts:** Link relevant `CONTRACT-*`, API endpoint, or schema.
- **Error / Edge Conditions:** Define exact failure behavior and boundaries.

## 3. VERIFIABLE ACCEPTANCE CRITERIA
1. **AC-01:** Given `...`, when `...`, then `...` *(verified by unit/integration/E2E test).*
2. **AC-02:** Boundary / negative case verification.
