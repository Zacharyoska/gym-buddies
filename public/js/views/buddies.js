import { api } from '../api.js';
import {
  esc,
  icon,
  num,
  formatDate,
  relativeDate,
  avatarPair,
  hashLink,
  emptyState
} from '../ui.js';

export async function render(root) {
  const data = await api.get('/buddies');
  const pairs = data.pairs;
  const sharedThisWeek = pairs.reduce((sum, pair) => sum + Number(pair.shared_this_week || 0), 0);

  root.innerHTML = `
    <div class="page-head">
      <div>
        <span class="eyebrow accent">${icon('users')} Community</span>
        <h1>Workout buddies</h1>
        <p class="page-sub">Accountability pairs that train together. Shared workout days are detected automatically from check-ins — no extra logging.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" type="button" data-action="add-buddy">${icon('user-plus')} <span>Pair buddies</span></button>
      </div>
    </div>

    <section class="buddies-hero">
      <div class="buddies-hero-copy">
        <span class="eyebrow" style="color:#d7a86e">${icon('award')} Better together</span>
        <h1>Two members. One shared habit.</h1>
        <p>When a pair checks in on the same day, it counts as a shared workout. Streaks build week over week and the leaderboard updates automatically.</p>
      </div>
      <div class="buddies-hero-stats">
        <div class="buddies-stat"><strong>${num(data.summary.active_pairs)}</strong><span>Active pairs</span></div>
        <div class="buddies-stat"><strong>${num(data.summary.shared_workouts_30)}</strong><span>Shared · 30 days</span></div>
        <div class="buddies-stat"><strong>${num(sharedThisWeek)}</strong><span>Shared this week</span></div>
      </div>
    </section>

    ${
      pairs.length
        ? `<section class="card card-pad" style="margin-bottom:18px">
            <div class="card-head">
              <div>
                <h3 class="card-title">Leaderboard</h3>
                <p class="card-sub">Ranked by shared workouts in the last 30 days</p>
              </div>
              <span class="badge badge-lime">${icon('award', 'icon-sm')} Top pairs</span>
            </div>
            <div class="list-stack">
              ${data.leaderboard
                .map(
                  (pair, index) => `<div class="list-row">
                    <span class="badge ${index === 0 ? 'badge-lime' : 'badge-gray'}">#${index + 1}</span>
                    ${avatarPair(pair.a, pair.b, 'avatar-sm')}
                    <div class="list-main">
                      <div class="list-name">
                        <a href="${hashLink(`/members/${pair.a.id}`)}">${esc(pair.a.first_name)} ${esc(pair.a.last_name)}</a>
                        <span class="faint"> + </span>
                        <a href="${hashLink(`/members/${pair.b.id}`)}">${esc(pair.b.first_name)} ${esc(pair.b.last_name)}</a>
                      </div>
                      <div class="list-meta">${pair.streak_weeks} week streak · goal ${pair.weekly_goal}× per week · last shared ${
                        pair.last_shared ? esc(relativeDate(pair.last_shared)) : 'not yet'
                      }</div>
                    </div>
                    <div class="list-end">
                      <div class="cell-strong">${num(pair.shared_30)}</div>
                      <div class="list-meta">shared workouts</div>
                    </div>
                  </div>`
                )
                .join('')}
            </div>
          </section>

          <div class="buddy-grid">
            ${pairs
              .map(
                (pair) => `<article class="buddy-card">
                  <div class="buddy-card-head">
                    ${avatarPair(pair.a, pair.b)}
                    <div class="buddy-card-title">
                      <div class="pair-names">
                        <a href="${hashLink(`/members/${pair.a.id}`)}">${esc(pair.a.first_name)} ${esc(pair.a.last_name)}</a>
                        <span class="plus">+</span>
                        <a href="${hashLink(`/members/${pair.b.id}`)}">${esc(pair.b.first_name)} ${esc(pair.b.last_name)}</a>
                      </div>
                      <div class="pair-since">Buddies since ${esc(formatDate(pair.created_at))}</div>
                    </div>
                    ${
                      pair.streak_weeks > 0
                        ? `<span class="streak-chip">${icon('flame')} ${pair.streak_weeks}w streak</span>`
                        : ''
                    }
                  </div>
                  <div class="buddy-card-metrics">
                    <div class="buddy-metric"><strong>${num(pair.shared_30)}</strong><span>Shared · 30 days</span></div>
                    <div class="buddy-metric"><strong>${num(pair.shared_this_week)}</strong><span>This week</span></div>
                    <div class="buddy-metric"><strong>${num(pair.total_shared)}</strong><span>All time</span></div>
                  </div>
                  <div class="goal-block">
                    <div class="goal-row">
                      <span>Weekly goal · ${pair.shared_this_week}/${pair.weekly_goal} shared</span>
                      <strong>${Math.min(100, pair.goal_percent)}%</strong>
                    </div>
                    <div class="goal-track"><div class="goal-fill" style="width:${Math.min(
                      100,
                      pair.goal_percent
                    )}%"></div></div>
                  </div>
                  <div class="buddy-card-foot">
                    <span class="small muted">Last shared ${
                      pair.last_shared ? esc(relativeDate(pair.last_shared)) : 'not yet'
                    }</span>
                    <button class="btn btn-ghost btn-xs" type="button" data-action="end-buddy" data-id="${pair.id}">End pair</button>
                  </div>
                </article>`
              )
              .join('')}
          </div>`
        : `<section class="card">${emptyState({
            iconName: 'users',
            title: 'No buddy pairs yet',
            text: 'Pair two active members so their shared check-ins can build a streak.',
            action:
              '<button class="btn btn-primary btn-sm" type="button" data-action="add-buddy">Pair buddies</button>'
          })}</section>`
    }

    <section class="card card-pad" style="margin-top:18px">
      <div class="card-head">
        <div>
          <h3 class="card-title">How shared workouts are counted</h3>
          <p class="card-sub">Simple for the desk, meaningful for members</p>
        </div>
      </div>
      <div class="grid grid-3" style="margin-bottom:0">
        <div class="list-row" style="border:none;padding:0">
          <span class="contact-icon">${icon('check-circle')}</span>
          <div class="list-main">
            <div class="list-name">Same-day check-ins</div>
            <div class="list-meta">A shared workout is any day both buddies check in.</div>
          </div>
        </div>
        <div class="list-row" style="border:none;padding:0">
          <span class="contact-icon">${icon('target')}</span>
          <div class="list-main">
            <div class="list-name">Weekly goals</div>
            <div class="list-meta">Each pair sets a 1–7 day target. Progress resets every Monday.</div>
          </div>
        </div>
        <div class="list-row" style="border:none;padding:0">
          <span class="contact-icon">${icon('flame')}</span>
          <div class="list-main">
            <div class="list-name">Streaks</div>
            <div class="list-meta">Consecutive weeks with at least one shared workout.</div>
          </div>
        </div>
      </div>
    </section>
  `;

  return 'Workout buddies';
}
