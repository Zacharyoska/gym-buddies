import { api } from '../api.js';
import { fillQr } from '../qr.js';
import {
  esc,
  icon,
  num,
  money,
  formatDate,
  formatDateTime,
  formatTime,
  relativeDate,
  daysLeftLabel,
  membershipBadge,
  membershipLabel,
  subscriptionBadge,
  paymentBadge,
  bookingBadge,
  methodLabel,
  avatar,
  hashLink,
  pageLinks,
  emptyState
} from '../ui.js';

const FILTERS = [
  ['all', 'All'],
  ['active', 'Active'],
  ['expiring', 'Expiring'],
  ['frozen', 'Frozen'],
  ['scheduled', 'Scheduled'],
  ['expired', 'Expired'],
  ['no_plan', 'No plan'],
  ['inactive', 'Inactive']
];

function statMini(label, value, sub = '') {
  return `<div class="stat-mini">
    <div class="stat-mini-label">${esc(label)}</div>
    <div class="stat-mini-value">${value}</div>
    ${sub ? `<div class="stat-mini-sub">${esc(sub)}</div>` : ''}
  </div>`;
}

function detailRows(items, columns, emptyTitle, emptyText = '') {
  if (!items.length) return emptyState({ iconName: 'info', title: emptyTitle, text: emptyText });
  return `<div class="table-wrap">
    <table class="table">
      <thead><tr>${columns
        .map((column) => `<th class="${column.align === 'right' ? 'num' : ''}">${esc(column.label)}</th>`)
        .join('')}</tr></thead>
      <tbody>
        ${items
          .map(
            (row) =>
              `<tr>${columns
                .map(
                  (column) =>
                    `<td class="${column.align === 'right' ? 'num' : ''}">${column.render(row)}</td>`
                )
                .join('')}</tr>`
          )
          .join('')}
      </tbody>
    </table>
  </div>`;
}

export async function render(root, query) {
  const page = Math.max(1, Number(query.get('page')) || 1);
  const search = query.get('search') || '';
  const status = query.get('status') || 'all';
  const sort = query.get('sort') || 'newest';
  const params = new URLSearchParams({ page, limit: 12 });
  if (search) params.set('search', search);
  if (status !== 'all') params.set('status', status);
  if (sort !== 'newest') params.set('sort', sort);
  const data = await api.get(`/members?${params.toString()}`);
  const summary = data.summary;

  const keep = { search, sort, status: status === 'all' ? '' : status };

  root.innerHTML = `
    <div class="page-head">
      <div>
        <span class="eyebrow accent">${icon('users')} Member directory</span>
        <h1>Members</h1>
        <p class="page-sub">Every profile, membership, and visit in one place. Search by name, member code, email, or phone.</p>
      </div>
      <div class="page-actions">
        <a class="btn btn-secondary" href="/api/export/members.csv">${icon('download')} <span>Export CSV</span></a>
        <button class="btn btn-primary" type="button" data-action="add-member">${icon('user-plus')} <span>Add member</span></button>
      </div>
    </div>

    <div class="filter-bar">
      <div class="chips-row">
        ${FILTERS.map(([key, label]) => {
          const count = key === 'all' ? summary.all : summary[key];
          const current = status === key;
          return `<a class="filter-chip ${current ? 'active' : ''}" href="${hashLink('/members', {
            status: key === 'all' ? '' : key,
            search,
            sort
          })}">${esc(label)} <span class="count">${num(count)}</span></a>`;
        }).join('')}
      </div>
    </div>

    <section class="card">
      <div class="toolbar" style="padding:18px 18px 0;margin-bottom:12px">
        <form id="member-search-form" class="search-box" role="search">
          ${icon('search')}
          <input name="search" type="search" value="${esc(search)}" placeholder="Search members…" aria-label="Search members" />
        </form>
        <div class="inline">
          <select class="select-mini" id="member-sort" aria-label="Sort members">
            <option value="newest" ${sort === 'newest' ? 'selected' : ''}>Newest first</option>
            <option value="name" ${sort === 'name' ? 'selected' : ''}>Name A–Z</option>
          </select>
        </div>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Plan</th>
              <th>Membership</th>
              <th>Last visit</th>
              <th>Joined</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${
              data.items.length
                ? data.items
                    .map(
                      (member) => `<tr>
                        <td>
                          <a class="person-cell" href="${hashLink(`/members/${member.id}`)}">
                            ${avatar(member)}
                            <span>
                              <span class="cell-main">${esc(member.first_name)} ${esc(member.last_name)}</span>
                              <span class="cell-sub">${esc(member.code)}${member.email ? ` · ${esc(member.email)}` : ''}</span>
                            </span>
                          </a>
                        </td>
                        <td>
                          <span class="cell-main">${esc(member.plan_name || '—')}</span>
                          <span class="cell-sub">${
                            member.end_date ? `Ends ${esc(formatDate(member.end_date))}` : 'No membership'
                          }</span>
                        </td>
                        <td>${membershipBadge(member.membership_state)}</td>
                        <td>
                          <span class="cell-main">${esc(member.last_visit ? relativeDate(member.last_visit) : 'Never')}</span>
                          <span class="cell-sub">${num(member.total_visits)} total visits</span>
                        </td>
                        <td class="nowrap">${esc(formatDate(member.joined_on))}</td>
                        <td>
                          <div class="row-actions">
                            <a class="btn btn-secondary btn-sm" href="${hashLink(`/members/${member.id}`)}">View</a>
                            <button class="icon-btn icon-btn-sm" type="button" title="Sell membership" data-action="add-subscription" data-id="${member.id}">${icon('layers', 'icon-sm')}</button>
                            <button class="icon-btn icon-btn-sm" type="button" title="Record payment" data-action="record-payment" data-id="${member.id}">${icon('card', 'icon-sm')}</button>
                          </div>
                        </td>
                      </tr>`
                    )
                    .join('')
                : `<tr><td colspan="6">${emptyState({
                    iconName: 'users',
                    title: 'No members match this view',
                    text: 'Try a different filter or search term, or add a new member.',
                    action:
                      '<button class="btn btn-primary btn-sm" type="button" data-action="add-member">Add member</button>'
                  })}</td></tr>`
            }
          </tbody>
        </table>
      </div>
      <div style="padding:0 18px 16px">
        ${pageLinks(data.page, data.pages, '/members', keep)}
      </div>
    </section>
  `;

  root.querySelector('#member-search-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get('search') || '';
    window.location.hash = hashLink('/members', { status: status === 'all' ? '' : status, search: value, sort });
  });

  root.querySelector('#member-sort')?.addEventListener('change', (event) => {
    window.location.hash = hashLink('/members', {
      status: status === 'all' ? '' : status,
      search,
      sort: event.target.value
    });
  });

  return 'Members';
}

export async function renderDetail(root, query, memberId) {
  const detail = await api.get(`/members/${memberId}`);
  const member = detail.member;
  const membership = detail.membership;
  const state = detail.membership_state;
  const stats = detail.stats;
  const isActiveMember = member.status === 'active';
  const canCheckIn = isActiveMember && ['active', 'expiring'].includes(state);

  const passMarkup = membership
    ? `<div class="membership-pass">
        <div class="pass-head">
          <div>
            <div class="pass-label">Current membership</div>
            <div class="pass-plan">${esc(membership.plan_name)}</div>
          </div>
          <span class="pass-state">${esc(membershipLabel(membership.state))}</span>
        </div>
        <div class="pass-dates">
          <div>
            <div class="pass-date-label">Started</div>
            <div class="pass-date-value">${esc(formatDate(membership.start_date))}</div>
          </div>
          <div>
            <div class="pass-date-label">Ends</div>
            <div class="pass-date-value">${esc(formatDate(membership.end_date))}</div>
          </div>
          <div>
            <div class="pass-date-label">Remaining</div>
            <div class="pass-date-value">${esc(daysLeftLabel(membership.days_left))}</div>
          </div>
        </div>
        <div class="pass-progress">
          <div class="pass-progress-track"><div class="pass-progress-fill" style="width:${Math.max(
            0,
            Math.min(100, membership.progress)
          )}%"></div></div>
          <div class="pass-progress-label"><span>${esc(formatDate(membership.start_date))}</span><span>${esc(
            formatDate(membership.end_date)
          )}</span></div>
        </div>
        <div class="pass-meta">
          <div><span>Price</span><strong>${money(membership.price_cents)}</strong></div>
          <div><span>Paid</span><strong>${money(membership.paid_cents)}</strong></div>
          <div><span>Balance</span><strong>${money(membership.balance_cents)}</strong></div>
        </div>
        <div class="pass-actions">
          ${
            ['active', 'expiring', 'expired'].includes(membership.state)
              ? `<button class="btn btn-secondary btn-sm" type="button" data-action="add-subscription" data-id="${member.id}">${icon('refresh', 'icon-sm')} Renew</button>`
              : ''
          }
          ${
            membership.balance_cents > 0
              ? `<button class="btn btn-secondary btn-sm" type="button" data-action="record-payment" data-id="${member.id}" data-subscription-id="${membership.id}">${icon('card', 'icon-sm')} Collect balance</button>`
              : ''
          }
          ${
            membership.status === 'active'
              ? `<button class="btn btn-ghost btn-sm" type="button" data-action="freeze-sub" data-id="${membership.id}">${icon('pause', 'icon-sm')} Freeze</button>`
              : ''
          }
          ${
            membership.status === 'frozen'
              ? `<button class="btn btn-secondary btn-sm" type="button" data-action="unfreeze-sub" data-id="${membership.id}">${icon('play', 'icon-sm')} Resume</button>`
              : ''
          }
          ${
            ['active', 'frozen', 'scheduled'].includes(membership.status)
              ? `<button class="btn btn-ghost btn-sm" type="button" data-action="cancel-sub" data-id="${membership.id}">${icon('ban', 'icon-sm')} Cancel</button>`
              : ''
          }
        </div>
      </div>`
    : `<div class="card card-pad" style="background:linear-gradient(135deg,#48240f,#6b3716);color:#fff2e2;border:none">
        <div class="card-head" style="margin-bottom:8px">
          <div>
            <h3 class="card-title" style="color:#fff4e8">No active membership</h3>
            <p class="card-sub" style="color:#e6cdb4">Sell a plan to get ${esc(member.first_name)} training.</p>
          </div>
          <span class="badge badge-lime">${esc(membershipLabel(state))}</span>
        </div>
        <button class="btn btn-primary btn-sm" type="button" style="margin-top:10px" data-action="add-subscription" data-id="${member.id}">${icon('plus', 'icon-sm')} Sell membership</button>
      </div>`;

  root.innerHTML = `
    <a class="back-link" href="#/members">${icon('arrow-left')} All members</a>

    <section class="profile-hero">
      ${avatar(member, 'avatar-xl')}
      <div class="profile-main">
        <div class="profile-title-row">
          <h1>${esc(member.first_name)} ${esc(member.last_name)}</h1>
          ${membershipBadge(state)}
        </div>
        <div class="profile-meta">
          <span>${icon('shield')} ${esc(member.code)}</span>
          <span>${icon('calendar')} Member since ${esc(formatDate(member.joined_on))}</span>
          ${member.email ? `<span>${icon('mail')} ${esc(member.email)}</span>` : ''}
          ${member.phone ? `<span>${icon('phone')} ${esc(member.phone)}</span>` : ''}
        </div>
        <div class="profile-actions">
          <button class="btn btn-secondary btn-sm" type="button" data-action="edit-member" data-id="${member.id}">${icon('edit')} Edit profile</button>
          <button class="btn btn-primary btn-sm" type="button" data-action="add-subscription" data-id="${member.id}">${icon('layers')} Sell membership</button>
          <button class="btn btn-secondary btn-sm" type="button" data-action="record-payment" data-id="${member.id}">${icon('card')} Record payment</button>
          ${
            canCheckIn
              ? `<button class="btn btn-secondary btn-sm" type="button" data-action="checkin-member" data-id="${member.id}">${icon('check-circle')} Check in</button>`
              : ''
          }
          ${
            isActiveMember
              ? `<button class="btn btn-ghost btn-sm" type="button" data-action="archive-member" data-id="${member.id}">${icon('archive')} Archive</button>`
              : `<button class="btn btn-secondary btn-sm" type="button" data-action="restore-member" data-id="${member.id}">${icon('refresh')} Restore profile</button>`
          }
        </div>
      </div>
      <div class="profile-hero-side">
        <span class="tag">${esc(member.status === 'active' ? 'Active profile' : 'Inactive profile')}</span>
        <span class="small muted">Member ID #${member.id}</span>
      </div>
    </section>

    <div class="stat-mini-grid">
      ${statMini('Total visits', num(stats.total_visits), stats.streak_weeks ? `${stats.streak_weeks}-week streak` : 'No current streak')}
      ${statMini('Visits this month', num(stats.visits_month), `${num(stats.visits_this_week)} this week`)}
      ${statMini('Member spend', money(stats.total_spend_cents), 'Lifetime payments')}
      ${statMini('Last visit', esc(stats.last_visit ? relativeDate(stats.last_visit) : 'Never'), stats.last_visit ? formatTime(stats.last_visit) : 'No check-ins yet')}
    </div>

    <div class="detail-grid">
      <div class="stack" style="gap:18px">
        ${passMarkup}

        <section class="card history-card">
          <div class="history-head">
            <h3>Membership history</h3>
            <button class="btn btn-secondary btn-xs" type="button" data-action="add-subscription" data-id="${member.id}">${icon('plus', 'icon-sm')} New</button>
          </div>
          ${detailRows(
            detail.subscriptions,
            [
              {
                label: 'Plan',
                render: (row) => `<span class="cell-strong">${esc(row.plan_name)}</span><span class="cell-sub">${esc(
                  row.duration_days
                )} days</span>`
              },
              {
                label: 'Period',
                render: (row) =>
                  `<span class="nowrap">${esc(formatDate(row.start_date))} – ${esc(formatDate(row.end_date))}</span>`
              },
              { label: 'Status', render: (row) => subscriptionBadge(row.status) },
              { label: 'Price', align: 'right', render: (row) => money(row.price_cents) },
              {
                label: 'Paid',
                align: 'right',
                render: (row) => `<span class="${Number(row.paid_cents) >= Number(row.price_cents) ? 'text-green' : 'text-amber'}">${money(
                  row.paid_cents
                )}</span>`
              }
            ],
            'No memberships yet',
            'Sell a membership to start this member’s history.'
          )}
        </section>

        <section class="card history-card">
          <div class="history-head">
            <h3>Payments</h3>
            <a class="card-link" href="#/payments?search=${encodeURIComponent(member.code)}">All payments ${icon('chevron-right')}</a>
          </div>
          ${detailRows(
            detail.payments.slice(0, 10),
            [
              {
                label: 'Receipt',
                render: (row) =>
                  `<span class="cell-strong" style="font-family:var(--mono);font-size:11px">${esc(row.receipt_no)}</span><span class="cell-sub">${esc(
                    formatDate(row.paid_at)
                  )}</span>`
              },
              { label: 'Description', render: (row) => esc(row.description || 'Payment') },
              { label: 'Method', render: (row) => esc(methodLabel(row.method)) },
              { label: 'Status', render: (row) => paymentBadge(row.status) },
              { label: 'Amount', align: 'right', render: (row) => `<span class="cell-strong">${money(row.amount_cents, true)}</span>` },
              {
                label: '',
                align: 'right',
                render: (row) =>
                  `<button class="icon-btn icon-btn-sm" type="button" title="Receipt" data-action="view-receipt" data-id="${row.id}">${icon('receipt', 'icon-sm')}</button>`
              }
            ],
            'No payments yet',
            'Payments recorded for this member will appear here.'
          )}
        </section>

        <section class="card history-card">
          <div class="history-head">
            <h3>Check-in history</h3>
            <span class="small muted">Latest ${Math.min(10, detail.checkins.length)} of ${detail.checkins.length}</span>
          </div>
          ${detailRows(
            detail.checkins.slice(0, 10),
            [
              {
                label: 'Checked in',
                render: (row) =>
                  `<span class="cell-strong">${esc(formatDate(row.checked_in_at))}</span><span class="cell-sub">${esc(
                    formatTime(row.checked_in_at)
                  )}</span>`
              },
              {
                label: 'Checked out',
                render: (row) => (row.checked_out_at ? esc(formatTime(row.checked_out_at)) : '<span class="badge badge-blue">In gym</span>')
              },
              { label: 'Source', render: (row) => `<span class="tag">${esc(String(row.source || '').replace('_', ' '))}</span>` }
            ],
            'No check-ins yet',
            'Front-desk visits will build this member’s history.'
          )}
        </section>

        <section class="card history-card">
          <div class="history-head">
            <h3>Class bookings</h3>
            <a class="card-link" href="#/classes">Schedule</a>
          </div>
          ${detailRows(
            detail.bookings.slice(0, 8),
            [
              {
                label: 'Class',
                render: (row) =>
                  `<a class="cell-strong table-link" href="${hashLink(`/classes/${row.class_id}`)}">${esc(row.class_name)}</a><span class="cell-sub">${esc(
                    row.coach
                  )}</span>`
              },
              { label: 'When', render: (row) => `<span class="nowrap">${esc(formatDateTime(row.starts_at))}</span>` },
              { label: 'Status', render: (row) => bookingBadge(row.status) }
            ],
            'No class bookings',
            'Book this member into a class from the schedule.'
          )}
        </section>
      </div>

      <aside class="detail-side">
        <section class="card card-pad">
          <div class="card-head">
            <h3 class="card-title">Contact details</h3>
            <button class="icon-btn icon-btn-sm" type="button" title="Edit profile" data-action="edit-member" data-id="${member.id}">${icon('edit', 'icon-sm')}</button>
          </div>
          <div class="contact-list">
            <div class="contact-item">
              <span class="contact-icon">${icon('mail')}</span>
              <div class="contact-body">
                <div class="contact-label">Email</div>
                <div class="contact-value">${
                  member.email ? `<a href="mailto:${esc(member.email)}">${esc(member.email)}</a>` : 'Not provided'
                }</div>
              </div>
            </div>
            <div class="contact-item">
              <span class="contact-icon">${icon('phone')}</span>
              <div class="contact-body">
                <div class="contact-label">Phone</div>
                <div class="contact-value">${
                  member.phone ? `<a href="tel:${esc(member.phone)}">${esc(member.phone)}</a>` : 'Not provided'
                }</div>
              </div>
            </div>
            <div class="contact-item">
              <span class="contact-icon">${icon('map-pin')}</span>
              <div class="contact-body">
                <div class="contact-label">Address</div>
                <div class="contact-value">${esc(member.address || 'Not provided')}</div>
              </div>
            </div>
            <div class="contact-item">
              <span class="contact-icon">${icon('shield')}</span>
              <div class="contact-body">
                <div class="contact-label">Emergency contact</div>
                <div class="contact-value">${
                  member.emergency_contact_name
                    ? `${esc(member.emergency_contact_name)}${
                        member.emergency_contact_phone ? ` · ${esc(member.emergency_contact_phone)}` : ''
                      }`
                    : 'Not provided'
                }</div>
              </div>
            </div>
            <div class="contact-item">
              <span class="contact-icon">${icon('calendar')}</span>
              <div class="contact-body">
                <div class="contact-label">Date of birth</div>
                <div class="contact-value">${esc(
                  member.date_of_birth ? formatDate(member.date_of_birth, { year: 'numeric' }) : 'Not provided'
                )}</div>
              </div>
            </div>
          </div>
        </section>

        <section class="card card-pad qr-pass-card">
          <div class="card-head">
            <div>
              <h3 class="card-title">Check-in QR pass</h3>
              <p class="card-sub">Scan at the front desk</p>
            </div>
            <button class="icon-btn icon-btn-sm" type="button" title="Print QR pass"
              data-action="print-qr" data-code="${esc(member.code)}"
              data-name="${esc(member.first_name)} ${esc(member.last_name)}">${icon('printer', 'icon-sm')}</button>
          </div>
          <div class="qr-pass-body">
            <div class="qr-pass-code" data-qr-code="${esc(member.code)}">
              <div class="qr-loading">${icon('qr')}<span>Generating QR…</span></div>
            </div>
            <div class="qr-pass-meta">
              <div class="qr-pass-name">${esc(member.first_name)} ${esc(member.last_name)}</div>
              <div class="qr-pass-code-label">${esc(member.code)}</div>
              <div class="small muted">The QR contains this code — no account or app needed.</div>
            </div>
          </div>
          <div class="qr-pass-actions">
            <button class="btn btn-secondary btn-sm" type="button" data-action="print-qr"
              data-code="${esc(member.code)}" data-name="${esc(member.first_name)} ${esc(member.last_name)}">${icon('printer', 'icon-sm')} Print pass</button>
            <button class="btn btn-ghost btn-sm" type="button" data-action="download-qr"
              data-code="${esc(member.code)}">${icon('download', 'icon-sm')} Download</button>
          </div>
        </section>

        <section class="card card-pad">
          <div class="card-head">
            <div>
              <h3 class="card-title">Workout buddies</h3>
              <p class="card-sub">Accountability partners</p>
            </div>
            <button class="icon-btn icon-btn-sm" type="button" title="Pair buddies" data-action="add-buddy">${icon('plus', 'icon-sm')}</button>
          </div>
          ${
            detail.buddies.length
              ? detail.buddies
                  .map(
                    (pair) => `<div class="buddy-mini">
                      ${avatar(pair.buddy, 'avatar-sm')}
                      <div class="buddy-mini-main">
                        <a class="buddy-mini-name" href="${hashLink(`/members/${pair.buddy.id}`)}">${esc(
                          pair.buddy.first_name
                        )} ${esc(pair.buddy.last_name)}</a>
                        <div class="buddy-mini-meta">${num(pair.shared_30)} shared workouts · ${num(
                          pair.shared_this_week
                        )}/${pair.weekly_goal} this week</div>
                      </div>
                      <a class="icon-btn icon-btn-sm" href="#/buddies" title="Buddy board">${icon('chevron-right', 'icon-sm')}</a>
                    </div>`
                  )
                  .join('')
              : `<div class="notice">${icon('users')}<div>No buddy pair yet. Pair this member with a friend for extra accountability.</div></div>`
          }
        </section>

        <section class="card card-pad">
          <div class="card-head">
            <h3 class="card-title">Notes</h3>
            <button class="icon-btn icon-btn-sm" type="button" title="Edit notes" data-action="edit-member" data-id="${member.id}">${icon('edit', 'icon-sm')}</button>
          </div>
          ${
            member.notes
              ? `<div class="notes-box">${esc(member.notes)}</div>`
              : `<div class="empty-state" style="padding:16px 8px">
                  <div class="empty-text" style="margin-top:0">No notes yet. Add goals, preferences, or anything the team should know.</div>
                </div>`
          }
        </section>
      </aside>
    </div>
  `;

  void fillQr(root.querySelector('[data-qr-code]'), member.code, { cellSize: 6, margin: 2 });

  return `${member.first_name} ${member.last_name}`;
}
