'use strict';

const DAY_MS = 24 * 60 * 60 * 1000;

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toISODate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function todayISO(date = new Date()) {
  return toISODate(date);
}

function nowStamp(date = new Date()) {
  return `${toISODate(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

function isValidISODate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

function parseISODate(value) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function addDays(isoDate, days) {
  const date = parseISODate(isoDate);
  date.setUTCDate(date.getUTCDate() + Number(days));
  return date.toISOString().slice(0, 10);
}

function diffDays(fromISO, toISO) {
  return Math.round((parseISODate(toISO).getTime() - parseISODate(fromISO).getTime()) / DAY_MS);
}

function monthKey(isoDate) {
  return String(isoDate).slice(0, 7);
}

function monthKeyFromStamp(stamp) {
  return String(stamp).slice(0, 7);
}

function addMonthsToKey(key, months) {
  const [y, m] = key.split('-').map(Number);
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12 + 12) % 12 + 1;
  return `${year}-${pad2(month)}`;
}

function monthKeysBack(count, fromISO = todayISO()) {
  const current = monthKey(fromISO);
  return Array.from({ length: count }, (_, index) =>
    addMonthsToKey(current, index - (count - 1))
  );
}

function startOfWeekISO(isoDate) {
  const date = parseISODate(isoDate);
  const dayOfWeek = date.getUTCDay();
  const mondayOffset = (dayOfWeek + 6) % 7;
  date.setUTCDate(date.getUTCDate() - mondayOffset);
  return date.toISOString().slice(0, 10);
}

function normalizeTimestamp(value) {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (isValidISODate(raw)) return `${raw} 12:00:00`;
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  if (!isValidISODate(match[1])) return null;
  const hour = Number(match[2]);
  const minute = Number(match[3]);
  const second = Number(match[4] || 0);
  if (hour > 23 || minute > 59 || second > 59) return null;
  return `${match[1]} ${pad2(hour)}:${pad2(minute)}:${pad2(second)}`;
}

function nowMinusMinutes(minutes, now = new Date()) {
  return nowStamp(new Date(now.getTime() - minutes * 60 * 1000));
}

function startOfDayStamp(isoDate = todayISO()) {
  return `${isoDate} 00:00:00`;
}

module.exports = {
  DAY_MS,
  pad2,
  toISODate,
  todayISO,
  nowStamp,
  isValidISODate,
  parseISODate,
  addDays,
  diffDays,
  monthKey,
  monthKeyFromStamp,
  addMonthsToKey,
  monthKeysBack,
  startOfWeekISO,
  normalizeTimestamp,
  nowMinusMinutes,
  startOfDayStamp
};
