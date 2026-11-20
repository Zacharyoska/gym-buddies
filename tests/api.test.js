'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createApp } = require('../lib/app');

let app;
let server;
let base;
let tempDir;
let cookie = '';
let plan;
let memberA;
let memberB;
let subscriptionA;
let subscriptionB;
let paymentA;
let checkinA;
let checkinB;
let buddy;

const CSRF = { 'x-gym-app': '1' };

function isoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

function today() {
  return isoDate(new Date());
}

function tomorrowAt(hour) {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(hour, 0, 0, 0);
  return `${isoDate(date)}T18:00`;
}

async function api(method, urlPath, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.auth !== false && cookie) headers.cookie = cookie;
  if (method !== 'GET' && options.csrf !== false) Object.assign(headers, CSRF);
  if (options.body !== undefined) headers['content-type'] = 'application/json';

  const response = await fetch(base + urlPath, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const text = await response.text();
  let data = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // CSV and other plain-text responses stay as text.
  }
  return { status: response.status, data, headers: response.headers, text };
}

function expectStatus(response, expected, label) {
  assert.equal(
    response.status,
    expected,
    `${label} expected ${expected}, got ${response.status}: ${String(
      typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
    ).slice(0, 500)}`
  );
}

test.before(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-buddies-test-'));
  app = await createApp({ dbPath: path.join(tempDir, 'test.db') });
  server = http.createServer(app.handle);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (app) app.close();
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
});

test('health check is public and applies security headers', async () => {
  const response = await api('GET', '/api/health', { auth: false });
  expectStatus(response, 200, 'health');
  assert.equal(response.data.ok, true);
  assert.equal(response.data.app, 'Gym Buddies by Jahren & Charles');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.match(response.headers.get('content-security-policy'), /default-src 'self'/);
});

test('static SPA shell and assets are served', async () => {
  const page = await fetch(base + '/');
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /text\/html/);
  const html = await page.text();
  assert.ok(html.includes('<title>Gym Buddies by Jahren & Charles — Member Manager</title>'));
  assert.ok(html.includes('<div id="app"'));

  const script = await fetch(base + '/js/main.js');
  assert.equal(script.status, 200);
  assert.match(script.headers.get('content-type'), /javascript/);
  const source = await script.text();
  assert.ok(source.includes("from './views/dashboard.js'"));

  const missing = await api('GET', '/api/not-a-real-endpoint');
  expectStatus(missing, 404, 'unknown API endpoint');
  assert.match(missing.data.error, /not found/i);
});

test('protected endpoints reject anonymous requests', async () => {
  const response = await api('GET', '/api/dashboard', { auth: false });
  expectStatus(response, 401, 'anonymous dashboard');
  assert.match(response.data.error, /sign in/i);
});

test('login rejects a bad password and accepts the demo account', async () => {
  const bad = await api('POST', '/api/auth/login', {
    auth: false,
    body: { username: 'admin', password: 'not-the-password' }
  });
  expectStatus(bad, 401, 'bad login');
  assert.match(bad.data.error, /invalid username or password/i);
  assert.equal(bad.headers.get('set-cookie'), null);

  const good = await api('POST', '/api/auth/login', {
    auth: false,
    body: { username: 'admin', password: 'admin123' }
  });
  expectStatus(good, 200, 'login');
  assert.equal(good.data.user.username, 'admin');
  assert.equal(good.data.user.role, 'Owner');
  const setCookie = good.headers.getSetCookie()[0];
  assert.match(setCookie, /gb_session=/);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Strict/i);
  cookie = setCookie.split(';')[0];

  const me = await api('GET', '/api/auth/me');
  expectStatus(me, 200, 'me');
  assert.equal(me.data.user.username, 'admin');
});

test('mutations require the app header', async () => {
  const response = await api('POST', '/api/members', {
    csrf: false,
    body: { first_name: 'Blocked', last_name: 'Request' }
  });
  expectStatus(response, 403, 'missing app header');
  assert.match(response.data.error, /blocked/i);
});

test('dashboard, lists, and reports return usable data', async () => {
  const dashboard = await api('GET', '/api/dashboard');
  expectStatus(dashboard, 200, 'dashboard');
  assert.ok(dashboard.data.kpis.total_members >= 30);
  assert.ok(Array.isArray(dashboard.data.expiring));
  assert.ok(dashboard.data.membership_breakdown);

  const members = await api('GET', '/api/members?limit=5');
  expectStatus(members, 200, 'members');
  assert.equal(members.data.items.length, 5);
  assert.ok(members.data.summary.all >= 30);

  const plans = await api('GET', '/api/plans?all=1');
  expectStatus(plans, 200, 'plans');
  assert.ok(plans.data.items.length >= 5);

  const payments = await api('GET', '/api/payments?limit=5');
  expectStatus(payments, 200, 'payments');
  assert.equal(payments.data.items.length, 5);

  const checkins = await api('GET', '/api/checkins/today');
  expectStatus(checkins, 200, 'checkins');
  assert.ok(checkins.data.summary.total_today > 0);

  const classes = await api('GET', '/api/classes?scope=all');
  expectStatus(classes, 200, 'classes');
  assert.ok(classes.data.items.length > 0);

  const buddies = await api('GET', '/api/buddies');
  expectStatus(buddies, 200, 'buddies');
  assert.ok(buddies.data.summary.active_pairs >= 1);

  const reports = await api('GET', '/api/reports?months=6');
  expectStatus(reports, 200, 'reports');
  assert.ok(reports.data.kpis.revenue_period_cents > 0);
  assert.ok(Array.isArray(reports.data.revenue));
});

test('plans can be created, edited, retired, and re-listed', async () => {
  const invalid = await api('POST', '/api/plans', {
    body: { name: '', price_cents: -5, duration_days: 0 }
  });
  expectStatus(invalid, 422, 'invalid plan');

  const created = await api('POST', '/api/plans', {
    body: {
      name: 'Integration Monthly',
      description: 'Plan created by the API test suite.',
      price_cents: 4200,
      duration_days: 30,
      features: ['Unlimited gym access', 'Locker room access']
    }
  });
  expectStatus(created, 201, 'create plan');
  assert.equal(created.data.name, 'Integration Monthly');
  assert.deepEqual(created.data.features, ['Unlimited gym access', 'Locker room access']);
  plan = created.data;

  const duplicate = await api('POST', '/api/plans', {
    body: { name: 'integration monthly', price_cents: 1000, duration_days: 10 }
  });
  expectStatus(duplicate, 409, 'duplicate plan');

  const edited = await api('PATCH', `/api/plans/${plan.id}`, {
    body: { price_cents: 4500, description: 'Updated by the test suite.' }
  });
  expectStatus(edited, 200, 'edit plan');
  assert.equal(edited.data.price_cents, 4500);
  assert.equal(edited.data.duration_days, 30);
  assert.deepEqual(edited.data.features, ['Unlimited gym access', 'Locker room access']);

  const retired = await api('POST', `/api/plans/${plan.id}/toggle`);
  expectStatus(retired, 200, 'retire plan');
  assert.equal(retired.data.active, 0);

  const listed = await api('GET', '/api/plans');
  expectStatus(listed, 200, 'active plans');
  assert.ok(!listed.data.items.some((item) => item.id === plan.id));

  const relisted = await api('POST', `/api/plans/${plan.id}/toggle`);
  expectStatus(relisted, 200, 'relist plan');
  assert.equal(relisted.data.active, 1);
});

test('members can be added, edited, and validated', async () => {
  const created = await api('POST', '/api/members', {
    body: {
      first_name: 'Test',
      last_name: 'Alpha',
      email: 'test.alpha@example.com',
      phone: '(555) 0100-0001',
      joined_on: today(),
      notes: 'Created by the integration suite.'
    }
  });
  expectStatus(created, 201, 'create member');
  assert.match(created.data.code, /^GB-\d{4,}$/);
  assert.equal(created.data.status, 'active');
  memberA = created.data;

  const second = await api('POST', '/api/members', {
    body: {
      first_name: 'Test',
      last_name: 'Beta',
      email: 'test.beta@example.com',
      phone: '(555) 0100-0002',
      joined_on: today()
    }
  });
  expectStatus(second, 201, 'create second member');
  memberB = second.data;

  const duplicate = await api('POST', '/api/members', {
    body: {
      first_name: 'Another',
      last_name: 'Member',
      email: 'TEST.ALPHA@example.com'
    }
  });
  expectStatus(duplicate, 409, 'duplicate member email');

  const invalidEmail = await api('POST', '/api/members', {
    body: { first_name: 'Bad', last_name: 'Email', email: 'not-an-email' }
  });
  expectStatus(invalidEmail, 422, 'invalid email');

  const edited = await api('PATCH', `/api/members/${memberA.id}`, {
    body: { phone: '(555) 999-0001', notes: 'Updated by the integration suite.' }
  });
  expectStatus(edited, 200, 'edit member');
  assert.equal(edited.data.phone, '(555) 999-0001');
  assert.equal(edited.data.first_name, 'Test');

  const lookup = await api('GET', `/api/members/lookup?code=${memberA.code}`);
  expectStatus(lookup, 200, 'lookup member');
  assert.equal(lookup.data.member.id, memberA.id);
  assert.equal(lookup.data.membership, null);
});

test('memberships can be sold with and without a payment', async () => {
  const sold = await api('POST', `/api/members/${memberA.id}/subscriptions`, {
    body: {
      plan_id: plan.id,
      start_date: today(),
      record_payment: true,
      payment_method: 'card',
      notes: 'Paid in full at the desk.'
    }
  });
  expectStatus(sold, 201, 'sell membership');
  assert.equal(sold.data.subscription.member_id, memberA.id);
  assert.equal(sold.data.subscription.plan_name, 'Integration Monthly');
  assert.equal(sold.data.subscription.status, 'active');
  assert.equal(sold.data.subscription.price_cents, 4500);
  assert.ok(sold.data.payment);
  assert.equal(sold.data.payment.amount_cents, 4500);
  assert.equal(sold.data.payment.status, 'paid');
  assert.match(sold.data.payment.receipt_no, /^RCPT-\d+$/);
  subscriptionA = sold.data.subscription;
  paymentA = sold.data.payment;

  const second = await api('POST', `/api/members/${memberB.id}/subscriptions`, {
    body: { plan_id: plan.id, start_date: today(), record_payment: false }
  });
  expectStatus(second, 201, 'sell unpaid membership');
  assert.equal(second.data.payment, null);
  assert.equal(second.data.subscription.status, 'active');
  subscriptionB = second.data.subscription;

  const overlap = await api('POST', `/api/members/${memberA.id}/subscriptions`, {
    body: { plan_id: plan.id, start_date: today() }
  });
  expectStatus(overlap, 409, 'overlapping membership');

  const detail = await api('GET', `/api/members/${memberA.id}`);
  expectStatus(detail, 200, 'member detail');
  assert.equal(detail.data.member.id, memberA.id);
  assert.equal(detail.data.membership.id, subscriptionA.id);
  assert.equal(detail.data.membership.paid_cents, 4500);
  assert.equal(detail.data.membership.balance_cents, 0);
  assert.ok(detail.data.payments.some((payment) => payment.id === paymentA.id));
  assert.ok(detail.data.subscriptions.some((item) => item.id === subscriptionA.id));
});

test('payments can be recorded, filtered, refunded, and receipted', async () => {
  const recorded = await api('POST', '/api/payments', {
    body: {
      member_id: memberA.id,
      subscription_id: subscriptionA.id,
      amount_cents: 1500,
      method: 'cash',
      paid_at: today(),
      description: 'Personal training session',
      notes: 'One-hour session'
    }
  });
  expectStatus(recorded, 201, 'record payment');
  assert.equal(recorded.data.payment.amount_cents, 1500);
  assert.equal(recorded.data.payment.method, 'cash');
  assert.match(recorded.data.payment.receipt_no, /^RCPT-\d+$/);

  const receipt = await api('GET', `/api/payments/${recorded.data.payment.id}/receipt`);
  expectStatus(receipt, 200, 'receipt');
  assert.equal(receipt.data.payment.first_name, 'Test');
  assert.equal(receipt.data.payment.description, 'Personal training session');

  const filtered = await api('GET', `/api/payments?status=paid&method=cash&search=${memberA.code}`);
  expectStatus(filtered, 200, 'filtered payments');
  assert.ok(filtered.data.items.some((payment) => payment.id === recorded.data.payment.id));

  const refunded = await api('POST', `/api/payments/${recorded.data.payment.id}/refund`);
  expectStatus(refunded, 200, 'refund payment');
  assert.equal(refunded.data.payment.status, 'refunded');
  assert.match(refunded.data.payment.notes, /refunded/i);

  const twice = await api('POST', `/api/payments/${recorded.data.payment.id}/refund`);
  expectStatus(twice, 409, 'double refund');

  const invalidAmount = await api('POST', '/api/payments', {
    body: { member_id: memberA.id, amount_cents: 0, method: 'cash' }
  });
  expectStatus(invalidAmount, 422, 'zero payment');

  const wrongOwner = await api('POST', '/api/payments', {
    body: {
      member_id: memberB.id,
      subscription_id: subscriptionA.id,
      amount_cents: 100,
      method: 'cash'
    }
  });
  expectStatus(wrongOwner, 422, 'membership belongs to another member');
});

test('check-in enforces membership, blocks duplicates, and checks out', async () => {
  const first = await api('POST', '/api/checkins', { body: { code: memberA.code } });
  expectStatus(first, 201, 'check in by code');
  assert.equal(first.data.member.id, memberA.id);
  assert.equal(first.data.membership.id, subscriptionA.id);
  assert.ok(['active', 'expiring'].includes(first.data.membership.state));
  assert.equal(first.data.checkin.checked_out_at, null);
  checkinA = first.data.checkin;

  const duplicate = await api('POST', '/api/checkins', { body: { code: memberA.code } });
  expectStatus(duplicate, 409, 'duplicate check-in');
  assert.match(duplicate.data.error, /already checked in/i);

  const second = await api('POST', '/api/checkins', { body: { code: memberB.code } });
  expectStatus(second, 201, 'second member check-in');
  checkinB = second.data.checkin;

  const anonymous = await api('POST', '/api/checkins', {
    auth: false,
    body: { code: memberA.code }
  });
  expectStatus(anonymous, 401, 'anonymous check-in');

  const todayLog = await api('GET', '/api/checkins/today');
  expectStatus(todayLog, 200, 'today check-ins');
  assert.ok(todayLog.data.live.some((item) => item.id === checkinA.id));
  assert.ok(todayLog.data.summary.total_today >= 2);

  const out = await api('POST', `/api/checkins/${checkinA.id}/checkout`);
  expectStatus(out, 200, 'checkout');
  assert.ok(out.data.checkin.checked_out_at);
  checkinA = out.data.checkin;

  const outAgain = await api('POST', `/api/checkins/${checkinA.id}/checkout`);
  expectStatus(outAgain, 409, 'double checkout');

  const outB = await api('POST', `/api/checkins/${checkinB.id}/checkout`);
  expectStatus(outB, 200, 'second checkout');
  checkinB = outB.data.checkin;

  const unknown = await api('POST', '/api/checkins', { body: { code: 'GB-9999' } });
  expectStatus(unknown, 404, 'unknown member code');
});

test('buddy pairs can be created, counted, and ended', async () => {
  const created = await api('POST', '/api/buddies', {
    body: {
      member_a_id: memberB.id,
      member_b_id: memberA.id,
      weekly_goal: 4,
      note: 'Integration test pair'
    }
  });
  expectStatus(created, 201, 'create buddy pair');
  assert.equal(created.data.weekly_goal, 4);
  assert.equal(created.data.status, 'active');
  assert.equal(created.data.a.id, memberA.id);
  assert.equal(created.data.b.id, memberB.id);
  assert.ok(created.data.shared_30 >= 1, 'same-day check-ins count as a shared workout');
  buddy = created.data;

  const duplicate = await api('POST', '/api/buddies', {
    body: { member_a_id: memberA.id, member_b_id: memberB.id, weekly_goal: 2 }
  });
  expectStatus(duplicate, 409, 'duplicate buddy pair');

  const selfPair = await api('POST', '/api/buddies', {
    body: { member_a_id: memberA.id, member_b_id: memberA.id }
  });
  expectStatus(selfPair, 422, 'self buddy pair');

  const board = await api('GET', '/api/buddies');
  expectStatus(board, 200, 'buddy board');
  assert.ok(board.data.pairs.some((pair) => pair.id === buddy.id));

  const ended = await api('POST', `/api/buddies/${buddy.id}/end`);
  expectStatus(ended, 200, 'end buddy pair');
  assert.equal(ended.data.status, 'ended');

  const endAgain = await api('POST', `/api/buddies/${buddy.id}/end`);
  expectStatus(endAgain, 409, 'double end buddy pair');

  const restart = await api('POST', '/api/buddies', {
    body: { member_a_id: memberA.id, member_b_id: memberB.id, weekly_goal: 2 }
  });
  expectStatus(restart, 201, 're-pair buddies');
  assert.equal(restart.data.status, 'active');
  buddy = restart.data;
});

test('classes support creation, bookings, attendance, and cancellation', async () => {
  const created = await api('POST', '/api/classes', {
    body: {
      name: 'Integration Circuit',
      coach: 'Test Coach',
      room: 'Test Studio',
      starts_at: tomorrowAt(18),
      duration_min: 45,
      capacity: 2,
      description: 'Created by the API test suite.'
    }
  });
  expectStatus(created, 201, 'create class');
  assert.equal(created.data.name, 'Integration Circuit');
  assert.equal(created.data.capacity, 2);
  const gymClass = created.data;

  const booking = await api('POST', `/api/classes/${gymClass.id}/bookings`, {
    body: { member_id: memberA.id }
  });
  expectStatus(booking, 201, 'book class');
  assert.equal(booking.data.booking.status, 'booked');
  assert.equal(booking.data.member.id, memberA.id);

  const duplicate = await api('POST', `/api/classes/${gymClass.id}/bookings`, {
    body: { member_id: memberA.id }
  });
  expectStatus(duplicate, 409, 'duplicate booking');

  const second = await api('POST', `/api/classes/${gymClass.id}/bookings`, {
    body: { member_id: memberB.id }
  });
  expectStatus(second, 201, 'book second member');

  const full = await api('POST', `/api/classes/${gymClass.id}/bookings`, {
    body: { member_id: memberB.id }
  });
  expectStatus(full, 409, 'class full or already booked');

  const detail = await api('GET', `/api/classes/${gymClass.id}`);
  expectStatus(detail, 200, 'class detail');
  assert.equal(detail.data.item.booked, 2);
  assert.equal(detail.data.available, 0);
  assert.equal(detail.data.bookings.length, 2);

  const attended = await api('POST', `/api/bookings/${booking.data.booking.id}/status`, {
    body: { status: 'attended' }
  });
  expectStatus(attended, 200, 'mark attended');
  assert.equal(attended.data.booking.status, 'attended');

  const noShow = await api('POST', `/api/bookings/${second.data.booking.id}/status`, {
    body: { status: 'no_show' }
  });
  expectStatus(noShow, 200, 'mark no-show');
  assert.equal(noShow.data.booking.status, 'no_show');

  const cancelled = await api('PATCH', `/api/classes/${gymClass.id}`, {
    body: { status: 'cancelled' }
  });
  expectStatus(cancelled, 200, 'cancel class');
  assert.equal(cancelled.data.status, 'cancelled');

  const lateBooking = await api('POST', `/api/classes/${gymClass.id}/bookings`, {
    body: { member_id: memberA.id }
  });
  expectStatus(lateBooking, 409, 'book cancelled class');
});

test('freezing blocks check-in, resuming restores it, and cancelling ends the membership', async () => {
  const frozen = await api('POST', `/api/subscriptions/${subscriptionA.id}/freeze`);
  expectStatus(frozen, 200, 'freeze membership');
  assert.equal(frozen.data.subscription.status, 'frozen');
  assert.equal(frozen.data.subscription.freeze_started_on, today());

  const blocked = await api('POST', '/api/checkins', { body: { code: memberA.code } });
  expectStatus(blocked, 403, 'check-in while frozen');
  assert.match(blocked.data.error, /frozen/i);

  const resumed = await api('POST', `/api/subscriptions/${subscriptionA.id}/unfreeze`);
  expectStatus(resumed, 200, 'unfreeze membership');
  assert.equal(resumed.data.subscription.status, 'active');
  assert.equal(resumed.data.subscription.end_date, subscriptionA.end_date);

  const detail = await api('GET', `/api/members/${memberA.id}`);
  expectStatus(detail, 200, 'member detail after freeze');
  assert.equal(detail.data.membership.status, 'active');

  const cancelled = await api('POST', `/api/subscriptions/${subscriptionA.id}/cancel`);
  expectStatus(cancelled, 200, 'cancel membership');
  assert.equal(cancelled.data.subscription.status, 'cancelled');

  const blockedAgain = await api('POST', '/api/checkins', { body: { code: memberA.code } });
  expectStatus(blockedAgain, 403, 'check-in after cancel');

  const freezeCancelled = await api('POST', `/api/subscriptions/${subscriptionA.id}/freeze`);
  expectStatus(freezeCancelled, 409, 'freeze cancelled membership');
});

test('member profiles can be archived and restored', async () => {
  const archived = await api('POST', `/api/members/${memberB.id}/archive`);
  expectStatus(archived, 200, 'archive member');
  assert.equal(archived.data.status, 'inactive');

  const bookingBlocked = await api('POST', `/api/checkins`, { body: { code: memberB.code } });
  expectStatus(bookingBlocked, 403, 'check-in archived member');

  const restored = await api('POST', `/api/members/${memberB.id}/restore`);
  expectStatus(restored, 200, 'restore member');
  assert.equal(restored.data.status, 'active');
});

test('CSV exports contain the expected headers and rows', async () => {
  const members = await api('GET', '/api/export/members.csv');
  expectStatus(members, 200, 'members csv');
  assert.match(members.headers.get('content-type'), /text\/csv/);
  assert.match(members.headers.get('content-disposition'), /attachment; filename="gym-buddies-members-/);
  assert.ok(members.text.includes('Member code,First name,Last name'));
  assert.ok(members.text.includes(memberA.code));

  const payments = await api('GET', '/api/export/payments.csv');
  expectStatus(payments, 200, 'payments csv');
  assert.ok(payments.text.includes('Receipt,Paid at,Member code'));
  assert.ok(payments.text.includes('Amount (PHP)'));
  assert.ok(payments.text.includes(paymentA.receipt_no));

  const checkins = await api('GET', '/api/export/checkins.csv');
  expectStatus(checkins, 200, 'checkins csv');
  assert.ok(checkins.text.includes(memberA.code));

  const anonymous = await api('GET', '/api/export/members.csv', { auth: false });
  expectStatus(anonymous, 401, 'anonymous export');
});

test('logout invalidates the session', async () => {
  const logout = await api('POST', '/api/auth/logout');
  expectStatus(logout, 200, 'logout');
  const cleared = logout.headers.getSetCookie()[0];
  assert.match(cleared, /gb_session=;/);
  cookie = cleared.split(';')[0];

  const me = await api('GET', '/api/auth/me');
  expectStatus(me, 401, 'me after logout');
});
