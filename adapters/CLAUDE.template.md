<!-- aisdgs-sync: bridge=claude config_sha256={{CONFIG_SHA256}} -->
# CLAUDE.md — AI-SDGS Thin Governance Bridge

This repository is governed by **AI-SDGS** (`Tier: {{ADOPTION_TIER}}`, `Mode: {{ONBOARDING_MODE}}`).

1. **Mandatory Root Router (`STD-011-R04`):** Before analyzing or modifying any file, read and strictly obey `@AGENTS.md` at the repository root as the Single Source of Truth.
2. **Prompt Is Not Baseline Authorization (`STD-001-R01`):** Classify every request using Section 2 of `AGENTS.md` prior to editing code, contracts, dependencies, or specifications.
3. **Protected Boundaries:** Never modify `.aisdgs/standard/**`, `.aisdgs/standard-lock.yaml`, or `governance/PROJECT-BASELINE.md` autonomously, and never set `cr_status: APPROVED` or `status: APPROVED` without explicit human confirmation.
4. **Verification Gate:** Run project tests and `aisdgs validate` before claiming any mutating task is `VERIFIED`.
