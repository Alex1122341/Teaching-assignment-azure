# PAWS Beta DOE Rule Book + Lookup Excel breakdown prototype — 2026-10-15

**Base:** Beta main a367a966dfc3f463212fd8e3cd1f57b979a218e1.
**Scope:** UI code + regression tests only. Feature candidate, not an approved data or release operation.

## Owner-defined scope

- Annual DOE Rule Book lists expandable business categories. Lectures, SRL and similar Faculty teaching rules show Weight (%) and unit (per credited hour or per session). Authorized Admin edits a **working Draft**; Validate, Impact Preview and separately authorized Publish/Recalculate remain.
- Faculty Lookup profile ends with an Excel-like report of teaching item / actual Assignment Quantity / calculated DOE; Total Without Trainees, Trainee Actual and Total + Applied Trainees are shown.
- Research / Administration / Service never silently enter this Teaching breakdown. Do not invent missing quantities from recorded credit.
- Existing Rule Book DB schema retained. Per-session selection maps to existing fixed mode for **each matched Faculty SessionAssignment** rather than a global Session credit.

## Code changes (candidate)

1. faculty-admin-doe-rulebook.js — expandable grouped rules, visible Weight/Unit, simple Weight/Basis editor on Session rules, advanced rule editor preserved.
2. faculty-admin.js — current Faculty DOE Worksheet section moved to the bottom of the Lookup profile; existing scoped API call kept.
3. faculty-admin-doe-worksheet.js — displays classified teaching Item/Quantity/Credit subtotal from exact authorized Worksheet source lines, supervision raw/applied and current original Worksheet total separately. Ambiguous or manual credit remains Needs Classification.
4. faculty-admin-doe-rulebook.css — responsive group/table styles.
5. Regression tests for Rate conversions, formula results, missing quantity, ambiguous HICC/Coordinator, Research/Service exclusion and screenshot arithmetic.

## Safety and unresolved scope

- Display-only breakdown: it does **not** rewrite the authoritative SQL Worksheet total or covertly change legacy Role/Manual categorization. Differences are exposed rather than hidden.
- Per-session means one fixed rule evaluation per valid Faculty SessionAssignment. Normal yearly policy matching/owner/scope still required.
- The existing 2026-27 candidate Rule Book stays Draft. No SQL changes, DOE Publish/Recalculate, source migration, Role/Session data changes or Hosting/API deployment in this task.
- Future DOE subitems can be added through current Rule Book selectors and templates when the source adapter and calculation mode already exist. A new item registry/entire domain classification refactor needs separate implementation.
- Four protected frontend files changed; current immutable freeze is expected to flag them. An independently reviewed freeze promotion is required **after product review** before code merge/release. No waivers or stale-baseline bypass.
- Open PRs #97-100 and Beta main remain untouched by this branch until owner-authorized merger.

## Acceptance checklist

- Validate rate editor is read-only for Active and editable only for a Draft, no role/gate bypass.
- Validate 7.5 lecture hours at 0.30% = 2.25%; 1.25% per session produces 1.25 for each matching Faculty assignment regardless of hours.
- Assert source reference, priority, selectors and published policy gating are preserved; validate and impact are required before separate publication.
- Verify exact API Faculty scoping; report does not fetch confidential extra fields.
- Example 7.50 LEC + 6 SRL + 24 LAB primary + 27 LAB secondary + 0.7 rotation = 15.97; 6 fourth-year preceptors = 4.50; 20.47 only if entire trainee credit is applied.
- No invented quantity from DOE; missing values and ambiguous manual/legacy HICC are review items; Research/Service excluded.
- Execute root/server tests, emulator, static build and freeze checks in PR CI. Protected drift is not a pass; preserve separate governance review and never deploy from this candidate alone.

## Owner-approved usability refinement (2026-10-15, same feature branch)

After the local UI preview, the owner approved simplifying the Rule Book as follows:

- In **Annual DOE Rule Book**, expand a business Group and adjust a simple DOE Item through direct **Weight (%)** and **Credit Per** controls; Session-derived rules support Hour versus one credit per matched Faculty SessionAssignment. Other existing simple rates display their known unit (Week, Shift, Trainee, Assignment) and an editable Weight only where the mode is already supported.
- **Restrictions/Conditions, match priority, canonical selectors, required source facts, formula, tiers, rule key and source details** are preserved but collapsed by default under **Advanced Settings**. Do not remove their backend validation or trust boundary. Admins should not need these for routine rate edits.
- The **Active Rule Book** remains read-only. Inline changes are local working-Draft state only until **Save Draft**; publication is still separate **Validate → Impact Preview → authorized Publish**, followed by separately authorized recalculation. No change to database schema, live DOE credits or published rates.
- Only uncomplicated credit rules with an existing supported mode have simple controls; unknown, tiered, complex and non-teaching/target/reserve rules stay advanced. Invalid or negative simple credit weights fail closed.
- Preserve original Source Reference, selectors, rule identity, priority and annual approval indicators on a simple rate edit. All changes to actual rates still require source review, approved annual provenance and normal policy governance. Frontend controls do not grant SQL authority.
- Inline editing must not discard open accordion state or create duplicates, alter an existing exception, or automatically publish.
- No merge or deployment is authorized by this UI approval. The current product PR still requires independent design/code review, separate immutable freeze governance promotion, complete CI and an explicitly authorized release. Existing failed baseline tests are blocking until reviewed promotion, not an excuse to relax checks.

**Review focus:** normal Admin sees only name, Weight and Unit; advanced operators can inspect and edit the full policy; ordinary Faculty and Active versions cannot write.
