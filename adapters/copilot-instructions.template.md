<!-- aisdgs-sync: bridge=copilot config_sha256={{CONFIG_SHA256}} -->
# GitHub Copilot Repository Instructions — AI-SDGS Bridge

This repository enforces **AI-SDGS** (`Tier: {{ADOPTION_TIER}}`, `Mode: {{ONBOARDING_MODE}}`).

1. Always consult root `AGENTS.md` as the authoritative governance router (`STD-011-R04`).
2. Classify every mutating request per `AGENTS.md` §2 and load the matching `.aisdgs/policies/*.md` playbook before editing protected paths, dependencies, migrations, or public contracts.
3. Never hardcode secrets, never bypass tests (`--no-verify`), and never mark governance artifacts `APPROVED` without human authorization (`STD-001-R02`, `STD-009-R01`).
