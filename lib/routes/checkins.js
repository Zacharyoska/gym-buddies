'use strict';

const { HttpError } = require('../errors');
const validate = require('../validate');
const { todayISO, nowStamp, diffDays } = require('../dates');
const { checkInMember, checkOutMember, membershipState } = require('../domain');

function register(router) {
  router.add('GET', '/api/checkins/today', async (ctx) => {
    const db = ctx.db;
    const today = todayISO();
    const t = nowStamp();

    const live = await db
      .prepare(
        `SELECT c.*, m.code, m.first_name, m.last_name, m.avatar_color,
                p.name AS plan_name
         FROM checkins c
         JOIN members m ON m.id = c.member_id
         LEFT JOIN subscriptions s ON s.id = (
           SELECT id FROM subscriptions
           WHERE member_id = m.id AND status = 'active'
           ORDER BY end_date DESC LIMIT 1
         )
         LEFT JOIN plans p ON p.id = s.plan_id
         WHERE c.checked_out_at IS NULL
         ORDER BY c.checked_in_at DESC`
      )
      .all();

    const log = await db
      .prepare(
        `SELECT c.*, m.code, m.first_name, m.last_name, m.avatar_color,
                p.name AS plan_name
         FROM checkins c
         JOIN members m ON m.id = c.member_id
         LEFT JOIN subscriptions s ON s.id = (
           SELECT id FROM subscriptions
           WHERE member_id = m.id AND status = 'active'
           ORDER BY end_date DESC LIMIT 1
         )
         LEFT JOIN plans p ON p.id = s.plan_id
         WHERE substr(c.checked_in_at, 1, 10) = ?
         ORDER BY c.checked_in_at DESC
         LIMIT 100`
      )
      .all(today);

    const summary = await db
      .prepare(
        `SELECT
           COUNT(*) AS total_today,
           COUNT(DISTINCT member_id) AS unique_members,
           AVG(CASE WHEN checked_out_at IS NOT NULL
             THEN (julianday(checked_out_at) - julianday(checked_in_at)) * 24 * 60 END) AS avg_minutes
         FROM checkins
         WHERE substr(checked_in_at, 1, 10) = ?`
      )
      .get(today);

    return {
      date: today,
      now: t,
      live,
      log,
      summary: {
        total_today: Number(summary.total_today || 0),
        unique_members: Number(summary.unique_members || 0),
        live: live.length,
        avg_minutes: summary.avg_minutes ? Math.round(Number(summary.avg_minutes)) : 0
      }
    };
  });

  router.add('POST', '/api/checkins', async (ctx) => {
    const db = ctx.db;
    let memberId;
    if (ctx.body.code) {
      const code = validate.string(ctx.body.code, 'Member code', { max: 30 });
      const member = await db
        .prepare('SELECT id FROM members WHERE code = ? COLLATE NOCASE')
        .get(code);
      if (!member) throw new HttpError(404, 'No member found with that code.');
      memberId = member.id;
    } else {
      memberId = validate.id(ctx.body.member_id, 'Member');
    }
    const result = await checkInMember(db, {
      memberId,
      source: 'front_desk',
      note: validate.optionalString(ctx.body.note, 'Note', 300)
    });
    ctx.statusCode = 201;
    return {
      checkin: result.checkin,
      member: result.member,
      membership: {
        ...result.subscription,
        days_left: diffDays(todayISO(), result.subscription.end_date),
        state: membershipState(result.member.status, result.subscription)
      }
    };
  });

  router.add('POST', '/api/checkins/:id/checkout', async (ctx) => {
    const checkinId = validate.id(ctx.params.id, 'Check-in ID');
    const checkin = await checkOutMember(ctx.db, checkinId);
    return { checkin };
  });
}

module.exports = { register };
