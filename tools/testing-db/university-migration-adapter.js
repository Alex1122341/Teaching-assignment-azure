'use strict';
const crypto = require('node:crypto');
const manifest = require('./university-guard-manifest.json');
const { compileTargetGuard, UNIVERSITY_HOSTS, TESTING_DATABASE } = require('../../server/src/runtime/sql-environment-target');
const GUARD = /(DB_NAME\s*\(\s*\)\s*(?:<>|!=|=)\s*N?)'VetMed-Ops'/gi;
const canonical = text => String(text).replace(/\r\n/g, '\n');
const sourceHash = text => crypto.createHash('sha256').update(canonical(text)).digest('hex');

function assertUniversityInventory(files) {
  const expected=Object.keys(manifest.files).sort(),actual=[...files].sort();
  if (actual.length!==expected.length || actual.some((file,index)=>file!==expected[index])) {
    throw Error('Testing migration inventory does not match the reviewed manifest');
  }
}

// Mask comments and literals separately; ordinary help/error strings are not
// executable USE statements. Dynamic SQL literals are checked as SQL below.
function lexSql(text) {
  let code = '', i = 0;
  const literals = [];
  while (i < text.length) {
    if (text.slice(i, i + 2) === '--') {
      while (i < text.length && text[i] !== '\n') { code += ' '; i++; }
    } else if (text.slice(i, i + 2) === '/*') {
      let depth = 1; i += 2; code += '  ';
      while (i < text.length && depth) {
        if (text.slice(i, i + 2) === '/*') { depth++; code += '  '; i += 2; }
        else if (text.slice(i, i + 2) === '*/') { depth--; code += '  '; i += 2; }
        else { code += text[i] === '\n' ? '\n' : ' '; i++; }
      }
      if (depth) throw Error('Testing SQL scope has an unclosed comment');
    } else if (text[i] === "'") {
      let value = '', closed = false; code += ' '; i++;
      while (i < text.length) {
        if (text[i] === "'" && text[i + 1] === "'") { value += "'"; code += '  '; i += 2; }
        else if (text[i] === "'") { code += ' '; i++; closed = true; break; }
        else { value += text[i]; code += text[i] === '\n' ? '\n' : ' '; i++; }
      }
      if (!closed) throw Error('Testing SQL scope has an unclosed literal');
      literals.push(value);
    } else { code += text[i++]; }
  }
  return { code, literals };
}

function assertScopedSql(text, depth = 0) {
  if (depth > 8) throw Error('Testing SQL scope contains excessive dynamic nesting');
  const { code, literals } = lexSql(String(text));
  if (/\bUSE\s+/i.test(code)) throw Error('Testing SQL context switches are forbidden');
  if (/\b(?:OPENQUERY|OPENDATASOURCE|OPENROWSET)\s*\(|\bCREATE\s+SYNONYM\b|\bEXEC(?:UTE)?\b[\s\S]*\)\s+AT\b/i.test(code)) {
    throw Error('Testing SQL scope forbids linked servers and synonyms');
  }
  const identifier = '(?:\\[[^\\]]+\\]|[A-Za-z_][A-Za-z0-9_]*)';
  const qualifiedObject = new RegExp('\\b(?:FROM|JOIN|UPDATE|INTO|TABLE|VIEW|PROCEDURE|FUNCTION|TRIGGER)\\s+' + identifier + '\\s*\\.\\s*' + identifier + '\\s*\\.', 'i');
  if (qualifiedObject.test(code) || /\[VetMed-Ops\]\s*\./i.test(code)) throw Error('Testing SQL cross-database scope is forbidden');
  for (const literal of literals) {
    const nested = literal.replace(/^(?:\s|;|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*/, '');
    // USE followed by a complete identifier/statement is SQL; "Use the
    // selected course" is help text. Strip comments before classifying it.
    if (/^\s*USE\s+/i.test(nested)) {
      const prose=/^Use (?:the|this|a|an) [^;\r\n]+$/i.test(nested)&&
        !/--|\/\*|['"\[\]]|\b(?:SELECT|INSERT|UPDATE|DELETE|MERGE|EXEC(?:UTE)?|CREATE|ALTER|DROP|DECLARE|SET|WITH|TRUNCATE|DBCC|WAITFOR|PRINT|RAISERROR|BACKUP|RESTORE|GRANT|REVOKE|DENY|RECONFIGURE|IF|BEGIN|RETURN|CHECKPOINT)\b/i.test(nested.slice(4));
      if(!prose)throw Error('Testing SQL context switches are forbidden');
    }
    if (/^\s*(?:SELECT|INSERT|UPDATE|DELETE|MERGE|CREATE|ALTER|DROP|EXEC|GRANT|REVOKE|DENY|DECLARE|SET|BEGIN|WITH)\b/i.test(nested)) assertScopedSql(literal, depth + 1);
  }
}

function adaptUniversitySql({ file, text, sourceSha256, target }) {
  if (target?.profile !== 'university-testing' || target.database !== TESTING_DATABASE || !UNIVERSITY_HOSTS.includes(target.host)) {
    throw Error('Testing adapter requires the resolved University Testing target');
  }
  compileTargetGuard(target);
  const entry = manifest.files[file], normalized = canonical(text), actual = sourceHash(text);
  if (manifest.normalization !== 'utf8-lf' || !entry || sourceSha256 !== actual || entry.sourceSha256 !== actual) {
    throw Error('Testing migration source is not the reviewed manifest input');
  }
  assertScopedSql(normalized);
  let guardCount = 0;
  const result = normalized.replace(GUARD, (_, prefix) => { guardCount++; return prefix + "'VetMed-Ops-Testing'"; });
  if (guardCount !== entry.guardCount || lexSql(result).literals.includes('VetMed-Ops')) {
    throw Error('Testing migration contains an unrecognized database guard');
  }
  return { text: result, sourceSha256: actual, transformedSha256: sourceHash(result), guardCount };
}

module.exports = { adaptUniversitySql, assertScopedSql, sourceHash, assertUniversityInventory };
