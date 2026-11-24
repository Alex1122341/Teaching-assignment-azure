'use strict';

(function exposeAfcBatchHelpers(root) {
  function normalizePastedDate(value, field) {
    const raw = String(value ?? '').trim();
    if (!raw) return { value: '', error: '' };

    let parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (!parts) parts = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(raw);
    const year = parts ? Number(parts[1]) : 0;
    const month = parts ? Number(parts[2]) : 0;
    const day = parts ? Number(parts[3]) : 0;
    const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const monthLengths = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (!parts || year < 1 || month < 1 || month > 12 || day < 1 || day > monthLengths[month - 1]) {
      return { value: '', error: `Invalid ${field}: "${raw}". Use YYYY-MM-DD or YYYY/M/D.` };
    }
    return { value: `${parts[1]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, error: '' };
  }

  function validCanonicalDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''));
    if (!match) return false;
    const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
    const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const monthLengths = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= monthLengths[month - 1];
  }

  function parsePaste(raw, resolveFaculty) {
    const lines = String(raw || '').replace(/\r/g, '').split('\n').filter(line => line.trim());
    if (lines.length && /faculty member|^faculty\s*\t/i.test(lines[0])) lines.shift();
    if (!lines.length) return { rows: [], error: 'Paste at least one AFC row.' };
    if (lines.length > 20) return { rows: [], error: 'Paste no more than 20 rows.' };
    const rows = lines.map(line => {
      const columns = line.split('\t');
      const [facultyEntry = '', sourceStartDate = '', sourceEndDate = ''] = columns;
      const purpose = columns.length > 4 ? columns.slice(3).join('\t') : columns[3] || '';
      const resolved = resolveFaculty(facultyEntry.trim());
      const start = normalizePastedDate(sourceStartDate, 'Start Date');
      const end = normalizePastedDate(sourceEndDate, 'End Date');
      const dateErrors = { startDate: start.error, endDate: end.error };
      const errors = Object.values(dateErrors).filter(Boolean);
      return { facultyId: resolved?.facultyId || '', facultyEntry, startDate: start.value, endDate: end.value, purpose, importError: columns.length < 4 ? 'Expected Faculty Member, Start, End, Purpose.' : '', dateErrors, errors, status: errors.length ? 'INVALID' : 'EDIT' };
    });
    return { rows, error: '' };
  }

  function validateRows(rows, resolveFaculty) {
    const seen = new Set();
    return rows.map((row, rowIndex) => {
      const errors = row.importError ? [row.importError] : [];
      const dateErrors = row.dateErrors || {};
      errors.push(...Object.values(dateErrors).filter(Boolean));
      const facultyRow = resolveFaculty(row.facultyEntry || row.facultyId);
      if (!facultyRow) errors.push('Choose an active Faculty member.');
      else row.facultyId = facultyRow.facultyId;
      const startValid = validCanonicalDate(row.startDate);
      const endValid = validCanonicalDate(row.endDate);
      if ((!startValid && !dateErrors.startDate) || (!endValid && !dateErrors.endDate)) errors.push('Enter valid YYYY-MM-DD dates.');
      else if (startValid && endValid && row.endDate < row.startDate) errors.push('End date is before start date.');
      if (!String(row.purpose ?? '').trim()) errors.push('Purpose is required.');
      else if (row.purpose.length > 1000) errors.push('Purpose exceeds 1,000 characters.');
      const identity = JSON.stringify([row.facultyId, row.startDate, row.endDate, row.purpose]);
      if (!errors.length && seen.has(identity)) errors.push('Duplicate row in this batch.');
      if (!errors.length) seen.add(identity);
      row.errors = errors;
      row.status = errors.length ? (errors.some(value => value.includes('Duplicate row')) ? 'DUPLICATE_IN_BATCH' : 'INVALID') : 'NEW';
      row.rowIndex = rowIndex;
      return row;
    });
  }

  function toApiRows(rows) {
    return rows.map(({ facultyId, startDate, endDate, purpose }) => ({ facultyId, startDate, endDate, purpose }));
  }

  function canSubmitRows(rows, inFlight = false) {
    return !inFlight && rows.length > 0 && rows.every(row => !row.errors?.length);
  }

  function successMessage(outcome) {
    const rows = Array.isArray(outcome?.rows) ? outcome.rows : [];
    if (outcome?.idempotentReplay) {
      return 'This batch was already applied; no additional AFC records were created (' + rows.length + ' rows).';
    }
    const created = rows.filter(row => row.status === 'NEW' || row.status === 'CREATED').length;
    return 'Created ' + created + ' AFC record(s).';
  }


  const blankRow = () => ({ facultyId: '', facultyEntry: '', startDate: '', endDate: '', purpose: '', errors: [], dateErrors: {} });
  const rowUsed = row => ['facultyEntry', 'facultyId', 'startDate', 'endDate', 'purpose', 'importError'].some(key => String(row[key] || '').trim()) ||
    Object.values(row.dateErrors || {}).some(Boolean);

  function receiptsFor(outcome, draft, requestId) {
    const incomplete = () => { throw new Error('The saved rows could not be confirmed.'); };
    if (outcome?.requestId !== requestId || !Array.isArray(outcome.rows) || outcome.rows.length !== draft.length) incomplete();
    const expected = outcome.idempotentReplay ? 'ALREADY_APPLIED' : 'NEW';
    const result = new Map(), ids = new Set();
    for (const receipt of outcome.rows) {
      const index = receipt?.rowIndex, row = draft[index];
      if (!Number.isInteger(index) || !row || result.has(index) || receipt.status !== expected ||
           !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(receipt.afcRecordId) ||
          ids.has(receipt.afcRecordId.toLowerCase()) || String(receipt.facultyId).toLowerCase() !== row.facultyId.toLowerCase() ||
          receipt.startDate !== row.startDate || receipt.endDate !== row.endDate || receipt.purpose !== row.purpose) incomplete();
      ids.add(receipt.afcRecordId.toLowerCase());
      result.set(index, { afcRecordId: receipt.afcRecordId, facultyId: row.facultyId, facultyName: row.facultyName,
        startDate: row.startDate, endDate: row.endDate, purpose: row.purpose, ...(row.file ? { file: row.file } : {}) });
    }
    return draft.map((_, index) => result.get(index));
  }

  function createEditor({ $, on, esc, getUser, canWrite, resolveFaculty, facultyName, saveBatch, showSaved, refresh,
    validPdf = () => false, newId = () => crypto.randomUUID() }) {
    let rows = [blankRow()], attempt = null, busy = false, generation = 0;
    const node = suffix => $('afc-batch-' + suffix);
    const locked = () => busy || attempt !== null;
    function status(message, error = false) {
      const output = node('status');
      if (!output) return;
      output.textContent = message;
      output.classList.toggle('error', error);
    }
    function controls() {
      const save = node('submit');
      if (!save) return;
      save.disabled = busy || !canWrite() || !rows.some(rowUsed);
      save.textContent = busy ? 'Saving…' : attempt ? 'Retry save' : 'Save records';
      for (const id of ['add-row', 'clear', 'paste', 'import-paste']) {
        const control = node(id);
        if (control) control.disabled = locked() || (id === 'add-row' && rows.length >= 20);
      }
    }
    function pdfControl(row, index) {
      const disabled = locked() || !canWrite() || !row.facultyId;
      return '<input type="file" accept=".pdf,application/pdf" data-afc-draft-pdf data-row-index="' + index +
        '" aria-label="Choose PDF for row ' + (index + 1) + '"' + (disabled ? ' disabled' : '') + '>' +
        (row.file ? '<div><span>' + esc(row.file.name) + '</span> <button type="button" class="btn btn-small" data-afc-remove-draft-pdf="' +
          index + '"' + (disabled ? ' disabled' : '') + '>Remove PDF</button></div>' : '') +
        '<div role="status">' + esc(row.pdfError || '') + '</div>';
    }
    function render() {
      const body = node('rows');
      if (!body) return;
      body.innerHTML = rows.map((row, index) => {
        const field = (label, key, attrs = '') => '<td><input class="input" data-afc-batch-field="' + key + '" data-row-index="' + index +
          '" aria-label="' + label + ' row ' + (index + 1) + '" value="' + esc(row[key]) + '" ' + attrs + (locked() ? ' disabled' : '') + '></td>';
        return '<tr>' + field('Faculty member', 'facultyEntry', 'list="afc-faculty-options" placeholder="Search active faculty…"') +
          field('Start date', 'startDate', 'type="date"') + field('End date', 'endDate', 'type="date"') +
          field('Purpose', 'purpose', 'maxlength="1000"') + '<td data-afc-draft-pdf-cell>' + pdfControl(row, index) +
          '</td><td data-afc-row-status aria-live="polite">' + esc(row.errors.join(' ')) +
          '</td><td><button class="btn" type="button" data-afc-batch-remove="' + index + '" aria-label="Remove row ' + (index + 1) +
          '"' + (locked() ? ' disabled' : '') + '>Remove</button></td></tr>';
      }).join('');
      controls();
    }
    function change(event) {
      if (locked()) return;
      const input = event.target?.closest?.('[data-afc-batch-field]');
      if (!input) return;
      const index = Number(input.dataset.rowIndex);
      const row = rows[index], key = input.dataset.afcBatchField;
      if (!row || !['facultyEntry', 'startDate', 'endDate', 'purpose'].includes(key)) return;
      row[key] = input.value;
      if (key === 'facultyEntry') {
        const id = resolveFaculty(input.value)?.facultyId || '';
        if (id !== row.facultyId) {
          row.facultyId = id;
          row.file = null;
          row.pdfError = '';
          const pdfCell = input.closest('tr')?.querySelector('[data-afc-draft-pdf-cell]');
          if (pdfCell) pdfCell.innerHTML = pdfControl(row, index);
        }
      }
      if (key === 'startDate' || key === 'endDate') row.dateErrors[key] = '';
      row.importError = ''; row.errors = [];
      const cell = input.closest('tr')?.querySelector?.('[data-afc-row-status]');
      if (cell) cell.textContent = '';
      status(''); controls();
    }
    function choosePdf(index, file, control) {
      const row = rows[index];
      if (!row?.facultyId || locked() || !canWrite()) return;
      row.file = file && validPdf(file) ? file : null;
      row.pdfError = file && !row.file ? 'Choose a PDF up to 2 MiB.' : '';
      const cell = control.closest('td');
      if (cell) {
        cell.innerHTML = pdfControl(row, index);
        cell.querySelector('[data-afc-draft-pdf]')?.focus();
      } else render();
    }
    function append() {
      if (locked()) return;
      const parsed = parsePaste(node('paste').value, resolveFaculty);
      if (parsed.error) { status(parsed.error, true); return; }
      const draft = rows.filter(rowUsed);
      if (draft.length + parsed.rows.length > 20) { status('A batch can contain at most 20 rows.', true); return; }
      rows = draft.concat(parsed.rows); node('paste').value = '';
      render(); status('Added ' + parsed.rows.length + ' pasted row(s).');
    }
    function newAttempt() {
      const entered = rows.filter(rowUsed);
      if (!entered.length) { status('Enter at least one record.', true); return null; }
      validateRows(entered, resolveFaculty);
      if (!canSubmitRows(entered)) {
        render(); status('Review the messages beside the incomplete rows.', true);
        return null;
      }
      return { requestId: newId(), draft: entered.map(row => ({
        facultyId: row.facultyId, startDate: row.startDate, endDate: row.endDate, purpose: row.purpose,
        facultyName: facultyName(resolveFaculty(row.facultyId)), file: row.file
      })) };
    }
    async function save() {
      const owner = getUser()?.uid, current = generation;
      if (!owner || busy || !canWrite()) return;
      attempt = attempt || newAttempt();
      if (!attempt) return;
      const submitted = attempt;
      const same = () => generation === current && getUser()?.uid === owner;
      busy = true; render(); status('Saving records…');
      let receipts;
      try {
        const response = await saveBatch({ requestId: submitted.requestId, rows: toApiRows(submitted.draft) });
        if (!same()) return;
        receipts = receiptsFor(response, submitted.draft, submitted.requestId);
      } catch (error) {
        if (!same()) return;
        if (error?.status >= 400 && error.status < 500 && error.status !== 408) {
          const entered = rows.filter(rowUsed);
          for (const item of Array.isArray(error.rows) ? error.rows : []) {
            const row = entered[item.rowIndex];
            if (row) row.errors = [item.status === 'ALREADY_EXISTS' ? 'Matching record already exists.' : 'This row was not saved.'];
          }
          attempt = null;
          status(error.message || 'Review these rows before saving again.', true);
        } else {
          status('Save unconfirmed. Retry save to confirm the same batch.', true);
        }
        return;
      } finally {
        if (same()) { busy = false; render(); }
      }
      attempt = null;
      rows = [blankRow()];
      render(); status('Saved ' + receipts.length + ' record(s). Add a PDF to each saved record below.');
      try { await showSaved(receipts); }
      catch (_) { if (same()) status('Records saved. Use Attach PDF in the AFC records list.', true); }
      try { if (same()) await refresh(); } catch (_) { /* The records were already confirmed. */ }
    }
    function clear() {
      ++generation; busy = false; attempt = null; rows = [blankRow()];
      if (node('paste')) node('paste').value = '';
      render(); status('');
    }
    function bind() {
      on(node('add-row'), 'click', () => {
        if (locked() || rows.length >= 20) return;
        rows.push(blankRow()); render();
        node('rows')?.querySelector?.('[data-afc-batch-field="facultyEntry"][data-row-index="' + (rows.length - 1) + '"]')?.focus();
      });
      on(node('rows'), 'input', change);
      on(node('rows'), 'change', event => {
        const picker = event.target?.closest?.('[data-afc-draft-pdf]');
        if (picker) choosePdf(Number(picker.dataset.rowIndex), picker.files?.[0], picker);
        else change(event);
      });
      on(node('rows'), 'click', event => {
        const removePdf = event.target?.closest?.('[data-afc-remove-draft-pdf]');
        if (removePdf) { choosePdf(Number(removePdf.dataset.afcRemoveDraftPdf), null, removePdf); return; }
        const remove = event.target?.closest?.('[data-afc-batch-remove]');
        if (!remove || locked()) return;
        rows.splice(Number(remove.dataset.afcBatchRemove), 1);
        if (!rows.length) rows.push(blankRow());
        render(); status('');
      });
      on(node('clear'), 'click', () => { if (!locked()) clear(); });
      on(node('import-paste'), 'click', append);
      on(node('submit'), 'click', save);
    }
    return { bind, render, controls, clear };
  }

  const helpers = Object.freeze({ createEditor, receiptsFor, normalizePastedDate, parsePaste, validateRows, toApiRows, canSubmitRows, successMessage });
  if (typeof module !== 'undefined' && module.exports) module.exports = helpers;
  if (root) root.UCVM_AFC_BATCH = helpers;
})(typeof window === 'undefined' ? null : window);
