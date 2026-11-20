'use strict';

const { spawnSync } = require('node:child_process');

const result = spawnSync(
  process.execPath,
  ['--test', '--test-concurrency=1'],
  {
    stdio: 'inherit',
    env: { ...process.env, GB_DB_DRIVER: 'promise' }
  }
);

process.exit(result.status ?? 1);
