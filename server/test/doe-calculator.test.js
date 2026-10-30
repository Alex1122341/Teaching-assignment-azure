'use strict';

require('node:test')('parity corrections carry a distinct reference-calculator version', () => {
  require('node:assert/strict').equal(require('../src/domain/doe-calculator').CALCULATOR_VERSION, '2026-27-v2');
});

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CALCULATOR_SOURCE,
  calculateTeachingRule,
  resolveTeachingDoe,
  calculateCourseCoordinatorDoe,
  calculateHiccDoe,
  calculateViscDoe,
  calculateRotationParticipantDoe,
  calculateRotationCoordinationDoe,
  calculateCccDoe,
  calculateSupervisionDoe,
  calculateTraineeReserveReference,
  resolveRoleDoe
} = require('../src/domain/doe-calculator');

test('assigned teaching calculator matches DOE Calculator rates', () => {
  const cases = [
    ['Lecture', 2, 0.6, 'lecture'],
    ['SRL', 1.5, 0.45, 'srl'],
    ['Lab Primary', 4, 0.84, 'lab_primary'],
    ['Lab Secondary', 4, 0.76, 'lab_secondary']
  ];
  for (const [teachingRole, creditedHours, expected, ruleCode] of cases) {
    const result = calculateTeachingRule({ teachingRole, creditedHours, sessionType: 'LEC' });
    assert.equal(result.calculatedDoe, expected);
    assert.equal(result.ruleCode, ruleCode);
    assert.equal(result.status, 'calculated');
  }
});

test('Quiz/Midterm and OSCE do not become false missing-DOE review lines', () => {
  for (const sessionType of ['Quiz/Midterm', 'OSCE']) {
    const result = resolveTeachingDoe({ sessionType, doeCredit: null });
    assert.equal(result.applicable, false);
    assert.equal(result.status, 'not-applicable');
    assert.equal(result.effectiveDoe, null);
    assert.equal(result.requiresReview, undefined);
  }
});

test('stored teaching DOE remains authoritative but calculator exposes mismatches', () => {
  const same = resolveTeachingDoe({ teachingRole: 'Lecture', creditedHours: 2, doeCredit: 0.6 });
  assert.equal(same.source, 'stored');
  assert.equal(same.status, 'stored');
  assert.equal(same.calculatedDoe, 0.6);
  const mismatch = resolveTeachingDoe({ teachingRole: 'Lecture', creditedHours: 2, doeCredit: 0.9 });
  assert.equal(mismatch.effectiveDoe, 0.9);
  assert.equal(mismatch.status, 'stored-calculation-mismatch');
  assert.equal(mismatch.reviewReason, 'stored-doe-differs-from-calculator');
});

test('course coordination tier calculation covers the workbook thresholds', () => {
  assert.deepEqual([2, 3, 6, 10, 15].map(units => calculateCourseCoordinatorDoe(units).calculatedDoe), [1.75, 3.5, 7, 10, 15]);
  assert.equal(calculateCourseCoordinatorDoe(null).reviewReason, 'course-units-required');
});

test('HICC, VISC, clinical rotation and CCC formulas match the DOE Calculator', () => {
  assert.equal(calculateHiccDoe(4).reviewReason, 'hicc-development-applicability-required');
  assert.equal(calculateHiccDoe(4, { developmentApplicable: true }).calculatedDoe, 8);
  const year1Hicc = calculateHiccDoe(3, { developmentApplicable: false });
  assert.equal(year1Hicc.calculatedDoe, 0);
  assert.equal(year1Hicc.status, 'not-applicable');
  assert.equal(calculateViscDoe('2026-27', 2).calculatedDoe, 10);
  assert.equal(calculateRotationParticipantDoe(3).calculatedDoe, 7.5);
  assert.equal(calculateRotationCoordinationDoe(2).calculatedDoe, 4);
  assert.equal(calculateCccDoe(6).calculatedDoe, 3);
  assert.equal(calculateCccDoe(null).reviewReason, 'ccc-shift-count-required');
});

test('supervision calculator preserves category rates and trainee reserve references', () => {
  const supervision = calculateSupervisionDoe({
    undergraduate: 1,
    vetm506: 0,
    im: 0,
    fourthYearPreceptor: 2,
    graduatePrimary: 1,
    graduateCosupervisor: 1,
    postdoctoral: 2
  });
  assert.equal(supervision.calculatedDoe, 10.5);
  assert.equal(supervision.components.length, 7);
  assert.equal(calculateTraineeReserveReference({ teachingDoe: 30 }).calculatedDoe, 15);
  assert.equal(calculateTraineeReserveReference({ teachingDoe: 40 }).ceilingDoe, 15);
  assert.equal(calculateTraineeReserveReference({ teachingDoe: 40, teachingFocused: true }).ceilingDoe, 7.5);
});

const completeSupervision = overrides => ({ undergraduate: 0, vetm506: 0, fourthYearPreceptor: 0,
  im: 0, graduatePrimary: 0, graduateCosupervisor: 0, postdoctoral: 0, ...overrides });

test('VETM 506 and IM use the existing annual step formula for confirmed counts', () => {
  for (const category of ['vetm506','im']) for (const [count, expected] of [[0,0],[0.5,0],[1,0.5],[1.5,1],[2,1],[3,1],[10,1]]) {
    const result = calculateSupervisionDoe(completeSupervision({ [category]: count }));
    assert.equal(result.calculatedDoe, expected, `${category}: ${count}`);
    assert.equal(result.status, 'calculated');
    assert.equal(result.components.find(c => c.key === category).doe, expected);
  }
  assert.equal(calculateSupervisionDoe(completeSupervision({vetm506:4,im:3})).calculatedDoe,2);
});

test('partial or invalid supervision cannot become a finalized total; explicit seven-category zero can', () => {
  assert.equal(calculateSupervisionDoe(completeSupervision()).calculatedDoe,0);
  for (const counts of [{undergraduate:1},completeSupervision({im:null}),completeSupervision({vetm506:-1}),completeSupervision({postdoctoral:'unknown'})]) {
    const result=calculateSupervisionDoe(counts);
    assert.equal(result.status,'needs-review');
    assert.equal(result.calculatedDoe,null);
    assert.ok(result.missingCategories.length>0);
  }
});

test('CCC deducts explicit source half-day credit once and rejects invalid deductions', () => {
  for(const [shifts,deduction,expected] of [[24,.25,11.75],[30,.25,14.75],[38,.5,18.5],[12,0,6],[0,0,0]]) {
    assert.equal(calculateCccDoe(shifts,deduction).calculatedDoe,expected);
  }
  for(const deduction of [null,-.25,13,'unknown'])assert.equal(calculateCccDoe(24,deduction).status,'needs-review');
  assert.equal(calculateCccDoe(12).calculatedDoe,6);
  const stored=resolveRoleDoe({roleType:'CCC',shiftCount:24,halfDayDeduction:.25,doeMappedValue:11.75});
  assert.equal(stored.calculatedDoe,11.75);assert.equal(stored.effectiveDoe,11.75);assert.equal(stored.requiresReview,false);
});

test('CCC source half-day counts and deduction agree; conflicting evidence remains unresolved',()=>{
  assert.equal(resolveRoleDoe({roleType:'CCC',shiftCount:24,halfDays:1}).calculatedDoe,11.75);
  const conflict=resolveRoleDoe({roleType:'CCC',shiftCount:24,halfDays:1,halfDayDeduction:.5});
  assert.equal(conflict.calculatedDoe,null);assert.equal(conflict.requiresReview,true);
  assert.equal(conflict.reviewReason,'ccc-half-day-evidence-conflict');
});

test('verified zero role quantities are calculated, while unknown quantities stay unresolved',()=>{
  assert.equal(calculateViscDoe('2026-27',0).calculatedDoe,0);
  assert.equal(calculateRotationCoordinationDoe(0).calculatedDoe,0);
  for(const unknown of [null,'',-1,'unknown']){
    assert.equal(calculateViscDoe('2026-27',unknown).status,'needs-review');
    assert.equal(calculateRotationCoordinationDoe(unknown).status,'needs-review');
  }
});

test('teaching-focused reserve reference stays within the confirmed teaching allocation',()=>{
  for(const [target,expected] of [[5,5],[7.5,7.5],[45,7.5]])assert.equal(calculateTraineeReserveReference({teachingDoe:target,teachingFocused:true}).ceilingDoe,expected);
});

test('explicit unknown role counts never fall back to the omitted legacy single-record reference',()=>{
  for(const [roleType,field] of [['VISC','subjectCount'],['Designated Rotation Coordinator','uniqueRotationTypes']]) {
    const role={roleType,academicYear:'2026-27',courseOrSubjectOrRotation:'An approved named group'};
    for(const value of [null,'',false,true,[],{},' ']) {
      assert.equal(resolveRoleDoe({...role,[field]:value}).effectiveDoe,null,`${roleType} ${String(value)}`);
      assert.equal(resolveRoleDoe(role,{[field]:value}).effectiveDoe,null,`${roleType} input ${String(value)}`);
    }
    assert.equal(resolveRoleDoe({...role,[field]:0}).effectiveDoe,0);
    assert.equal(resolveRoleDoe(role).effectiveDoe,roleType==='VISC'?5:2);
  }
});

test('stored CCC allocations retain nonblocking warnings for invalid or contradictory explicit source evidence',()=>{
  for(const creditField of ['doeMappedValue','doeOverrideValue']) {
    for(const evidence of [{shiftCount:24,halfDays:1,halfDayDeduction:.5},{shiftCount:24,halfDayDeduction:13},{shiftCount:24,halfDays:-1}]) {
      const result=resolveRoleDoe({roleType:'CCC',[creditField]:11.75,...evidence});
      assert.equal(result.effectiveDoe,11.75);
      assert.equal(result.requiresReview,true);
      assert.equal(result.sourceEvidenceInvalid,true);
      assert.match(result.reviewReason,/ccc-half-day/);
      assert.notEqual(result.status,'needs-review');
    }
  }
});

test('role resolution preserves override > mapped > calculator precedence', () => {
  const override = resolveRoleDoe({ roleType: 'VISC', academicYear: '2026-27', courseOrSubjectOrRotation: 'VTMD subject', doeMappedValue: 5, doeOverrideValue: 0 });
  assert.equal(override.effectiveDoe, 0);
  assert.equal(override.source, 'override');
  const mapped = resolveRoleDoe({ roleType: 'VISC', academicYear: '2026-27', courseOrSubjectOrRotation: 'VTMD subject', doeMappedValue: 5, doeOverrideValue: null });
  assert.equal(mapped.effectiveDoe, 5);
  assert.equal(mapped.source, 'mapped');
  const calculated = resolveRoleDoe({ roleType: 'Designated Rotation Coordinator', academicYear: '2026-27', courseOrSubjectOrRotation: 'Anesthesia', doeMappedValue: null, doeOverrideValue: null });
  assert.equal(calculated.effectiveDoe, 2);
  assert.equal(calculated.source, 'calculator');
});

test('course catalog provides safe explicit-role calculations and legacy full-year candidates', () => {
  const cc = resolveRoleDoe({ roleType: 'Course Coordinator', academicYear: '2026-27', courseOrSubjectOrRotation: 'VTMD 420: Sick Animals-Integument, MSK' });
  assert.equal(cc.effectiveDoe, 3.5);
  assert.equal(cc.courseUnits, 3);

  const year1Hicc = resolveRoleDoe({ roleType: 'HICC', academicYear: '2026-27', courseOrSubjectOrRotation: 'VTMD 211: Practical Work Experience 1' });
  assert.equal(year1Hicc.effectiveDoe, 0);
  assert.equal(year1Hicc.hiccDevelopmentApplicable, false);

  const legacy = resolveRoleDoe({ roleType: 'Course Coordinator / HICC (legacy ambiguous)', academicYear: '2026-27', courseOrSubjectOrRotation: 'VTMD 420: Sick Animals-Integument, MSK' });
  assert.equal(legacy.effectiveDoe, null);
  assert.equal(legacy.reviewReason, 'legacy-course-coordinator-hicc-role-must-be-resolved');
  assert.equal(legacy.courseUnits, 3);
  assert.equal(legacy.candidates.courseCoordinatorDoe, 3.5);
  assert.equal(legacy.candidates.hiccDoe, 6);
  assert.equal(legacy.candidateBasis, 'full-year-reference-before-proration');

  const legacyYear1 = resolveRoleDoe({ roleType: 'Course Coordinator / HICC (legacy ambiguous)', academicYear: '2026-27', courseOrSubjectOrRotation: 'VTMD 211: Practical Work Experience 1' });
  assert.equal(legacyYear1.candidates.courseCoordinatorDoe, 3.5);
  assert.equal(legacyYear1.candidates.hiccDoe, 0);
});

test('CCC without confirmed shift count remains an explicit review case', () => {
  const ccc = resolveRoleDoe({ roleType: 'CCC', academicYear: '2026-27' });
  assert.equal(ccc.effectiveDoe, null);
  assert.equal(ccc.reviewReason, 'ccc-shift-count-required');
  assert.match(CALCULATOR_SOURCE, /DOE Calculator/);
});

test('dated annual roles keep proration case by case and do not false-mismatch stored values', () => {
  const unresolved = resolveRoleDoe({
    roleType: 'Course Coordinator',
    academicYear: '2026-27',
    courseOrSubjectOrRotation: 'VTMD 420: Sick Animals-Integument, MSK',
    effectiveDate: '2026-09-01',
    expirationDate: '2027-03-01',
    doeMappedValue: null,
    doeOverrideValue: null
  });
  assert.equal(unresolved.calculatedDoe, 3.5);
  assert.equal(unresolved.effectiveDoe, null);
  assert.equal(unresolved.source, 'missing');
  assert.equal(unresolved.reviewReason, 'role-date-proration-review-required');
  assert.equal(unresolved.prorationReview, true);
  assert.equal(unresolved.candidateBasis, 'full-year-reference-before-proration');

  const storedProrated = resolveRoleDoe({
    roleType: 'HICC',
    academicYear: '2026-27',
    courseOrSubjectOrRotation: 'VTMD 420: Sick Animals-Integument, MSK',
    effectiveDate: '2026-09-01',
    expirationDate: '2027-03-01',
    doeMappedValue: 3,
    doeOverrideValue: null
  });
  assert.equal(storedProrated.calculatedDoe, 6);
  assert.equal(storedProrated.effectiveDoe, 3);
  assert.equal(storedProrated.source, 'mapped');
  assert.equal(storedProrated.status, 'mapped');
  assert.equal(storedProrated.reviewReason, null);
  assert.equal(storedProrated.requiresReview, false);

  const datedYear1Zero = resolveRoleDoe({
    roleType: 'HICC',
    academicYear: '2026-27',
    courseOrSubjectOrRotation: 'VTMD 211: Practical Work Experience 1',
    effectiveDate: '2026-09-01',
    expirationDate: '2027-03-01',
    doeMappedValue: null,
    doeOverrideValue: null
  });
  assert.equal(datedYear1Zero.calculatedDoe, 0);
  assert.equal(datedYear1Zero.effectiveDoe, 0);
  assert.equal(datedYear1Zero.prorationReview, false);
});
