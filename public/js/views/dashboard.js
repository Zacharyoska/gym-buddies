import { api } from '../api.js';
import {
  esc,
  icon,
  num,
  money,
  compactMoney,
  formatDate,
  formatTime,
  relativeDate,
  membershipBadge,
  methodLabel,
  avatar,
  avatarPair,
  hashLink,
  emptyState,
  donutMarkup
} from '../ui.js';
import { lifterBackground } from '../lifter.js';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function revenueBars(rows) {
  if (!rows.length) return emptyState({ iconName: 'chart', title: 'No revenue yet' });
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

export async function render(root) {
  const data = await api.get('/dashboard');
  const { kpis, user } = data;
  const firstName = (user?.full_name || '').split(' ')[0] || 'there';
  const previous = Number(kpis.revenue_previous_month_cents || 0);
  const current = Number(kpis.revenue_month_cents || 0);
  const change = previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;
  const changeLabel =
    change === null
      ? 'No prior month revenue'
      : `${change >= 0 ? '+' : ''}${change}% vs last month`;
  const changeTone = change === null ? '' : change >= 0 ? 'positive' : 'negative';
  const breakdown = data.membership_breakdown;
  const totalMembers = Object.values(breakdown).reduce((sum, value) => sum + Number(value), 0);
  const liveCount = Number(kpis.live_checkins || 0);

  root.innerHTML = `
    <section class="hero-panel">
      ${lifterBackground('lifter-hero')}
      <div class="hero-copy">
        <span class="eyebrow">${icon('activity')} ${esc(formatDate(data.as_of, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }))}</span>
        <h1>${esc(greeting())}, ${esc(firstName)}. <em>${num(liveCount)}</em> ${liveCount === 1 ? 'member is' : 'members are'} training right now.</h1>
        <p>Everything the front desk needs today: check-ins, renewals, payments, classes, and the buddy board — all in one place.</p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="#/checkins">${icon('check-circle')} <span>Check in a member</span></a>
          <button class="btn btn-secondary" type="button" data-action="add-member">${icon('user-plus')} <span>Add member</span></button>
          <a class="btn btn-secondary" href="#/members">${icon('users')} <span>View members</span></a>
        </div>
      </div>
      <div class="hero-figure">
        <div class="hero-live">
          <span class="hero-live-number">${num(liveCount)}</span>
          <span class="hero-live-label">In the gym now</span>
          <span class="live-dot" style="margin-top:12px"></span>
        </div>
      </div>
    </section>

    <div class="kpi-grid">
      <article class="kpi-card" style="--kpi-tint:#fff1e0;--kpi-color:#c2410c">
        <div class="kpi-top">
          <span class="kpi-label">Active memberships</span>
          <span class="kpi-icon">${icon('users')}</span>
        </div>
        <div class="kpi-value">${num(kpis.active_members)}</div>
        <div class="kpi-foot">
          <span>${num(kpis.total_members)} active profiles</span>
          <a class="card-link kpi-link" href="#/members?status=active">View</a>
        </div>
      </article>
      <article class="kpi-card" style="--kpi-tint:#fff4e0;--kpi-color:#ea580c">
        <div class="kpi-top">
          <span class="kpi-label">Revenue this month</span>
          <span class="kpi-icon">${icon('peso')}</span>
        </div>
        <div class="kpi-value">${money(current)}</div>
        <div class="kpi-foot">
          ${change === null ? '' : `<span class="delta ${changeTone}">${icon(change >= 0 ? 'trend-up' : 'activity')} ${esc(changeLabel)}</span>`}
          ${change === null ? `<span>${esc(changeLabel)}</span>` : ''}
        </div>
      </article>
      <article class="kpi-card" style="--kpi-tint:#eef5f8;--kpi-color:#2e6a8f">
        <div class="kpi-top">
          <span class="kpi-label">Check-ins today</span>
          <span class="kpi-icon">${icon('check-circle')}</span>
        </div>
        <div class="kpi-value">${num(kpis.checkins_today)}</div>
        <div class="kpi-foot"><span class="live-dot"></span><span>${num(liveCount)} currently checked in</span></div>
      </article>
      <article class="kpi-card" style="--kpi-tint:#fdf3e1;--kpi-color:#a76a0a">
        <div class="kpi-top">
          <span class="kpi-label">Expiring in 7 days</span>
          <span class="kpi-icon">${icon('clock')}</span>
        </div>
        <div class="kpi-value">${num(kpis.expiring_soon)}</div>
        <div class="kpi-foot">
          <span>Renewals to follow up</span>
          <a class="card-link kpi-link" href="#/members?status=expiring">View</a>
        </div>
      </article>
    </div>

    <div class="grid grid-main-side">
      <section class="card chart-card">
        <div class="card-head">
          <div>
            <h3 class="card-title">Revenue</h3>
            <p class="card-sub">Collected payments over the last 6 months</p>
          </div>
          <a class="card-link" href="#/reports">Full report ${icon('chevron-right')}</a>
        </div>
        ${revenueBars(data.revenue)}
      </section>
      <section class="card card-pad">
        <div class="card-head">
          <div>
            <h3 class="card-title">Membership mix</h3>
            <p class="card-sub">Where every member stands right now</p>
          </div>
        </div>
        ${donutMarkup(membershipSegments(breakdown), num(totalMembers), 'Members')}
      </section>
    </div>

    <div class="grid grid-2">
      <section class="card card-pad">
        <div class="card-head">
          <div>
            <h3 class="card-title">Expiring memberships</h3>
            <p class="card-sub">Next 7 days · reach out before they lapse</p>
          </div>
          <a class="card-link" href="#/members?status=expiring">All expiring</a>
        </div>
        <div class="list-stack">
          ${
            data.expiring.length
              ? data.expiring
                  .map(
                    (item) => `<div class="list-row">
                      ${avatar(item, 'avatar-sm')}
                      <div class="list-main">
                        <a class="list-name" href="${hashLink(`/members/${item.member_id}`)}">${esc(
                          item.first_name
                        )} ${esc(item.last_name)}</a>
                        <div class="list-meta">${esc(item.plan_name)} · ${esc(item.code)}</div>
                      </div>
                      <div class="list-end">
                        <span class="expiry-pill ${item.days_left <= 2 ? 'urgent' : ''}">${
                          item.days_left === 0 ? 'Ends today' : `${item.days_left} day${item.days_left === 1 ? '' : 's'} left`
                        }</span>
                        <div class="list-meta" style="margin-top:3px">${esc(formatDate(item.end_date))}</div>
                      </div>
                    </div>`
                  )
                  .join('')
              : emptyState({
                  iconName: 'check-circle',
                  title: 'No renewals due',
                  text: 'No active memberships end in the next seven days.'
                })
          }
        </div>
      </section>

      <section class="card card-pad">
        <div class="card-head">
          <div>
            <h3 class="card-title">In the gym now</h3>
            <p class="card-sub">Live check-ins · ${num(liveCount)} on the floor</p>
          </div>
          <a class="card-link" href="#/checkins">Front desk</a>
        </div>
        <div class="list-stack">
          ${
            data.live.length
              ? data.live
                  .map(
                    (item) => `<div class="list-row">
                      ${avatar(item, 'avatar-sm')}
                      <div class="list-main">
                        <a class="list-name" href="${hashLink(`/members/${item.member_id}`)}">${esc(
                          item.first_name
                        )} ${esc(item.last_name)}</a>
                        <div class="list-meta">Since ${esc(formatTime(item.checked_in_at))}${
                          item.plan_name ? ` · ${esc(item.plan_name)}` : ''
                        }</div>
                      </div>
                      <button class="btn btn-secondary btn-xs" type="button" data-action="checkout" data-id="${
                        item.checkin_id
                      }">${icon('log-out', 'icon-sm')} Check out</button>
                    </div>`
                  )
                  .join('')
              : emptyState({
                  iconName: 'users',
                  title: 'The floor is quiet',
                  text: 'The first check-in of the day will appear here.'
                })
          }
        </div>
      </section>
    </div>

    <div class="grid grid-2">
      <section class="card card-pad">
        <div class="card-head">
          <div>
            <h3 class="card-title">Today's classes</h3>
            <p class="card-sub">${data.today_classes.length} session${data.today_classes.length === 1 ? '' : 's'} on the schedule</p>
          </div>
          <a class="card-link" href="#/classes">Full schedule</a>
        </div>
        ${
          data.today_classes.length
            ? data.today_classes
                .map((item) => {
                  const fill = Math.min(100, Math.round((Number(item.booked) / Number(item.capacity)) * 100));
                  return `<div class="mini-class">
                    <div class="class-time">
                      <strong>${esc(formatTime(item.starts_at))}</strong>
                      <span>${esc(item.duration_min)} min</span>
                    </div>
                    <div class="mini-class-main">
                      <a class="list-name" href="${hashLink(`/classes/${item.id}`)}">${esc(item.name)}</a>
                      <div class="list-meta">${esc(item.coach)}${item.room ? ` · ${esc(item.room)}` : ''}</div>
                    </div>
                    <div class="class-fill">
                      <div class="capacity-bar"><div class="capacity-fill ${
                        fill >= 100 ? 'full' : fill >= 75 ? 'warn' : ''
                      }" style="width:${fill}%"></div></div>
                      <div class="capacity-label">${item.booked}/${item.capacity} booked</div>
                    </div>
                  </div>`;
                })
                .join('')
            : emptyState({ iconName: 'calendar', title: 'No classes today', text: 'Add a session to get the schedule going.' })
        }
      </section>

      <section class="card card-pad">
        <div class="card-head">
          <div>
            <h3 class="card-title">Buddy leaders</h3>
            <p class="card-sub">Most shared workouts in the last 30 days</p>
          </div>
          <a class="card-link" href="#/buddies">Buddy board</a>
        </div>
        ${
          data.buddy_leaders.length
            ? data.buddy_leaders
                .map(
                  (pair, index) => `<div class="buddy-preview">
                    <span class="badge badge-lime">#${index + 1}</span>
                    ${avatarPair(pair.a, pair.b, 'avatar-sm')}
                    <div class="buddy-preview-main">
                      <div class="list-name">${esc(pair.a.first_name)} + ${esc(pair.b.first_name)}</div>
                      <div class="list-meta">${pair.streak_weeks} week streak · goal ${pair.weekly_goal}/week</div>
                    </div>
                    <div class="buddy-shared">
                      <strong>${num(pair.shared_30)}</strong>
                      <span>shared</span>
                    </div>
                  </div>`
                )
                .join('')
            : emptyState({
                iconName: 'users',
                title: 'No buddy pairs yet',
                text: 'Pair two members so they can keep each other accountable.'
              })
        }
      </section>
    </div>

    <section class="card">
      <div class="card-head" style="padding:22px 22px 0;margin-bottom:14px">
        <div>
          <h3 class="card-title">Recent payments</h3>
          <p class="card-sub">Latest transactions across the desk</p>
        </div>
        <a class="card-link" href="#/payments">All payments</a>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr><th>Member</th><th>Receipt</th><th>Description</th><th class="num">Amount</th><th>Method</th><th>When</th><th></th></tr>
          </thead>
          <tbody>
            ${
              data.recent_payments.length
                ? data.recent_payments
                    .map(
                      (payment) => `<tr>
                        <td>
                          <a class="person-cell" href="${hashLink(`/members/${payment.member_id}`)}">
                            ${avatar(payment, 'avatar-sm')}
                            <span><span class="cell-main">${esc(payment.first_name)} ${esc(payment.last_name)}</span></span>
                          </a>
                        </td>
                        <td><span class="cell-sub" style="margin:0;font-family:var(--mono)">${esc(payment.receipt_no)}</span></td>
                        <td>${esc(payment.description || 'Payment')}</td>
                        <td class="num cell-strong">${money(payment.amount_cents, true)}</td>
                        <td>${esc(methodLabel(payment.method))}</td>
                        <td class="nowrap">${esc(relativeDate(payment.paid_at))}</td>
                        <td class="text-right">
                          <button class="icon-btn icon-btn-sm" type="button" title="View receipt" data-action="view-receipt" data-id="${payment.id}">${icon('receipt', 'icon-sm')}</button>
                        </td>
                      </tr>`
                    )
                    .join('')
                : `<tr><td colspan="7">${emptyState({ iconName: 'card', title: 'No payments yet' })}</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </section>
  `;
  return 'Dashboard';
}
