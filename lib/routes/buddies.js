'use strict';

const { HttpError } = require('../errors');
const validate = require('../validate');
const { nowStamp, todayISO } = require('../dates');
const { buddyLeaderboard } = require('../metrics');

async function pairDetails(db, pairId, today) {
  const pair = await db
    .prepare(
      `SELECT bp.*,
              a.first_name AS a_first_name, a.last_name AS a_last_name,
              a.avatar_color AS a_avatar_color, a.code AS a_code,
              b.first_name AS b_first_name, b.last_name AS b_last_name,
              b.avatar_color AS b_avatar_color, b.code AS b_code
       FROM buddy_pairs bp
       JOIN members a ON a.id = bp.member_a_id
       JOIN members b ON b.id = bp.member_b_id
       WHERE bp.id = ?`
    )
    .get(pairId);
  if (!pair) return null;
  const { getBuddyStats } = require('../domain');
  return {
    id: pair.id,
    weekly_goal: pair.weekly_goal,
    note: pair.note,
    status: pair.status,
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
  };
}

function register(router) {
  router.add('GET', '/api/buddies', async (ctx) => {
    const today = todayISO();
    const pairs = await buddyLeaderboard(ctx.db, 100, today);
    return {
      pairs,
      leaderboard: pairs.slice(0, 5),
      summary: {
        active_pairs: pairs.length,
        shared_workouts_30: pairs.reduce((sum, pair) => sum + pair.shared_30, 0)
      }
    };
  });

  router.add('POST', '/api/buddies', async (ctx) => {
    const db = ctx.db;
    const memberA = validate.id(ctx.body.member_a_id, 'First member');
    const memberB = validate.id(ctx.body.member_b_id, 'Second member');
    if (memberA === memberB) throw new HttpError(422, 'Choose two different members.');
    const weeklyGoal = validate.integer(ctx.body.weekly_goal || 3, 'Weekly goal', {
      min: 1,
      max: 7
    });
    const note = validate.optionalString(ctx.body.note, 'Note', 300);
    const a = await db.prepare('SELECT * FROM members WHERE id = ?').get(memberA);
    const b = await db.prepare('SELECT * FROM members WHERE id = ?').get(memberB);
    if (!a || !b) throw new HttpError(404, 'One of the selected members was not found.');
    if (a.status !== 'active' || b.status !== 'active') {
      throw new HttpError(409, 'Both buddies must be active members.');
    }
    const low = Math.min(memberA, memberB);
    const high = Math.max(memberA, memberB);
    const existing = await db
      .prepare('SELECT * FROM buddy_pairs WHERE member_a_id = ? AND member_b_id = ?')
      .get(low, high);
    if (existing?.status === 'active') {
      throw new HttpError(409, 'These members are already workout buddies.');
    }
    let pairId;
    const now = nowStamp();
    if (existing) {
      await db.prepare(
        `UPDATE buddy_pairs
         SET status = 'active', weekly_goal = ?, note = ?, created_at = ?, ended_at = NULL
         WHERE id = ?`
      ).run(weeklyGoal, note || null, now, existing.id);
      pairId = existing.id;
    } else {
      const result = await db
        .prepare(
          `INSERT INTO buddy_pairs
            (member_a_id, member_b_id, weekly_goal, status, note, created_at)
           VALUES (?, ?, ?, 'active', ?, ?)`
        )
        .run(low, high, weeklyGoal, note || null, now);
      pairId = Number(result.lastInsertRowid);
    }
    ctx.statusCode = 201;
    return await pairDetails(db, pairId, todayISO());
  });

  router.add('POST', '/api/buddies/:id/end', async (ctx) => {
    const db = ctx.db;
    const pairId = validate.id(ctx.params.id, 'Buddy pair ID');
    const pair = await db.prepare('SELECT * FROM buddy_pairs WHERE id = ?').get(pairId);
    if (!pair) throw new HttpError(404, 'Buddy pair not found.');
    if (pair.status !== 'active') throw new HttpError(409, 'This pair has already ended.');
    await db.prepare(
      `UPDATE buddy_pairs SET status = 'ended', ended_at = ? WHERE id = ?`
    ).run(nowStamp(), pairId);
    return await pairDetails(db, pairId, todayISO());
  });
}

module.exports = { register };
