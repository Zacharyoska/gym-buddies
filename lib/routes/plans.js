'use strict';

const { HttpError } = require('../errors');
const validate = require('../validate');
const { nowStamp } = require('../dates');
const { parseFeatures, normalizeFeatures } = require('../domain');

async function serializePlan(row) {
  return { ...row, features: parseFeatures(row.features) };
}

function planFields(body, existing = null) {
  return {
    name: validate.string(body.name ?? existing?.name, 'Plan name', { max: 80 }),
    description: validate.optionalString(
      body.description ?? existing?.description ?? '',
      'Description',
      600
    ),
    duration_days: validate.integer(
      body.duration_days ?? existing?.duration_days,
      'Duration',
      { min: 1, max: 1095 }
    ),
    price_cents: validate.moneyCents(
      body.price_cents ?? existing?.price_cents,
      'Price'
    ),
    features: normalizeFeatures(
      body.features !== undefined ? body.features : parseFeatures(existing?.features)
    )
  };
}

function register(router) {
  router.add('GET', '/api/plans', async (ctx) => {
    const includeInactive = ctx.query.all === '1' || ctx.query.include_inactive === '1';
    const where = includeInactive ? '' : 'WHERE p.active = 1';
    const plans = (
      await ctx.db
        .prepare(
          `SELECT p.*,
                  (SELECT COUNT(*) FROM subscriptions s
                   WHERE s.plan_id = p.id AND s.status = 'active') AS active_members,
                  (SELECT COUNT(*) FROM subscriptions s
                   WHERE s.plan_id = p.id) AS total_memberships
           FROM plans p
           ${where}
           ORDER BY p.active DESC, p.price_cents ASC, p.duration_days ASC`
        )
        .all()
    ).map(serializePlan);
    return {
      items: plans,
      summary: {
        total_plans: plans.length,
        active_plans: plans.filter((plan) => plan.active).length,
        active_members: plans.reduce((sum, plan) => sum + Number(plan.active_members), 0)
      }
    };
  });

  router.add('POST', '/api/plans', async (ctx) => {
    const db = ctx.db;
    const fields = planFields(ctx.body);
    const duplicate = await db
      .prepare('SELECT id FROM plans WHERE lower(name) = lower(?)')
      .get(fields.name);
    if (duplicate) throw new HttpError(409, 'A plan with this name already exists.');
    const result = await db
      .prepare(
        `INSERT INTO plans (name, description, duration_days, price_cents, features, active, created_at)
         VALUES (?, ?, ?, ?, ?, 1, ?)`
      )
      .run(
        fields.name,
        fields.description || null,
        fields.duration_days,
        fields.price_cents,
        JSON.stringify(fields.features),
        nowStamp()
      );
    ctx.statusCode = 201;
    return await serializePlan(await db.prepare('SELECT * FROM plans WHERE id = ?').get(Number(result.lastInsertRowid)));
  });

  router.add('PATCH', '/api/plans/:id', async (ctx) => {
    const db = ctx.db;
    const planId = validate.id(ctx.params.id, 'Plan ID');
    const existing = await db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
    if (!existing) throw new HttpError(404, 'Plan not found.');
    const fields = planFields(ctx.body, existing);
    const duplicate = await db
      .prepare('SELECT id FROM plans WHERE lower(name) = lower(?) AND id != ?')
      .get(fields.name, planId);
    if (duplicate) throw new HttpError(409, 'A plan with this name already exists.');
    await db.prepare(
      `UPDATE plans SET name = ?, description = ?, duration_days = ?, price_cents = ?, features = ?
       WHERE id = ?`
    ).run(
      fields.name,
      fields.description || null,
      fields.duration_days,
      fields.price_cents,
      JSON.stringify(fields.features),
      planId
    );
    return await serializePlan(await db.prepare('SELECT * FROM plans WHERE id = ?').get(planId));
  });

  router.add('POST', '/api/plans/:id/toggle', async (ctx) => {
    const db = ctx.db;
    const planId = validate.id(ctx.params.id, 'Plan ID');
    const plan = await db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
    if (!plan) throw new HttpError(404, 'Plan not found.');
    await db.prepare('UPDATE plans SET active = ? WHERE id = ?').run(plan.active ? 0 : 1, planId);
    return await serializePlan(await db.prepare('SELECT * FROM plans WHERE id = ?').get(planId));
  });
}

module.exports = { register };
