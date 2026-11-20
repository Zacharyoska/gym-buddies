import { api } from './api.js';
import {
  esc,
  icon,
  money,
  formatDate,
  todayShort,
  avatar,
  toast,
  closeModal,
  confirmDialog
} from './ui.js';
import {
  openMemberModal,
  openSubscriptionModal,
  openPaymentModal,
  openPlanModal,
  openClassModal,
  openBookingModal,
  openBuddyModal,
  openReceiptModal
} from './modals.js';
import { openQrScanner, printQrPass, downloadQrPass } from './qr.js';
import { lifterBackground } from './lifter.js';
import * as dashboardView from './views/dashboard.js';
import * as membersView from './views/members.js';
import * as plansView from './views/plans.js';
import * as paymentsView from './views/payments.js';
import * as checkinsView from './views/checkins.js';
import * as classesView from './views/classes.js';
import * as buddiesView from './views/buddies.js';
import * as reportsView from './views/reports.js';

document.body.insertAdjacentHTML('afterbegin', lifterBackground('lifter-site'));

const NAV_GROUPS = [
  {
    label: 'Workspace',
    items: [
      { key: 'dashboard', href: '#/dashboard', label: 'Dashboard', icon: 'dashboard' },
      { key: 'members', href: '#/members', label: 'Members', icon: 'users' },
      { key: 'checkins', href: '#/checkins', label: 'Check-in', icon: 'check-circle' },
      { key: 'classes', href: '#/classes', label: 'Classes', icon: 'calendar' },
      { key: 'buddies', href: '#/buddies', label: 'Buddies', icon: 'users' }
    ]
  },
  {
    label: 'Revenue',
    items: [
      { key: 'payments', href: '#/payments', label: 'Payments', icon: 'card' },
      { key: 'plans', href: '#/plans', label: 'Plans', icon: 'layers' },
      { key: 'reports', href: '#/reports', label: 'Reports', icon: 'chart' }
    ]
  }
];

const ROUTE_META = {
  dashboard: { crumb: 'Overview', title: 'Dashboard' },
  members: { crumb: 'Members', title: 'Members' },
  checkins: { crumb: 'Front desk', title: 'Check-in' },
  classes: { crumb: 'Studio', title: 'Classes' },
  buddies: { crumb: 'Community', title: 'Workout buddies' },
  payments: { crumb: 'Revenue', title: 'Payments' },
  plans: { crumb: 'Revenue', title: 'Membership plans' },
  reports: { crumb: 'Business', title: 'Reports' }
};

let session = null;

function parseHash() {
  const raw = window.location.hash.replace(/^#/, '');
  const [pathPart, queryPart = ''] = raw.split('?');
  const segments = pathPart
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    });
  return { segments, query: new URLSearchParams(queryPart) };
}

function go(hash) {
  if (window.location.hash === hash) {
    void renderRoute();
  } else {
    window.location.hash = hash;
  }
}

function setActiveNav(key) {
  document.querySelectorAll('[data-nav]').forEach((link) => {
    link.classList.toggle('active', link.dataset.nav === key);
  });
}

function setNavOpen(open) {
  document.body.classList.toggle('nav-open', open);
  const menuButton = document.querySelector('.menu-btn');
  if (menuButton) {
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  }
}

let topbarRevealed = false;

function pulseTopbar() {
  const topbar = document.querySelector('.topbar');
  if (!topbar) return;
  if (!topbarRevealed) {
    topbarRevealed = true;
    return;
  }
  topbar.classList.remove('is-changing');
  void topbar.offsetWidth;
  topbar.classList.add('is-changing');
  window.setTimeout(() => topbar.classList.remove('is-changing'), 460);
}

function userPerson(user) {
  const parts = String(user?.full_name || user?.username || 'Staff').trim().split(/\s+/);
  return {
    first_name: parts[0] || 'S',
    last_name: parts.slice(1).join(' '),
    avatar_color: '#c2410c',
    photo: '/images/profile.jpg'
  };
}

function shellMarkup(user) {
  const person = userPerson(user);
  return `
    <div class="app-shell">
      <aside class="sidebar" id="sidebar" aria-label="Main navigation">
        <a class="brand" href="#/dashboard">
          <span class="brand-mark"><img src="/images/profile.jpg" alt="" /></span>
          <span>
            <span class="brand-name">Gym Buddies by Jahren & Charles</span>
            <span class="brand-sub">Member manager</span>
          </span>
        </a>
        <div class="nav-scroll">
          ${NAV_GROUPS.map(
            (group) => `<div class="nav-label">${esc(group.label)}</div>
              ${group.items
                .map(
                  (item) => `<a class="nav-link" data-nav="${item.key}" href="${item.href}">
                    ${icon(item.icon)}
                    <span>${esc(item.label)}</span>
                  </a>`
                )
                .join('')}`
          ).join('')}
          <div class="sidebar-note">
            <div class="sidebar-note-title">${icon('zap', 'icon-sm')} Front desk tip</div>
            <p>Member codes are on the key tags. Use Check-in for the fastest front-desk flow.</p>
          </div>
        </div>
        <div class="sidebar-user">
          ${avatar(person)}
          <div>
            <div class="sidebar-user-name">${esc(user?.full_name || user?.username || 'Staff')}</div>
            <div class="sidebar-user-role">${esc(user?.role || 'Staff')}</div>
          </div>
          <button class="icon-btn" type="button" data-action="logout" title="Sign out" aria-label="Sign out">
            ${icon('log-out')}
          </button>
        </div>
      </aside>
      <div class="sidebar-overlay" data-action="close-nav"></div>
      <div class="app-main">
        <header class="topbar">
          <button class="icon-btn menu-btn" type="button" data-action="toggle-nav" aria-label="Open navigation" aria-expanded="false" aria-controls="sidebar">
            ${icon('menu')}
          </button>
          <div class="topbar-title">
            <span class="crumb" id="topbar-crumb">Overview</span>
            <h2 id="topbar-title">Dashboard</h2>
          </div>
          <div class="topbar-actions">
            <span class="date-pill">${icon('calendar', 'icon-sm')} ${esc(todayShort())}</span>
            <button class="btn btn-primary btn-sm" type="button" data-action="add-member">
              ${icon('user-plus')} <span class="btn-text">Add member</span>
            </button>
          </div>
        </header>
        <main class="page" id="view">
          <div class="page-loading"><div class="spinner" role="status" aria-label="Loading"></div></div>
        </main>
      </div>
    </div>
  `;
}

function loginMarkup(errorMessage = '') {
  return `<div class="login-screen">
    <section class="login-showcase">
      ${lifterBackground('lifter-login')}
      <div class="login-brand">
        <span class="brand-mark"><img src="/images/profile.jpg" alt="" /></span>
        <span>
          <span class="brand-name">Gym Buddies by Jahren & Charles</span>
          <span class="brand-sub">Member manager</span>
        </span>
      </div>
      <div class="login-copy">
        <span class="login-kicker">${icon('shield', 'icon-sm')} Front desk, simplified</span>
        <h1>A gym that<br /><em>knows</em> its people.</h1>
        <p>Memberships, payments, check-ins, classes, and workout buddies — one calm workspace for the whole team.</p>
        <div class="login-features">
          <div class="login-feature">
            <span class="login-feature-icon">${icon('check-circle')}</span>
            <span>Check members in with a code and catch expired plans instantly.</span>
          </div>
          <div class="login-feature">
            <span class="login-feature-icon">${icon('card')}</span>
            <span>Sell plans, record receipts, and handle refunds without a spreadsheet.</span>
          </div>
          <div class="login-feature">
            <span class="login-feature-icon">${icon('users')}</span>
            <span>Pair workout buddies and watch shared streaks build automatically.</span>
          </div>
        </div>
      </div>
      <div class="login-proof">
        <span class="avatar-pair">
          <span class="avatar avatar-sm" style="--avatar:#d97706"><img src="/images/profile.jpg" alt="" /></span>
          <span class="avatar avatar-sm" style="--avatar:#9a3412">JE</span>
          <span class="avatar avatar-sm" style="--avatar:#b45309">SR</span>
        </span>
        <div class="login-proof-copy">
          <div class="login-proof-title">Built for the front desk</div>
          <div class="login-proof-sub">Staff and plans are ready to go.</div>
        </div>
        <span class="login-proof-badge">${icon('zap', 'icon-sm')} Demo</span>
      </div>
    </section>

    <section class="login-panel">
      <div class="login-card">
        <h2>Welcome back.</h2>
        <p>Sign in to open the Gym Buddies by Jahren & Charles front desk.</p>
        <form class="login-form" id="login-form" autocomplete="on">
          <div class="login-field">
            ${icon('user')}
            <label class="sr-only" for="login-username">Username</label>
            <input class="input" id="login-username" name="username" autocomplete="username" required autofocus placeholder="Username" />
          </div>
          <div class="login-field">
            ${icon('lock')}
            <label class="sr-only" for="login-password">Password</label>
            <input class="input" id="login-password" name="password" type="password" autocomplete="current-password" required placeholder="Password" />
          </div>
          <div class="login-error ${errorMessage ? 'visible' : ''}" id="login-error" role="alert">${esc(errorMessage)}</div>
          <button class="btn btn-dark btn-lg btn-block" type="submit" id="login-submit">
            ${icon('log-out')} <span>Sign in</span>
          </button>
        </form>
        <div class="login-demo">
          <div class="login-demo-copy">
            <div class="login-demo-label">Demo account</div>
            <div class="login-demo-value">admin / admin123</div>
          </div>
          <button class="btn btn-secondary btn-sm" type="button" data-action="fill-demo">Use demo</button>
        </div>
        <div class="login-foot">Demo data resets with <strong>npm run seed</strong>. Use the app locally — all data stays on this computer.</div>
      </div>
    </section>
  </div>`;
}

function showLogin(errorMessage = '') {
  session = null;
  closeModal();
  document.getElementById('app').innerHTML = loginMarkup(errorMessage);
  document.title = 'Sign in · Gym Buddies by Jahren & Charles';
  const form = document.getElementById('login-form');
  const error = document.getElementById('login-error');
  const submit = document.getElementById('login-submit');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    error.classList.remove('visible');
    error.textContent = '';
    submit.disabled = true;
    submit.innerHTML = '<span class="spinner" style="width:18px;height:18px;border-width:2px"></span><span>Signing in…</span>';
    try {
      const result = await api.post('/auth/login', {
        username: data.username,
        password: data.password
      });
      session = result.user;
      await showApp();
      toast(`Welcome back, ${result.user.full_name.split(' ')[0]}.`, 'success', 'Signed in');
    } catch (requestError) {
      error.textContent = requestError.message;
      error.classList.add('visible');
      submit.disabled = false;
      submit.innerHTML = `${icon('log-out')} <span>Sign in</span>`;
      document.getElementById('login-password')?.focus();
    }
  });
}

async function showApp() {
  topbarRevealed = false;
  document.getElementById('app').innerHTML = shellMarkup(session);
  setActiveNav('dashboard');
  if (!window.location.hash) {
    window.location.hash = '#/dashboard';
    return;
  }
  await renderRoute();
}

function errorMarkup(message) {
  return `<div class="card error-card">
    <div class="empty-icon">${icon('alert')}</div>
    <div class="empty-title">This page could not load</div>
    <div class="empty-text" style="margin-left:auto;margin-right:auto">${esc(message)}</div>
    <div class="empty-action">
      <button class="btn btn-primary btn-sm" type="button" data-action="refresh-view">${icon('refresh')} Try again</button>
    </div>
  </div>`;
}

async function renderRoute() {
  if (!session) return;
  const root = document.getElementById('view');
  if (!root) return;
  setNavOpen(false);

  const { segments, query } = parseHash();
  const section = segments[0] || 'dashboard';
  const meta = ROUTE_META[section] || { crumb: 'Gym Buddies by Jahren & Charles', title: 'Page' };
  const crumb = document.getElementById('topbar-crumb');
  const heading = document.getElementById('topbar-title');
  if (crumb) crumb.textContent = meta.crumb;

  setActiveNav(section);
  root.innerHTML = '<div class="page-loading"><div class="spinner" role="status" aria-label="Loading"></div></div>';
  let title = meta.title;

  try {
    if (section === 'dashboard' && segments.length === 1) {
      title = await dashboardView.render(root, query);
    } else if (section === 'members' && segments.length === 1) {
      title = await membersView.render(root, query);
    } else if (section === 'members' && /^\d+$/.test(segments[1] || '')) {
      title = await membersView.renderDetail(root, query, Number(segments[1]));
    } else if (section === 'plans' && segments.length === 1) {
      title = await plansView.render(root, query);
    } else if (section === 'payments' && segments.length === 1) {
      title = await paymentsView.render(root, query);
    } else if (section === 'checkins' && segments.length === 1) {
      title = await checkinsView.render(root, query);
    } else if (section === 'classes' && segments.length === 1) {
      title = await classesView.render(root, query);
    } else if (section === 'classes' && /^\d+$/.test(segments[1] || '')) {
      title = await classesView.renderDetail(root, query, Number(segments[1]));
    } else if (section === 'buddies' && segments.length === 1) {
      title = await buddiesView.render(root, query);
    } else if (section === 'reports' && segments.length === 1) {
      title = await reportsView.render(root, query);
    } else {
      root.innerHTML = `<div class="card error-card">
        <div class="empty-icon">${icon('search')}</div>
        <div class="empty-title">Page not found</div>
        <div class="empty-text" style="margin-left:auto;margin-right:auto">The page you tried to open does not exist.</div>
        <div class="empty-action"><a class="btn btn-primary btn-sm" href="#/dashboard">Back to dashboard</a></div>
      </div>`;
      title = 'Page not found';
      if (heading) heading.textContent = title;
      pulseTopbar();
      return;
    }

    if (heading) heading.textContent = title || meta.title;
    pulseTopbar();
    document.title = `${title || meta.title} · Gym Buddies by Jahren & Charles`;
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (section === 'checkins') {
      root.querySelector('#checkin-code')?.focus();
    }
  } catch (error) {
    if (error?.status === 401) {
      handleUnauthorized();
      return;
    }
    if (heading) heading.textContent = meta.title;
    pulseTopbar();
    document.title = `${meta.title} · Gym Buddies by Jahren & Charles`;
    root.innerHTML = errorMarkup(error?.message || 'Something went wrong.');
  }
}

let unauthorizedHandled = false;

function handleUnauthorized() {
  if (unauthorizedHandled) return;
  unauthorizedHandled = true;
  window.setTimeout(() => {
    unauthorizedHandled = false;
  }, 800);
  if (!session) return;
  showLogin('Your session expired. Sign in again to continue.');
}

/* Actions */

function busyButton(button, busy) {
  if (!button) return;
  if (busy) {
    button.dataset.originalHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px"></span><span>Working…</span>';
  } else {
    button.disabled = false;
    if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
      delete button.dataset.originalHtml;
    }
  }
}

async function handleAction(action, element) {
  const id = Number(element.dataset.id);
  const subscriptionId = Number(element.dataset.subscriptionId) || null;
  try {
    switch (action) {
      case 'toggle-nav':
        setNavOpen(!document.body.classList.contains('nav-open'));
        break;
      case 'close-nav':
        setNavOpen(false);
        break;
      case 'fill-demo': {
        const username = document.getElementById('login-username');
        const password = document.getElementById('login-password');
        if (username) username.value = 'admin';
        if (password) password.value = 'admin123';
        document.getElementById('login-submit')?.focus();
        break;
      }
      case 'logout': {
        try {
          await api.post('/auth/logout');
        } catch {
          // Signing out locally is still the right outcome.
        }
        showLogin();
        toast('You have been signed out.', 'info', 'See you soon');
        break;
      }
      case 'refresh-view':
        await renderRoute();
        break;
      case 'add-member':
        await openMemberModal();
        break;
      case 'edit-member': {
        const detail = await api.get(`/members/${id}`);
        await openMemberModal(detail.member);
        break;
      }
      case 'add-subscription':
        await openSubscriptionModal(id);
        break;
      case 'record-payment':
        await openPaymentModal({ memberId: id || null, subscriptionId });
        break;
      case 'view-receipt':
        await openReceiptModal(id);
        break;
      case 'print-receipt':
        window.print();
        break;
      case 'add-plan':
        openPlanModal();
        break;
      case 'edit-plan': {
        const plans = await api.get('/plans?all=1');
        const plan = plans.items.find((item) => item.id === id);
        if (plan) openPlanModal(plan);
        break;
      }
      case 'toggle-plan': {
        const plans = await api.get('/plans?all=1');
        const plan = plans.items.find((item) => item.id === id);
        if (!plan) return;
        if (plan.active) {
          const ok = await confirmDialog({
            title: 'Retire this plan?',
            message: `<strong>${esc(plan.name)}</strong> will no longer be available to sell. Existing memberships keep their terms and you can put it back on sale at any time.`,
            confirmText: 'Retire plan',
            eyebrow: 'Membership plan'
          });
          if (!ok) return;
        }
        await api.post(`/plans/${id}/toggle`);
        toast(plan.active ? 'Plan retired.' : 'Plan is back on sale.', 'success');
        await renderRoute();
        break;
      }
      case 'add-class':
        openClassModal();
        break;
      case 'add-booking':
        await openBookingModal(id);
        break;
      case 'add-buddy':
        await openBuddyModal();
        break;
      case 'end-buddy': {
        const ok = await confirmDialog({
          title: 'End this buddy pair?',
          message: 'Both members keep their profiles and check-in history. Their shared stats stay in the past, but they will no longer appear on the buddy board.',
          confirmText: 'End pair',
          danger: true,
          eyebrow: 'Workout buddies'
        });
        if (!ok) return;
        await api.post(`/buddies/${id}/end`);
        toast('Buddy pair ended.', 'success');
        await renderRoute();
        break;
      }
      case 'freeze-sub': {
        const ok = await confirmDialog({
          title: 'Freeze this membership?',
          message: 'The member will not be able to check in while frozen. When you resume, the end date moves forward by the number of days frozen.',
          confirmText: 'Freeze membership',
          eyebrow: 'Membership'
        });
        if (!ok) return;
        await api.post(`/subscriptions/${id}/freeze`);
        toast('Membership frozen. Resume it when the member returns.', 'success');
        await renderRoute();
        break;
      }
      case 'unfreeze-sub':
        await api.post(`/subscriptions/${id}/unfreeze`);
        toast('Membership resumed. The end date has been extended.', 'success');
        await renderRoute();
        break;
      case 'cancel-sub': {
        const ok = await confirmDialog({
          title: 'Cancel this membership?',
          message: 'This ends the membership immediately. It cannot be undone, but the member can buy a new plan at any time.',
          confirmText: 'Cancel membership',
          danger: true,
          eyebrow: 'Membership'
        });
        if (!ok) return;
        await api.post(`/subscriptions/${id}/cancel`);
        toast('Membership cancelled.', 'success');
        await renderRoute();
        break;
      }
      case 'refund-payment': {
        const ok = await confirmDialog({
          title: 'Refund this payment?',
          message: 'The receipt will be marked as refunded and removed from revenue totals. The payment record stays in the member’s history.',
          confirmText: 'Mark as refunded',
          danger: true,
          eyebrow: 'Payment'
        });
        if (!ok) return;
        await api.post(`/payments/${id}/refund`);
        toast('Payment marked as refunded.', 'success');
        await renderRoute();
        break;
      }
      case 'archive-member': {
        const ok = await confirmDialog({
          title: 'Archive this member?',
          message: 'Their profile becomes inactive and any open check-in is closed. Membership and payment history are kept, and the profile can be restored later.',
          confirmText: 'Archive member',
          danger: true,
          eyebrow: 'Member profile'
        });
        if (!ok) return;
        await api.post(`/members/${id}/archive`);
        toast('Member archived. Visit their profile to restore them.', 'success');
        await renderRoute();
        break;
      }
      case 'restore-member':
        await api.post(`/members/${id}/restore`);
        toast('Member profile restored.', 'success');
        await renderRoute();
        break;
      case 'checkin-member': {
        const result = await api.post('/checkins', { member_id: id });
        toast(`${result.member.first_name} ${result.member.last_name} is checked in.`, 'success', 'Welcome in');
        await renderRoute();
        break;
      }
      case 'scan-qr': {
        const input = document.getElementById('checkin-code');
        await openQrScanner({
          onScan: (code) => {
            if (!input?.isConnected || !code) return;
            input.value = code;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.form?.requestSubmit();
          }
        });
        break;
      }
      case 'print-qr':
        await printQrPass({ code: element.dataset.code, name: element.dataset.name });
        break;
      case 'download-qr':
        await downloadQrPass({ code: element.dataset.code });
        toast('QR code downloaded.', 'success');
        break;
      case 'checkout': {
        await api.post(`/checkins/${id}/checkout`);
        toast('Visit closed. Have a great day.', 'success');
        await renderRoute();
        break;
      }
      case 'cancel-class': {
        const ok = await confirmDialog({
          title: 'Cancel this class?',
          message: 'The session will stay on the schedule marked as cancelled. Existing bookings remain visible for follow-up.',
          confirmText: 'Cancel class',
          danger: true,
          eyebrow: 'Class session'
        });
        if (!ok) return;
        await api.patch(`/classes/${id}`, { status: 'cancelled' });
        toast('Class cancelled.', 'success');
        await renderRoute();
        break;
      }
      case 'booking-status': {
        const status = element.dataset.status;
        const labels = {
          attended: 'Attendance marked.',
          no_show: 'Booking marked as a no-show.',
          cancelled: 'Booking cancelled.',
          booked: 'Booking restored.'
        };
        await api.post(`/bookings/${id}/status`, { status });
        toast(labels[status] || 'Booking updated.', 'success');
        await renderRoute();
        break;
      }
      default:
        break;
    }
  } catch (error) {
    if (error?.status === 401) return;
    toast(error?.message || 'That action could not be completed.', 'error');
  }
}

document.addEventListener('click', (event) => {
  const element = event.target.closest('[data-action]');
  if (!element) return;
  event.preventDefault();
  void handleAction(element.dataset.action, element);
});

document.addEventListener('submit', async (event) => {
  const form = event.target.closest('form[data-form]');
  if (!form) return;
  event.preventDefault();
  const kind = form.dataset.form;
  const submitButton = form.querySelector('button[type="submit"]');
  const data = Object.fromEntries(new FormData(form).entries());
  busyButton(submitButton, true);
  let savedMember = null;
  let membershipCreated = false;

  try {
    if (kind === 'member') {
      if (!form.dataset.id && !data.plan_id) {
        toast('Choose a membership plan before adding the member.', 'error');
        return;
      }
      const payload = {
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone: data.phone,
        date_of_birth: data.date_of_birth,
        gender: data.gender,
        address: data.address,
        emergency_contact_name: data.emergency_contact_name,
        emergency_contact_phone: data.emergency_contact_phone,
        joined_on: data.joined_on,
        notes: data.notes
      };
      if (form.dataset.id) {
        await api.patch(`/members/${form.dataset.id}`, payload);
        closeModal();
        toast('Member profile updated.', 'success');
        await renderRoute();
      } else {
        savedMember = await api.post('/members', payload);
        const result = await api.post(`/members/${savedMember.id}/subscriptions`, {
          plan_id: Number(data.plan_id),
          start_date: data.start_date,
          record_payment: data.record_payment === 'on',
          payment_method: data.payment_method,
          notes: data.membership_notes
        });
        membershipCreated = true;
        closeModal();
        toast(
          `${savedMember.first_name} added with a ${result.subscription.plan_name} membership${
            result.payment ? ` · receipt ${result.payment.receipt_no}` : ''
          }.`,
          'success',
          'Member and membership added'
        );
        go(`#/members/${savedMember.id}`);
      }
    } else if (kind === 'subscription') {
      const memberId = Number(form.dataset.id);
      const result = await api.post(`/members/${memberId}/subscriptions`, {
        plan_id: Number(data.plan_id),
        start_date: data.start_date,
        record_payment: data.record_payment === 'on',
        payment_method: data.payment_method,
        notes: data.notes
      });
      closeModal();
      toast(
        `${result.subscription.plan_name} membership sold${
          result.payment ? ` · receipt ${result.payment.receipt_no}` : ''
        }.`,
        'success',
        'Membership created'
      );
      go(`#/members/${memberId}`);
    } else if (kind === 'payment') {
      const amount = Number(data.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        toast('Enter an amount greater than zero.', 'error');
        return;
      }
      const payload = {
        member_id: Number(data.member_id),
        amount_cents: Math.round(amount * 100),
        method: data.method,
        paid_at: data.paid_at || undefined,
        description: data.description,
        notes: data.notes
      };
      if (data.subscription_id) payload.subscription_id = Number(data.subscription_id);
      const result = await api.post('/payments', payload);
      closeModal();
      toast(
        `Receipt ${result.payment.receipt_no} · ${money(result.payment.amount_cents, true)}.`,
        'success',
        'Payment recorded'
      );
      await renderRoute();
    } else if (kind === 'plan') {
      const payload = {
        name: data.name,
        description: data.description,
        price_cents: Math.round(Number(data.price) * 100),
        duration_days: Number(data.duration_days),
        features: String(data.features || '')
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
      };
      if (!payload.name) {
        toast('Plan name is required.', 'error');
        return;
      }
      if (!Number.isFinite(payload.price_cents) || payload.price_cents < 0) {
        toast('Enter a valid plan price.', 'error');
        return;
      }
      if (form.dataset.id) {
        await api.patch(`/plans/${form.dataset.id}`, payload);
        toast('Plan updated. Existing memberships are unchanged.', 'success');
      } else {
        await api.post('/plans', payload);
        toast(`${payload.name} is ready to sell.`, 'success', 'Plan created');
      }
      closeModal();
      await renderRoute();
    } else if (kind === 'class') {
      const saved = await api.post('/classes', {
        name: data.name,
        coach: data.coach,
        room: data.room,
        starts_at: data.starts_at,
        duration_min: Number(data.duration_min),
        capacity: Number(data.capacity),
        description: data.description
      });
      closeModal();
      toast(`${saved.name} added to the schedule.`, 'success', 'Class created');
      go(`#/classes/${saved.id}`);
    } else if (kind === 'booking') {
      const classId = Number(form.dataset.id);
      const result = await api.post(`/classes/${classId}/bookings`, {
        member_id: Number(data.member_id)
      });
      closeModal();
      toast(`${result.member.first_name} ${result.member.last_name} is booked in.`, 'success', 'Booking confirmed');
      await renderRoute();
    } else if (kind === 'buddy') {
      await api.post('/buddies', {
        member_a_id: Number(data.member_a_id),
        member_b_id: Number(data.member_b_id),
        weekly_goal: Number(data.weekly_goal),
        note: data.note
      });
      closeModal();
      toast('Buddy pair created. Shared check-ins will start counting today.', 'success', 'Buddies paired');
      go('#/buddies');
    } else if (kind === 'checkin') {
      const code = String(data.code || '').trim();
      if (!code) return;
      const result = await api.post('/checkins', { code });
      toast(
        `${result.member.first_name} ${result.member.last_name} checked in${
          result.membership?.plan_name ? ` · ${result.membership.plan_name}` : ''
        }.`,
        'success',
        'Welcome in'
      );
      await renderRoute();
    }
  } catch (error) {
    if (savedMember && !form.dataset.id && !membershipCreated) {
      closeModal();
      go(`#/members/${savedMember.id}`);
      toast(
        `${savedMember.first_name} was added, but the membership could not be created: ${
          error?.message || 'Unknown error'
        }. Sell a plan from the profile to finish.`,
        'error',
        'Membership needs attention'
      );
    } else if (error?.status !== 401) {
      toast(error?.message || 'That form could not be saved.', 'error');
    }
  } finally {
    if (submitButton?.isConnected) busyButton(submitButton, false);
  }
});

window.addEventListener('hashchange', () => {
  void renderRoute();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && document.body.classList.contains('nav-open')) {
    setNavOpen(false);
  }
});

window.addEventListener('gb:unauthorized', handleUnauthorized);

async function boot() {
  try {
    const me = await api.get('/auth/me');
    session = me.user;
    await showApp();
  } catch {
    showLogin();
  }
}

void boot();
