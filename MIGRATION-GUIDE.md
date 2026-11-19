# AI-SDGS UPGRADE & TIER MIGRATION GUIDE (`v1.0.0`)

---

## 1. Upgrading Pinned AI-SDGS Standard Snapshots (`STD-007-R07`)

Adopting projects pin an immutable local copy of AI-SDGS inside `.aisdgs/` (`standard-lock.yaml`). Upgrading the `aisdgs` CLI binary on your workstation **never** mutates existing repositories automatically.

### Safe 4-Step Upgrade Workflow
1. **Preview Compatibility & File Diffs (Read-Only):**
   ```bash
   aisdgs update plan
   ```
2. **Review Impact:**
   - `PATCH` (`1.0.x`) & `MINOR` (`1.x.0`) releases are backward-compatible with existing baselines.
   - `MAJOR` (`2.0.0`) releases require filing a `CR-FULL` and reviewing `adoption-profile.yaml` & active `EXC-*` waivers.
3. **Apply Snapshot Update Inside Hard Write-Barrier:**
   ```bash
   aisdgs update apply --approver <human-owner>
   ```
   *Write-Barrier Guarantee:* `update apply` updates `.aisdgs/{standard,schemas,policies}/`, `.aisdgs/standard-lock.yaml`, and synchronized adapter headers ONLY. Your `governance/**`, `docs/**`, `changes/**`, and `src/**` files are **never overwritten**.
4. **Verify & Commit (Instant Git Rollback):**
   ```bash
   aisdgs validate
   git add .aisdgs AGENTS.md CLAUDE.md GEMINI.md .cursor changes/CHANGELOG-GOVERNANCE.md
   git commit -m "chore(governance): upgrade AI-SDGS snapshot"
   ```
   *(To roll back at any time: `git revert HEAD` restores both the previous snapshot and lockfile atomically.)*

---

## 2. Promoting Project Adoption Tiers (`LITE` → `STANDARD` → `STRICT`)

As an MVP matures into a multi-developer production system, promote governance rigor without losing existing `REQ-*`, `ADR-*`, or `CR-*` IDs (`STD-007-R08`):

1. **Generate Promotion Checklist:**
   ```bash
   aisdgs update plan --promote-tier standard
   ```
2. **Complete Required Artifacts:**
   - **`LITE` → `STANDARD`:**
     - Create `governance/EXCEPTIONS.md` (if not already present).
     - Extract inline requirements from `PROJECT-BASELINE.md` into discrete `docs/requirements/REQ-*.md` files keeping identical IDs.
     - Create `docs/architecture/ADR-001.md` capturing core architectural boundaries.
     - Add CI gate (`templates/ci/github-aisdgs-gate.yml`).
   - **`STANDARD` → `STRICT`:**
     - Assign explicit human owners for `HUM-OWNER`, `HUM-PROD`, `HUM-ARCH`, and `HUM-SEC` in `.aisdgs/config.yaml`.
     - Set `strict_validation: true` and `adoption_tier: STRICT` in `.aisdgs/config.yaml` and `.aisdgs/adoption-profile.yaml`.
     - Sync Ring 1 permissions & adapters: `aisdgs adapter sync --with-permissions`.
3. **Validate & Re-Lock Baseline:**
   ```bash
   aisdgs validate --strict
   aisdgs baseline lock --approver <human-owner> --bump minor
   ```
