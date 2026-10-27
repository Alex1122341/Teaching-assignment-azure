# PAWS DOE Data Lineage and Calculation Mapping

**Verified from Beta main:** ff3a247f584a8417c3c290b0482d0cccbe0f00b4 (2026-10-15). **Last documented deployed API/Hosting:** ca465bf1401b457ca3b74048cfaf170bedc7694a (2026-10-14). This is source review, not a fresh SQL Active-policy or live Faculty-data query.

## 1. Three distinct current calculations

1. **Recorded / legacy fallback** — SessionAssignment.DoeCredit and RoleAssignment.DoeOverrideValue / DoeMappedValue take precedence. The 2026-27 code calculator fills missing values, does not replace stored values, and flags differences. This is used in DOE Overview, Teaching Summary, and Faculty detail evidence.
2. **Annual policy engine** — Active DoePolicyVersion + exact Course/Subject mappings, Rule selectors/parameters/tiers or a specifically approved Exception + authoritative assignment facts -> versioned DoeCalculationRecord. A candidate Draft is for validation/Impact Preview, not automatic live recalculation.
3. **Faculty Worksheet aggregation** — Annual records and nonduplicated stored session/role values + approved target + raw supervision + manual DOE -> reserve application, total assigned teaching DOE, remaining DOE, and Needs Review. DOE List is based on this, **not on the DOE Overview aggregate**.

## 2. Logical end-to-end flow

~~~mermaid
flowchart TD
  M["MASTER teaching assignments / source workbook"]
  G["UCVM Workload Guidelines and approved contracts"]
  S["paws.Session + SessionAssignment: hours, teaching role, stored DOE"]
  R["paws.RoleAssignment: mapped / override / scope / dates"]
  T["paws.DoeFacultyTarget: approved target / override"]
  SUP["paws.DoeSupervisionSourceSnapshot + DoeWorkloadSource"]
  MAN["paws.ManualDoeAssignment: signed adjustment"]
  POL["Annual DoePolicyVersion: rules / mappings / exceptions"]
  FACT["DoeAssignmentFact + fact inputs"]
  ENG["DOE calculation service + policy engine"]
  REC["DoeCalculationRecord: result + provenance"]
  FALL["Recorded-value resolver + deterministic legacy fallback"]
  WR["SQL DOE Worksheet repository: annual rows supersede matching legacy rows"]
  WS["Worksheet service: subtotals / supervision reserve / status"]
  LIST["DOE List + Faculty DOE Worksheet"]
  DASH["DOE Overview / Teaching Summary / Faculty evidence"]
  M --> S
  M --> R
  M --> SUP
  M --> POL
  G --> POL
  G --> T
  G --> SUP
  S --> FACT
  R --> FACT
  FACT --> ENG
  POL --> ENG
  ENG --> REC
  S --> FALL
  R --> FALL
  REC --> WR
  FALL --> WR
  T --> WR
  SUP --> WR
  MAN --> WR
  WR --> WS --> LIST
  FALL --> DASH
~~~

The displayed edge is a logical data dependency, not proof that all 4,970 historical SessionAssignment rows are already normalized as annual facts.

## 3. Exact SQL input-field map

| Input | SQL table/column | Rule application / final usage |
| --- | --- | --- |
| Faculty identity and Stream | paws.Faculty.FacultyId / Stream | Exact FacultyId required; teaching-focused Stream changes reserve policy |
| AcademicYear | Session, Role, policy, target, user-selected year | Canonical YYYY-YY; annual source isolation |
| Session date/time/type/course/topic | paws.Session via paws.vCalendarSession | Calendar factual context. Course != Subject != Topic |
| TeachingRole, hours, stored DOE | paws.SessionAssignment.TeachingRole, CreditedHours, DoeQuantity, DoeCredit | Legacy effective DOE: stored DoeCredit first, otherwise TeachingRole rate times DoeQuantity ?? CreditedHours |
| Annual Session hours | SessionAssignment.CreditedHours or valid session StartTime/EndTime interval | Annual Session recalc uses explicit credited hours when finite, otherwise valid interval duration |
| Role and source DOE | paws.RoleAssignment.RoleType, CourseOrSubjectOrRotation, DoeMappedValue, DoeOverrideValue, EffectiveDate, ExpirationDate | Override including literal zero > Mapped > full-year calculator fallback; dated credit without approved stored proration requires review |
| Annual authoritative facts | paws.DoeAssignmentFact + DoeAssignmentFactInput | Inputs/canonical source ID and revision, linked to CurrentCalculationId |
| Annual policy | paws.DoePolicyVersion / DoePolicyRule / Selector / Parameter / Tier / Input | Active annual Rule matching, calculation and provenance |
| Course/subject mapping | paws.DoeCourseMapping / DoeSubjectMapping | Exact canonical/approved aliases, unitCount, HICC eligibility, Subject key |
| Approved special allocation | paws.DoePolicyException | Top priority matching approved exception is evaluated before the normal Rule; ambiguous ties fail |
| Calculation result | paws.DoeCalculationRecord | ResultDoe, policy/rule/exception, facts/inputs/parameters/rule/reference snapshots, status and trigger |
| Approved Faculty target | paws.DoeFacultyTarget.ContractTeachingDoe, OverrideDoe, EffectiveTargetDoe | EffectiveTarget for reserve and Remaining; FTE alone never creates this target |
| Supervision evidence | paws.DoeSupervisionSourceSnapshot.RawDoe, paws.DoeWorkloadSource.ParametersJson | Raw supervision; approved annual reserve parameters take precedence over fallback source |
| Manual negotiated DOE | paws.ManualDoeAssignment.DoeValue / Notes | Signed role line; negative amount requires Notes. Applied once, excluded from initial reserve capacity test |
| Research/Service/PPVM contract facts | paws.DoeFacultyAllocation | Separate contract-allocation display, not interchangeable with assigned teaching DOE |

### Worksheet duplication rules

- First read active DoeAssignmentFact with linked current DoeCalculationRecord.
- Add active ManualDoeAssignment as role-category lines.
- Add legacy SessionAssignment **only when no active annual fact exists for the same SessionAssignmentId**.
- Add legacy RoleAssignment **only when no active normalized role fact refers to the same RoleAssignmentId**.
- Add imported supervision snapshot **only when no annual supervision fact exists for that Faculty**.
- Read one approved target/Faculty/year and Active reserve parameters; never default a missing target or supervision source to zero.

## 4. Apply formulas — rule selection

~~~text
1. Confirm AcademicYear, exact Faculty/source ID and Active annual policy.
2. Add approved CourseMapping / SubjectMapping facts (units, eligibility, subject).
3. Find approved matching Exception by Faculty/category/scope/date.
   - Highest priority wins; same top priority => EXCEPTION_AMBIGUOUS.
4. Otherwise find enabled matching Rule by selectors and category.
   - Highest priority wins; tied matches => AMBIGUOUS_RULE.
5. Validate rule approval, reference approval, mappings and required inputs.
6. Evaluate formula (percentage POINTS, e.g. 0.30 = 0.30%, not 30%).
7. Reject missing/invalid input, unapproved reference, nonfinite result,
   or negative resultKind=credit/target.
8. Produce resultDOE + facts/inputs/parameter/rule/reference snapshots.
9. On an authorized write or explicit Recalculate, persist a calculation
   record and link the active fact; otherwise return a read-only preview.
~~~

Supported engines modes: fixed; per_hour = hours*rate; per_shift = shifts*rate; per_week = weeks*rate; per_trainee = trainees*rate; tiered fixed lookup/progressive tiers; percentage_of_target = targetDoe*rate; prorated = baseDoe*fte when explicitly supplied; capped; minimum; whitelisted advanced formula. The safe formula grammar only exposes declared inputs/parameters and min, max, round, floor, ceil, abs. **A prorated mode is not automatic HICC/VISC date-based prorating.**

### 2026-27 approved reference rate examples

| Category | Calculation | Required evidence |
| --- | --- | --- |
| LEC / SRL | creditedHours * 0.30 | TeachingRole, hours |
| LAB Primary / Secondary | creditedHours * 0.21 / 0.19 | Teacher's primary/secondary role and credited hours |
| Quiz/Midterm, OSCE | no standard DOE credit | Approved non-credit classification |
| Course Coordinator | units <3:1.75; 3-5:3.5; 6-9:7; 10-14:10; >=15:15 | Confirmed course units, coordinator |
| HICC new curriculum | units * 2; finalized stage development 0 | Approved course mapping/development applicability |
| VISC 2026-27 | subjects * 5 | Confirmed literal subject groups; slash does not imply more than one |
| Rotation participant / designated coordinator | weeks * 2.5; distinct rotation types * 2 | Source weeks/types, possible explicit source exception |
| CCC | shifts * 0.5 minus explicit source half-day deduction | Deduction only once; cached MASTER credit already contains it |
| Undergraduate / fourth year trainee | count * 1 / 0.75 | Confirmed trainee counts |
| Graduate primary / co-supervisor / postdoc | count * 3 / 2 / 1.5 | Approved counts, three-year average where available |
| VETM 506 / IM source cases | count <1 =>0; count=1 =>0.5; count>1 =>1 | Confirmed source-specific MASTER formula |
| Research/PPVM/Service/Admin | recorded individual contract value | No generic faculty-rank/FTE inference |

The 34 code Guidelines reference rows include explanatory and capped credits, not 34 guaranteed runtime formulas. The 2026-27 Master/Guidelines **candidate Draft revision2** was recorded as 58 rules, 56 course mappings, 25 Subject groups and 25 source-scoped allocations. Its Impact Preview on 5,282 source lines (4,970 teaching, 196 role, 116 supervision) had zero projected differences **in the candidate preview**. It was not published by that data migration. Verify live Active status independently before applying it.

## 5. Final Worksheet: supervision reserve and total

Let T=Effective Teaching Target, A=source assigned teaching and role credit **before negotiated manual adjustment**, S=raw supervision DOE.

~~~text
Initial reserve R:
  if Teaching-focused: R = min(T, 7.5)
  else if T <= 35:   R = T * 0.50
  else:              R = min(T, 15)

SupervisionCeiling = T for standard stream with T <= 35; otherwise R
AppliedSupervision = min(S, SupervisionCeiling, max(0, T-A))

Worksheet source A =
  scheduledTeachingSubtotal + roleSubtotal - manualRoleSubtotal
  + adjustmentSubtotal

TotalAssigned =
  scheduledTeachingSubtotal + roleSubtotal + adjustmentSubtotal
  + AppliedSupervision

Remaining = EffectiveTarget - TotalAssigned
~~~

ManualDoeAssignment is currently a role-subtotal line, NOT necessarily an adjustment-subtotal line. A negative negotiated reduction decreases TotalAssigned but is **excluded from A** so that supervision does not automatically expand to replace the reduction.

**Synthetic demonstration (not a real Faculty):** T=15, 4 hours LEC=1.20, approved Course Coordinator=3.50, signed manual adjustment=-0.50, raw supervision=6.00. Pre-reserve A=1.20+3.50=4.70; applied supervision=min(6,15,15-4.70)=6.00; total=1.20+3.50-0.50+6.00=10.20%; remaining=15-10.20=4.80%.

The Worksheet returns Needs Review if a meaningful source is missing, a line is unrateable, policy versions mismatch, target/supervision/reserve is unavailable, or a discrepancy still requires review. A numeric total may be absent; do not replace that with zero.

## 6. Final displayed fields and APIs

| UI | API | Output mapping |
| --- | --- | --- |
| DOE Overview | dashboardDoeOverview() | SQL recorded teaching + missing-value legacy fallback; SQL role override/mapped + fallback; Effective DOE Total = Teaching + Role. **No supervision reserve applied** |
| Teaching Summary | dashboardTeachingSummary() | Per-Faculty stored + fallback teaching and role, resolution counts. A number can be partial if unresolved rows exist |
| Faculty detail DOE Evidence | dashboard Faculty detail + renderer | Per-row Stored / Calculated / Effective, Rule, Source and Status; separate contract allocations |
| DOE List | GET /api/v1/doe/worksheets?academicYear=YYYY-YY | One Faculty per row: Effective Target, Scheduled, Role, Raw Supervision, Applied Supervision, Adjustment, **Total Assigned**, Remaining, Source, Status |
| Faculty DOE Worksheet | GET /api/v1/doe/worksheet?academicYear=YYYY-YY&facultyId={canonical ID} | Sections and detailed source lines, current calculation record and provenance, Reserve summary, Needs Review reasons |
| Annual Rule Book UI | GET /api/v1/doe/policy / history / policy-version | Active or Draft policy, references, selectors, mappings and impact. Publishing is a separate gated operation |

DOE List badge: **Within DOE** if two-decimal Remaining >0, **At DOE** if =0, **Over DOE** if <0. Any Worksheet that is not fully calculated is **Needs Review** even if an intermediate number exists. API values retain up to six decimal places; UI displays two.

## 7. Actual write and recalculation triggers

- Open Overview/Teaching Summary: server **read-only** stored+fallback aggregate, no DOE policy write.
- Open DOE List/Worksheet: server **read-only** current source line assembly and Reserve computation, not automatic annual policy recalculation.
- Annual DOE fact Create/Update: requires Active Rule Book; calculates and transactionally saves DoeAssignmentFact/Record/Audit.
- Approved Session edit/create/assignment replacement: after SQL Session write, triggers the independent annual Session DOE recalculation. **If recalc fails, the Session edit is not automatically rolled back**; response contains DOE Needs Review / DOE_RECALCULATION_FAILED.
- Annual Draft Save/Validate/Impact: test the candidate version and save impact evidence; do not replace live calculations.
- Rule Book Publish: separately gated; switches annual Active version only after current validated revision and complete source-fingerprint Impact Preview. **Publish does not itself rewrite all prior Faculty calculation records.**
- Global Recalculate: separately gated, versioned calculation records, batches of at most 250 normalized facts, optimistic/concurrency guards.

## 8. Verified limitations and pending checks

1. Live 2026-27 **Active** DoePolicyVersion is **not freshly queried here**. Last documented Active was the Faculty Master List snapshot, with 58-rule policy as Draft.
2. DOE Overview and DOE List **do not currently share the same total formula**; comparisons must use the same metric/denominator, especially for supervision.
3. No individual live Faculty calculation is evidenced by this doc. Verify through authorized exact-scope API/SQL read rather than inferred source counts.
4. Outlook automatic invites and D2L API updates are separate future integrations; neither is a DOE input/output channel today.

## 9. Source files

- [SQL Worksheet source precedence](../server/src/data/sql-doe-worksheet-repository.js); [Worksheet calculation/status](../server/src/doe/doe-worksheet-service.js); [Reserve](../server/src/doe/doe-reserve-service.js).
- [Legacy calculator / stored precedence](../server/src/domain/doe-calculator.js); [annual engine](../server/src/domain/doe-policy-engine.js); [annual mappings / preview](../server/src/doe/doe-calculation-service.js).
- [DOE policy lifecycle](../server/src/doe/doe-policy-service.js); [SQL publication/recalculation](../server/src/data/sql-doe-policy-repository.js).
- [Session-triggered calculation](../server/src/doe/doe-session-service.js); [Session API and nonblocking DOE error behavior](../server/src/data/data-api.js).
- [DOE Overview/Teaching Summary](../server/src/data/sql-dashboard-repository.js); [DOE List/detail UI](../frontend/scripts/faculty-admin-doe-worksheet.js); [Faculty detail](../frontend/scripts/faculty-admin-doe-renderer.js); [Policy editor](../frontend/scripts/faculty-admin-doe-policy.js).
- [2026-27 initial policy Draft evidence](../docs/current-doe-rulebook-import-20261011.md); [58-rule Draft rationalization](../docs/doe-source-rationalization-20261011.md); [supervision source recovery](../docs/operations/doe-worksheet-source-recovery-20261008.md).

**Documentation only:** no application/SQL/Firebase source changes, live SQL query, imports, Rule Book Publish, Recalculate or deployment.
