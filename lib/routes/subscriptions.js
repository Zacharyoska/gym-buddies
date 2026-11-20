'use strict';

const validate = require('../validate');
const {
  freezeSubscription,
  unfreezeSubscription,
  cancelSubscription
} = require('../domain');

function register(router) {
  router.add('POST', '/api/subscriptions/:id/freeze', async (ctx) => {
    const subscriptionId = validate.id(ctx.params.id, 'Membership ID');
    const subscription = await freezeSubscription(ctx.db, subscriptionId);
    return { subscription };
  });

  router.add('POST', '/api/subscriptions/:id/unfreeze', async (ctx) => {
    const subscriptionId = validate.id(ctx.params.id, 'Membership ID');
    const subscription = await unfreezeSubscription(ctx.db, subscriptionId);
    return { subscription };
  });

  router.add('POST', '/api/subscriptions/:id/cancel', async (ctx) => {
    const subscriptionId = validate.id(ctx.params.id, 'Membership ID');
    const subscription = await cancelSubscription(ctx.db, subscriptionId);
    return { subscription };
  });
}

module.exports = { register };
