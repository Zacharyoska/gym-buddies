'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const CHECK_ONLY = process.argv.includes('--check');
const VERCEL_ENV_VARS = ['LIBSQL_URL', 'LIBSQL_AUTH_TOKEN', 'SESSION_SECRET'];

function fail(message) {
  console.error(`\n[deploy] ${message}\n`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options
  });
  if (result.error) fail(result.error.message);
  if (result.status !== 0) {
    fail(`Command failed (${result.status}): ${command} ${args.join(' ')}`);
  }
}

function requireSetting(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    if (name === 'SESSION_SECRET') {
      fail(
        'SESSION_SECRET is missing. Generate one with:\n' +
          '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      );
    }
    fail(`${name} is missing. Set it in this PowerShell session first (see README.md).`);
  }
  process.env[name] = value;
  return value;
}

function validate() {
  const url = requireSetting('LIBSQL_URL');
  const token = requireSetting('LIBSQL_AUTH_TOKEN');
  const secret = requireSetting('SESSION_SECRET');
  const adminPassword = requireSetting('ADMIN_PASSWORD');

  if (!/^(libsql|https):\/\//i.test(url)) {
    fail('LIBSQL_URL must start with libsql:// (the URL from Turso).');
  }
  if (token.length < 20 || !token.startsWith('eyJ')) {
    fail(
      'LIBSQL_AUTH_TOKEN does not look like a Turso token. Recreate it with:\n' +
        '  turso db tokens create <your-database-name>'
    );
  }
  if (secret.length < 32) {
    fail('SESSION_SECRET must be at least 32 characters long.');
  }
  if (adminPassword.length < 8) {
    fail('ADMIN_PASSWORD must be at least 8 characters long.');
  }

  let host = 'unknown';
  try {
    host = new URL(url).host;
  } catch {
    fail('LIBSQL_URL could not be parsed. Copy it again from Turso.');
  }

  console.log('[deploy] Configuration looks valid.');
  console.log(`[deploy] Database host: ${host}`);
  console.log('[deploy] Admin password: set (not shown)');
}

function deploy() {
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const base = ['--yes', 'vercel@latest'];

  console.log('\n[deploy] 1/4 Creating/linking the Vercel project...');
  run(npx, [...base, '--prod', '--yes']);

  console.log('\n[deploy] 2/4 Uploading environment variables to Vercel...');
  for (const environment of ['production', 'preview']) {
    for (const name of VERCEL_ENV_VARS) {
      run(
        npx,
        [
          ...base,
          'env',
          'add',
          name,
          '--environment',
          environment,
          '--sensitive',
          '--force',
          '--yes'
        ],
        {
          input: process.env[name],
          stdio: ['pipe', 'inherit', 'inherit']
        }
      );
    }
  }

  console.log('\n[deploy] 3/4 Redeploying with the new environment variables...');
  run(npx, [...base, '--prod', '--yes']);

  console.log('\n[deploy] Done. Open the URL printed above, then check /api/health.');
}

function main() {
  validate();

  console.log('\n[deploy] Setting up the hosted database...');
  run(process.execPath, [path.join(__dirname, 'remote-setup.js')], { shell: false });

  if (CHECK_ONLY) {
    console.log('\n[deploy] Check complete. No deploy was performed.');
    return;
  }

  deploy();
}

try {
  main();
} catch (error) {
  fail(error && error.message ? error.message : String(error));
}
