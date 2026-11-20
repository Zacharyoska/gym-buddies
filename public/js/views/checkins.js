import { api } from '../api.js';
import {
  esc,
  icon,
  num,
  formatDate,
  formatTime,
  membershipBadge,
  membershipLabel,
  avatar,
  hashLink,
  emptyState,
  debounce
} from '../ui.js';

function minutesBetween(start, end) {
  if (!start) return null;
  const from = new Date(String(start).replace(' ', 'T')).getTime();
  const to =
    end == null
      ? Date.now()
      : end instanceof Date
        ? end.getTime()
        : new Date(String(end).replace(' ', 'T')).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return null;
  return Math.round((to - from) / 60000);
}

function durationLabel(start, end) {
  const minutes = minutesBetween(start, end);
  if (minutes === null) return '—';
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export async function render(root) {
  const data = await api.get('/checkins/today');
  const summary = data.summary;

  root.innerHTML = `
    <div class="page-head">
      <div>
        <span class="eyebrow accent">${icon('check-circle')} Front desk</span>
        <h1>Check-in</h1>
        <p class="page-sub">${esc(formatDate(data.date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }))} · Enter a member code to check someone in or out.</p>
      </div>
      <div class="page-actions">
        <a class="btn btn-secondary" href="/api/export/checkins.csv">${icon('download')} <span>Export visits</span></a>
        <button class="btn btn-secondary" type="button" data-action="refresh-view">${icon('refresh')} <span>Refresh</span></button>
      </div>
    </div>

    <div class="checkin-layout">
      <section class="checkin-card">
        <span class="eyebrow accent">${icon('zap')} Fast check-in</span>
        <h2 style="margin-top:8px">Who's training today?</h2>
        <p>Scan a member's QR pass, use a USB QR scanner, or type their code. The app checks for an active membership before letting them in.</p>
        <form class="checkin-form" data-form="checkin" id="checkin-form" autocomplete="off">
          <input class="code-input" id="checkin-code" name="code" required maxlength="30" placeholder="GB-0001" aria-label="Member code" />
          <button class="btn btn-primary" type="submit">${icon('check-circle')} <span>Check in</span></button>
        </form>
        <div class="checkin-scan-row">
          <button class="btn btn-secondary btn-sm" type="button" data-action="scan-qr">${icon('qr', 'icon-sm')} <span>Scan QR with camera</span></button>
          <span>A USB scanner works like typing: point it at the code and press Enter.</span>
        </div>
        <div class="checkin-hint">QR passes contain the member code, e.g. <code>GB-0001</code>.</div>
        <div class="checkin-preview" id="checkin-preview"></div>
      </section>

      <section class="card card-pad">
        <div class="card-head">
          <div>
            <h3 class="card-title">In the gym now</h3>
            <p class="card-sub">Live visits that have not been checked out</p>
          </div>
          <span class="badge badge-blue"><span class="live-dot"></span>${num(summary.live)} live</span>
        </div>
        <div class="checkin-stats" style="margin-top:0;margin-bottom:14px">
          <span class="checkin-stat"><strong>${num(summary.total_today)}</strong><span>visits today</span></span>
          <span class="checkin-stat"><strong>${num(summary.unique_members)}</strong><span>unique members</span></span>
          <span class="checkin-stat"><strong>${num(summary.avg_minutes)}</strong><span>avg minutes</span></span>
        </div>
        <div class="live-list">
          ${
            data.live.length
              ? data.live
                  .map(
                    (item) => `<div class="live-row">
                      ${avatar(item, 'avatar-sm')}
                      <div class="live-row-main">
                        <a class="live-name" href="${hashLink(`/members/${item.member_id}`)}">${esc(
                          item.first_name
                        )} ${esc(item.last_name)}</a>
                        <div class="live-meta">${esc(item.code)}${item.plan_name ? ` · ${esc(item.plan_name)}` : ''} · since ${esc(
                          formatTime(item.checked_in_at)
                        )}</div>
                      </div>
                      <span class="live-elapsed">${esc(durationLabel(item.checked_in_at, new Date()))}</span>
                      <button class="btn btn-secondary btn-xs" type="button" data-action="checkout" data-id="${item.id}">${icon('log-out', 'icon-sm')} Out</button>
                    </div>`
                  )
                  .join('')
              : emptyState({
                  iconName: 'users',
                  title: 'Nobody is checked in',
                  text: 'Start with the first member at the desk.'
                })
          }
        </div>
      </section>
    </div>

    <section class="card">
      <div class="card-head" style="padding:22px 22px 0;margin-bottom:12px">
        <div>
          <h3 class="card-title">Today's visit log</h3>
          <p class="card-sub">${num(summary.total_today)} check-in${summary.total_today === 1 ? '' : 's'} recorded today</p>
        </div>
        <div class="badge badge-gray">${esc(formatDate(data.date))}</div>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr><th>Member</th><th>Checked in</th><th>Checked out</th><th>Duration</th><th>Plan</th><th></th></tr>
          </thead>
          <tbody>
            ${
              data.log.length
                ? data.log
                    .map(
                      (item) => `<tr>
                        <td>
                          <a class="person-cell" href="${hashLink(`/members/${item.member_id}`)}">
                            ${avatar(item, 'avatar-sm')}
                            <span>
                              <span class="cell-main">${esc(item.first_name)} ${esc(item.last_name)}</span>
                              <span class="cell-sub">${esc(item.code)}</span>
                            </span>
                          </a>
                        </td>
                        <td class="visit-time cell-strong">${esc(formatTime(item.checked_in_at))}</td>
                        <td class="visit-time">${
                          item.checked_out_at
                            ? esc(formatTime(item.checked_out_at))
                            : '<span class="badge badge-blue">In gym</span>'
                        }</td>
                        <td>${esc(durationLabel(item.checked_in_at, item.checked_out_at))}</td>
                        <td>${esc(item.plan_name || '—')}</td>
                        <td class="text-right">${
                          item.checked_out_at
                            ? ''
                            : `<button class="btn btn-secondary btn-xs" type="button" data-action="checkout" data-id="${item.id}">Check out</button>`
                        }</td>
                      </tr>`
                    )
                    .join('')
                : `<tr><td colspan="6">${emptyState({
                    iconName: 'check-circle',
                    title: 'No visits yet today',
                    text: 'Check in the first member using the code field above.'
                  })}</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </section>
  `;

  const input = root.querySelector('#checkin-code');
  const preview = root.querySelector('#checkin-preview');
  let requestId = 0;

  const showPreview = debounce(async () => {
    const code = input?.value.trim() || '';
    const current = ++requestId;
    if (!code) {
      preview.innerHTML = '';
      return;
    }
    try {
      const result = await api.get(`/members/lookup?code=${encodeURIComponent(code)}`);
      if (current !== requestId) return;
      const member = result.member;
      const membership = result.membership;
      const state = membership?.state || (member.status === 'inactive' ? 'inactive' : 'no_plan');
      preview.innerHTML = `
        <div class="preview-card">
          ${avatar(member)}
          <div class="preview-main">
            <div class="preview-name">${esc(member.first_name)} ${esc(member.last_name)} ${membershipBadge(state)}</div>
            <div class="preview-meta">${esc(member.code)}${
              membership ? ` · ${esc(membership.plan_name)} · ends ${esc(formatDate(membership.end_date))}` : ' · No membership'
            }</div>
          </div>
          <span class="small ${membership && ['active', 'expiring'].includes(state) ? 'text-green' : 'text-amber'}">
            ${esc(membershipLabel(state))}
          </span>
        </div>
        ${
          result.open_checkin
            ? `<div class="notice warn" style="margin-top:8px">${icon('alert')}<div>Already checked in at ${esc(
                formatTime(result.open_checkin.checked_in_at)
              )}. Use the live list to check them out.</div></div>`
            : ''
        }
        ${
          state === 'frozen'
            ? `<div class="notice warn" style="margin-top:8px">${icon('pause')}<div>Membership frozen since ${esc(
                formatDate(membership.freeze_started_on)
              )}. Resume it before check-in.</div></div>`
            : ''
        }
        ${
          state === 'expired'
            ? `<div class="notice danger" style="margin-top:8px">${icon('alert')}<div>Membership ended ${esc(
                formatDate(membership.end_date)
              )}. Sell a renewal at the desk.</div></div>`
            : ''
        }
        ${
          !membership
            ? `<div class="notice warn" style="margin-top:8px">${icon('alert')}<div>
                No active membership yet. <a href="${hashLink(`/members/${member.id}`)}">Open the member profile</a> and sell a plan before check-in.
              </div></div>`
            : ''
        }
        ${
          state === 'scheduled'
            ? `<div class="notice warn" style="margin-top:8px">${icon('clock')}<div>Membership starts ${esc(
                formatDate(membership.start_date)
              )}. Check-in unlocks on that date.</div></div>`
            : ''
        }
      `;
    } catch (error) {
      if (current !== requestId) return;
      preview.innerHTML =
        error.status === 404
          ? `<div class="notice warn" style="margin-top:8px">${icon('alert')}<div>No member found with code <strong>${esc(
              code.toUpperCase()
            )}</strong>.</div></div>`
          : `<div class="notice danger" style="margin-top:8px">${icon('alert')}<div>${esc(error.message)}</div></div>`;
    }
  }, 350);

  input?.addEventListener('input', showPreview);

  return 'Check-in';
}
