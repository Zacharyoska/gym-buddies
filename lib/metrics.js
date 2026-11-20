'use strict';

const {
  todayISO,
  addDays,
  monthKeysBack,
  startOfWeekISO
} = require('./dates');
const { getBuddyStats } = require('./domain');

async function revenueByMonth(db, months = 6, today = todayISO()) {
  const keys = monthKeysBack(months, today);
  const rows = await db
    .prepare(
      `SELECT substr(paid_at, 1, 7) AS month, SUM(amount_cents) AS amount_cents
       FROM payments
       WHERE status = 'paid' AND substr(paid_at, 1, 7) >= ?
       GROUP BY substr(paid_at, 1, 7)`
    )
    .all(keys[0]);
  const found = new Map(rows.map((row) => [row.month, Number(row.amount_cents)]));
  return keys.map((month) => ({ month, amount_cents: found.get(month) || 0 }));
}

async function newMembersByMonth(db, months = 6, today = todayISO()) {
  const keys = monthKeysBack(months, today);
  const rows = await db
    .prepare(
      `SELECT substr(joined_on, 1, 7) AS month, COUNT(*) AS count
       FROM members
       WHERE substr(joined_on, 1, 7) >= ?
       GROUP BY substr(joined_on, 1, 7)`
    )
    .all(keys[0]);
  const found = new Map(rows.map((row) => [row.month, Number(row.count)]));
  return keys.map((month) => ({ month, count: found.get(month) || 0 }));
}

async function attendanceByDay(db, days = 14, today = todayISO()) {
  const start = addDays(today, -(days - 1));
  const rows = await db
    .prepare(
      `SELECT substr(checked_in_at, 1, 10) AS day, COUNT(*) AS count
       FROM checkins
       WHERE substr(checked_in_at, 1, 10) >= ?
       GROUP BY substr(checked_in_at, 1, 10)`
    )
    .all(start);
  const found = new Map(rows.map((row) => [row.day, Number(row.count)]));
  return Array.from({ length: days }, (_, index) => {
    const day = addDays(start, index);
    return { day, count: found.get(day) || 0 };
  });
}

async function planMix(db) {
  return (await db
    .prepare(
      `SELECT p.id, p.name, p.price_cents, p.duration_days, COUNT(s.id) AS count
       FROM plans p
       LEFT JOIN subscriptions s
         ON s.plan_id = p.id AND s.status = 'active'
       GROUP BY p.id
       HAVING count > 0
       ORDER BY count DESC, p.price_cents DESC`
    )
    .all())
    .map((row) => ({ ...row, count: Number(row.count) }));
}

async function buddyLeaderboard(db, limit = 10, today = todayISO()) {
  const pairs = await db
    .prepare(
      `SELECT bp.*,
              a.first_name AS a_first_name, a.last_name AS a_last_name,
              a.avatar_color AS a_avatar_color, a.code AS a_code,
              b.first_name AS b_first_name, b.last_name AS b_last_name,
              b.avatar_color AS b_avatar_color, b.code AS b_code
       FROM buddy_pairs bp
       JOIN members a ON a.id = bp.member_a_id
       JOIN members b ON b.id = bp.member_b_id
       WHERE bp.status = 'active'
       ORDER BY bp.id ASC`
    )
    .all();
  const leaders = [];
  for (const pair of pairs) {
    leaders.push({
      id: pair.id,
      weekly_goal: pair.weekly_goal,
      note: pair.note,
      created_at: pair.created_at,
      a: {
        id: pair.member_a_id,
        first_name: pair.a_first_name,
        last_name: pair.a_last_name,
        avatar_color: pair.a_avatar_color,
        code: pair.a_code
      },
      b: {
        id: pair.member_b_id,
        first_name: pair.b_first_name,
        last_name: pair.b_last_name,
        avatar_color: pair.b_avatar_color,
        code: pair.b_code
      },
      ...(await getBuddyStats(db, pair.member_a_id, pair.member_b_id, today, pair.weekly_goal))
    });
  }
  return leaders
    .sort((left, right) => {
      if (right.shared_30 !== left.shared_30) return right.shared_30 - left.shared_30;
      if (right.streak_weeks !== left.streak_weeks) return right.streak_weeks - left.streak_weeks;
      return left.id - right.id;
    })
    .slice(0, limit);
}

async function expiringMemberships(db, days = 7, today = todayISO(), limit = 10) {
  const until = addDays(today, days);
  return (await db
    .prepare(
      `SELECT s.id AS subscription_id, s.end_date, s.start_date,
              m.id AS member_id, m.code, m.first_name, m.last_name,
              m.email, m.phone, m.avatar_color,
              p.name AS plan_name
       FROM subscriptions s
       JOIN members m ON m.id = s.member_id
       JOIN plans p ON p.id = s.plan_id
       WHERE s.status = 'active' AND m.status = 'active'
         AND s.end_date >= ? AND s.end_date <= ?
       ORDER BY s.end_date ASC, m.first_name ASC
       LIMIT ?`
    )
    .all(today, until, limit))
    .map((row) => ({
      ...row,
      days_left: Math.max(0, require('./dates').diffDays(today, row.end_date))
    }));
}

async function paymentMethodTotals(db, sinceDate) {
  const rows = await db
    .prepare(
      `SELECT method, SUM(amount_cents) AS amount_cents, COUNT(*) AS count
       FROM payments
       WHERE status = 'paid' AND substr(paid_at, 1, 10) >= ?
       GROUP BY method
       ORDER BY amount_cents DESC`
    )
    .all(sinceDate);
  return rows.map((row) => ({
    method: row.method,
    amount_cents: Number(row.amount_cents),
    count: Number(row.count)
  }));
}

async function activeMembershipCount(db, today = todayISO()) {
  return Number(
    (await db
      .prepare(
        `SELECT COUNT(DISTINCT s.member_id) AS count
         FROM subscriptions s
         JOIN members m ON m.id = s.member_id
         WHERE s.status = 'active' AND m.status = 'active'
           AND s.start_date <= ? AND s.end_date >= ?`
      )
      .get(today, today)).count
  );
}

async function topMembersByVisits(db, sinceDate, limit = 8) {
  return (await db
    .prepare(
      `SELECT m.id, m.code, m.first_name, m.last_name, m.avatar_color,
              COUNT(c.id) AS visits
       FROM checkins c
       JOIN members m ON m.id = c.member_id
       WHERE substr(c.checked_in_at, 1, 10) >= ?
       GROUP BY m.id
       ORDER BY visits DESC, m.first_name ASC
       LIMIT ?`
    )
    .all(sinceDate, limit))
    .map((row) => ({ ...row, visits: Number(row.visits) }));
}

async function membershipBreakdown(db, today = todayISO()) {
  const rows = await db
    .prepare(
      `WITH latest AS (
         SELECT s.*,
                ROW_NUMBER() OVER (
                  PARTITION BY s.member_id
                  ORDER BY CASE s.status
                    WHEN 'active' THEN 0 WHEN 'frozen' THEN 1
                    WHEN 'scheduled' THEN 2 ELSE 3 END,
                    s.end_date DESC, s.id DESC
                ) AS rn
         FROM subscriptions s
       )
       SELECT
         SUM(CASE WHEN m.status = 'inactive' THEN 1 ELSE 0 END) AS inactive,
         SUM(CASE WHEN m.status = 'active' AND l.id IS NULL THEN 1 ELSE 0 END) AS no_plan,
         SUM(CASE WHEN m.status = 'active' AND l.status = 'active' AND l.end_date <= ? THEN 1 ELSE 0 END) AS expiring,
         SUM(CASE WHEN m.status = 'active' AND l.status = 'active' AND l.end_date > ? THEN 1 ELSE 0 END) AS active,
         SUM(CASE WHEN m.status = 'active' AND l.status = 'frozen' THEN 1 ELSE 0 END) AS frozen,
         SUM(CASE WHEN m.status = 'active' AND l.status = 'scheduled' THEN 1 ELSE 0 END) AS scheduled,
         SUM(CASE WHEN m.status = 'active' AND l.status IN ('expired', 'cancelled') THEN 1 ELSE 0 END) AS expired
       FROM members m
       LEFT JOIN latest l ON l.member_id = m.id AND l.rn = 1`
    )
    .get(addDays(today, 7), addDays(today, 7));
  return {
    active: Number(rows.active || 0),
    expiring: Number(rows.expiring || 0),
    frozen: Number(rows.frozen || 0),
    scheduled: Number(rows.scheduled || 0),
    expired: Number(rows.expired || 0),
    no_plan: Number(rows.no_plan || 0),
    inactive: Number(rows.inactive || 0)
  };
}

module.exports = {
  revenueByMonth,
  newMembersByMonth,
  attendanceByDay,
  planMix,
  buddyLeaderboard,
  expiringMemberships,
  paymentMethodTotals,
  activeMembershipCount,
  topMembersByVisits,
  membershipBreakdown,
  startOfWeekISO
};
