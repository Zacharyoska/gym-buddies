import { api } from '../api.js';
import { esc, icon, num, money, emptyState } from '../ui.js';

export async function render(root) {
  const data = await api.get('/plans?all=1');
  const plans = data.items;
  const activePlans = plans.filter((plan) => plan.active);
  const sorted = [...plans].sort((a, b) => {
    if (a.active !== b.active) return b.active - a.active;
    return a.price_cents - b.price_cents;
  });

  root.innerHTML = `
    <div class="page-head">
      <div>
        <span class="eyebrow accent">${icon('layers')} Pricing & plans</span>
        <h1>Membership plans</h1>
        <p class="page-sub">The products the front desk can sell. Price and duration changes only affect new memberships.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" type="button" data-action="add-plan">${icon('plus')} <span>Create plan</span></button>
      </div>
    </div>

    <div class="notice" style="margin-bottom:18px">
      ${icon('info')}
      <div>
        <strong>${num(activePlans.length)} active plan${activePlans.length === 1 ? '' : 's'}</strong>
        ${' '}available to sell · ${num(data.summary.active_members)} active memberships across all plans.
        Deactivating a plan hides it from the sales flow but keeps existing memberships untouched.
      </div>
    </div>

    ${
      sorted.length
        ? `<div class="plan-grid">
            ${sorted
              .map((plan) => {
                const featured = plan.active && plan.duration_days >= 365;
                const period =
                  plan.duration_days === 1 ? 'one day' : `${plan.duration_days} days`;
                return `<article class="plan-card ${featured ? 'featured' : ''} ${plan.active ? '' : 'inactive'}">
                  <div class="plan-top">
                    <div>
                      <div class="plan-name">${esc(plan.name)}</div>
                      ${featured ? '<span class="badge badge-lime" style="margin-top:7px">Best value</span>' : ''}
                    </div>
                    ${
                      plan.active
                        ? '<span class="badge badge-green"><span class="dot"></span>On sale</span>'
                        : '<span class="badge badge-gray">Retired</span>'
                    }
                  </div>
                  <p class="plan-description">${esc(plan.description || 'No description yet.')}</p>
                  <div class="plan-price-row">
                    <span class="plan-price">${money(plan.price_cents)}</span>
                    <span class="plan-period">for ${esc(period)}</span>
                  </div>
                  <div class="feature-list">
                    ${
                      plan.features.length
                        ? plan.features
                            .map(
                              (feature) => `<div class="feature-item">
                                <span class="feature-check">${icon('check')}</span>
                                <span>${esc(feature)}</span>
                              </div>`
                            )
                            .join('')
                        : `<div class="feature-item"><span class="feature-check">${icon('check')}</span><span>Gym access for ${esc(period)}</span></div>`
                    }
                  </div>
                  <div class="plan-footer">
                    <span class="plan-members">${num(plan.active_members)} active · ${num(
                      plan.total_memberships
                    )} sold</span>
                    <div class="btn-row">
                      <button class="icon-btn icon-btn-sm" type="button" title="Edit plan" data-action="edit-plan" data-id="${plan.id}">${icon('edit', 'icon-sm')}</button>
                      <button class="icon-btn icon-btn-sm" type="button" title="${
                        plan.active ? 'Retire plan' : 'Put plan back on sale'
                      }" data-action="toggle-plan" data-id="${plan.id}">${icon(plan.active ? 'pause' : 'play', 'icon-sm')}</button>
                    </div>
                  </div>
                </article>`;
              })
              .join('')}
          </div>`
        : `<section class="card">${emptyState({
            iconName: 'layers',
            title: 'No plans yet',
            text: 'Create your first membership plan so the team can start selling.',
            action:
              '<button class="btn btn-primary btn-sm" type="button" data-action="add-plan">Create plan</button>'
          })}</section>`
    }

    <div class="grid grid-2" style="margin-top:18px">
      <section class="card card-pad">
        <div class="card-head">
          <div>
            <h3 class="card-title">How plan changes work</h3>
            <p class="card-sub">A quick refresher for the team</p>
          </div>
        </div>
        <div class="list-stack">
          <div class="list-row">
            <span class="contact-icon">${icon('shield')}</span>
            <div class="list-main">
              <div class="list-name">Existing memberships keep their terms</div>
              <div class="list-meta">Editing a plan never changes a membership that has already been sold.</div>
            </div>
          </div>
          <div class="list-row">
            <span class="contact-icon">${icon('pause')}</span>
            <div class="list-main">
              <div class="list-name">Retiring a plan hides it from the sales flow</div>
              <div class="list-meta">You can put it back on sale at any time without losing history.</div>
            </div>
          </div>
          <div class="list-row">
            <span class="contact-icon">${icon('calendar')}</span>
            <div class="list-main">
              <div class="list-name">Renewals start after the latest membership</div>
              <div class="list-meta">The app suggests the day after a current membership ends to avoid overlaps.</div>
            </div>
          </div>
        </div>
      </section>

      <section class="card card-pad">
        <div class="card-head">
          <div>
            <h3 class="card-title">Plan performance</h3>
            <p class="card-sub">Active memberships by plan</p>
          </div>
          <a class="card-link" href="#/reports">Reports</a>
        </div>
        <div class="method-bars">
          ${
            activePlans.length
              ? (() => {
                  const max = Math.max(...activePlans.map((plan) => Number(plan.active_members)), 1);
                  return activePlans
                    .map(
                      (plan) => `<div class="method-row">
                        <span class="method-name">${esc(plan.name)}</span>
                        <div class="method-track"><div class="method-fill" style="width:${Math.max(
                          2,
                          Math.round((Number(plan.active_members) / max) * 100)
                        )}%"></div></div>
                        <span class="method-amount">${num(plan.active_members)}</span>
                      </div>`
                    )
                    .join('');
                })()
              : '<span class="muted small">No active plans yet.</span>'
          }
        </div>
      </section>
    </div>
  `;

  return 'Plans';
}
