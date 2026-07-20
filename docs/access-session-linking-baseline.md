# Access / Session / Linking Baseline

Date: 2026-04-12  
Primary truth source: current repository code.

## Legend
- **Confirmed from code** — directly verified in current repository implementation.
- **Needs manual verification** — backend/runtime/environment details not fully provable from repository code alone.

---

## A) Purpose / scope

This baseline is the dedicated preservation document for the access/session/linking lifecycle centered on:
- `src/pages/AccessCodeLogin.jsx`
- `src/components/session/useAccessSession.jsx`
- `src/components/session/workspaceUtils.js`
- `src/Layout.jsx` (role/workspace redirect coupling)
- `src/services/currentAppIdentityService.js`
- `src/lib/AuthContext.jsx`
- `src/pages/AdminAccessCodes.jsx` (admin management implications)

It intentionally focuses only on access/session/linking behavior and role/workspace restoration implications.

---

## B) Core model

- **Confirmed from code:** Base44 authenticated sign-in is the first gate. App state/auth state is checked in `AuthContext`; app-level access-code linking is separate and handled after auth in `AccessCodeLogin`/`useAccessSession`.
- **Confirmed from code:** Supported role-linked access-code session types are `Admin`, `CompanyOwner`, and `Driver` (`SUPPORTED_CODE_TYPES`).
- **Confirmed from code:** `Truck` access-code login is explicitly rejected as unsupported in `AccessCodeLogin`.
- **Confirmed from code:** Access codes are one-time-use for first-time claim/linking (`AccessCodeLogin` rejects codes with `used_by_user_id`).
- **Confirmed from code:** Successful claim marks the code as used (`used_by_user_id`, `used_at`, `usage_status: 'Used'`) and also mirrors legacy `user_id`.
- **Confirmed from code:** `active_flag` semantics are distinct from claim semantics: inactive codes are rejected for login/restore, while used status is tracked separately via usage fields.

---

## C) Access-code claim / first-time linking lifecycle

### Entry conditions
- **Confirmed from code:** User must already be authenticated (`user?.id` required) before linking; otherwise login/link is blocked with retry guidance.
- **Confirmed from code:** User is prompted for access code on the dedicated access-code page.

### Code lookup and validation
- **Confirmed from code:** Lookup is `AccessCode.filter({ code })`; login chooses first active match (`active_flag !== false`).
- **Confirmed from code:** Missing/inactive match => `Invalid or inactive access code`.
- **Confirmed from code:** `Truck` code type => `This access code type is no longer supported`.
- **Confirmed from code:** Any code with `used_by_user_id` already present is rejected (`This access code has already been used`).

### User linking by role
- **Confirmed from code:** Role mapping uses `normalizeAccessCodeTypeToAppRole`:
  - `Admin` -> `app_role: 'admin'`
  - `CompanyOwner` -> `app_role: 'company_owner'`
  - `Driver` -> `app_role: 'driver'`
- **Confirmed from code:** All successful claims set `onboarding_complete: true` on `User`.
- **Confirmed from code (Admin):** `linked_admin_access_code_id` set to the claimed code id; `company_id` and `driver_id` nulled.
- **Confirmed from code (CompanyOwner):** `company_id` sourced from access code (`match.company_id`), `driver_id` nulled.
- **Confirmed from code (Driver):** `driver_id` set from code; `company_id` from code if present, else derived from driver record.

### Post-claim writeback
- **Confirmed from code:** Access code is updated with:
  - `user_id` (legacy compatibility mirror)
  - `used_by_user_id`
  - `used_at`
  - `usage_status: 'Used'`
- **Confirmed from code:** Session login is established in client state and storage (`access_code_id`), then redirect occurs.

### Redirect after successful linking
- **Confirmed from code:** If the linked code yields admin workspace capability (including admin-capable multi-view codes), redirect to `AdminDashboard`; otherwise redirect to `Home`.

---

## D) Existing linked-user restore behavior

### Core restore principle
- **Confirmed from code:** Already-linked users restore via linked identity/session resolution and should not need to re-enter access code when a compatible active linked code is resolvable.

### Restore order and fallback (authenticated)
- **Confirmed from code:** On load, authenticated flow resolves authoritative identity by re-reading `User` (`resolveAuthoritativeLinkedIdentity`).
- **Confirmed from code:** Backfill helper runs early (`backfillAccessCodeUsageForLinkedIdentity`) to claim clearly-matchable unused codes for already-linked users.
- **Confirmed from code:** Restore preference order:
  1. `linked_admin_access_code_id` (for admin-linked users)
  2. stored `access_code_id` if code is active/supported and compatible with linked identity
  3. linked-identity lookup fallback query (`resolveLinkedIdentityAccessCode`)
- **Confirmed from code:** If no valid restore candidate: session code is cleared; authenticated user remains authenticated but access-code session becomes null and app routes back to access-code flow.

### Restore order (unauthenticated)
- **Confirmed from code:** If not authenticated, restore only from stored `access_code_id`; invalid/inactive IDs are removed from storage.

### Role-specific linked restore behavior
- **Confirmed from code (Admin):** Prefers explicit `linked_admin_access_code_id`; otherwise searches admin code by `used_by_user_id`, then legacy `user_id`.
- **Confirmed from code (CompanyOwner):** Fallback can search by `used_by_user_id`, legacy `user_id`, and `company_id` with code-type compatibility checks.
- **Confirmed from code (Driver):** Fallback can search by `used_by_user_id`, legacy `user_id`, and `driver_id` with code-type compatibility checks.

### Local storage / persisted workspace
- **Confirmed from code:** Session restore persists and consumes:
  - `access_code_id`
  - `workspace_mode`
  - `workspace_company_id`
- **Confirmed from code:** If stored workspace is unavailable, restore prefers Admin workspace when present, else first available workspace.

### Missing stored session but valid linked identity
- **Confirmed from code:** If `access_code_id` storage is missing/incompatible but linked identity is valid, linked-identity lookup fallback can still reconstruct a session.

### Previously linked code already marked used
- **Confirmed from code:** `used_by_user_id` on a linked code does not block restoration for the linked user; used-state blocks only first-time claim by someone else.

---

## E) Linked identity compatibility / fallback rules

### Authoritative linked identity source
- **Confirmed from code:** Runtime identity is refreshed from persisted `User` record and merged over transient auth identity fields (`app_role`, `company_id`, `driver_id`, `linked_admin_access_code_id`, `onboarding_complete`).

### Compatibility checks
- **Confirmed from code:** Stored/fallback access code must match linked role-derived code type.
- **Confirmed from code (Driver):** If linked identity has `driver_id`, code `driver_id` must match.
- **Confirmed from code (CompanyOwner):** If linked identity has `company_id`, code `company_id` must match.
- **Confirmed from code (Admin):** If linked identity has `linked_admin_access_code_id`, code id must match.

### Linked fallback behavior by role
- **Confirmed from code:** Fallback resolution includes both modern linkage (`used_by_user_id`) and legacy mirror (`user_id`) queries.
- **Confirmed from code:** Session construction (`buildLinkedUserSession`) prioritizes linked identity role, but can preserve `raw_code_type` and reuse fallback session attributes when present.

### Admin linkage nuance / admin-capable fallback
- **Confirmed from code:** “Normal” admin linkage is explicit through claiming an Admin access code and persisting `linked_admin_access_code_id`.
- **Confirmed from code:** Admin-capable session fallback can still render Admin-linked session shape using authenticated profile identity fields when role resolves to admin and/or fallback raw code type is admin.
- **Needs manual verification:** Exact production behavior for nonstandard/backup app-owner admin-capable accounts is environment/data dependent; repo code shows compatibility paths but not definitive operational policy.

---

## F) Workspace behavior

### Available workspaces and switching
- **Confirmed from code:** Workspace options are derived from access-code `available_views` + `linked_company_ids`; if absent, defaults come from base code type.
- **Confirmed from code:** Supported workspace modes are normalized to `Admin` and `CompanyOwner`.
- **Confirmed from code:** Workspace switcher appears only when multiple options exist.

### Initial workspace selection
- **Confirmed from code:** Initial selection order:
  1. stored `(workspace_mode, workspace_company_id)` if valid
  2. Admin workspace if available
  3. first available workspace
- **Confirmed from code:** If no workspace options derive, fallback uses base code-type defaults.

### Persistence
- **Confirmed from code:** Active workspace mode/company are stored in local storage on login, restore, and workspace switch.

### Admin <-> CompanyOwner switching
- **Confirmed from code:** Admin-capable codes with owner workspace enabled can switch into company-owner context using linked company ids.
- **Confirmed from code:** Switch triggers immediate redirect to `AdminDashboard` for admin mode or `Home` for owner mode.

### Effective session fields
- **Confirmed from code:** Effective session can rewrite view context while preserving raw code:
  - `raw_code_type` preserves original code type
  - `activeViewMode` / `activeCompanyId` define effective workspace
  - `code_type` is rewritten to `CompanyOwner` when admin code is operating in owner workspace

---

## G) Backfill / existing linked-code locking behavior

- **Confirmed from code:** Restore flow attempts backfill claim for already-linked identities where safe and unambiguous.
- **Confirmed from code:** Backfill writes same claim fields (`user_id`, `used_by_user_id`, `used_at`, `usage_status: 'Used'`) but only when code is active/supported and currently unclaimed.

### Safe matching rules observed
- **Confirmed from code (Admin):** Backfill only if `linked_admin_access_code_id` exists and resolves to Admin code.
- **Confirmed from code (Driver):** Backfill uses active Driver code matching linked `driver_id`.
- **Confirmed from code (CompanyOwner):** Backfill requires exactly one active owner code for company AND exactly one active onboarding-complete owner user for that company, and the user must match current linked user.

### Ambiguity behavior
- **Confirmed from code:** Ambiguous company-owner conditions (multiple owner codes/users) are intentionally skipped (no forced claim guess).

### Preservation goal
- **Confirmed from code:** Logic is explicitly designed to preserve already-linked user restoration without forcing relink while gradually normalizing claim metadata.

---

## H) UI / admin-management implications

- **Confirmed from code:** Admin Access Codes UI reflects used/unused state via usage fields (e.g., used badge when `used_by_user_id` present).
- **Confirmed from code:** `active_flag` is admin operational activation/deactivation state and is separate from claim/usage semantics.
- **Confirmed from code:** Already-linked users can restore without relinking when compatibility checks pass.
- **Confirmed from code:** Claimed codes are not reusable for first-time claim by another user (`used_by_user_id` check at login).

---

## I) Known edge cases / high-risk areas

- **Confirmed from code:** First-use claim is client-orchestrated with read-then-update flow, which can have a race window if backend lacks strict atomic enforcement.
- **Confirmed from code:** Legacy compatibility path (`user_id`) coexists with modern claim field (`used_by_user_id`), creating potential drift risk.
- **Confirmed from code:** Historical record ambiguity (especially company-owner code/user multiplicity) is handled conservatively by skipping automatic backfill.
- **Needs manual verification:** Backup app-owner / nonstandard admin-capable account behavior may vary by production identity data and Base44 tenant setup.
- **Confirmed from code:** This area is high-risk for refactors because auth, identity, workspace, storage, and redirect logic are tightly coupled across files.

---

## J) Needs manual verification

- **Needs manual verification:** Definitive server-side enforcement boundaries for one-time claim rules beyond client checks.
- **Needs manual verification:** Backend atomicity/transaction behavior for simultaneous first-use attempts.
- **Needs manual verification:** Environment-specific Base44 auth/session behavior (token expiry, refresh, tenant policy) beyond client restore logic.
- **Needs manual verification:** Legacy app-owner/admin-capable account behavior not represented by normal access-code claim path.

---

## K) Related docs

- `docs/behavior-preservation-baseline.md`
- `docs/notifications-behavior-baseline.md`
- `docs/admin-operations-baseline.md`
- `docs/personal-app-baseline-reference.md`
- `docs/refactor-safety-rules.md`
- `docs/baseline-audit-2026-04-12.md`
