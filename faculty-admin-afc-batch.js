'use strict';

(function exposeAfcBatchHelpers(root) {
  function parsePaste(raw, resolveFaculty) {
    const lines = String(raw || '').replace(/\r/g, '').split('\n').filter(line => line.trim());
    if (lines.length && /faculty member|^faculty\s*\t/i.test(lines[0])) lines.shift();
    if (!lines.length) return { rows: [], error: 'Paste at least one AFC row.' };
    if (lines.length > 20) return { rows: [], error: 'Paste no more than 20 rows.' };
    const rows = lines.map(line => {
      const columns = line.split('\t');
      const [facultyEntry = '', startDate = '', endDate = ''] = columns;
      const purpose = columns.length > 4 ? columns.slice(3).join('\t') : columns[3] || '';
      const resolved = resolveFaculty(facultyEntry.trim());
      return { facultyId: resolved?.facultyId || '', facultyEntry, startDate: startDate.trim(), endDate: endDate.trim(), purpose, importError: columns.length < 4 ? 'Expected Faculty Member, Start, End, Purpose.' : '', errors: [], status: 'EDIT' };
    });
    return { rows, error: '' };
  }

  function successMessage(outcome) {
    const rows = Array.isArray(outcome?.rows) ? outcome.rows : [];
    if (outcome?.idempotentReplay) {
      return 'This batch was already applied; no additional AFC records were created (' + rows.length + ' rows).';
    }
    const created = rows.filter(row => row.status === 'NEW' || row.status === 'CREATED').length;
    return 'Created ' + created + ' AFC record(s).';
  }

  const helpers = Object.freeze({ parsePaste, successMessage });
  if (typeof module !== 'undefined' && module.exports) module.exports = helpers;
  if (root) root.UCVM_AFC_BATCH = helpers;
})(typeof window === 'undefined' ? null : window);
