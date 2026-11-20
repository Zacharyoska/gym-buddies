'use strict';

function registerRoutes(router, config) {
  require('./auth').register(router, config);
  require('./dashboard').register(router, config);
  require('./members').register(router, config);
  require('./subscriptions').register(router, config);
  require('./plans').register(router, config);
  require('./payments').register(router, config);
  require('./checkins').register(router, config);
  require('./classes').register(router, config);
  require('./buddies').register(router, config);
  require('./reports').register(router, config);
  require('./export').register(router, config);
}

module.exports = { registerRoutes };
