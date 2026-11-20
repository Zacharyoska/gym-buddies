import { api } from '../api.js';
import {
  esc,
  icon,
  num,
  money,
  formatDateTime,
  relativeDate,
  paymentBadge,
  methodLabel,
  methodIcon,
  avatar,
  hashLink,
  pageLinks,
  emptyState
} from '../ui.js';

const METHODS = [
  ['', 'All methods'],
  ['card', 'Card'],
  ['cash', 'Cash'],
  ['online', 'Online'],
  ['bank', 'Bank transfer']
];

const STATUSES = [
  ['', 'All statuses'],
  ['paid', 'Paid'],
  ['refunded', 'Refunded']
];

export async function render(root, query) {
  const page = Math.max(1, Number(query.get('page')) || 1);
  const search = query.get('search') || '';
  const method = query.get('method') || '';
  const status = query.get('status') || '';
  const from = query.get('from') || '';
  const to = query.get('to') || '';
  const params = new URLSearchParams({ page, limit: 15 });
  if (search) params.set('search', search);
  if (method) params.set('method', method);
  if (status) params.set('status', status);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const data = await api.get(`/payments?${params.toString()}`);
  const summary = data.summary;
  const keep = { search, method, status, from, to };

  root.innerHTML = `
    <div class="page-head">
      <div>
        <span class="eyebrow accent">${icon('card')} Money in</span>
        <h1>Payments</h1>
        <p class="page-sub">Receipts, memberships, retail, and refunds. Every payment gets a numbered receipt the member can keep.</p>
      </div>
      <div class="page-actions">
        <a class="btn btn-secondary" href="/api/export/payments.csv">${icon('download')} <span>Export CSV</span></a>
        <button class="btn btn-primary" type="button" data-action="record-payment">${icon('plus')} <span>Record payment</span></button>
      </div>
    </div>

    <div class="kpi-grid">
      <article class="kpi-card" style="--kpi-tint:#fff1e0;--kpi-color:#c2410c">
        <div class="kpi-top"><span class="kpi-label">This month</span><span class="kpi-icon">${icon('peso')}</span></div>
        <div class="kpi-value">${money(summary.month_cents)}</div>
        <div class="kpi-foot"><span>Collected so far in ${esc(
          new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date())
        )}</span></div>
      </article>
      <article class="kpi-card" style="--kpi-tint:#eef5f8;--kpi-color:#2e6a8f">
        <div class="kpi-top"><span class="kpi-label">Last 30 days</span><span class="kpi-icon">${icon('trend-up')}</span></div>
        <div class="kpi-value">${money(summary.last_30_cents)}</div>
        <div class="kpi-foot"><span>Rolling revenue</span></div>
      </article>
      <article class="kpi-card" style="--kpi-tint:#fdf3e1;--kpi-color:#a76a0a">
        <div class="kpi-top"><span class="kpi-label">Filtered total</span><span class="kpi-icon">${icon('receipt')}</span></div>
        <div class="kpi-value">${money(summary.filtered_paid_cents)}</div>
        <div class="kpi-foot"><span>${num(data.total)} matching receipt${data.total === 1 ? '' : 's'}</span></div>
      </article>
      <article class="kpi-card" style="--kpi-tint:#fdeceb;--kpi-color:#b93e3e">
        <div class="kpi-top"><span class="kpi-label">Refunded this month</span><span class="kpi-icon">${icon('refresh')}</span></div>
        <div class="kpi-value">${money(summary.refunded_month_cents)}</div>
        <div class="kpi-foot"><span>${money(summary.filtered_refunded_cents)} in current filter</span></div>
      </article>
    </div>

    <section class="card">
      <form id="payment-filter-form" class="filter-bar" style="padding:18px 18px 0;margin-bottom:14px">
        <div class="search-box">
          ${icon('search')}
          <input name="search" type="search" value="${esc(search)}" placeholder="Member, receipt, description…" aria-label="Search payments" />
        </div>
        <select class="select-mini" name="method" aria-label="Filter by method">
          ${METHODS.map(
            ([value, label]) => `<option value="${value}" ${method === value ? 'selected' : ''}>${label}</option>`
          ).join('')}
        </select>
        <select class="select-mini" name="status" aria-label="Filter by status">
          ${STATUSES.map(
            ([value, label]) => `<option value="${value}" ${status === value ? 'selected' : ''}>${label}</option>`
          ).join('')}
        </select>
        <input class="input" name="from" type="date" value="${esc(from)}" aria-label="From date" style="width:145px;height:34px;font-size:11.5px" />
        <input class="input" name="to" type="date" value="${esc(to)}" aria-label="To date" style="width:145px;height:34px;font-size:11.5px" />
        <button class="btn btn-dark btn-sm" type="submit">${icon('search', 'icon-sm')} Apply</button>
        ${
          search || method || status || from || to
            ? `<a class="btn btn-ghost btn-sm" href="#/payments">Clear</a>`
            : ''
        }
      </form>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Receipt</th>
              <th>Member</th>
              <th>Description</th>
              <th>Method</th>
              <th>Status</th>
              <th>Date</th>
              <th class="num">Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${
              data.items.length
                ? data.items
                    .map(
                      (payment) => `<tr>
                        <td>
                          <span class="cell-main" style="font-family:var(--mono);font-size:11px">${esc(
                            payment.receipt_no
                          )}</span>
                          <span class="cell-sub">${esc(relativeDate(payment.paid_at))}</span>
                        </td>
                        <td>
                          <a class="person-cell" href="${hashLink(`/members/${payment.member_id}`)}">
                            ${avatar(payment, 'avatar-sm')}
                            <span>
                              <span class="cell-main">${esc(payment.first_name)} ${esc(payment.last_name)}</span>
                              <span class="cell-sub">${esc(payment.code)}</span>
                            </span>
                          </a>
                        </td>
                        <td>
                          <span class="cell-main">${esc(payment.description || 'Payment')}</span>
                          <span class="cell-sub">${esc(payment.plan_name || 'General')}</span>
                        </td>
                        <td><span class="inline">${icon(methodIcon(payment.method), 'icon-sm')} ${esc(methodLabel(payment.method))}</span></td>
                        <td>${paymentBadge(payment.status)}</td>
                        <td class="nowrap">${esc(formatDateTime(payment.paid_at))}</td>
                        <td class="num cell-strong">${money(payment.amount_cents, true)}</td>
                        <td>
                          <div class="row-actions">
                            <button class="icon-btn icon-btn-sm" type="button" title="View receipt" data-action="view-receipt" data-id="${payment.id}">${icon('receipt', 'icon-sm')}</button>
                            ${
                              payment.status === 'paid'
                                ? `<button class="icon-btn icon-btn-sm" type="button" title="Refund payment" data-action="refund-payment" data-id="${payment.id}">${icon('refresh', 'icon-sm')}</button>`
                                : ''
                            }
                          </div>
                        </td>
                      </tr>`
                    )
                    .join('')
                : `<tr><td colspan="8">${emptyState({
                    iconName: 'card',
                    title: 'No payments match this view',
                    text: 'Try clearing the filters, or record a new payment.',
                    action:
                      '<button class="btn btn-primary btn-sm" type="button" data-action="record-payment">Record payment</button>'
                  })}</td></tr>`
            }
          </tbody>
        </table>
      </div>
      <div style="padding:0 18px 16px">
        ${pageLinks(data.page, data.pages, '/payments', keep)}
      </div>
    </section>
  `;

  root.querySelector('#payment-filter-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    window.location.hash = hashLink('/payments', values);
  });

  return 'Payments';
}
