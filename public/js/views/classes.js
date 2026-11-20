import { api } from '../api.js';
import {
  esc,
  icon,
  num,
  formatDate,
  formatDateTime,
  formatTime,
  dateParts,
  dayDiff,
  bookingBadge,
  avatar,
  hashLink,
  emptyState
} from '../ui.js';

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
}

function groupLabel(day) {
  const today = todayKey();
  const difference = dayDiff(today, day);
  if (difference === 0) return `Today · ${formatDate(day, { weekday: 'long' })}`;
  if (difference === 1) return `Tomorrow · ${formatDate(day, { weekday: 'long' })}`;
  return formatDate(day, { weekday: 'long', month: 'short', day: 'numeric' });
}

function classCard(item) {
  const parts = dateParts(item.starts_at);
  const fill = Math.min(100, Math.round((Number(item.booked) / Number(item.capacity)) * 100));
  const spots = Math.max(0, Number(item.capacity) - Number(item.booked));
  const upcoming = !item.ended && item.status === 'active' && new Date(item.starts_at.replace(' ', 'T')).getTime() > Date.now();
  return `<article class="class-card">
    <div class="class-date">
      <strong>${esc(parts.day)}</strong>
      <span>${esc(parts.month)}</span>
    </div>
    <div class="class-card-body">
      <div class="class-card-top">
        <h3><a href="${hashLink(`/classes/${item.id}`)}">${esc(item.name)}</a></h3>
        ${
          item.status === 'cancelled'
            ? '<span class="badge badge-red">Cancelled</span>'
            : item.ended
              ? '<span class="badge badge-gray">Finished</span>'
              : spots === 0
                ? '<span class="badge badge-amber">Full</span>'
                : ''
        }
      </div>
      <div class="class-meta">
        <span>${icon('user')} ${esc(item.coach)}</span>
        <span>${icon('clock')} ${esc(formatTime(item.starts_at))} · ${esc(item.duration_min)} min</span>
        ${item.room ? `<span>${icon('map-pin')} ${esc(item.room)}</span>` : ''}
      </div>
      <div class="class-card-bottom">
        <div class="class-card-fill">
          <div class="capacity-bar"><div class="capacity-fill ${
            fill >= 100 ? 'full' : fill >= 75 ? 'warn' : ''
          }" style="width:${fill}%"></div></div>
          <div class="capacity-label">${
            item.ended
              ? `${num(item.attended)} attended · ${num(item.no_shows)} no-show`
              : `${num(item.booked)}/${num(item.capacity)} booked · ${num(spots)} spot${spots === 1 ? '' : 's'} left`
          }</div>
        </div>
        <a class="btn btn-secondary btn-xs" href="${hashLink(`/classes/${item.id}`)}">Manage</a>
        ${
          upcoming && spots > 0
            ? `<button class="btn btn-primary btn-xs" type="button" data-action="add-booking" data-id="${item.id}">${icon('plus', 'icon-sm')} Book</button>`
            : ''
        }
      </div>
    </div>
  </article>`;
}

export async function render(root, query) {
  const scope = ['upcoming', 'past', 'all'].includes(query.get('scope'))
    ? query.get('scope')
    : 'upcoming';
  const data = await api.get(`/classes?scope=${scope}`);

  const groups = new Map();
  for (const item of data.items) {
    const day = String(item.starts_at).slice(0, 10);
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day).push(item);
  }

  root.innerHTML = `
    <div class="page-head">
      <div>
        <span class="eyebrow accent">${icon('calendar')} Studio schedule</span>
        <h1>Classes</h1>
        <p class="page-sub">Group sessions, coaches, capacity, and attendance. Book members in and mark attendance after class.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" type="button" data-action="add-class">${icon('plus')} <span>Add class</span></button>
      </div>
    </div>

    <div class="toolbar">
      <div class="segmented">
        <a class="${scope === 'upcoming' ? 'active' : ''}" href="#/classes?scope=upcoming">Upcoming</a>
        <a class="${scope === 'past' ? 'active' : ''}" href="#/classes?scope=past">Past</a>
        <a class="${scope === 'all' ? 'active' : ''}" href="#/classes?scope=all">All</a>
      </div>
      <span class="small muted">${num(data.items.length)} session${data.items.length === 1 ? '' : 's'} shown</span>
    </div>

    ${
      data.items.length
        ? [...groups.entries()]
            .map(
              ([day, items]) => `<div class="class-group-label">${esc(groupLabel(day))}</div>
                <div class="class-grid">${items.map(classCard).join('')}</div>`
            )
            .join('')
        : `<section class="card">${emptyState({
            iconName: 'calendar',
            title: scope === 'past' ? 'No past classes yet' : 'No classes on the schedule',
            text:
              scope === 'past'
                ? 'Completed sessions and attendance will appear here.'
                : 'Add a session so members can book in.',
            action:
              '<button class="btn btn-primary btn-sm" type="button" data-action="add-class">Add class</button>'
          })}</section>`
    }
  `;

  return 'Classes';
}

export async function renderDetail(root, query, classId) {
  const data = await api.get(`/classes/${classId}`);
  const item = data.item;
  const parts = dateParts(item.starts_at);
  const fill = Math.min(100, Math.round((Number(item.booked) / Number(item.capacity)) * 100));
  const upcoming = new Date(item.starts_at.replace(' ', 'T')).getTime() > Date.now();

  root.innerHTML = `
    <a class="back-link" href="#/classes">${icon('arrow-left')} All classes</a>

    <section class="class-hero">
      <div class="class-hero-date">
        <strong>${esc(parts.day)}</strong>
        <span>${esc(parts.month)}</span>
      </div>
      <div class="class-hero-main">
        <div class="profile-title-row">
          <h1>${esc(item.name)}</h1>
          ${
            item.status === 'cancelled'
              ? '<span class="badge badge-red">Cancelled</span>'
              : item.ended
                ? '<span class="badge badge-gray">Finished</span>'
                : '<span class="badge badge-green"><span class="dot"></span>Open for booking</span>'
          }
        </div>
        <div class="class-hero-meta">
          <span>${icon('user')} ${esc(item.coach)}</span>
          <span>${icon('calendar')} ${esc(formatDateTime(item.starts_at))}</span>
          <span>${icon('clock')} ${esc(item.duration_min)} minutes</span>
          ${item.room ? `<span>${icon('map-pin')} ${esc(item.room)}</span>` : ''}
          <span>${icon('users')} ${num(item.booked)}/${num(item.capacity)} booked</span>
        </div>
        ${item.description ? `<p class="class-hero-desc">${esc(item.description)}</p>` : ''}
        <div class="class-hero-actions">
          ${
            upcoming && item.status === 'active' && data.available > 0
              ? `<button class="btn btn-primary btn-sm" type="button" data-action="add-booking" data-id="${item.id}">${icon('user-plus', 'icon-sm')} Book member</button>`
              : ''
          }
          ${
            !item.ended && item.status === 'active'
              ? `<button class="btn btn-danger btn-sm" type="button" data-action="cancel-class" data-id="${item.id}">${icon('ban', 'icon-sm')} Cancel class</button>`
              : ''
          }
          <a class="btn btn-secondary btn-sm" href="#/classes">${icon('arrow-left', 'icon-sm')} Schedule</a>
        </div>
      </div>
      <div class="profile-hero-side">
        <span class="small muted">${esc(formatDate(item.starts_at, { weekday: 'long' }))}</span>
        <span class="tag">${esc(formatTime(item.starts_at))}</span>
      </div>
    </section>

    <div class="stat-mini-grid">
      <div class="stat-mini">
        <div class="stat-mini-label">Booked</div>
        <div class="stat-mini-value">${num(item.booked)}<span class="muted" style="font-size:12px"> / ${num(item.capacity)}</span></div>
        <div class="stat-mini-sub">${fill}% filled</div>
      </div>
      <div class="stat-mini">
        <div class="stat-mini-label">Attended</div>
        <div class="stat-mini-value text-green">${num(item.attended)}</div>
        <div class="stat-mini-sub">Marked after class</div>
      </div>
      <div class="stat-mini">
        <div class="stat-mini-label">No-shows</div>
        <div class="stat-mini-value ${item.no_shows ? 'text-red' : ''}">${num(item.no_shows)}</div>
        <div class="stat-mini-sub">Follow up if needed</div>
      </div>
      <div class="stat-mini">
        <div class="stat-mini-label">Spots left</div>
        <div class="stat-mini-value">${num(data.available)}</div>
        <div class="stat-mini-sub">${item.status === 'cancelled' ? 'Class cancelled' : item.ended ? 'Class finished' : 'Open for booking'}</div>
      </div>
    </div>

    <section class="card">
      <div class="card-head" style="padding:22px 22px 0;margin-bottom:12px">
        <div>
          <h3 class="card-title">Booking list</h3>
          <p class="card-sub">${num(data.bookings.length)} booking${data.bookings.length === 1 ? '' : 's'} · mark attendance or free a spot</p>
        </div>
        ${
          upcoming && item.status === 'active' && data.available > 0
            ? `<button class="btn btn-primary btn-sm" type="button" data-action="add-booking" data-id="${item.id}">${icon('plus', 'icon-sm')} Book member</button>`
            : ''
        }
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr><th>Member</th><th>Booked</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            ${
              data.bookings.length
                ? data.bookings
                    .map(
                      (booking) => `<tr>
                        <td>
                          <a class="person-cell" href="${hashLink(`/members/${booking.member_id}`)}">
                            ${avatar(booking, 'avatar-sm')}
                            <span>
                              <span class="cell-main">${esc(booking.first_name)} ${esc(booking.last_name)}</span>
                              <span class="cell-sub">${esc(booking.code)}${booking.phone ? ` · ${esc(booking.phone)}` : ''}</span>
                            </span>
                          </a>
                        </td>
                        <td class="nowrap">${esc(formatDateTime(booking.created_at))}</td>
                        <td>${bookingBadge(booking.status)}</td>
                        <td>
                          <div class="booking-status-actions">
                            ${
                              item.ended && booking.status !== 'attended' && booking.status !== 'cancelled'
                                ? `<button class="btn btn-secondary btn-xs" type="button" data-action="booking-status" data-id="${booking.id}" data-status="attended">Attended</button>`
                                : ''
                            }
                            ${
                              item.ended && booking.status !== 'no_show' && booking.status !== 'cancelled'
                                ? `<button class="btn btn-ghost btn-xs" type="button" data-action="booking-status" data-id="${booking.id}" data-status="no_show">No-show</button>`
                                : ''
                            }
                            ${
                              booking.status !== 'cancelled' && !item.ended
                                ? `<button class="btn btn-ghost btn-xs" type="button" data-action="booking-status" data-id="${booking.id}" data-status="cancelled">Cancel</button>`
                                : ''
                            }
                            ${
                              booking.status === 'cancelled' && !item.ended
                                ? `<button class="btn btn-secondary btn-xs" type="button" data-action="booking-status" data-id="${booking.id}" data-status="booked">Re-book</button>`
                                : ''
                            }
                          </div>
                        </td>
                      </tr>`
                    )
                    .join('')
                : `<tr><td colspan="4">${emptyState({
                    iconName: 'users',
                    title: 'No bookings yet',
                    text: item.ended
                      ? 'Nobody booked into this session.'
                      : 'Book a member into this class to fill the room.',
                    action:
                      upcoming && item.status === 'active' && data.available > 0
                        ? `<button class="btn btn-primary btn-sm" type="button" data-action="add-booking" data-id="${item.id}">Book member</button>`
                        : ''
                  })}</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </section>
  `;

  return item.name;
}
