'use strict';

const NORMALIZED_ROLE = Object.freeze({
  owner: 'adfa_general',
  administrator: 'adfa_regular',
  admin: 'adfa_regular'
});

const SELF_SERVICE_ROLES = new Set(['faculty', 'hicc', 'visc']);
const ADMINISTRATOR_ROLES = new Set(['developer', 'adfa_general', 'adfa_regular', 'owner', 'administrator', 'admin']);
const GENERAL_ROLES = new Set(['developer', 'adfa_general', 'owner']);
const OFFICE_ROLES = new Set(['adc', 'lab']);
const SUPPORTED_ROLES = new Set([...ADMINISTRATOR_ROLES, ...SELF_SERVICE_ROLES, ...OFFICE_ROLES]);

function normalizeBaseRole(value) {
  const role = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!SUPPORTED_ROLES.has(role)) return null;
  return NORMALIZED_ROLE[role] || role;
}

function isSupportedRole(value) {
  return normalizeBaseRole(value) !== null;
}

function isAdministratorRole(value) {
  const role = normalizeBaseRole(value);
  return ADMINISTRATOR_ROLES.has(role);
}

function isGeneralRole(value) {
  const role = normalizeBaseRole(value);
  return GENERAL_ROLES.has(role);
}

function isSelfServiceRole(value) {
  const role = normalizeBaseRole(value);
  return SELF_SERVICE_ROLES.has(role);
}

module.exports = {
  normalizeBaseRole,
  isSupportedRole,
  isAdministratorRole,
  isGeneralRole,
  isSelfServiceRole,
  SUPPORTED_ROLES,
  ADMINISTRATOR_ROLES,
  GENERAL_ROLES,
  SELF_SERVICE_ROLES
};
