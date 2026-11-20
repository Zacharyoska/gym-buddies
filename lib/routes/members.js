'use strict';

const { HttpError } = require('../errors');
const validate = require('../validate');
const {
  todayISO,
  nowStamp,
  addDays,
  diffDays,
  startOfWeekISO
} = require('../dates');
const {
  AVATAR_COLORS,
  parseFeatures,
  getCurrentSubscription,
  createSubscription,
  recordPayment,
  membershipState,
  suggestStartDate,
  getBuddyStats
} = require('../domain');
const { membershipBreakdown } = require('../metrics');
const { transaction } = require('../db');

const ALLOWED_STATES = [
  'all',
  'active',
  'expiring',
  'frozen',
  'scheduled',
  'expired',
  'no_plan',
  'inactive'
];

async function getMemberRow(db, memberId) {
  return await db.prepare('SELECT * FROM members WHERE id = ?').get(memberId);
}

async function getMemberBuddies(db, memberId, today) {
  const rows = await db
    .prepare(
      `SELECT bp.id, bp.member_a_id, bp.member_b_id, bp.weekly_goal, bp.created_at, bp.note,
              a.first_name AS a_first_name, a.last_name AS a_last_name,
              a.code AS a_code, a.avatar_color AS a_avatar_color,
              b.first_name AS b_first_name, b.last_name AS b_last_name,
              b.code AS b_code, b.avatar_color AS b_avatar_color
       FROM buddy_pairs bp
       JOIN members a ON a.id = bp.member_a_id
       JOIN members b ON b.id = bp.member_b_id
       WHERE bp.status = 'active' AND ? IN (bp.member_a_id, bp.member_b_id)
       ORDER BY bp.id ASC`
    )
    .all(memberId);
  return rows.map((pair) => {
    const isA = pair.member_a_id === memberId;
    const buddy = isA
      ? {
          id: pair.member_b_id,
          first_name: pair.b_first_name,
          last_name: pair.b_last_name,
          code: pair.b_code,
          avatar_color: pair.b_avatar_color
        }
      : {
          id: pair.member_a_id,
          first_name: pair.a_first_name,
          last_name: pair.a_last_name,
          code: pair.a_code,
          avatar_color: pair.a_avatar_color
        };
    return {
      id: pair.id,
      buddy,
      weekly_goal: pair.weekly_goal,
      created_at: pair.created_at,
      note: pair.note,
      ...getBuddyStats(db, pair.member_a_id, pair.member_b_id, today, pair.weekly_goal)
    };
  });
}

async function buildMemberDetail(db, memberId) {
  const today = todayISO();
  const member = await getMemberRow(db, memberId);
  if (!member) throw new HttpError(404, 'Member not found.');

  const current = await getCurrentSubscription(db, memberId);
  let membership = null;
  if (current) {
    const paidCents = Number(
      (
        await db
          .prepare(
            `SELECT COALESCE(SUM(amount_cents), 0) AS value
             FROM payments WHERE subscription_id = ? AND status = 'paid'`
          )
          .get(current.id)
      ).value
    );
    const totalDays = diffDays(current.start_date, current.end_date) + 1;
    const elapsed = Math.min(Math.max(diffDays(current.start_date, today), 0), totalDays);
    membership = {
      ...current,
      features: parseFeatures(current.plan_features),
      paid_cents: paidCents,
      balance_cents: Math.max(0, current.price_cents - paidCents),
      days_left: diffDays(today, current.end_date),
      progress: Math.round((elapsed / totalDays) * 100),
      state: membershipState(member.status, current, today)
    };
  }

  const subscriptions = (await db
    .prepare(
      `SELECT s.*, p.name AS plan_name, p.duration_days, p.features AS plan_features,
              (SELECT COALESCE(SUM(pm.amount_cents), 0) FROM payments pm
               WHERE pm.subscription_id = s.id AND pm.status = 'paid') AS paid_cents
       FROM subscriptions s JOIN plans p ON p.id = s.plan_id
       WHERE s.member_id = ?
       ORDER BY s.start_date DESC, s.id DESC`
    )
    .all(memberId))
    .map((row) => ({ ...row, features: parseFeatures(row.plan_features) }));

  const payments = await db
    .prepare(
      `SELECT p.*, s.plan_id, pl.name AS plan_name
       FROM payments p
       LEFT JOIN subscriptions s ON s.id = p.subscription_id
       LEFT JOIN plans pl ON pl.id = s.plan_id
       WHERE p.member_id = ?
       ORDER BY p.paid_at DESC, p.id DESC
       LIMIT 80`
    )
    .all(memberId);

  const checkins = await db
    .prepare(
      `SELECT id, checked_in_at, checked_out_at, source, note
       FROM checkins WHERE member_id = ?
       ORDER BY checked_in_at DESC, id DESC
       LIMIT 80`
    )
    .all(memberId);

  const bookings = await db
    .prepare(
      `SELECT b.id, b.status, b.created_at,
              c.id AS class_id, c.name AS class_name, c.coach, c.starts_at,
              c.duration_min, c.room, c.status AS class_status
       FROM bookings b JOIN classes c ON c.id = b.class_id
       WHERE b.member_id = ?
       ORDER BY c.starts_at DESC
       LIMIT 30`
    )
    .all(memberId);

  const totals = await db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM checkins WHERE member_id = ?) AS total_visits,
        (SELECT COUNT(*) FROM checkins WHERE member_id = ? AND substr(checked_in_at, 1, 7) = ?) AS visits_month,
        (SELECT COALESCE(SUM(amount_cents), 0) FROM payments WHERE member_id = ? AND status = 'paid') AS total_spend,
        (SELECT MAX(checked_in_at) FROM checkins WHERE member_id = ?) AS last_visit`
    )
    .get(memberId, memberId, today.slice(0, 7), memberId, memberId);

  const visitDays = (
    await db
      .prepare(
        `SELECT DISTINCT substr(checked_in_at, 1, 10) AS day
         FROM checkins
         WHERE member_id = ? AND substr(checked_in_at, 1, 10) >= ?
         ORDER BY day ASC`
      )
      .all(memberId, addDays(today, -365))
  ).map((row) => row.day);
  const weekSet = new Set(visitDays.map((day) => startOfWeekISO(day)));
  let cursor = startOfWeekISO(today);
  if (!weekSet.has(cursor)) cursor = addDays(cursor, -7);
  let streakWeeks = 0;
  while (weekSet.has(cursor)) {
    streakWeeks += 1;
    cursor = addDays(cursor, -7);
  }
  const weekStart = startOfWeekISO(today);

  return {
    member,
    membership_state: membershipState(member.status, current, today),
    membership,
    suggested_start_date: await suggestStartDate(db, memberId, today),
    subscriptions,
    payments,
    checkins,
    bookings,
    buddies: await getMemberBuddies(db, memberId, today),
    stats: {
      total_visits: Number(totals.total_visits || 0),
      visits_month: Number(totals.visits_month || 0),
      visits_this_week: visitDays.filter((day) => day >= weekStart).length,
      total_spend_cents: Number(totals.total_spend || 0),
      last_visit: totals.last_visit || null,
      streak_weeks: streakWeeks
    }
  };
}

function memberFieldsFromBody(body, existing = null) {
  const fields = {
    first_name: existing?.first_name ?? '',
    last_name: existing?.last_name ?? '',
    email: existing?.email || null,
    phone: existing?.phone || null,
    date_of_birth: existing?.date_of_birth || null,
    gender: existing?.gender || null,
    address: existing?.address || null,
    emergency_contact_name: existing?.emergency_contact_name || null,
    emergency_contact_phone: existing?.emergency_contact_phone || null,
    joined_on: existing?.joined_on || todayISO(),
    notes: existing?.notes || null
  };

  if (!existing || Object.prototype.hasOwnProperty.call(body, 'first_name')) {
    fields.first_name = validate.string(body.first_name, 'First name', { max: 60 });
  }
  if (!existing || Object.prototype.hasOwnProperty.call(body, 'last_name')) {
    fields.last_name = validate.string(body.last_name, 'Last name', { max: 60 });
  }
  if (!existing || Object.prototype.hasOwnProperty.call(body, 'email')) {
    const email = validate.email(body.email, 'Email', false);
    fields.email = email || null;
  }
  if (!existing || Object.prototype.hasOwnProperty.call(body, 'phone')) {
    fields.phone = validate.optionalString(body.phone, 'Phone', 40) || null;
  }
  if (!existing || Object.prototype.hasOwnProperty.call(body, 'date_of_birth')) {
    fields.date_of_birth =
      validate.isoDate(body.date_of_birth, 'Date of birth', { required: false }) || null;
  }
  if (!existing || Object.prototype.hasOwnProperty.call(body, 'gender')) {
    fields.gender = validate.optionalString(body.gender, 'Gender', 30) || null;
  }
  if (!existing || Object.prototype.hasOwnProperty.call(body, 'address')) {
    fields.address = validate.optionalString(body.address, 'Address', 300) || null;
  }
  if (!existing || Object.prototype.hasOwnProperty.call(body, 'emergency_contact_name')) {
    fields.emergency_contact_name =
      validate.optionalString(body.emergency_contact_name, 'Emergency contact', 120) || null;
  }
  if (!existing || Object.prototype.hasOwnProperty.call(body, 'emergency_contact_phone')) {
    fields.emergency_contact_phone =
      validate.optionalString(body.emergency_contact_phone, 'Emergency phone', 40) || null;
  }
  if (!existing || Object.prototype.hasOwnProperty.call(body, 'joined_on')) {
    fields.joined_on = validate.isoDate(body.joined_on, 'Join date', { required: false }) || todayISO();
  }
  if (!existing || Object.prototype.hasOwnProperty.call(body, 'notes')) {
    fields.notes = validate.optionalString(body.notes, 'Notes', 1000) || null;
  }
  return fields;
}

function register(router) {
  router.add('GET', '/api/members', async (ctx) => {
    const db = ctx.db;
    const today = todayISO();
    const weekAhead = addDays(today, 7);
    const { page, limit, offset } = validate.pagination(ctx.query, 12, 100);
    const search = validate.searchTerm(ctx.query);
    const state = ALLOWED_STATES.includes(ctx.query.status) ? ctx.query.status : 'all';

    const selectedSub = `
      SELECT id FROM subscriptions
      WHERE member_id = m.id
      ORDER BY
        CASE status WHEN 'active' THEN 0 WHEN 'frozen' THEN 1
          WHEN 'scheduled' THEN 2 WHEN 'expired' THEN 3 ELSE 4 END,
        end_date DESC, id DESC
      LIMIT 1`;

    const baseSql = `
      SELECT m.id, m.code, m.first_name, m.last_name, m.email, m.phone,
             m.joined_on, m.status, m.avatar_color, m.notes,
             s.id AS subscription_id, s.status AS sub_status, s.start_date, s.end_date,
             p.name AS plan_name,
             CASE
               WHEN m.status = 'inactive' THEN 'inactive'
               WHEN s.status = 'active' AND s.end_date <= '${weekAhead}' THEN 'expiring'
               WHEN s.status = 'active' THEN 'active'
               WHEN s.status = 'frozen' THEN 'frozen'
               WHEN s.status = 'scheduled' THEN 'scheduled'
               WHEN s.id IS NOT NULL THEN 'expired'
               ELSE 'no_plan'
             END AS membership_state,
             (SELECT COUNT(*) FROM checkins c WHERE c.member_id = m.id) AS total_visits,
             (SELECT MAX(c.checked_in_at) FROM checkins c WHERE c.member_id = m.id) AS last_visit
      FROM members m
      LEFT JOIN subscriptions s ON s.id = (${selectedSub})
      LEFT JOIN plans p ON p.id = s.plan_id`;

    const params = [];
    let where = ' WHERE 1 = 1';
    if (search) {
      where += `
        AND lower(first_name || ' ' || last_name || ' ' || code || ' ' ||
              COALESCE(email, '') || ' ' || COALESCE(phone, '')) LIKE lower(?)`;
      params.push(`%${search}%`);
    }
    if (state !== 'all') {
      where += ' AND membership_state = ?';
      params.push(state);
    }

    const total = Number(
      await db
        .prepare(`SELECT COUNT(*) AS value FROM (${baseSql}) AS base ${where}`)
        .get(...params).value
    );
    const sort =
      ctx.query.sort === 'name'
        ? ' ORDER BY first_name ASC, last_name ASC'
        : ' ORDER BY joined_on DESC, id DESC';
    const items = await db
      .prepare(
        `SELECT * FROM (${baseSql}) AS base ${where} ${sort} LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset);

    const breakdown = await membershipBreakdown(db, today);
    const summary = {
      ...breakdown,
      all:
        breakdown.active +
        breakdown.expiring +
        breakdown.frozen +
        breakdown.scheduled +
        breakdown.expired +
        breakdown.no_plan +
        breakdown.inactive
    };

    return {
      items,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      limit,
      summary
    };
  });

  router.add('GET', '/api/members/lookup', async (ctx) => {
    const code = validate.string(ctx.query.code, 'Member code', { max: 30 });
    const member = await ctx.db
      .prepare('SELECT * FROM members WHERE code = ? COLLATE NOCASE')
      .get(code);
    if (!member) throw new HttpError(404, 'No member found with that code.');
    const today = todayISO();
    const current = await getCurrentSubscription(ctx.db, member.id);
    const open = await ctx.db
      .prepare('SELECT * FROM checkins WHERE member_id = ? AND checked_out_at IS NULL LIMIT 1')
      .get(member.id);
    return {
      member,
      membership: current
        ? {
            ...current,
            days_left: diffDays(today, current.end_date),
            state: membershipState(member.status, current, today)
          }
        : null,
      open_checkin: open || null
    };
  });

  router.add('GET', '/api/members/:id', async (ctx) => {
    const memberId = validate.id(ctx.params.id, 'Member ID');
    return await buildMemberDetail(ctx.db, memberId);
  });

  router.add('POST', '/api/members', async (ctx) => {
    const db = ctx.db;
    const fields = memberFieldsFromBody(ctx.body);
    if (fields.email) {
      const existing = await db.prepare('SELECT id FROM members WHERE email = ?').get(fields.email);
      if (existing) throw new HttpError(409, 'A member with this email already exists.');
    }
    const next = Number((await db.prepare('SELECT COALESCE(MAX(id), 0) + 1 AS value FROM members').get()).value);
    const code = `GB-${String(next).padStart(4, '0')}`;
    const color = AVATAR_COLORS[(next - 1) % AVATAR_COLORS.length];
    const now = nowStamp();
    const result = await db
      .prepare(
        `INSERT INTO members
          (code, first_name, last_name, email, phone, date_of_birth, gender, address,
           emergency_contact_name, emergency_contact_phone, joined_on, status, notes,
           avatar_color, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`
      )
      .run(
        code,
        fields.first_name,
        fields.last_name,
        fields.email,
        fields.phone,
        fields.date_of_birth,
        fields.gender,
        fields.address,
        fields.emergency_contact_name,
        fields.emergency_contact_phone,
        fields.joined_on,
        fields.notes,
        color,
        now,
        now
      );
    ctx.statusCode = 201;
    return await db.prepare('SELECT * FROM members WHERE id = ?').get(Number(result.lastInsertRowid));
  });

  router.add('PATCH', '/api/members/:id', async (ctx) => {
    const db = ctx.db;
    const memberId = validate.id(ctx.params.id, 'Member ID');
    const existing = await getMemberRow(db, memberId);
    if (!existing) throw new HttpError(404, 'Member not found.');
    const fields = memberFieldsFromBody(ctx.body, existing);
    if (fields.email) {
      const duplicate = await db
        .prepare('SELECT id FROM members WHERE email = ? AND id != ?')
        .get(fields.email, memberId);
      if (duplicate) throw new HttpError(409, 'A member with this email already exists.');
    }
    await db.prepare(
      `UPDATE members SET
        first_name = ?, last_name = ?, email = ?, phone = ?, date_of_birth = ?,
        gender = ?, address = ?, emergency_contact_name = ?, emergency_contact_phone = ?,
        joined_on = ?, notes = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      fields.first_name,
      fields.last_name,
      fields.email,
      fields.phone,
      fields.date_of_birth,
      fields.gender,
      fields.address,
      fields.emergency_contact_name,
      fields.emergency_contact_phone,
      fields.joined_on,
      fields.notes,
      nowStamp(),
      memberId
    );
    return await db.prepare('SELECT * FROM members WHERE id = ?').get(memberId);
  });

  router.add('POST', '/api/members/:id/archive', async (ctx) => {
    const db = ctx.db;
    const memberId = validate.id(ctx.params.id, 'Member ID');
    const member = await getMemberRow(db, memberId);
    if (!member) throw new HttpError(404, 'Member not found.');
    await db.prepare(
      `UPDATE members SET status = 'inactive', updated_at = ? WHERE id = ?`
    ).run(nowStamp(), memberId);
    await db.prepare(
      `UPDATE checkins SET checked_out_at = ?
       WHERE member_id = ? AND checked_out_at IS NULL`
    ).run(nowStamp(), memberId);
    return await db.prepare('SELECT * FROM members WHERE id = ?').get(memberId);
  });

  router.add('POST', '/api/members/:id/restore', async (ctx) => {
    const db = ctx.db;
    const memberId = validate.id(ctx.params.id, 'Member ID');
    const member = await getMemberRow(db, memberId);
    if (!member) throw new HttpError(404, 'Member not found.');
    await db.prepare(
      `UPDATE members SET status = 'active', updated_at = ? WHERE id = ?`
    ).run(nowStamp(), memberId);
    return await db.prepare('SELECT * FROM members WHERE id = ?').get(memberId);
  });

  router.add('POST', '/api/members/:id/subscriptions', async (ctx) => {
    const db = ctx.db;
    const memberId = validate.id(ctx.params.id, 'Member ID');
    const planId = validate.id(ctx.body.plan_id, 'Plan');
    const startDate = validate.isoDate(ctx.body.start_date, 'Start date', { required: false });
    const notes = validate.optionalString(ctx.body.notes, 'Notes', 500);
    const record = validate.boolean(ctx.body.record_payment);
    const method = record
      ? validate.enumOf(ctx.body.payment_method || 'cash', ['cash', 'card', 'bank', 'online'], 'Payment method')
      : null;

    const result = await transaction(db, async () => {
      const subscription = await createSubscription(db, {
        memberId,
        planId,
        startDate: startDate || undefined,
        notes
      });
      let payment = null;
      if (record) {
        payment = await recordPayment(db, {
          memberId,
          subscriptionId: subscription.id,
          amountCents: subscription.price_cents,
          method,
          description: `${subscription.plan_name} membership`,
          paidAt: nowStamp()
        });
      }
      return { subscription, payment };
    });
    ctx.statusCode = 201;
    return {
      ...result,
      member: await buildMemberDetail(db, memberId)
    };
  });
}

module.exports = { register };
