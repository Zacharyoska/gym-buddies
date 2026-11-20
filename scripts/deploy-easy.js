'use strict';

const crypto = require('node:crypto');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const DB_LOCATION = 'aws-ap-southeast-1';
const DB_LOCATION_SHORT = 'sin';

function fail(message) {
  console.error(`\n[deploy:easy] ${message}\n`);
  process.exit(1);
}

function stripAnsi(value) {
  return String(value || '').replace(/\x1b\[[0-9;]*m/g, '').trim();
}

function capture(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    ...options
  });
  const stdout = stripAnsi(result.stdout);
  const stderr = stripAnsi(result.stderr);
  if (stdout) process.stdout.write(`${stdout}\n`);
  if (stderr) process.stderr.write(`${stderr}\n`);
  if (result.error) fail(result.error.message);
  if (result.status !== 0 && !options.allowFailure) {
    fail(`Command failed (${result.status}): ${command} ${args.join(' ')}`);
  }
  return { status: result.status, stdout, stderr };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options
  });
  if (result.error) fail(result.error.message);
  if (result.status !== 0) fail(`Command failed (${result.status}): ${command} ${args.join(' ')}`);
}

function ensureTursoCli() {
  const result = capture('turso', ['--version'], { allowFailure: true });
  if (result.status === 0) return;

  console.error('[deploy:easy] Turso CLI is not installed or not on PATH.');
  if (process.platform === 'win32') {
    console.error('Install it in PowerShell, then reopen PowerShell and run this again:');
    console.error('  irm https://github.com/tursodatabase/turso/releases/latest/download/turso_cli-installer.ps1 | iex');
  } else {
    console.error('Install it, then run this again:');
    console.error('  curl -sSfL https://get.tur.so/install.sh | bash');
  }
  process.exit(1);
}

function ensureTursoLogin() {
  const who = capture('turso', ['auth', 'whoami'], { allowFailure: true });
  if (who.status === 0) {
    console.log(`[deploy:easy] Turso account: ${who.stdout.split('\n')[0]}`);
    return;
  }
  console.log('[deploy:easy] Opening Turso login in your browser...');
  run('turso', ['auth', 'signup']);
}

function createDatabase() {
  const name = `gym-buddies-${crypto.randomBytes(3).toString('hex')}`;
  console.log(`[deploy:easy] Creating Turso database: ${name} (${DB_LOCATION})`);

  let result = capture(
    'turso',
    ['db', 'create', name, '--location', DB_LOCATION, '--wait'],
    { allowFailure: true }
  );
  if (result.status !== 0) {
    console.log('[deploy:easy] Retrying with the short region code...');
    result = capture('turso', ['db', 'create', name, '--location', DB_LOCATION_SHORT, '--wait'], {
      allowFailure: true
    });
  }
  if (result.status !== 0) {
    console.log('[deploy:easy] Retrying with Turso default location...');
    result = capture('turso', ['db', 'create', name, '--wait'], { allowFailure: true });
  }
  if (result.status !== 0) fail('Could not create the Turso database.');

  return name;
}

function getCredentials(name) {
  const urlResult = capture('turso', ['db', 'show', name, '--url']);
  const urlMatch = urlResult.stdout.match(/(?:libsql|https):\/\/[^\s]+/);
  if (!urlMatch) fail('Could not read the database URL from Turso.');

  const tokenResult = capture('turso', ['db', 'tokens', 'create', name]);
  const tokenMatch = tokenResult.stdout.match(/eyJ[A-Za-z0-9._-]+/);
  if (!tokenMatch) fail('Could not read the auth token from Turso.');

  return {
    url: urlMatch[0],
    token: tokenMatch[0]
  };
}

function main() {
  console.log('[deploy:easy] This uses your Turso and Vercel logins. Browser windows may open.\n');

  ensureTursoCli();
  ensureTursoLogin();

  const name = createDatabase();
  const { url, token } = getCredentials(name);

  process.env.LIBSQL_URL = url;
  process.env.LIBSQL_AUTH_TOKEN = token;
  process.env.SESSION_SECRET = crypto.randomBytes(32).toString('hex');
  process.env.ADMIN_PASSWORD = `Gb!${crypto.randomBytes(12).toString('base64url')}`;

  console.log('\n[deploy:easy] Generated a session secret and a strong admin password.');
  console.log('[deploy:easy] Running the full deploy now...\n');

  run(process.execPath, [path.join(__dirname, 'deploy.js')], { shell: false });

  console.log('\n============================================================');
  console.log('SAVE THESE LOGIN DETAILS:');
  console.log('  username: admin');
  console.log(`  password: ${process.env.ADMIN_PASSWORD}`);
  console.log('============================================================');
  console.log('[deploy:easy] Done. Do not share the password above.');
}

try {
  main();
} catch (error) {
  fail(error && error.message ? error.message : String(error));
}
