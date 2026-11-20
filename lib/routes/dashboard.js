'use strict';

const { todayISO, addDays, addMonthsToKey } = require('../dates');
const {
  revenueByMonth,
  attendanceByDay,
  planMix,
  buddyLeaderboard,
  expiringMemberships,
  activeMembershipCount,
  membershipBreakdown
} = require('../metrics');

function number(row, key = 'value') {
  return Number(row?.[key] || 0);
}

function register(router) {
  router.add('GET', '/api/dashboard', async (ctx) => {
    const db = ctx.db;
    const today = todayISO();
    const tomorrow = addDays(today, 1);
    const month = today.slice(0, 7);
    const previousMonth = addMonthsToKey(month, -1);
    const weekAhead = addDays(today, 7);

    const revenueMonth = number(
      await db
        .prepare(
          `SELECT COALESCE(SUM(amount_cents), 0) AS value
           FROM payments WHERE status = 'paid' AND substr(paid_at, 1, 7) = ?`
        )
        .get(month)
    );
    const revenuePreviousMonth = number(
      await db
        .prepare(
          `SELECT COALESCE(SUM(amount_cents), 0) AS value
           FROM payments WHERE status = 'paid' AND substr(paid_at, 1, 7) = ?`
        )
        .get(previousMonth)
    );
    const checkinsToday = number(
      await db
        .prepare(
          `SELECT COUNT(*) AS value FROM checkins WHERE substr(checked_in_at, 1, 10) = ?`
        )
        .get(today)
    );
    const liveCheckins = number(
      await db
        .prepare(`SELECT COUNT(*) AS value FROM checkins WHERE checked_out_at IS NULL`)
        .get()
    );
    const newMembersMonth = number(
      await db
        .prepare(
          `SELECT COUNT(*) AS value FROM members WHERE substr(joined_on, 1, 7) = ?`
        )
        .get(month)
    );
    const expiringCount = number(
      await db
        .prepare(
          `SELECT COUNT(DISTINCT s.member_id) AS value
           FROM subscriptions s JOIN members m ON m.id = s.member_id
           WHERE s.status = 'active' AND m.status = 'active'
             AND s.end_date >= ? AND s.end_date <= ?`
        )
        .get(today, weekAhead)
    );
    const activeMembers = await activeMembershipCount(db, today);
    const totalMembers = number(
      await db.prepare(`SELECT COUNT(*) AS value FROM members WHERE status = 'active'`).get()
    );

    const expiring = await expiringMemberships(db, 7, today, 5);
    const live = await db
      .prepare(
        `SELECT c.id AS checkin_id, c.checked_in_at, c.note,
                m.id AS member_id, m.code, m.first_name, m.last_name, m.avatar_color,
                (SELECT p.name FROM subscriptions s JOIN plans p ON p.id = s.plan_id
                 WHERE s.member_id = m.id AND s.status = 'active'
                 ORDER BY s.end_date DESC LIMIT 1) AS plan_name
         FROM checkins c JOIN members m ON m.id = c.member_id
         WHERE c.checked_out_at IS NULL
         ORDER BY c.checked_in_at DESC
         LIMIT 8`
      )
      .all();

    const todayClasses = await db
      .prepare(
        `SELECT c.*,
                (SELECT COUNT(*) FROM bookings b
                 WHERE b.class_id = c.id AND b.status != 'cancelled') AS booked
         FROM classes c
         WHERE c.starts_at >= ? AND c.starts_at < ?
         ORDER BY c.starts_at ASC
         LIMIT 5`
      )
      .all(`${today} 00:00:00`, `${tomorrow} 00:00:00`);

    const recentPayments = await db
      .prepare(
        `SELECT p.id, p.receipt_no, p.amount_cents, p.method, p.paid_at, p.status,
                m.id AS member_id, m.first_name, m.last_name, m.avatar_color
         FROM payments p JOIN members m ON m.id = p.member_id
         ORDER BY p.paid_at DESC, p.id DESC
         LIMIT 5`
      )
      .all();

    return {
      as_of: today,
      user: ctx.user,
      kpis: {
        active_members: activeMembers,
        total_members: totalMembers,
        expiring_soon: expiringCount,
        revenue_month_cents: revenueMonth,
        revenue_previous_month_cents: revenuePreviousMonth,
        checkins_today: checkinsToday,
        live_checkins: liveCheckins,
        new_members_month: newMembersMonth
      },
      revenue: await revenueByMonth(db, 6, today),
      attendance: await attendanceByDay(db, 14, today),
      plan_mix: await planMix(db),
      membership_breakdown: await membershipBreakdown(db, today),
      expiring,
      live,
      today_classes: todayClasses,
      buddy_leaders: await buddyLeaderboard(db, 3, today),
      recent_payments: recentPayments
    };
  });
}

module.exports = { register };
