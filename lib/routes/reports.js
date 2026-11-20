'use strict';

const { todayISO, addDays, addMonthsToKey, monthKeysBack } = require('../dates');
const {
  revenueByMonth,
  newMembersByMonth,
  attendanceByDay,
  planMix,
  paymentMethodTotals,
  activeMembershipCount,
  topMembersByVisits,
  membershipBreakdown
} = require('../metrics');

function number(row, key = 'value') {
  return Number(row?.[key] || 0);
}

function register(router) {
  router.add('GET', '/api/reports', async (ctx) => {
    const db = ctx.db;
    const today = todayISO();
    const months = [3, 6, 12].includes(Number(ctx.query.months))
      ? Number(ctx.query.months)
      : 6;
    const keys = monthKeysBack(months, today);
    const periodStart = `${keys[0]}-01`;
    const month = today.slice(0, 7);
    const previousMonth = addMonthsToKey(month, -1);
    const last30Start = addDays(today, -29);

    const revenuePeriod = number(
      await db
        .prepare(
          `SELECT COALESCE(SUM(amount_cents), 0) AS value FROM payments
           WHERE status = 'paid' AND substr(paid_at, 1, 10) >= ?`
        )
        .get(periodStart)
    );
    const revenueMonth = number(
      await db
        .prepare(
          `SELECT COALESCE(SUM(amount_cents), 0) AS value FROM payments
           WHERE status = 'paid' AND substr(paid_at, 1, 7) = ?`
        )
        .get(month)
    );
    const revenuePreviousMonth = number(
      await db
        .prepare(
          `SELECT COALESCE(SUM(amount_cents), 0) AS value FROM payments
           WHERE status = 'paid' AND substr(paid_at, 1, 7) = ?`
        )
        .get(previousMonth)
    );
    const newMembersPeriod = number(
      await db
        .prepare('SELECT COUNT(*) AS value FROM members WHERE joined_on >= ?')
        .get(periodStart)
    );
    const attendance30 = number(
      await db
        .prepare('SELECT COUNT(*) AS value FROM checkins WHERE substr(checked_in_at, 1, 10) >= ?')
        .get(last30Start)
    );
    const activeMembers = await activeMembershipCount(db, today);
    const totalMembers = number(
      await db.prepare("SELECT COUNT(*) AS value FROM members WHERE status = 'active'").get()
    );
    const breakdown = await membershipBreakdown(db, today);

    const classUtilization = (
      await db
        .prepare(
          `SELECT c.id, c.name, c.coach, c.starts_at, c.capacity,
                  COUNT(CASE WHEN b.status IN ('attended', 'no_show') THEN 1 END) AS reserved,
                  COUNT(CASE WHEN b.status = 'attended' THEN 1 END) AS attended
           FROM classes c
           LEFT JOIN bookings b ON b.class_id = c.id
           WHERE c.status = 'active'
             AND substr(c.starts_at, 1, 10) >= ?
             AND c.starts_at < ?
           GROUP BY c.id
           HAVING reserved > 0
           ORDER BY c.starts_at DESC
           LIMIT 10`
        )
        .all(addDays(today, -30), `${today} 23:59:59`)
    ).map((row) => ({
      ...row,
      reserved: Number(row.reserved),
      attended: Number(row.attended),
      fill_rate: Math.round((Number(row.reserved) / Number(row.capacity)) * 100)
    }));

    return {
      as_of: today,
      range_months: months,
      kpis: {
        revenue_period_cents: revenuePeriod,
        revenue_month_cents: revenueMonth,
        revenue_previous_month_cents: revenuePreviousMonth,
        new_members_period: newMembersPeriod,
        active_members: activeMembers,
        total_members: totalMembers,
        attendance_30: attendance30,
        avg_visits_30: activeMembers
          ? Math.round((attendance30 / activeMembers) * 10) / 10
          : 0,
        expiring_soon: breakdown.expiring
      },
      revenue: await revenueByMonth(db, months, today),
      new_members: await newMembersByMonth(db, months, today),
      attendance: await attendanceByDay(db, 14, today),
      plan_mix: await planMix(db),
      methods: await paymentMethodTotals(db, periodStart),
      top_members: await topMembersByVisits(db, addDays(today, -89), 8),
      class_utilization: classUtilization,
      membership_breakdown: breakdown
    };
  });
}

module.exports = { register };
