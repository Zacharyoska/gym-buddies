'use strict';

const { HttpError } = require('../errors');
const validate = require('../validate');
const { nowStamp, todayISO, addDays, isValidISODate } = require('../dates');
const { recordPayment } = require('../domain');

const METHODS = ['cash', 'card', 'bank', 'online'];
const STATUSES = ['paid', 'refunded'];

function number(row, key = 'value') {
  return Number(row?.[key] || 0);
}

function register(router) {
  router.add('GET', '/api/payments', async (ctx) => {
    const db = ctx.db;
    const { page, limit, offset } = validate.pagination(ctx.query, 15, 100);
    const search = validate.searchTerm(ctx.query);
    const method = METHODS.includes(ctx.query.method) ? ctx.query.method : '';
    const status = STATUSES.includes(ctx.query.status) ? ctx.query.status : '';
    const from = isValidISODate(ctx.query.from || '') ? ctx.query.from : '';
    const to = isValidISODate(ctx.query.to || '') ? ctx.query.to : '';

    let where = ' WHERE 1 = 1';
    const params = [];
    if (search) {
      where += ` AND (lower(m.first_name || ' ' || m.last_name || ' ' || m.code ||
        ' ' || p.receipt_no || ' ' || COALESCE(p.description, '')) LIKE lower(?))`;
      params.push(`%${search}%`);
    }
    if (method) {
      where += ' AND p.method = ?';
      params.push(method);
    }
    if (status) {
      where += ' AND p.status = ?';
      params.push(status);
    }
    if (from) {
      where += ' AND substr(p.paid_at, 1, 10) >= ?';
      params.push(from);
    }
    if (to) {
      where += ' AND substr(p.paid_at, 1, 10) <= ?';
      params.push(to);
    }

    const base = `
      FROM payments p
      JOIN members m ON m.id = p.member_id
      LEFT JOIN subscriptions s ON s.id = p.subscription_id
      LEFT JOIN plans pl ON pl.id = s.plan_id
      ${where}`;
    const total = number(await db.prepare(`SELECT COUNT(*) AS value ${base}`).get(...params));
    const items = await db
      .prepare(
        `SELECT p.*, m.first_name, m.last_name, m.code, m.avatar_color,
                pl.name AS plan_name ${base}
         ORDER BY p.paid_at DESC, p.id DESC LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset);
    const filtered = await db
      .prepare(
        `SELECT
          COALESCE(SUM(CASE WHEN p.status = 'paid' THEN p.amount_cents ELSE 0 END), 0) AS paid_cents,
          COALESCE(SUM(CASE WHEN p.status = 'refunded' THEN p.amount_cents ELSE 0 END), 0) AS refunded_cents
         ${base}`
      )
      .get(...params);

    const today = todayISO();
    const month = today.slice(0, 7);
    const monthCents = number(
      await db
        .prepare(
          `SELECT COALESCE(SUM(amount_cents), 0) AS value FROM payments
           WHERE status = 'paid' AND substr(paid_at, 1, 7) = ?`
        )
        .get(month)
    );
    const last30Cents = number(
      await db
        .prepare(
          `SELECT COALESCE(SUM(amount_cents), 0) AS value FROM payments
           WHERE status = 'paid' AND substr(paid_at, 1, 10) >= ?`
        )
        .get(addDays(today, -29))
    );
    const refundedMonthCents = number(
      await db
        .prepare(
          `SELECT COALESCE(SUM(amount_cents), 0) AS value FROM payments
           WHERE status = 'refunded' AND substr(paid_at, 1, 7) = ?`
        )
        .get(month)
    );

    return {
      items,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      summary: {
        filtered_paid_cents: Number(filtered.paid_cents || 0),
        filtered_refunded_cents: Number(filtered.refunded_cents || 0),
        month_cents: monthCents,
        last_30_cents: last30Cents,
        refunded_month_cents: refundedMonthCents
      }
    };
  });

  router.add('POST', '/api/payments', async (ctx) => {
    const db = ctx.db;
    const memberId = validate.id(ctx.body.member_id, 'Member');
    const amountCents = validate.moneyCents(ctx.body.amount_cents, 'Amount');
    if (amountCents <= 0) throw new HttpError(422, 'Amount must be greater than zero.');
    const method = validate.enumOf(ctx.body.method, METHODS, 'Payment method');
    const subscriptionId = ctx.body.subscription_id
      ? validate.id(ctx.body.subscription_id, 'Membership')
      : null;
    const paidAt = ctx.body.paid_at
      ? validate.timestamp(ctx.body.paid_at, 'Payment date')
      : nowStamp();
    const description = validate.optionalString(ctx.body.description, 'Description', 300);
    const notes = validate.optionalString(ctx.body.notes, 'Notes', 500);
    const payment = await recordPayment(db, {
      memberId,
      subscriptionId,
      amountCents,
      method,
      paidAt,
      description,
      notes
    });
    ctx.statusCode = 201;
    return {
      payment,
      member: await db.prepare('SELECT * FROM members WHERE id = ?').get(memberId)
    };
  });

  router.add('GET', '/api/payments/:id/receipt', async (ctx) => {
    const db = ctx.db;
    const paymentId = validate.id(ctx.params.id, 'Payment ID');
    const payment = await db
      .prepare(
        `SELECT p.*, m.first_name, m.last_name, m.code, m.email, m.phone, m.avatar_color,
                pl.name AS plan_name, pl.duration_days
         FROM payments p
         JOIN members m ON m.id = p.member_id
         LEFT JOIN subscriptions s ON s.id = p.subscription_id
         LEFT JOIN plans pl ON pl.id = s.plan_id
         WHERE p.id = ?`
      )
      .get(paymentId);
    if (!payment) throw new HttpError(404, 'Payment not found.');
    return { payment };
  });

  router.add('POST', '/api/payments/:id/refund', async (ctx) => {
    const db = ctx.db;
    const paymentId = validate.id(ctx.params.id, 'Payment ID');
    const payment = await db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId);
    if (!payment) throw new HttpError(404, 'Payment not found.');
    if (payment.status === 'refunded') {
      throw new HttpError(409, 'This payment has already been refunded.');
    }
    const note = `Refunded ${nowStamp()}${payment.notes ? ` — ${payment.notes}` : ''}`;
    await db.prepare(
      `UPDATE payments SET status = 'refunded', notes = ? WHERE id = ?`
    ).run(note, paymentId);
    return { payment: await db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId) };
  });
}

module.exports = { register };
