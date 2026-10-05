'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ExcelJS = require('exceljs');
const {
  CATEGORY_COLUMNS,
  buildDoeImportPayload,
  parseDoeWorksheet,
  readDoeWorkbook,
  reconcileDoeRows
} = require('../tools/doe-faculty-import');

const HEADERS = [
  'FullName', 'UCID', 'Teaching', 'ScholarlyActivity', 'PPVMCostShare',
  'ClinicalUnsorted', 'ClinicalTeaching', 'ClinicalActivityPPVM', 'Research',
  'ContractAdmin', 'ServiceAdmin', 'Other', 'Onboarding', 'TotalContractPctFTE'
];

function workbookWith(rows, sheetName = 'DOE Import') {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.addRow(HEADERS);
  for (const values of rows) sheet.addRow(values);
  return workbook;
}

function sourceRow({ name = 'Faculty One', ucid = '0001234', ...values } = {}) {
  const row = Array(HEADERS.length).fill(null);
  row[0] = name;
  row[1] = ucid;
  for (const [header, value] of Object.entries(values)) row[HEADERS.indexOf(header)] = value;
  return row;
}

test('sanitized DOE Import worksheet maps only A:N fields and preserves blanks versus numeric zero', () => {
  assert.deepEqual(CATEGORY_COLUMNS.map(item => item.column), [4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  const sheet = workbookWith([
    sourceRow({ Teaching: 40, ScholarlyActivity: 10, ServiceAdmin: 20, TotalContractPctFTE: 70 }),
    sourceRow({ name: 'Faculty Two', ucid: '0001235', Teaching: 0, PPVMCostShare: 0, TotalContractPctFTE: 0 })
  ]).getWorksheet('DOE Import');
  const parsed = parseDoeWorksheet(sheet);
  assert.equal(parsed.sourceRows.length, 2);
  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.sourceRows[0].ucid, '0001234');
  assert.equal(parsed.sourceRows[0].teachingDoe, 40);
  assert.deepEqual(parsed.sourceRows[0].allocations, [
    { categoryCode: 'scholarly_activity', allocationDoe: 10 },
    { categoryCode: 'service_admin', allocationDoe: 20 }
  ]);
  assert.equal(parsed.sourceRows[1].teachingDoe, 0);
  assert.deepEqual(parsed.sourceRows[1].allocations, [{ categoryCode: 'ppvm_cost_share', allocationDoe: 0 }]);
});

test('sanitized DOE workbook preserves formatted leading-zero UCIDs and validates all supplied categories against total', () => {
  const sheet = workbookWith([
    sourceRow({ Teaching: 40, ScholarlyActivity: 10, Research: 1, TotalContractPctFTE: 51 }),
    sourceRow({ name: 'Bad total', ucid: '0001235', Teaching: 40, Research: 10, TotalContractPctFTE: 49 })
  ]).getWorksheet('DOE Import');
  sheet.getCell('B2').numFmt = '0000000';
  const parsed = parseDoeWorksheet(sheet);
  assert.equal(parsed.sourceRows[0].ucid, '0001234');
  assert.deepEqual(parsed.errors.map(error => error.code), ['TOTAL_MISMATCH']);
  assert.equal(parsed.errors[0].rowNumber, 3);
});

test('DOE workbook requires the exact sanitized worksheet and reports missing UCIDs without row values', async () => {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet('Other');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'paws-doe-import-'));
  const file = path.join(directory, 'synthetic.xlsx');
  try {
    await workbook.xlsx.writeFile(file);
    await assert.rejects(readDoeWorkbook(file), { code: 'DOE_IMPORT_SHEET_REQUIRED' });
    const sheet = workbookWith([sourceRow({ name: 'No UCID', ucid: '', Teaching: 10, TotalContractPctFTE: 10 })]).getWorksheet('DOE Import');
    const parsed = parseDoeWorksheet(sheet);
    assert.deepEqual(parsed.errors.map(error => error.code), ['UCID_REQUIRED']);
    assert.doesNotMatch(JSON.stringify(parsed.errors), /No UCID/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('DOE reconciliation authorizes exact UCID matches only and distinguishes active, inactive, missing and conflicting rows', () => {
  const sourceRows = [
    { rowNumber: 2, sourceName: 'Same Name', ucid: '0001', teachingDoe: 40, allocations: [] },
    { rowNumber: 3, sourceName: 'Inactive', ucid: '0002', teachingDoe: 25, allocations: [] },
    { rowNumber: 4, sourceName: 'Missing', ucid: '0003', teachingDoe: 10, allocations: [] },
    { rowNumber: 5, sourceName: 'Name conflict', ucid: '0004', teachingDoe: 20, allocations: [] },
    { rowNumber: 6, sourceName: 'Duplicate A', ucid: '0005', teachingDoe: 15, allocations: [] },
    { rowNumber: 7, sourceName: 'Duplicate B', ucid: '0005', teachingDoe: 15, allocations: [] }
  ];
  const facultyRows = [
    { facultyId: 'f-active', ucid: '0001', displayName: 'Same Name', active: true },
    { facultyId: 'f-inactive', ucid: '0002', displayName: 'Inactive', active: false },
    { facultyId: 'f-conflict', ucid: '0004', displayName: 'Different Name', active: true },
    { facultyId: 'f-duplicate-a', ucid: '0005', displayName: 'Duplicate A', active: true },
    { facultyId: 'f-duplicate-b', ucid: '0005', displayName: 'Duplicate B', active: true }
  ];
  const result = reconcileDoeRows(sourceRows, facultyRows);
  assert.deepEqual(result.summary, {
    sourceRows: 6,
    exactActiveMatches: 1,
    exactInactiveMatches: 1,
    noMatch: 1,
    conflicts: 3,
    teachingTargetRows: 1,
    nonTeachingAllocationRows: 0,
    validationErrors: 0,
    activeFaculty: 4,
    activeFacultyWithTeachingTarget: 1,
    activeFacultyMissingTeachingTarget: 3
  });
  assert.deepEqual(result.issues.map(issue => issue.code), ['NO_MATCH', 'NAME_MISMATCH', 'DUPLICATE_SOURCE_UCID', 'DUPLICATE_DATABASE_UCID', 'DUPLICATE_SOURCE_UCID', 'DUPLICATE_DATABASE_UCID']);
  assert.equal(result.importRows.length, 1);
  assert.equal(result.importRows[0].facultyId, 'f-active');
  assert.equal(result.importRows[0].teachingDoe, 40);
  assert.doesNotMatch(JSON.stringify(result), /0001|Same Name|Different Name/);
});

test('DOE reconciliation imports blank Teaching as absent and explicit zero as a target', () => {
  const result = reconcileDoeRows([
    { rowNumber: 2, sourceName: 'A', ucid: '1', teachingDoe: null, allocations: [] },
    { rowNumber: 3, sourceName: 'B', ucid: '2', teachingDoe: 0, allocations: [] }
  ], [
    { facultyId: 'fa', ucid: '1', displayName: 'A', active: true },
    { facultyId: 'fb', ucid: '2', displayName: 'B', active: true }
  ]);
  assert.equal(result.summary.teachingTargetRows, 1);
  assert.equal(result.importRows.length, 2);
  assert.equal(result.importRows[0].teachingDoe, null);
  assert.equal(result.importRows[1].teachingDoe, 0);
});

test('DOE import payload contains only approved identity and DOE fields', () => {
  const payload = buildDoeImportPayload([{
    rowNumber: 2, sourceName: 'Faculty One', ucid: '0001234', academicYear: '2026-27',
    teachingDoe: 0, totalContractPctFte: 90, fte: 1, allocations: [{ categoryCode: 'research', allocationDoe: 90 }]
  }], [], { sourceFileName: 'PAWS_DOE_Import_2026-27.xlsx', sourceFileSha256: 'A'.repeat(64) });
  assert.deepEqual(Object.keys(payload), ['academicYear', 'sourceFileName', 'sourceFileSha256', 'validationErrors', 'sourceRows']);
  assert.deepEqual(Object.keys(payload.sourceRows[0]), ['rowNumber', 'sourceName', 'ucid', 'teachingDoe', 'allocations']);
  assert.equal(payload.sourceRows[0].teachingDoe, 0);
  assert.doesNotMatch(JSON.stringify(payload), /totalContractPctFte|\"fte\"/i);
});
