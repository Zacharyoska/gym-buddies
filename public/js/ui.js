/* Shared UI helpers: formatting, icons, modals, toasts, and small charts. */

const ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ESCAPE_MAP[char]);
}

export function icon(name, className = '') {
  return `<svg class="icon ${className}" aria-hidden="true"><use href="#i-${esc(name)}"></use></svg>`;
}

export function num(value) {
  return new Intl.NumberFormat('en-US').format(Number(value || 0));
}

export function money(cents, showCents = false) {
  const amount = Number(cents || 0);
  const value = amount / 100;
  const hasCents = Math.round(amount) % 100 !== 0;
  const digits = showCents || hasCents ? 2 : 0;
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value);
}

export function compactMoney(cents) {
  const value = Number(cents || 0) / 100;
  const sign = value < 0 ? '-' : '';
  const absolute = Math.abs(value);
  if (absolute >= 1000000) return `${sign}₱${(absolute / 1000000).toFixed(1)}m`;
  if (absolute >= 1000) {
    const digits = absolute >= 10000 ? 0 : 1;
    return `${sign}₱${(absolute / 1000).toFixed(digits)}k`;
  }
  return `${sign}₱${Math.round(absolute)}`;
}

export function percent(value) {
  const number = Number(value || 0);
  return `${Number.isInteger(number) ? number : number.toFixed(1)}%`;
}

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const text = String(value);
  const match = text.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (!match) {
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4] || 0),
    Number(match[5] || 0),
    Number(match[6] || 0)
  );
}

export function formatDate(value, options = {}) {
  const date = parseDate(value);
  if (!date) return '—';
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return new Intl.DateTimeFormat('en-US', {
    month: options.month || 'short',
    day: options.day || 'numeric',
    year:
      options.year === undefined
        ? sameYear
          ? undefined
          : 'numeric'
        : options.year,
    weekday: options.weekday
  }).format(date);
}

export function formatDateLong(value) {
  return formatDate(value, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

export function formatTime(value) {
  const date = parseDate(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

export function formatDateTime(value) {
  const date = parseDate(value);
  if (!date) return '—';
  return `${formatDate(value)} · ${formatTime(value)}`;
}

export function todayName() {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date());
}

export function todayShort() {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  }).format(new Date());
}

export function relativeDate(value) {
  const date = parseDate(value);
  if (!date) return '—';
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const difference = Math.round((target - start) / 86400000);
  if (difference === 0) return 'Today';
  if (difference === 1) return 'Tomorrow';
  if (difference === -1) return 'Yesterday';
  return formatDate(value);
}

export function dayDiff(fromValue, toValue) {
  const from = parseDate(fromValue);
  const to = parseDate(toValue);
  if (!from || !to) return 0;
  const fromUtc = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const toUtc = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((toUtc - fromUtc) / 86400000);
}

export function daysLeftLabel(days) {
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`;
  if (days === 0) return 'Ends today';
  if (days === 1) return '1 day left';
  return `${days} days left`;
}

export function monthShort(key) {
  const [year, month] = String(key).split('-').map(Number);
  if (!year || !month) return String(key);
  return new Intl.DateTimeFormat('en-US', { month: 'short' }).format(
    new Date(year, month - 1, 1)
  );
}

export function monthLong(key) {
  const [year, month] = String(key).split('-').map(Number);
  if (!year || !month) return String(key);
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(
    new Date(year, month - 1, 1)
  );
}

export function dateParts(value) {
  const date = parseDate(value);
  if (!date) return { day: '—', month: '—', weekday: '—' };
  return {
    day: String(date.getDate()),
    month: new Intl.DateTimeFormat('en-US', { month: 'short' }).format(date),
    weekday: new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date)
  };
}

export function initials(firstName, lastName) {
  return `${String(firstName || '').trim().charAt(0)}${String(lastName || '')
    .trim()
    .charAt(0)}`.toUpperCase();
}

function safeColor(color) {
  return /^#[0-9a-f]{6}$/i.test(String(color || '')) ? color : '#c2410c';
}

export function avatar(person, size = '') {
  const name = initials(person?.first_name, person?.last_name);
  const color = safeColor(person?.avatar_color);
  const photo = person?.photo ? String(person.photo) : '';
  const inner = /^\/images\/[\w.-]+$/.test(photo)
    ? `<img src="${esc(photo)}" alt="" />`
    : esc(name);
  return `<span class="avatar ${size}" style="--avatar:${color}" aria-hidden="true">${inner}</span>`;
}

export function avatarPair(a, b, size = '') {
  return `<span class="avatar-pair">${avatar(a, size)}${avatar(b, size)}</span>`;
}

const MEMBERSHIP_STATES = {
  active: { label: 'Active', tone: 'green' },
  expiring: { label: 'Expiring soon', tone: 'amber' },
  frozen: { label: 'Frozen', tone: 'blue' },
  scheduled: { label: 'Scheduled', tone: 'violet' },
  expired: { label: 'Expired', tone: 'red' },
  cancelled: { label: 'Cancelled', tone: 'gray' },
  no_plan: { label: 'No plan', tone: 'gray' },
  inactive: { label: 'Inactive', tone: 'gray' }
};

export function membershipBadge(state) {
  const info = MEMBERSHIP_STATES[state] || { label: state || 'Unknown', tone: 'gray' };
  return `<span class="badge badge-${info.tone}"><span class="dot"></span>${esc(info.label)}</span>`;
}

export function membershipLabel(state) {
  return (MEMBERSHIP_STATES[state] || { label: state || 'Unknown' }).label;
}

export function subscriptionBadge(status) {
  const map = {
    active: ['Active', 'green'],
    expiring: ['Expiring soon', 'amber'],
    frozen: ['Frozen', 'blue'],
    scheduled: ['Scheduled', 'violet'],
    expired: ['Expired', 'red'],
    cancelled: ['Cancelled', 'gray']
  };
  const [label, tone] = map[status] || [status || 'Unknown', 'gray'];
  return `<span class="badge badge-${tone}">${esc(label)}</span>`;
}

export function paymentBadge(status) {
  return status === 'refunded'
    ? '<span class="badge badge-red">Refunded</span>'
    : '<span class="badge badge-green">Paid</span>';
}

export function bookingBadge(status) {
  const map = {
    booked: ['Booked', 'blue'],
    attended: ['Attended', 'green'],
    no_show: ['No-show', 'red'],
    cancelled: ['Cancelled', 'gray']
  };
  const [label, tone] = map[status] || [status, 'gray'];
  return `<span class="badge badge-${tone}">${esc(label)}</span>`;
}

export function methodLabel(method) {
  return { cash: 'Cash', card: 'Card', bank: 'Bank transfer', online: 'Online' }[method] || method;
}

export function methodIcon(method) {
  return { cash: 'peso', card: 'card', bank: 'archive', online: 'zap' }[method] || 'card';
}

export function actionButton(label, action, options = {}) {
  const classes = options.className || 'btn btn-secondary btn-sm';
  const attrs = [
    `class="${classes}"`,
    `type="button"`,
    `data-action="${esc(action)}"`
  ];
  if (options.id !== undefined) attrs.push(`data-id="${esc(options.id)}"`);
  if (options.memberId !== undefined) attrs.push(`data-member-id="${esc(options.memberId)}"`);
  if (options.subscriptionId !== undefined)
    attrs.push(`data-subscription-id="${esc(options.subscriptionId)}"`);
  if (options.status !== undefined) attrs.push(`data-status="${esc(options.status)}"`);
  if (options.label2 !== undefined) attrs.push(`data-extra="${esc(options.label2)}"`);
  if (options.title) attrs.push(`title="${esc(options.title)}"`);
  if (options.disabled) attrs.push('disabled');
  const iconHtml = options.icon ? icon(options.icon) : '';
  return `<button ${attrs.join(' ')}>${iconHtml}${label ? `<span>${label}</span>` : ''}</button>`;
}

export function emptyState({ iconName = 'info', title, text = '', action = '' }) {
  return `<div class="empty-state">
    <div class="empty-icon">${icon(iconName)}</div>
    <div class="empty-title">${esc(title)}</div>
    ${text ? `<div class="empty-text">${esc(text)}</div>` : ''}
    ${action ? `<div class="empty-action">${action}</div>` : ''}
  </div>`;
}

export function progressBar(percentValue, tone = '') {
  const width = Math.max(0, Math.min(100, Number(percentValue || 0)));
  return `<div class="capacity-bar"><div class="capacity-fill ${tone}" style="width:${width}%"></div></div>`;
}

export function hashLink(path, params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, value);
    }
  }
  const query = search.toString();
  return `#${path}${query ? `?${query}` : ''}`;
}

export function pageLinks(page, pages, path, params = {}) {
  if (pages <= 1) return '';
  const current = Number(page);
  const links = [];
  const add = (number) => {
    links.push(
      `<a class="page-link ${number === current ? 'active' : ''}" href="${hashLink(path, {
        ...params,
        page: number
      })}">${number}</a>`
    );
  };
  const previous = `<a class="page-link ${current <= 1 ? 'disabled' : ''}" href="${hashLink(path, {
    ...params,
    page: Math.max(1, current - 1)
  })}" aria-label="Previous page">‹</a>`;
  const next = `<a class="page-link ${current >= pages ? 'disabled' : ''}" href="${hashLink(path, {
    ...params,
    page: Math.min(pages, current + 1)
  })}" aria-label="Next page">›</a>`;

  const numbers = new Set([1, pages, current, current - 1, current + 1]);
  const sorted = [...numbers].filter((number) => number >= 1 && number <= pages).sort((a, b) => a - b);
  let previousNumber = 0;
  for (const number of sorted) {
    if (previousNumber && number - previousNumber > 1) {
      links.push('<span class="page-link disabled">…</span>');
    }
    add(number);
    previousNumber = number;
  }
  return `<div class="pagination">
    <span class="pagination-info">Page ${current} of ${pages}</span>
    <div class="page-links">${previous}${links.join('')}${next}</div>
  </div>`;
}

/* Toasts */

export function toast(message, type = 'success', title = '') {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const iconName = type === 'error' ? 'alert' : type === 'info' ? 'info' : 'check';
  const heading = title || (type === 'error' ? 'Something needs attention' : type === 'info' ? 'Heads up' : 'Done');
  const element = document.createElement('div');
  element.className = `toast toast-${type}`;
  element.innerHTML = `
    <div class="toast-icon">${icon(iconName)}</div>
    <div class="toast-main">
      <div class="toast-title">${esc(heading)}</div>
      <div class="toast-text">${esc(message)}</div>
    </div>
    <button type="button" class="toast-close" aria-label="Dismiss notification">${icon('x', 'icon-sm')}</button>`;
  root.appendChild(element);
  const remove = () => {
    if (!element.isConnected || element.classList.contains('removing')) return;
    element.classList.add('removing');
    window.setTimeout(() => element.remove(), 180);
  };
  element.querySelector('.toast-close').addEventListener('click', remove);
  window.setTimeout(remove, type === 'error' ? 6500 : 4200);
}

/* Modals */

let activeDialog = null;

export function openModal({ title, subtitle = '', body = '', size = '' }) {
  closeModal();
  const root = document.getElementById('modal-root');
  root.innerHTML = `<dialog class="modal ${size}" id="app-dialog" aria-labelledby="modal-title">
    <div class="modal-panel">
      <header class="modal-head">
        <div>
          <h2 id="modal-title">${esc(title)}</h2>
          ${subtitle ? `<p>${esc(subtitle)}</p>` : ''}
        </div>
        <button type="button" class="icon-btn modal-close" data-dialog-close aria-label="Close dialog">
          ${icon('x')}
        </button>
      </header>
      ${body}
    </div>
  </dialog>`;
  const dialog = root.querySelector('dialog');
  activeDialog = dialog;
  document.body.classList.add('modal-open');
  dialog.addEventListener('click', (event) => {
    if (event.target.closest('[data-dialog-close]')) {
      closeModal();
      return;
    }
    if (event.target === dialog) closeModal();
  });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('modal-open');
    if (root.contains(dialog)) root.innerHTML = '';
    activeDialog = null;
  });
  dialog.showModal();
  window.requestAnimationFrame(() => {
    const target = dialog.querySelector('[autofocus], input:not([type="hidden"]), select, textarea, button');
    if (target) target.focus();
  });
  return dialog;
}

export function closeModal() {
  if (!activeDialog) return;
  const dialog = activeDialog;
  activeDialog = null;
  if (dialog.open) dialog.close();
  else dialog.dispatchEvent(new Event('close'));
}

export function confirmDialog({
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false,
  eyebrow = ''
}) {
  return new Promise((resolve) => {
    let settled = false;
    const dialog = openModal({
      title,
      subtitle: eyebrow,
      size: 'modal-narrow',
      body: `<div class="modal-body">
        <p class="modal-confirm-copy">${message}</p>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-ghost" data-dialog-close>${esc(cancelText)}</button>
        <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-confirm-ok>
          ${esc(confirmText)}
        </button>
      </div>`
    });
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    dialog.querySelector('[data-confirm-ok]').addEventListener('click', () => {
      finish(true);
      closeModal();
    });
    dialog.addEventListener('close', () => finish(false), { once: true });
  });
}

/* Small chart helpers */

export function donutMarkup(segments, centerValue, centerLabel) {
  const colors = ['#f97316', '#c2410c', '#fdba74', '#fed7aa', '#f59e0b', '#d6b8a0'];
  const total = segments.reduce((sum, segment) => sum + Number(segment.value || 0), 0);
  let cursor = 0;
  const stops = [];
  segments.forEach((segment, index) => {
    const value = Number(segment.value || 0);
    if (!value) return;
    const start = (cursor / total) * 100;
    cursor += value;
    const end = (cursor / total) * 100;
    stops.push(`${segment.color || colors[index % colors.length]} ${start}% ${end}%`);
  });
  const background = total
    ? `conic-gradient(${stops.join(', ')})`
    : 'conic-gradient(#fbf1e6 0 100%)';
  const legend = segments
    .map((segment, index) => {
      const value = Number(segment.value || 0);
      const share = total ? Math.round((value / total) * 100) : 0;
      return `<div class="legend-row">
        <span class="legend-dot" style="background:${segment.color || colors[index % colors.length]}"></span>
        <span class="legend-name">${esc(segment.label)}</span>
        <span class="legend-value">${num(value)}</span>
        <span class="legend-share">${share}%</span>
      </div>`;
    })
    .join('');
  return `<div class="donut-layout">
    <div class="donut" style="background:${background}">
      <div class="donut-center">
        <span class="donut-value">${esc(String(centerValue))}</span>
        <span class="donut-label">${esc(centerLabel)}</span>
      </div>
    </div>
    <div class="legend">${legend || '<span class="muted small">No data yet.</span>'}</div>
  </div>`;
}

export function areaChartMarkup(points, labels) {
  const width = 640;
  const height = 168;
  const padX = 12;
  const padTop = 16;
  const padBottom = 20;
  const plotHeight = height - padTop - padBottom;
  const values = points.map((point) => Number(point || 0));
  const max = Math.max(...values, 1);
  const usableWidth = width - padX * 2;
  const step = values.length > 1 ? usableWidth / (values.length - 1) : usableWidth;
  const coordinates = values.map((value, index) => ({
    x: padX + index * step,
    y: padTop + plotHeight - (value / max) * plotHeight
  }));
  const line = coordinates.map((point) => `${point.x},${point.y}`).join(' ');
  const area = values.length
    ? `M ${coordinates[0].x} ${padTop + plotHeight} L ${coordinates
        .map((point) => `${point.x} ${point.y}`)
        .join(' L ')} L ${coordinates[coordinates.length - 1].x} ${padTop + plotHeight} Z`
    : '';
  const grid = [0.25, 0.5, 0.75, 1]
    .map((fraction) => {
      const y = padTop + plotHeight - fraction * plotHeight;
      return `<line x1="${padX}" y1="${y}" x2="${width - padX}" y2="${y}" stroke="#fff2e2" stroke-width="1"/>`;
    })
    .join('');
  const dots = coordinates
    .map(
      (point, index) =>
        `<circle cx="${point.x}" cy="${point.y}" r="2.5" fill="#ffffff" stroke="#ea580c" stroke-width="2"><title>${esc(
          labels[index] || ''
        )}: ${values[index]} visits</title></circle>`
    )
    .join('');
  const labelRow = labels
    .map((label, index) =>
      index % Math.ceil(labels.length / 7) === 0 || index === labels.length - 1
        ? `<span>${esc(label)}</span>`
        : '<span></span>'
    )
    .join('');
  return `<div class="area-chart">
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Attendance over time">
      <defs>
        <linearGradient id="attendance-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#f97316" stop-opacity="0.32"/>
          <stop offset="100%" stop-color="#f97316" stop-opacity="0.02"/>
        </linearGradient>
      </defs>
      ${grid}
      <path d="${area}" fill="url(#attendance-fill)"></path>
      <polyline points="${line}" fill="none" stroke="#ea580c" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></polyline>
      ${dots}
    </svg>
    <div class="area-chart-labels">${labelRow}</div>
  </div>`;
}

export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), delay);
  };
}
