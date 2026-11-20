'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('money and compactMoney are formatted in Philippine pesos', async () => {
  const ui = await import('../public/js/ui.js');

  assert.equal(ui.money(150000), '₱1,500');
  assert.equal(ui.money(150050, true), '₱1,500.50');
  assert.equal(ui.money(150050), '₱1,500.50');
  assert.equal(ui.compactMoney(150000), '₱1.5k');
  assert.equal(ui.compactMoney(140000000), '₱1.4m');
  assert.equal(ui.compactMoney(30000), '₱300');
});
