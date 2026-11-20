'use strict';

const { todayISO, addDays } = require('../dates');

function escapeCsv(value) {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function sendCsv(ctx, filename, rows) {
  const csv = `\uFEFF${rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n')}\r\n`;
  ctx.res.statusCode = 200;
  ctx.res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  ctx.res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  ctx.res.setHeader('Cache-Control', 'no-store');
  ctx.res.setHeader('Content-Length', Buffer.byteLength(csv));
  ctx.res.end(csv);
}

function register(router) {
  router.add('GET', '/api/export/members.csv', async (ctx) => {
    const rows = await ctx.db
      .prepare(
        `SELECT m.code, m.first_name, m.last_name, COALESCE(m.email, ''), COALESCE(m.phone, ''),
                m.joined_on, m.status,
                COALESCE((SELECT p.name FROM subscriptions s
                  JOIN plans p ON p.id = s.plan_id
                  WHERE s.member_id = m.id AND s.status = 'active'
                  ORDER BY s.end_date DESC LIMIT 1), '') AS plan_name,
                COALESCE((SELECT s.end_date FROM subscriptions s
                  WHERE s.member_id = m.id AND s.status = 'active'
                  ORDER BY s.end_date DESC LIMIT 1), '') AS end_date
         FROM members m
         ORDER BY m.code`
      )
      .all();
    sendCsv(ctx, `gym-buddies-members-${todayISO()}.csv`, [
      ['Member code', 'First name', 'Last name', 'Email', 'Phone', 'Joined', 'Status', 'Plan', 'Membership ends'],
      ...rows.map((row) => [
        row.code,
        row.first_name,
        row.last_name,
        row.email,
        row.phone,
        row.joined_on,
        row.status,
        row.plan_name,
        row.end_date
      ])
    ]);
  });

  router.add('GET', '/api/export/payments.csv', async (ctx) => {
    const rows = await ctx.db
      .prepare(
        `SELECT p.receipt_no, p.paid_at, m.code, m.first_name, m.last_name,
                p.amount_cents, p.method, p.status, COALESCE(p.description, ''), COALESCE(p.notes, '')
         FROM payments p JOIN members m ON m.id = p.member_id
         ORDER BY p.paid_at DESC, p.id DESC`
      )
      .all();
    sendCsv(ctx, `gym-buddies-payments-${todayISO()}.csv`, [
      ['Receipt', 'Paid at', 'Member code', 'First name', 'Last name', 'Amount (PHP)', 'Method', 'Status', 'Description', 'Notes'],
      ...rows.map((row) => [
        row.receipt_no,
        row.paid_at,
        row.code,
        row.first_name,
        row.last_name,
        (row.amount_cents / 100).toFixed(2),
        row.method,
        row.status,
        row.description,
        row.notes
      ])
    ]);
  });

  router.add('GET', '/api/export/checkins.csv', async (ctx) => {
    const rows = await ctx.db
      .prepare(
        `SELECT c.checked_in_at, COALESCE(c.checked_out_at, ''), m.code, m.first_name, m.last_name,
                COALESCE(c.source, ''), COALESCE(c.note, '')
         FROM checkins c JOIN members m ON m.id = c.member_id
         WHERE substr(c.checked_in_at, 1, 10) >= ?
         ORDER BY c.checked_in_at DESC`
      )
      .all(addDays(todayISO(), -365));
    sendCsv(ctx, `gym-buddies-checkins-${todayISO()}.csv`, [
      ['Checked in', 'Checked out', 'Member code', 'First name', 'Last name', 'Source', 'Note'],
      ...rows.map((row) => [
        row.checked_in_at,
        row.checked_out_at,
        row.code,
        row.first_name,
        row.last_name,
        row.source,
        row.note
      ])
    ]);
  });
}

module.exports = { register };
