'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { performance } = require('node:perf_hooks');
const sql = require('../server/node_modules/mssql');
const ExcelJS = require('../server/node_modules/exceljs');
const { createSqlFacultyAvailabilityRepository } = require('../server/src/data/sql-faculty-availability-repository');
const { createFacultyAvailabilityApi } = require('../server/src/availability/faculty-availability-api');

if (!process.env.PAWS_SQL_TEST_PASSWORD) throw Error('Disposable SQL password required.');
const facultyId = '11111111-1111-4111-8111-111111111111';
const inactiveId = '22222222-2222-4222-8222-222222222222';
const active = { baseRole: 'faculty', facultyId, active: true };
const range = { startDate: '2027-01-01', endDate: '2027-01-31', mode: 'range' };

async function run() {
  const pool = await new sql.ConnectionPool({
    server: '127.0.0.1', port: 14331, database: 'VetMed-Ops', user: 'sa',
    password: process.env.PAWS_SQL_TEST_PASSWORD, options: { encrypt: true, trustServerCertificate: true }
  }).connect();
  try {
    const query = async (statement, args = {}) => {
      const request = pool.request();
      for (const [key, value] of Object.entries(args)) request.input(key, value);
      return (await request.query(statement)).recordset || [];
    };
    const runtime = (statement, args) => query(
      'EXECUTE AS USER=N\'paws-calendar-test-runtime\';BEGIN TRY ' + statement +
        ';REVERT;END TRY BEGIN CATCH REVERT;THROW;END CATCH', args);
    const repository = createSqlFacultyAvailabilityRepository({ query: runtime });
    const request = { actorFirebaseUid: 'availability-admin', action: 'query', selection: 'allActive', ...range };
    const rosterInput = { actorFirebaseUid: request.actorFirebaseUid, action: 'roster', includeInactive: true };
    const firstPage = await repository.bulk(rosterInput);
    assert.ok(firstPage.total > 500);
    assert.equal(firstPage.faculty.length, 500);
    const secondPage = await repository.bulk({ ...rosterInput, rosterOffset: Number(firstPage.nextCursor) });
    assert.equal(new Set([...firstPage.faculty, ...secondPage.faculty].map(row => row.facultyId)).size, firstPage.total);
    const adminRoster = await repository.bulk({ ...rosterInput, rosterSearch: 'Alex Different' });
    assert.equal(adminRoster.faculty.find(row => row.facultyId.toLowerCase() === inactiveId).active, false);
    const selfRoster = await repository.bulk({ actorFirebaseUid: 'availability-hicc', action: 'roster' });
    assert.deepEqual(selfRoster.faculty.map(row => row.facultyId.toLowerCase()), [facultyId]);
    for (const scoped of ['availability-self', 'availability-hicc', 'availability-inactive', 'availability-unsupported', 'Availability-admin']) {
      await assert.rejects(repository.bulk({ ...request, actorFirebaseUid: scoped }), error => error.number === 55603);
    }
    await assert.rejects(repository.bulk({ ...request, actorFirebaseUid: 'availability-hicc', selection: 'selected',
      facultyIds: [facultyId, inactiveId] }), error => error.number === 55603);
    await assert.rejects(repository.bulk({ ...request, selection: 'selected', facultyIds: [inactiveId] }), error => error.number === 55604);
    await assert.rejects(repository.bulk({ ...request, selection: 'selected', facultyIds: [facultyId, facultyId] }), error => error.number === 55601);
    assert.equal((await repository.bulk({ ...request, selection: 'selected', facultyIds: [inactiveId], includeInactive: true })).faculty.length, 1);
    const clockChange = await repository.bulk({ ...request, startDate: '2026-03-08', endDate: '2026-03-08',
      selection: 'selected', facultyIds: [facultyId] });
    assert.deepEqual(clockChange.clockChanges, [{ date: '2026-03-08', start: 7200, end: 10800 }]);
    const fallClock = await repository.bulk({ ...request, startDate: '2026-11-01', endDate: '2026-11-01',
      selection: 'selected', facultyIds: [facultyId] });
    assert.deepEqual(fallClock.clockChanges, [{ date: '2026-11-01', start: 3600, end: 7200 }]);
    const openClock = await repository.bulk({ ...request, mode: 'from', startDate: '2026-03-08', endDate: null,
      selection: 'selected', facultyIds: [facultyId] });
    assert.ok(openClock.clockChanges.some(row => row.date === '2026-03-08' && row.start === 7200 && row.end === 10800));

    const sqlTimings = [];
    let loaded;
    for (let repetition = 0; repetition < 3; repetition++) {
      const started = performance.now();
      loaded = await repository.bulk(request);
      sqlTimings.push(Math.round(performance.now() - started));
    }
    const scale = loaded.events.filter(row => row.courseCode === 'AVSCALE');
    assert.ok(loaded.faculty.length >= 150);
    assert.equal(scale.length, 150 * 31);
    assert.ok(loaded.complete);
    assert.doesNotMatch(JSON.stringify(loaded), /PRIVATE|email|ucid|medical|ReasonCode|DeductionJson/i);
    assert.deepEqual(loaded.unlinkedTeaching, [{ date: '2027-01-04', startTime: '12:00:00', endTime: '13:00:00' }]);
    const self = await repository.bulk({ ...request, actorFirebaseUid: 'availability-self',
      selection: 'selected', facultyIds: [facultyId] });
    assert.deepEqual(self.unlinkedTeaching, [{ date: '2027-01-04', startTime: null, endTime: null }]);
    assert.equal(new Set(loaded.events.map(row => row.facultyId + ':' + row.eventKey)).size, loaded.events.length);

    let sqlReads = 0;
    const api = createFacultyAvailabilityApi({
      verifyToken: async uid => ({ uid }),
      findUser: async uid => uid === 'availability-admin' ? { ...active, baseRole: 'owner' } : active,
      repository: { ...repository, bulk: input => { if (input.action === 'query') sqlReads++; return repository.bulk(input); } }
    });
    const started = performance.now();
    const { status, body } = await api.query('availability-admin', { ...range, selection: 'allActive', facultyIds: [],
      startTime: '08:30', endTime: '16:30' });
    const queryMs = Math.round(performance.now() - started);
    assert.equal(status, 200);
    assert.equal(body.dates.length, 31);
    const events = [...body.items];
    for (let offset = body.nextCursor; offset !== null;) {
      const page = await api.page('availability-admin', { snapshot: body.snapshot, offset });
      assert.equal(page.status, 200);
      events.push(...page.body.items);
      offset = page.body.nextCursor;
    }
    const pagesMs = Math.round(performance.now() - started - queryMs);
    assert.equal(sqlReads, 1, 'All pages reuse the set-based SQL snapshot');
    assert.equal(events.length, body.total);
    assert.equal(events.filter(row => row.courseCode === 'AVSCALE').length, 150 * 31);
    assert.equal(body.faculty.filter(row => row.name.startsWith('Coordination ')).length, 150);
    assert.doesNotMatch(JSON.stringify(events), /PRIVATE|email|medical|ReasonCode|DeductionJson/i);
    const ccc = events.find(row => row.type === 'CCC' && row.startDate === '2027-01-05');
    assert.equal(ccc.label, 'CCC');
    assert.deepEqual(ccc.segments.map(row => row.status), ['busy', 'unknown']);
    assert.equal(events.find(row => row.type === 'Rotation').segments[0].status, 'busy');
    assert.ok(!events.some(row => row.kind === 'afc' && row.startDate === '2027-01-08'), 'Available Special Leave must not block');
    assert.ok(events.some(row => row.kind === 'afc' && row.startDate === '2027-01-09'), 'Unavailable Special Leave still blocks');
    assert.equal(body.faculty.find(row => row.facultyId === facultyId).undatedRoles, 2);
    const old = await repository.list({ actorFirebaseUid: 'availability-admin', facultyId, ...range, kind: 'afc', cursor: 0, limit: 100 });
    assert.deepEqual(events.filter(row => row.facultyId === facultyId && row.kind === 'afc').map(row => row.eventKey).sort(),
      old.items.map(row => row.eventKey).sort());
    assert.equal((await api.page('availability-self', { snapshot: body.snapshot, offset: '0' })).status, 403);

    const commonStart = performance.now();
    const common = await api.common('availability-admin', { snapshot: body.snapshot, duration: 60, step: 30, minCount: 150, requiredIds: [] });
    const commonMs = Math.round(performance.now() - commonStart);
    assert.equal(common.status, 200);
    assert.ok(common.body.matches.some(row => row.count >= 150));
    const slot = common.body.matches[0];
    const detail = await api.commonDetail('availability-admin', { snapshot: body.snapshot, date: slot.date, start: String(slot.start), end: String(slot.end) });
    assert.equal(detail.body.faculty.filter(row => row.status === 'clear').length, slot.count);
    const exported = await api.export('availability-admin', { snapshot: body.snapshot, format: 'xlsx', filter: 'all', sort: 'name' });
    assert.equal(exported.status, 200);
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(Buffer.from(exported.body.fileBase64, 'base64'));
    assert.equal(book.worksheets[0].rowCount, body.faculty.length + 1);
    assert.equal(book.worksheets[0].getCell('A1').value, 'Faculty');
    assert.equal(book.worksheets[0].getCell('K1').value, 'Faculty reference');
    assert.match(book.worksheets[0].getCell('K2').value, /^[A-F0-9]{10}$/);
    console.log(JSON.stringify({ acceptance: 'AVAILABILITY_BULK_SQL_OK', scaleFaculty: 150, dates: 31,
      scopeFaculty: body.faculty.length, sourceEvents: loaded.events.length, filteredEvents: events.length,
      sqlReadSamplesMs: sqlTimings, firstPageWithModelMs: queryMs, remainingPagesMs: pagesMs,
      commonSearchMs: commonMs, sqlFullQueries: sqlReads }));

    const [definition] = await query("SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'paws_api.ListFacultyAvailabilityBulk'))),2) AS DefinitionHash");
    const rollback = fs.readFileSync(require.resolve('../database/azure-sql/rollback_072_faculty_availability_bulk_read.sql'), 'utf8')
      .replace(/^:ON ERROR EXIT\r?\n/m, '');
    await assert.rejects(query(rollback.replace('$(PAWS_AVAILABILITY_BULK_SHA256)', '0'.repeat(64))), error => error.number === 57208);
    await query(rollback.replace('$(PAWS_AVAILABILITY_BULK_SHA256)', definition.DefinitionHash));
    const [after] = await query("SELECT OBJECT_ID(N'paws_api.ListFacultyAvailability') AS LegacyObjectId,OBJECT_ID(N'paws_api.ListFacultyAvailabilityBulk') AS BulkObjectId,(SELECT COUNT(*) FROM paws.Session WHERE CourseCode=N'AVSCALE') AS SessionCount");
    assert.ok(after.LegacyObjectId);
    assert.equal(after.BulkObjectId, null);
    assert.equal(after.SessionCount, 4650);
    console.log('AVAILABILITY_BULK_ROLLBACK_PRESERVED_DATA');
  } finally { await pool.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
