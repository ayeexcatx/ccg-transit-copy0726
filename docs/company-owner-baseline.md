# Company Owner Baseline (Code-Backed)

Date reviewed: 2026-03-25.
Updated: 2026-04-13.

## Covered areas
- Company Owner Home
- Company Owner Availability
- Company Owner Drivers
- Company Owner Notifications
- Company Owner Profile

---

## 1) Company Owner Home

### Confirmed from code
- Greeting uses Eastern-time-based daypart logic and workspace display label.
- Announcement Center shows active announcements filtered by target scope (All / company / access code).
- Action Needed section is driven by unresolved notifications after company-scoped visibility filtering, with truck-specific detail logic in drawer/notification flows.
- Quick lists for Today and Upcoming dispatches are filtered by allowed trucks (owner) and sorted/limited.
- Clicking actionable notifications routes into dispatch drawer context (Portal with query params).
- See `docs/portal-dispatch-drawer-behavior-baseline.md` for detailed drawer/deep-link behavior.

### Present in personal baseline
- Home landing with greeting.
- Announcement center.
- Action Needed concept.
- Today/Upcoming dispatch quick views.

### Missing from personal baseline
- None currently confirmed.

### Conflicts with personal baseline
- None currently confirmed.

### Needs manual verification
- Exact UX expectations for Action Needed ordering/prioritization under heavy notification volume.

---

## 2) Company Owner Availability

### Confirmed from code
- Company-owner-only access guard.
- Reuses shared availability system scoped to `session.company_id`.
- Includes summary boxes, calendar views, weekly defaults, date overrides.

### Present in personal baseline
- Owner-specific availability management with summary + calendar/defaults.

### Missing from personal baseline
- None currently confirmed.

### Conflicts with personal baseline
- None currently confirmed.

### Needs manual verification
- Any server-side enforcement beyond UI behavior.

---

## 3) Company Owner Drivers

### Confirmed from code
- Owner-only driver management page.
- CRUD for drivers with required name/phone validation.
- Driver record stores owner SMS permission layer (`owner_sms_enabled`) and driver status.
- Access-code request workflow: owner can move driver to `Pending` request state.
- SMS state shown as combined owner-enabled + driver-opted-in + effective state.
- Includes in-app educational guidance (EN/PT) about assignment and notification behaviors.

### Present in personal baseline
- Add/edit driver workflows.
- SMS dual-permission model.
- Access-code request intent and status progression (`Requested`/`Created`).
- Instructional guidance section with English/Portuguese coverage.

### Missing from personal baseline
- None currently confirmed.

### Conflicts with personal baseline
- None currently confirmed.

### Needs manual verification
- Whether educational content text should be treated as product policy or temporary guidance copy.

---

## 4) Company Owner Notifications

### Confirmed from code
- Notifications page uses shared notifications hook and supports mark-all-read.
- CompanyOwner notification/SMS dispatch time uses the dispatch main/earliest start time (not suppressed for staggered truck timings).
- Notification list is visibility-filtered by dispatch existence/scope (company-scoped + truck-scoped).
- Owner unread state can be effectively read even when raw `read_flag` is false (effective read state from confirmation logic).
- Clicking dispatch-related notifications navigates into dispatch context; some categories are action-marked read on click.
- See `docs/notifications-behavior-baseline.md` for full `read_flag` vs effective-read vs action-marked-read logic.

### Present in personal baseline
- Notification feed and action handling.
- Distinction between stored read state and computed effective-read state.

### Missing from personal baseline
- None currently confirmed.

### Conflicts with personal baseline
- None currently confirmed.

### Needs manual verification
- Performance/consistency under high notification volume and frequent updates.

---

## 5) Company Owner Profile

### Confirmed from code
- Owner profile shows company details from company record + owner access codes.
- Edit flow submits a **pending profile change request** (not direct overwrite) for admin approval.
- Owner can request a new owner access code if missing.
- Contact methods are typed; one can be designated for SMS.
- Effective SMS enabled for owner is tied to both access-code opt-in and valid SMS-designated company contact.
- Related owner access codes are synchronized when company SMS contact changes.

### 2026-04-13 approved behavior update
- Multiple owner access codes for the same company share one company workspace (dispatches, availability, company-level operations state).
- Owner SMS settings now come from each owner’s personal profile fields on their own access code (`label`, `sms_phone`, `sms_enabled`) instead of shared company contact SMS selection.
- Shared company contacts remain business-profile data and no longer drive owner SMS routing.
- Owner dispatch assignment area supports informational owner assignment options (`Name (Owner)`) when company has multiple trucks or at least one added driver.
- Informational owner assignment is display-only and does not trigger driver-dispatch side effects.
- Owner Home now includes a recent company activity section sourced from company-scoped dispatch activity and related owner activity records.

### Present in personal baseline
- Profile editing and admin approval flow.
- Access-code controls.
- SMS notification settings.
- Multi-contact-method editor and SMS-designation behavior.

### Missing from personal baseline
- None currently confirmed.

### Conflicts with personal baseline
- None currently confirmed.

### Needs manual verification
- Approval SLA/workflow assumptions (frontend supports pending flow but not process guarantees).
