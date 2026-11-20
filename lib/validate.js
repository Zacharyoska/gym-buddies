'use strict';

const { HttpError } = require('./errors');
const { isValidISODate, normalizeTimestamp } = require('./dates');

function fail(message, field) {
  throw new HttpError(422, message, field ? { field } : null);
}

function string(value, label, options = {}) {
  const { required = true, min = 1, max = 200, trim = true } = options;
  let result = value === undefined || value === null ? '' : String(value);
  if (trim) result = result.trim();
  if (!result && required) fail(`${label} is required.`);
  if (!result) return '';
  if (result.length < min) fail(`${label} must be at least ${min} characters.`);
  if (result.length > max) fail(`${label} must be at most ${max} characters.`);
  return result;
}

function optionalString(value, label, max = 200) {
  return string(value, label, { required: false, max });
}

function email(value, label = 'Email', required = false) {
  const result = string(value, label, { required, max: 254 }).toLowerCase();
  if (!result) return '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(result)) fail(`${label} is not valid.`);
  return result;
}

function integer(value, label, options = {}) {
  const { required = true, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = options;
  if ((value === undefined || value === null || value === '') && !required) return null;
  const number = Number(value);
  if (!Number.isInteger(number)) fail(`${label} must be a whole number.`);
  if (number < min) fail(`${label} must be at least ${min}.`);
  if (number > max) fail(`${label} must be at most ${max}.`);
  return number;
}

function id(value, label = 'ID') {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) fail(`${label} is invalid.`);
  return number;
}

function moneyCents(value, label = 'Amount') {
  return integer(value, label, { min: 0, max: 100000000 });
}

function boolean(value) {
  return value === true || value === 'true' || value === 'on' || value === 1 || value === '1';
}

function enumOf(value, allowed, label) {
  const result = string(value, label, { max: 40 });
  if (!allowed.includes(result)) fail(`${label} must be one of: ${allowed.join(', ')}.`);
  return result;
}

function isoDate(value, label, options = {}) {
  const { required = true } = options;
  if (!value && !required) return '';
  const result = string(value, label, { max: 10 });
  if (!isValidISODate(result)) fail(`${label} must be a valid date (YYYY-MM-DD).`);
  return result;
}

function timestamp(value, label, options = {}) {
  const { required = true } = options;
  if (!value && !required) return '';
  const result = normalizeTimestamp(String(value ?? ''));
  if (!result) fail(`${label} must be a valid date and time.`);
  return result;
}

function pagination(query, defaultLimit = 15, maxLimit = 100) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number.parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
}

function searchTerm(query, max = 80) {
  return String(query.search || query.q || '').trim().slice(0, max);
}

module.exports = {
  fail,
  string,
  optionalString,
  email,
  integer,
  id,
  moneyCents,
  boolean,
  enumOf,
  isoDate,
  timestamp,
  pagination,
  searchTerm
};
