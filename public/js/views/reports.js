import { api } from '../api.js';
import {
  esc,
  icon,
  num,
  money,
  compactMoney,
  percent,
  formatDate,
  methodLabel,
  methodIcon,
  avatar,
  hashLink,
  emptyState,
  donutMarkup,
  areaChartMarkup
} from '../ui.js';

function revenueBars(rows) {
  if (!rows.length) return emptyState({ iconName: 'chart', title: 'No revenue in this period' });
  const max = Math.max(...rows.map((row) => Number(row.amount_cents)), 1);
  const currentMonth = new Date().toISOString().slice(0, 7);
  return `<div class="bar-chart">
    ${rows
      .map((row) => {
        const value = Number(row.amount_cents);
        const height = value > 0 ? Math.max(5, Math.round((value / max) * 100)) : 2;
        const label = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(
          new Date(`${row.month}-01T00:00:00`)
        );
        return `<div class="bar-col" title="${esc(label)}: ${esc(money(value))}">
          <span class="bar-value">${value ? esc(compactMoney(value)) : ''}</span>
          <div class="bar-track"><div class="bar-fill" style="height:${height}%"></div></div>
          <span class="bar-label ${row.month === currentMonth ? 'current' : ''}">${esc(label)}</span>
        </div>`;
      })
      .join('')}
  </div>`;
}

function membershipSegments(breakdown) {
  return [
    { label: 'Active', value: breakdown.active, color: '#f97316' },
    { label: 'Expiring soon', value: breakdown.expiring, color: '#f59e0b' },
    { label: 'Frozen', value: breakdown.frozen, color: '#6f9fd8' },
    { label: 'Scheduled', value: breakdown.scheduled, color: '#a68bd8' },
    { label: 'Expired', value: breakdown.expired, color: '#e08a86' },
    { label: 'No plan', value: breakdown.no_plan, color: '#e0c6aa' },
    { label: 'Inactive', value: breakdown.inactive, color: '#ad9277' }
  ];
}

export async function render(root, query) {
  const months = [3, 6, 12].includes(Number(query.get('months'))) ? Number(query.get('months')) : 6;
  const data = await api.get(`/reports?months=${months}`);
  const kpis = data.kpis;
  const breakdown = data.membership_breakdown;
  const totalMembers = Object.values(breakdown).reduce((sum, value) => sum + Number(value), 0);
  const breakdownSegments = membershipSegments(breakdown);
  const maxMethod = Math.max(...data.methods.map((method) => Number(method.amount_cents)), 1);
  const attendanceLabels = data.attendance.map((row) => formatDate(row.day, { month: 'short', day: 'numeric' }));

  root.innerHTML = `
    <div class="page-head">
      <div>
        <span class="eyebrow accent">${icon('chart')} Business overview</span>
        <h1>Reports</h1>
        <p class="page-sub">Revenue, retention, attendance, and plan performance — calculated live from the front-desk data.</p>
      </div>
      <div class="page-actions">
        <a class="btn btn-secondary" href="/api/export/members.csv">${icon('download')} <span>Members</span></a>
        <a class="btn btn-secondary" href="/api/export/payments.csv">${icon('download')} <span>Payments</span></a>
        <a class="btn btn-secondary" href="/api/export/checkins.csv">${icon('download')} <span>Check-ins</span></a>
      </div>
    </div>

    <div class="toolbar">
      <div class="segmented">
        <a class="${months === 3 ? 'active' : ''}" href="#/reports?months=3">3 months</a>
        <a class="${months === 6 ? 'active' : ''}" href="#/reports?months=6">6 months</a>
        <a class="${months === 12 ? 'active' : ''}" href="#/reports?months=12">12 months</a>
      </div>
      <span class="small muted">As of ${esc(formatDate(data.as_of, { month: 'long', day: 'numeric', year: 'numeric' }))}</span>
    </div>

    <div class="report-kpis">
      <article class="kpi-card" style="--kpi-tint:#fff1e0;--kpi-color:#c2410c">
        <div class="kpi-top"><span class="kpi-label">Revenue · ${months} months</span><span class="kpi-icon">${icon('peso')}</span></div>
        <div class="kpi-value">${money(kpis.revenue_period_cents)}</div>
        <div class="kpi-foot"><span>${money(kpis.revenue_month_cents)} this month</span></div>
      </article>
      <article class="kpi-card" style="--kpi-tint:#eef5f8;--kpi-color:#2e6a8f">
        <div class="kpi-top"><span class="kpi-label">New members</span><span class="kpi-icon">${icon('user-plus')}</span></div>
        <div class="kpi-value">${num(kpis.new_members_period)}</div>
        <div class="kpi-foot"><span>Joined in the last ${months} months</span></div>
      </article>
      <article class="kpi-card" style="--kpi-tint:#fdf3e1;--kpi-color:#a76a0a">
        <div class="kpi-top"><span class="kpi-label">Attendance · 30 days</span><span class="kpi-icon">${icon('activity')}</span></div>
        <div class="kpi-value">${num(kpis.attendance_30)}</div>
        <div class="kpi-foot"><span>${kpis.avg_visits_30} visits per active member</span></div>
      </article>
      <article class="kpi-card" style="--kpi-tint:#f1ebfb;--kpi-color:#6a4a9b">
        <div class="kpi-top"><span class="kpi-label">Active members</span><span class="kpi-icon">${icon('users')}</span></div>
        <div class="kpi-value">${num(kpis.active_members)}</div>
        <div class="kpi-foot"><span>${num(kpis.expiring_soon)} expiring within 7 days</span></div>
      </article>
    </div>

    <div class="report-grid">
      <section class="card chart-card">
        <div class="card-head">
          <div>
            <h3 class="card-title">Revenue trend</h3>
            <p class="card-sub">Paid receipts by month · ${months}-month window</p>
          </div>
          <span class="badge badge-green">${money(kpis.revenue_month_cents)} this month</span>
        </div>
        ${revenueBars(data.revenue)}
      </section>

      <section class="card card-pad">
        <div class="card-head">
          <div>
            <h3 class="card-title">Membership status</h3>
            <p class="card-sub">Current state of every profile</p>
          </div>
        </div>
        ${donutMarkup(breakdownSegments, num(totalMembers), 'Members')}
        <div class="report-note">${icon('info')} Expiring counts memberships ending within the next 7 days. Scheduled memberships start later and become active automatically.</div>
      </section>
    </div>

    <div class="grid grid-2">
      <section class="card chart-card">
        <div class="card-head">
          <div>
            <h3 class="card-title">Attendance · last 14 days</h3>
            <p class="card-sub">Daily check-ins across the gym</p>
          </div>
          <span class="badge badge-lime">${num(data.attendance.reduce((sum, row) => sum + Number(row.count), 0))} visits</span>
        </div>
        ${areaChartMarkup(data.attendance.map((row) => row.count), attendanceLabels)}
      </section>

      <section class="card card-pad">
        <div class="card-head">
          <div>
            <h3 class="card-title">Payment methods</h3>
            <p class="card-sub">Collected in the selected period</p>
          </div>
        </div>
        <div class="method-bars">
          ${
            data.methods.length
              ? data.methods
                  .map(
                    (method) => `<div class="method-row">
                      <span class="method-name">${icon(methodIcon(method.method))} ${esc(methodLabel(method.method))}</span>
                      <div class="method-track"><div class="method-fill" style="width:${Math.max(
                        2,
                        Math.round((Number(method.amount_cents) / maxMethod) * 100)
                      )}%"></div></div>
                      <span class="method-amount">${money(method.amount_cents)}</span>
                    </div>`
                  )
                  .join('')
              : '<span class="muted small">No payments in this period.</span>'
          }
        </div>
        <div class="report-note">${icon('shield')} Refunded payments are excluded from revenue and method totals.</div>
      </section>
    </div>

    <div class="grid grid-2">
      <section class="card card-pad">
        <div class="card-head">
          <div>
            <h3 class="card-title">Plan mix</h3>
            <p class="card-sub">Active memberships by plan</p>
          </div>
          <a class="card-link" href="#/plans">Manage plans</a>
        </div>
        ${
          data.plan_mix.length
            ? donutMarkup(
                data.plan_mix.map((plan, index) => ({
                  label: plan.name,
                  value: plan.count,
                  color: ['#f97316', '#c2410c', '#fdba74', '#f59e0b', '#a68bd8'][index % 5]
                })),
                num(data.plan_mix.reduce((sum, plan) => sum + Number(plan.count), 0)),
                'Active'
              )
            : emptyState({ iconName: 'layers', title: 'No active memberships' })
        }
      </section>

      <section class="card card-pad">
        <div class="card-head">
          <div>
            <h3 class="card-title">Most active members</h3>
            <p class="card-sub">Check-ins in the last 90 days</p>
          </div>
          <a class="card-link" href="#/members">Members</a>
        </div>
        <div class="list-stack">
          ${
            data.top_members.length
              ? data.top_members
                  .map(
                    (member, index) => `<div class="list-row">
                      <span class="badge ${index === 0 ? 'badge-lime' : 'badge-gray'}">#${index + 1}</span>
                      ${avatar(member, 'avatar-sm')}
                      <div class="list-main">
                        <a class="list-name" href="${hashLink(`/members/${member.id}`)}">${esc(member.first_name)} ${esc(
                          member.last_name
                        )}</a>
                        <div class="list-meta">${esc(member.code)}</div>
                      </div>
                      <div class="list-end">
                        <div class="cell-strong">${num(member.visits)}</div>
                        <div class="list-meta">visits</div>
                      </div>
                    </div>`
                  )
                  .join('')
              : emptyState({ iconName: 'activity', title: 'No visits in the last 90 days' })
          }
        </div>
      </section>
    </div>

    <section class="card">
      <div class="card-head" style="padding:22px 22px 0;margin-bottom:12px">
        <div>
          <h3 class="card-title">Class utilization</h3>
          <p class="card-sub">Recent sessions with bookings · attendance and fill rate</p>
        </div>
        <a class="card-link" href="#/classes?scope=past">Past classes</a>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr><th>Class</th><th>Date</th><th>Coach</th><th class="num">Attended</th><th class="num">Reserved</th><th>Fill rate</th></tr>
          </thead>
          <tbody>
            ${
              data.class_utilization.length
                ? data.class_utilization
                    .map(
                      (item) => `<tr>
                        <td><a class="cell-main table-link" href="${hashLink(`/classes/${item.id}`)}">${esc(item.name)}</a></td>
                        <td class="nowrap">${esc(formatDate(item.starts_at, { weekday: 'short' }))} · ${esc(
                          formatDate(item.starts_at)
                        )}</td>
                        <td>${esc(item.coach)}</td>
                        <td class="num">${num(item.attended)}</td>
                        <td class="num">${num(item.reserved)} / ${num(item.capacity)}</td>
                        <td style="min-width:130px">
                          <div class="capacity-bar"><div class="capacity-fill ${
                            item.fill_rate >= 100 ? 'full' : item.fill_rate >= 75 ? 'warn' : ''
                          }" style="width:${Math.min(100, item.fill_rate)}%"></div></div>
                          <div class="capacity-label">${percent(item.fill_rate)}</div>
                        </td>
                      </tr>`
                    )
                    .join('')
                : `<tr><td colspan="6">${emptyState({
                    iconName: 'calendar',
                    title: 'No class attendance yet',
                    text: 'Sessions with bookings will show utilization here.'
                  })}</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </section>

    <div class="report-note" style="margin-top:16px;padding-top:0;border-top:0">
      ${icon('info')} Reports use the server’s local date and update automatically as the team records payments, memberships, and check-ins.
    </div>
  `;

  return 'Reports';
}
