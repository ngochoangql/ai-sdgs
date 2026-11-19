<!-- aisdgs-sync: bridge=kilocode config_sha256={{CONFIG_SHA256}} -->
# Kilo Code Governance Rule — AI-SDGS Bridge

This workspace enforces **AI-SDGS** (`Tier: {{ADOPTION_TIER}}`, `Mode: {{ONBOARDING_MODE}}`).

1. Read and obey root `AGENTS.md` prior to any file edit or shell mutation (`STD-011-R04`).
2. Classify prompts via `AGENTS.md` §2, respect `protected_paths`, and load `.aisdgs/policies/*.md` playbooks only when triggered.
3. Never self-approve `CR-*` / baseline manifests or report `VERIFIED` completion without real test and `aisdgs validate` execution evidence.
