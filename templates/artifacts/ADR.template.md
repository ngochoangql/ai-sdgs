---
id: "{{ADR_ID}}"
title: "{{ADR_TITLE}}"
version: 1.0.0
status: DRAFT
artifact_class: NORMATIVE_SPEC
domain: architecture
normative_references: []
last_updated: "{{DATE_ISO}}"
---

# {{ADR_ID}} — {{ADR_TITLE}}

## 1. CONTEXT & ARCHITECTURAL PROBLEM (`STD-008-R01`)
Describe the architectural forces, technical constraints, and requirements driving this decision.

## 2. CONSIDERED ALTERNATIVES
1. **Option A — `<Name>`:** Summary, pros, cons, operational/security risks.
2. **Option B — `<Name>`:** Summary, pros, cons, operational/security risks.

## 3. DECISION & NORMATIVE INVARIANTS (`STD-008-R02`)
Chosen option: **Option `<X>`**.
- **Invariant 1:** Modules in `<layer-A>` **MUST NOT** depend on `<layer-B>`.
- **Invariant 2:** State/contract rule enforced across implementation.

## 4. CONSEQUENCES & ROLLBACK / MIGRATION NOTES
Positive outcomes, accepted trade-offs, and conditions under which this ADR should be revisited.
