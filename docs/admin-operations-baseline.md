# Admin Operations Baseline (Code-Backed)

Date reviewed: 2026-03-25.

This baseline treats repository code as source of truth and compares it against `docs/personal-app-baseline-reference.md` as a secondary expectation reference.

## Covered areas
- Admin Dashboard
- Admin Availability
- Admin Announcements
- Admin Companies
- Admin Access Codes
- Admin Template Notes
- Admin SMS Center
- Admin Driver Protocol
- Admin Profile
- Admin Confirmations

---

## 1) Admin Dashboard

### Confirmed from code
- Shows four top cards: pending confirmations, create dispatch shortcut, today dispatch counts (day/night), and upcoming dispatch counts (day/night). Upcoming counts use Monday on Fri/Sat/Sun; otherwise next day. A Sunday-night indicator is shown when relevant.
- "Active Announcements" section lists active announcements and shows added date + computed audience label.
- Quick actions link to Dispatches, Companies, Access Codes, Template Notes.
- "Force App Refresh" requires entering a valid active Admin access code, then rotates runtime version in `AppConfig`.

### Present in personal baseline
- Dashboard landing for admin.
- Four summary cards (confirmations/create/today/upcoming).
- Active announcements block.
- Quick actions block.
- Force refresh capability, including admin-code confirmation and runtime version behavior.

### Missing from personal baseline
- None currently confirmed.

### Conflicts with personal baseline
- None currently confirmed.

### Needs manual verification
- Runtime polling timing and UX under long-lived backgrounded browser tabs.

---

## 2) Admin Availability

### Confirmed from code
- Admin-only route guard.
- Reuses shared availability system with:
  - Summary boxes across companies.
  - Company selector/search.
  - Day/week/month views.
  - Weekly defaults + date overrides per shift.
- Shift operations and counts are resolved via shared availability rules.

### Present in personal baseline
- Summary cards and company-focused availability controls.
- Company selector/search.
- Day/week/month views.
- Weekly defaults + date overrides.

### Missing from personal baseline
- None currently confirmed.

### Conflicts with personal baseline
- None currently confirmed.

### Needs manual verification
- Any backend constraints not visible in frontend (e.g., entity-level validation).

---

## 3) Admin Announcements

### Confirmed from code
- Create/edit announcement with:
  - title/message/priority/active flag.
  - targeting: All / Companies / AccessCodes.
- Toggle active/inactive inline.
- Maintains admin activity log with granular change entries.
- Card list shows priority, target type summary, created date, activity excerpts.

### Present in personal baseline
- Create/edit + targeting controls.
- Active toggle.
- Card list with metadata.
- Per-announcement activity log behavior.

### Missing from personal baseline
- None currently confirmed.

### Conflicts with personal baseline
- None currently confirmed.

### Needs manual verification
- Real-world audit expectations for activity-log ordering and truncation.

---

## 4) Admin Companies

### Confirmed from code
- Company CRUD in "Company Info" tab with:
  - name, address, multiple typed contact methods, truck list, status.
- Displays company drivers and SMS state badges.
- Shows pending owner profile-change request diff and supports approve/reject.
- "Company Scoring" tab computes score/trend from dispatches/confirmations/incidents/assignments/manual events.
- Manual reliability events can be added/deleted (type/date/severity/dispatch/truck/driver links).

### Present in personal baseline
- Company info management.
- Company scoring + metrics + manual reliability log concepts.
- Pending profile-change approval flow with current/requested comparison.
- Multi-contact-method structure.

### Missing from personal baseline
- None currently confirmed.

### Conflicts with personal baseline
- None currently confirmed.

### Needs manual verification
- Score formula correctness against intended business policy (frontend calls shared scoring lib, but policy acceptance is business-side).

---

## 5) Admin Access Codes

### Confirmed from code
- Create/edit/delete cards for Truck, CompanyOwner, Driver, Admin codes.
- Driver code creation can originate from pending driver requests and updates driver `access_code_status`.
- Admin code supports multi-workspace fields (`available_views`, `linked_company_ids`) with validation.
- SMS behavior differs by type:
  - Driver: derived from `owner_sms_enabled` + `driver_sms_opt_in` + valid phone (effective SMS enabled).
  - CompanyOwner: derived from owner opt-in + valid SMS-designated company contact (effective SMS enabled).
  - Others: uses direct code fields.
- Copy-to-clipboard shortcut for code values.

### Present in personal baseline
- Card-driven access code management.
- Create/edit modals by role.
- Pending driver request workflow surfaced on admin page.
- Admin multi-workspace configuration and linked-company constraints.

### Missing from personal baseline
- None currently confirmed.

### Conflicts with personal baseline
- None currently confirmed.

### Needs manual verification
- Long-term UX for admins managing many linked companies and views.

---

## 6) Admin Template Notes

### Confirmed from code
- CRUD for template notes with two note types:
  - General notes (ordered bullet lines).
  - Box notes (styled content with simple markup rendering).
- Notes have active flag, priority, and display width.
- Sorted for dispatch usage via shared utility.

### Present in personal baseline
- Template note management with note types and ordering concepts.

### Missing from personal baseline
- None currently confirmed.

### Conflicts with personal baseline
- None currently confirmed.

### Needs manual verification
- Exact final render parity inside all dispatch drawer contexts.

---

## 7) Admin Profile

### Confirmed from code
- Admin profile reads/writes admin access-code record (name/phone/sms opt-in).
- Unsaved-change guard in modal.
- SMS section explicitly states admin SMS delivery is not active yet; preference is stored for future support.

### Present in personal baseline
- Admin profile edit flow and SMS section concept.
- Unsaved-change modal guard behavior.
- Explicit "SMS not active yet" framing.

### Missing from personal baseline
- None currently confirmed.

### Conflicts with personal baseline
- None currently confirmed.

### Needs manual verification
- Whether backend SMS workflow for admins is intentionally deferred or partially rolled out outside this repo.

---

## 8) Admin Confirmations

### Confirmed from code
- Page is split into **Open Confirmations**, **Confirmation History**, and **Driver Dispatch Log** views for acknowledgement/seen history review.
- Open rows are computed from unresolved owner notifications + missing truck confirmations (not a raw dispatch-status list).
- Open section shows company, dispatch date, status/type, truck, client, job number, reference, notification timestamp, and a computed pending-age field.
- History section is sourced from completed `Confirmation` records and shows company/date/truck/client/job/reference plus `Confirmed At` and `Confirmed By`.
- Clicking open/history rows opens dispatch detail in place via the admin overlay drawer (`openAdminDispatchDrawer`), without forcing navigation to Admin Dispatches first.
- See `docs/notifications-behavior-baseline.md` for full owner-notification / open-confirmation reconciliation logic.

### Present in personal baseline
- Two-section structure (open + history).
- Pending duration and notification-time emphasis for open confirmations.
- Confirmed-at / confirmed-by metadata in history.

### Missing from personal baseline
- None currently confirmed.

### Conflicts with personal baseline
- None currently confirmed.

### Needs manual verification
- Expected SLA/alerting policy for long-pending confirmations (UI shows age); current behavior treats Admin Confirmations primarily as an admin review log/record surface, and automatic reminder/escalation policy is not encoded in inspected client code.

---

## 9) Admin app shell (header/nav) coverage

### Confirmed from code
- Admin pages use a shared sticky header with logo/title, workspace identity line, notification bell, profile menu trigger, and logout action.
- Admin nav tabs are explicitly rendered as: Dashboard, Dispatches, Availability, Confirmations, Incidents, Announcements, Companies, Access Codes, Notes, SMS Center, Driver Protocol.
- Pending badges for company profile requests and driver requests are attached to Companies and Access Codes nav items.
- See `docs/behavior-preservation-baseline.md` (App shell / header section) for cross-role shell behavior.

### Present in personal baseline
- Persistent header concept with logo, role/workspace identity, notification bell, profile/menu, and logout.
- Admin navigation item set.

### Missing from personal baseline
- None currently confirmed.

### Conflicts with personal baseline
- None currently confirmed.

### Needs manual verification
- Responsive behavior details across breakpoints for very long company/workspace labels.

---

## 10) Admin SMS Center

### Confirmed from code
- Admin SMS Center exists as a dedicated admin page with six tabs: **Overview**, **Notification Rules**, **Templates and Previews**, **Logs**, **Inbound Replies**, **Broadcast and Scheduled Messages**.
- Notification Rules includes toggle categories spanning driver dispatch updates, owner dispatch status updates, owner informational updates, admin SMS-eligible notifications, welcome/opt-out messages, and informational broadcast behavior.
- Templates and Previews includes role/template previews (including admin-relevant examples such as all-trucks-confirmed and owner workflow updates).
- Logs stores outbound SMS attempt history and provider status lifecycle fields.
- Inbound Replies stores inbound reply logs.
- Broadcast and Scheduled Messages supports send-now and scheduled informational broadcasts to selected role audiences.

### Baseline clarification
- Owner informational update SMS uses generic update wording and does not inject the admin's custom in-app short message body.
- Admin SMS is configuration-ready and mirrors admin notification categories when enabled; it is not the same normal owner/driver dispatch SMS flow.

### Needs manual verification
- Production-provider behavior across all rule combinations and toggle states (send/skip/delivery webhook timing).

---

## 11) Admin Driver Protocol

### Confirmed from code
- Admin Driver Protocol exists as an admin page for managing driver-facing protocol/policy content.
- Admin can edit and publish protocol content with formatting controls (including emphasis/list/indent style controls).
- Protocol supports version updates/republish behavior.
- Publishing a new protocol version prompts drivers to review and re-accept the latest version.

### Needs manual verification
- Cross-device UX details for rich-text formatting and acceptance prompts in long-session scenarios.
