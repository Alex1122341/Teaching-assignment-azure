(() => {
  'use strict';
  const text = value => value == null ? '' : String(value).trim();
  const spaces = value => text(value).replace(/\s+/g, ' ');
  // Retain the old export for compatibility; rendered names now use format().
  const removeCommas = value => spaces(value).replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  const unchanged = /^(?:Locum|TBD|Unassigned|Other\s*\/\s*Unassigned|Name unavailable|Not provided|Unknown faculty|Unknown|No instructor assigned|No faculty|Faculty \d+|UCVM User|Signed-in account|N\/A)$/i;
  function formatText(value) {
    const name = spaces(value);
    if (!name || unchanged.test(name) || /^[^\s@]+@[^\s@]+$/.test(name) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f-]{23}$/i.test(name)) return name;
    // Already "Last, First": normalize spacing and do not reverse twice.
    if (name.includes(',')) return name.replace(/\s*,\s*/g, ', ');
    const suffix = name.match(/^(.*?)(\s+\([^()]{1,40}\))$/);
    const stem = suffix ? suffix[1] : name, parts = stem.split(/\s+/);
    if (parts.length < 2) return name;
    return parts[parts.length - 1] + ', ' + parts.slice(0, -1).join(' ') + (suffix ? suffix[2] : '');
  }
  function format(record, fallback = '') {
    if (!record || typeof record !== 'object') return formatText(record) || formatText(fallback);
    const first = spaces(record.preferredFirstName ?? record.PreferredFirstName ?? record.firstName ?? record.FirstName);
    const last = spaces(record.preferredLastName ?? record.PreferredLastName ?? record.lastName ?? record.LastName);
    if (first && last) return last + ', ' + first;
    return formatText(record.preferredFullName ?? record.PreferredFullName ?? record.displayName ?? record.DisplayName ?? record.name ?? record.facultyName) || formatText(fallback) || (last || first);
  }
  function formatList(value) {
    // Instructor lists are semicolon/newline-delimited. Commas belong within names.
    return String(value ?? '').split(/([;\n]+)/).map(part => /^[;\n]+$/.test(part) ? part : formatText(part)).join('').trim();
  }
  window.PAWS_FACULTY_NAME = Object.freeze({ format, formatList, removeCommas });
})();
