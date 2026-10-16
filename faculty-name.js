(() => {
  'use strict';
  const text = value => value == null ? '' : String(value).trim();
  const removeCommas = value => text(value).replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  function format(record, fallback = '') {
    if (!record || typeof record !== 'object') return removeCommas(record) || removeCommas(fallback);
    const first = text(record.preferredFirstName ?? record.PreferredFirstName);
    const last = text(record.preferredLastName ?? record.PreferredLastName);
    const preferred = [first, last].filter(Boolean).join(' ');
    // Display is separate from FacultyId, source aliases, and private HR identity.
    return removeCommas(preferred || record.displayName || record.DisplayName || record.name || record.facultyName) || removeCommas(fallback);
  }
  window.PAWS_FACULTY_NAME = Object.freeze({ format, removeCommas });
})();
