---
id: EXCEPTIONS-001
title: "{{PROJECT_NAME}} — Governance Exceptions & Waivers Register"
version: 1.0.0
status: APPROVED
artifact_class: CONSTITUTIONAL
last_updated: "{{DATE_ISO}}"
waivers: []
---

# GOVERNANCE EXCEPTIONS & WAIVERS REGISTER

All temporary exemptions from `[WAIVABLE]` requirements (`STD-002-R05`, `STD-002-R06`) MUST be registered in the machine-readable `waivers` YAML frontmatter array above and approved by the designated Human Authority.

- **`[NON-WAIVABLE]` Rules:** Cannot be waived under any Adoption Tier (`STD-002-R04`).
- **Maximum Single-Grant Duration:** `180 days` (`LITE`), `90 days` (`STANDARD`), `60 days` (`STRICT`).
- **Expiration Enforcement:** Any `ACTIVE` waiver whose `expires_at` date is in the past fails `aisdgs validate` (`Exit Code 1`).
