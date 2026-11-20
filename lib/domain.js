'use strict';

const { HttpError } = require('./errors');
const {
  todayISO,
  nowStamp,
  addDays,
  diffDays,
  startOfWeekISO
} = require('./dates');

const AVATAR_COLORS = [
  '#C2410C',
  '#D97706',
  '#9A3412',
  '#b45309',
  '#7c2d12',
  '#ea580c',
  '#0f766e',
  '#a16207',
  '#c2410c',
  '#9a3412'
];

const PAYMENT_METHODS = ['cash', 'card', 'bank', 'online'];
const MEMBERSHIP_STATUSES = ['active', 'scheduled', 'frozen', 'expired', 'cancelled'];

function parseFeatures(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean);
    }
  } catch {
    // Fall through to text splitting.
  }
  return String(value)
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeFeatures(value) {
  const items = Array.isArray(value) ? value : parseFeatures(value);
  return items.map((item) => String(item).trim()).filter(Boolean).slice(0, 12);
}

async function refreshSubscriptionStatuses(db, today = todayISO()) {
  await db.prepare(
    `UPDATE subscriptions
     SET status = 'expired'
     WHERE status IN ('active', 'scheduled') AND end_date < ?`
  ).run(today);
  await db.prepare(
    `UPDATE subscriptions
     SET status = 'active'
     WHERE status = 'scheduled' AND start_date <= ? AND end_date >= ?`
  ).run(today, today);
}

function subscriptionStatusFor(startDate, endDate, today = todayISO()) {
  if (endDate < today) return 'expired';
  if (startDate > today) return 'scheduled';
  return 'active';
}

async function suggestStartDate(db, memberId, today = todayISO()) {
  const row = await db
    .prepare(
      `SELECT MAX(end_date) AS latest_end
       FROM subscriptions
       WHERE member_id = ? AND status IN ('active', 'frozen', 'scheduled')`
    )
    .get(memberId);
  if (!row?.latest_end) return today;
  return row.latest_end >= today ? addDays(row.latest_end, 1) : today;
}

async function getCurrentSubscription(db, memberId) {
  return await db
    .prepare(
      `SELECT s.*, p.name AS plan_name, p.description AS plan_description,
              p.duration_days, p.features AS plan_features
       FROM subscriptions s
       JOIN plans p ON p.id = s.plan_id
       WHERE s.member_id = ?
       ORDER BY
         CASE s.status
           WHEN 'active' THEN 0
           WHEN 'frozen' THEN 1
           WHEN 'scheduled' THEN 2
           WHEN 'expired' THEN 3
           ELSE 4
         END,
         s.end_date DESC, s.id DESC
       LIMIT 1`
    )
    .get(memberId);
}

async function getActiveSubscription(db, memberId, today = todayISO()) {
  return await db
    .prepare(
      `SELECT s.*, p.name AS plan_name
       FROM subscriptions s
       JOIN plans p ON p.id = s.plan_id
       WHERE s.member_id = ? AND s.status = 'active'
         AND s.start_date <= ? AND s.end_date >= ?
       ORDER BY s.end_date DESC, s.id DESC
       LIMIT 1`
    )
    .get(memberId, today, today);
}

async function createSubscription(db, { memberId, planId, startDate, notes = '' }, today = todayISO()) {
  const member = await db.prepare('SELECT * FROM members WHERE id = ?').get(memberId);
  if (!member) throw new HttpError(404, 'Member not found.');
  if (member.status !== 'active') {
    throw new HttpError(409, 'Reactivate this member before selling a membership.');
  }
  const plan = await db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
  if (!plan) throw new HttpError(404, 'Plan not found.');
  if (!plan.active) throw new HttpError(409, 'This plan is no longer available.');

  const start = startDate || await suggestStartDate(db, memberId, today);
  const end = addDays(start, plan.duration_days - 1);

  const overlap = await db
    .prepare(
      `SELECT s.id, s.start_date, s.end_date, p.name AS plan_name
       FROM subscriptions s
       JOIN plans p ON p.id = s.plan_id
       WHERE s.member_id = ? AND s.status != 'cancelled'
         AND NOT (s.end_date < ? OR s.start_date > ?)
       ORDER BY s.start_date ASC
       LIMIT 1`
    )
    .get(memberId, start, end);
  if (overlap) {
    throw new HttpError(
      409,
      `This period overlaps the member's ${overlap.plan_name} membership (${overlap.start_date} to ${overlap.end_date}). Renewals start after the latest membership ends.`
    );
  }

  const status = subscriptionStatusFor(start, end, today);
  const now = nowStamp();
  const result = await db
    .prepare(
      `INSERT INTO subscriptions
        (member_id, plan_id, start_date, end_date, status, price_cents, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(memberId, planId, start, end, status, plan.price_cents, notes || null, now);

  return {
    ...await db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(Number(result.lastInsertRowid)),
    plan_name: plan.name,
    plan_description: plan.description,
    duration_days: plan.duration_days,
    plan_features: parseFeatures(plan.features)
  };
}

async function nextReceiptNumber(db) {
  const row = await db
    .prepare(
      `SELECT COALESCE(MAX(CAST(SUBSTR(receipt_no, 6) AS INTEGER)), 10000) AS value
       FROM payments`
    )
    .get();
  return `RCPT-${String(Number(row.value) + 1).padStart(5, '0')}`;
}

async function recordPayment(
  db,
  {
    memberId,
    subscriptionId = null,
    amountCents,
    method,
    paidAt = nowStamp(),
    description = '',
    notes = ''
  }
) {
  const member = await db.prepare('SELECT * FROM members WHERE id = ?').get(memberId);
  if (!member) throw new HttpError(404, 'Member not found.');
  if (!PAYMENT_METHODS.includes(method)) {
    throw new HttpError(422, 'Payment method is invalid.');
  }
  let subscription = null;
  if (subscriptionId) {
    subscription = await db
      .prepare(
        `SELECT s.*, p.name AS plan_name
         FROM subscriptions s JOIN plans p ON p.id = s.plan_id
         WHERE s.id = ? AND s.member_id = ?`
      )
      .get(subscriptionId, memberId);
    if (!subscription) {
      throw new HttpError(422, 'The selected membership does not belong to this member.');
    }
  }
  const receiptNo = await nextReceiptNumber(db);
  const createdAt = nowStamp();
  const label =
    description ||
    (subscription ? `${subscription.plan_name} membership` : 'General payment');
  const result = await db
    .prepare(
      `INSERT INTO payments
        (receipt_no, member_id, subscription_id, amount_cents, method, status, paid_at, description, notes, created_at)
       VALUES (?, ?, ?, ?, ?, 'paid', ?, ?, ?, ?)`
    )
    .run(
      receiptNo,
      memberId,
      subscriptionId || null,
      amountCents,
      method,
      paidAt,
      label,
      notes || null,
      createdAt
    );
  return await db.prepare('SELECT * FROM payments WHERE id = ?').get(Number(result.lastInsertRowid));
}

async function freezeSubscription(db, subscriptionId, today = todayISO()) {
  const subscription = await db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(subscriptionId);
  if (!subscription) throw new HttpError(404, 'Membership not found.');
  if (subscription.status !== 'active') {
    throw new HttpError(409, 'Only an active membership can be frozen.');
  }
  const now = nowStamp();
  await db.prepare(
    `UPDATE subscriptions
     SET status = 'frozen', freeze_started_on = ?
     WHERE id = ?`
  ).run(today, subscriptionId);
  return await db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(subscriptionId);
}

async function unfreezeSubscription(db, subscriptionId, today = todayISO()) {
  const subscription = await db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(subscriptionId);
  if (!subscription) throw new HttpError(404, 'Membership not found.');
  if (subscription.status !== 'frozen') {
    throw new HttpError(409, 'Only a frozen membership can be resumed.');
  }
  const frozenDays = Math.max(
    0,
    diffDays(subscription.freeze_started_on || today, today)
  );
  const endDate = addDays(subscription.end_date, frozenDays);
  const status = subscriptionStatusFor(subscription.start_date, endDate, today);
  await db.prepare(
    `UPDATE subscriptions
     SET status = ?, end_date = ?, freeze_started_on = NULL
     WHERE id = ?`
  ).run(status, endDate, subscriptionId);
  return await db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(subscriptionId);
}

async function cancelSubscription(db, subscriptionId) {
  const subscription = await db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(subscriptionId);
  if (!subscription) throw new HttpError(404, 'Membership not found.');
  if (!['active', 'frozen', 'scheduled'].includes(subscription.status)) {
    throw new HttpError(409, 'This membership cannot be cancelled.');
  }
  await db.prepare(
    `UPDATE subscriptions
     SET status = 'cancelled', freeze_started_on = NULL
     WHERE id = ?`
  ).run(subscriptionId);
  return await db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(subscriptionId);
}

async function checkInMember(
  db,
  { memberId, source = 'front_desk', note = '' },
  today = todayISO(),
  now = nowStamp()
) {
  const member = await db.prepare('SELECT * FROM members WHERE id = ?').get(memberId);
  if (!member) throw new HttpError(404, 'Member not found.');
  if (member.status !== 'active') {
    throw new HttpError(403, 'This member is inactive. Restore their profile before check-in.');
  }
  const subscription = await getActiveSubscription(db, memberId, today);
  if (!subscription) {
    const current = await getCurrentSubscription(db, memberId);
    let message = 'This member has no active membership covering today.';
    if (current?.status === 'frozen') {
      message = `Membership is frozen since ${current.freeze_started_on}. Resume it before check-in.`;
    } else if (current?.status === 'scheduled') {
      message = `Membership starts on ${current.start_date}. Check-in is not available yet.`;
    } else if (current?.status === 'expired') {
      message = `Membership expired on ${current.end_date}. Renew it at the front desk.`;
    }
    throw new HttpError(403, message);
  }
  const open = await db
    .prepare(
      `SELECT * FROM checkins
       WHERE member_id = ? AND checked_out_at IS NULL
       ORDER BY checked_in_at DESC LIMIT 1`
    )
    .get(memberId);
  if (open) {
    throw new HttpError(409, 'This member is already checked in.');
  }
  const createdAt = nowStamp();
  const result = await db
    .prepare(
      `INSERT INTO checkins (member_id, checked_in_at, source, note, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(memberId, now, source, note || null, createdAt);
  return {
    checkin: await db.prepare('SELECT * FROM checkins WHERE id = ?').get(Number(result.lastInsertRowid)),
    member,
    subscription
  };
}

async function checkOutMember(db, checkinId, now = nowStamp()) {
  const checkin = await db.prepare('SELECT * FROM checkins WHERE id = ?').get(checkinId);
  if (!checkin) throw new HttpError(404, 'Check-in not found.');
  if (checkin.checked_out_at) throw new HttpError(409, 'This visit is already closed.');
  await db.prepare('UPDATE checkins SET checked_out_at = ? WHERE id = ?').run(now, checkinId);
  return await db.prepare('SELECT * FROM checkins WHERE id = ?').get(checkinId);
}

async function getSharedDays(db, memberAId, memberBId, since = '1970-01-01') {
  return (await db
    .prepare(
      `SELECT DISTINCT substr(a.checked_in_at, 1, 10) AS day
       FROM checkins a
       JOIN checkins b
         ON substr(a.checked_in_at, 1, 10) = substr(b.checked_in_at, 1, 10)
       WHERE a.member_id = ? AND b.member_id = ?
         AND substr(a.checked_in_at, 1, 10) >= ?
       ORDER BY day ASC`
    )
    .all(memberAId, memberBId, since))
    .map((row) => row.day);
}

async function getBuddyStats(db, memberAId, memberBId, today = todayISO(), weeklyGoal = 3) {
  const allDays = await getSharedDays(db, memberAId, memberBId);
  const last30Start = addDays(today, -29);
  const weekStart = startOfWeekISO(today);
  const last30 = allDays.filter((day) => day >= last30Start);
  const thisWeek = allDays.filter((day) => day >= weekStart && day <= today);

  const weeksWithShared = new Set(allDays.map((day) => startOfWeekISO(day)));
  let cursor = weekStart;
  if (!weeksWithShared.has(cursor)) cursor = addDays(cursor, -7);
  let streakWeeks = 0;
  while (weeksWithShared.has(cursor)) {
    streakWeeks += 1;
    cursor = addDays(cursor, -7);
  }

  return {
    shared_30: last30.length,
    shared_this_week: thisWeek.length,
    total_shared: allDays.length,
    weekly_goal: weeklyGoal,
    goal_percent: Math.min(100, Math.round((thisWeek.length / weeklyGoal) * 100)),
    streak_weeks: streakWeeks,
    last_shared: allDays.length ? allDays[allDays.length - 1] : null
  };
}

function membershipState(memberStatus, subscription, today = todayISO()) {
  if (memberStatus === 'inactive') return 'inactive';
  if (!subscription) return 'no_plan';
  if (subscription.status === 'active') {
    return subscription.end_date <= addDays(today, 7) ? 'expiring' : 'active';
  }
  if (subscription.status === 'frozen') return 'frozen';
  if (subscription.status === 'scheduled') return 'scheduled';
  if (subscription.status === 'cancelled') return 'cancelled';
  return 'expired';
}

module.exports = {
  AVATAR_COLORS,
  PAYMENT_METHODS,
  MEMBERSHIP_STATUSES,
  parseFeatures,
  normalizeFeatures,
  refreshSubscriptionStatuses,
  subscriptionStatusFor,
  suggestStartDate,
  getCurrentSubscription,
  getActiveSubscription,
  createSubscription,
  nextReceiptNumber,
  recordPayment,
  freezeSubscription,
  unfreezeSubscription,
  cancelSubscription,
  checkInMember,
  checkOutMember,
  getSharedDays,
  getBuddyStats,
  membershipState
};
