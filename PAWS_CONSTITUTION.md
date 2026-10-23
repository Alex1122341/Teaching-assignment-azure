# PAWS Constitution

These product rules apply to current PAWS features and future changes. A change to a rule requires an explicit Owner decision recorded in the same reviewed PR.

## Person names: Last name, First name

Every person-name label in PAWS uses **Last name, First name**. This includes faculty and staff names in tables, calendars, HICC/CC/VISC lists, dashboards, pickers, availability, SWAP, account labels, approval/history attribution, and names printed in newly generated CSV, Excel, calendar invitations and PDF documents.

- Use preferred last and first name fields when available; otherwise use the recorded first/last fields. Preserve complete compound surnames, given names, initials, accents, apostrophes, hyphens and capitalization. Example: `de la Cruz, Mary Jane`.
- Reuse `PAWS_FACULTY_NAME.format()` for one person and `.formatList()` for a list. Server-generated documents use the matching pure module `server/src/domain/person-name.js`. Their formatter implementations must remain identical and are guarded by parity assertions. Do not implement name reversal inside an individual feature.
- An already formatted name stays in the same order. Multiple people are separated by semicolons or newlines; the comma inside one person's name is not a person separator.
- Structured names take precedence over a free-text label. Existing legacy first-last strings retain the shared compatibility fallback; do not use that fallback to overwrite source identity fields. A missing name, single recorded component or non-person label remains truthful: `Locum`, `TBD`, `Not provided`, `N/A` and similar placeholders are not invented people.
- Keep structured components until the presentation boundary. A partial component such as the surname `de la Cruz` or given name `Mary Jane` must not be reparsed as an unstructured full name. Read-only APIs that already produce a canonical presentation label (such as the leadership directory) format once server-side; consumers escape that label directly.
- Format before HTML, CSV, calendar or PDF escaping. Preserve the existing escaping and spreadsheet formula protections.
- Names are presentation, not identity. Keep FacultyId, UID, UCID, email, matching aliases, form option values, permissions, DOE inputs, source imports, audit records, stored signature evidence and source hashes unchanged by formatting.
- Historical PDFs, uploaded originals, signed evidence, backups, raw audit From/To values and machine interchange payloads preserve their original bytes or recorded values. Their surrounding person-name labels follow the display rule. Individual First name / Last name edit fields retain their individual components.

### Required review

When adding or modifying any person-name display or generated output, identify its formatter call and confirm the name remains correct after formatting twice. Cover structured compound names, an already comma-formatted name, a list of people and a placeholder. Include the relevant screen or output in acceptance. Preserve raw identity and historical evidence contracts.
