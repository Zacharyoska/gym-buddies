# Gym Buddies by Jahren & Charles — Subscription & Membership Manager

A complete, local-first membership management system for a single gym. It covers the whole front-desk loop: member profiles, plan sales and renewals, payments and refunds, printable receipts, check-in/out, class bookings and attendance, workout buddy pairs, reporting, and CSV exports.

The app runs locally on the built-in Node.js HTTP server and SQLite driver, with a vanilla JavaScript single-page frontend and a seeded demo database, so you can start testing in under a minute. For Vercel, the same code runs as a serverless handler with hosted Turso/libSQL SQLite and signed cookies. All money is shown in Philippine pesos (PHP), and member QR passes are generated and scanned locally in the browser — no external QR service is needed.

---

## Quick start

**Requirements:** Node.js **24 or newer** (minimum 22.5), no database server required.

```powershell
cd C:\Users\User\gym-buddies
node --version
npm start
```

Open **http://127.0.0.1:3000** and sign in:

| Username | Password |
| --- | --- |
| `admin` | `admin123` |

The first launch creates `data/gym-buddies.db` and fills it with realistic demo data. Stop the server with `Ctrl+C`.

To reset all demo data (destructive) and restore the `admin / admin123` login:

```powershell
npm run seed
```

To start with a clean gym instead of demo records, see **Start with an empty gym** below.

---

## What you can test

### Dashboard
- Live count of members currently in the gym.
- Active memberships, monthly revenue, today's check-ins, and expiring memberships.
- Revenue trend chart, membership status mix, expiring memberships, live check-ins, today's classes, buddy leaderboard, and recent receipts.

### Members
- Search by name, member code, email, or phone; filter by membership state; sort by newest or name.
- Add a member and choose a membership plan in the same step; the profile, membership, and optional paid receipt are created together, so check-in works immediately.
- Edit profiles, including emergency contacts, birth date, notes, and join date.
- Archive and restore profiles without deleting history.
- Member detail pages show a membership pass, a scannable/printable QR check-in pass, visit stats, membership history, payments, check-ins, class bookings, buddy pairs, and contact details.
- Print a wallet-sized QR card or download the QR as an SVG file from the member's profile.

### Plans
- Create and edit plans with price, duration, and feature lists.
- Retire or re-list a plan. Existing memberships keep their original terms.
- See active memberships and total sales per plan.

### Memberships
- Sell a plan with an optional payment recorded at the same time, either from Add member or from an existing member's profile.
- Renew by choosing a start date; the app suggests the day after the latest membership ends and blocks overlapping periods.
- Freeze and resume a membership. Resuming pushes the end date forward by the frozen days.
- Cancel a membership immediately.
- Scheduled memberships become active automatically when their start date arrives; expired memberships are refreshed on every authenticated request.

### Payments
- Record membership, personal-training, retail, or general payments.
- Every payment gets a sequential receipt number.
- View printable receipts and export all payments to CSV.
- Filter by method, status, date range, or free-text search.
- Refund a payment: the record stays in history but is excluded from revenue totals.

### Check-in / front desk
- Scan a member's QR pass with the front-desk camera and they are checked in immediately; a USB QR scanner works too, because the QR contains the member code.
- Type or paste a member code (`GB-0001`) as a fallback, with a live preview of the member and membership state.
- Print a QR pass from any member profile and hand it to the member; the code is plain text, so a phone camera or any QR reader can show it.
- Expired, frozen, scheduled, archived, or already-checked-in members are blocked with a clear reason.
- Check members out from the live list or today's visit log.
- See visit totals, unique visitors, average completed visit length, and export visits to CSV.

Camera scanning needs the app open at `127.0.0.1` or over HTTPS, and the browser must allow camera access. On a plain-HTTP LAN address, use a USB QR scanner or type the code.

### Classes
- Create sessions with coach, room, start time, duration, capacity, and description.
- Book active members with a membership covering the class date.
- Prevent duplicate bookings and over-capacity bookings.
- Mark bookings as attended, no-show, or cancelled; re-book a cancelled spot.
- Cancel a class while keeping its booking history visible.
- Browse upcoming, past, or all sessions.

### Workout buddies
- Pair any two active members and set a 1–7 day weekly shared-workout goal.
- Shared workout days are detected automatically: a day counts when both buddies check in on the same date.
- Streaks count consecutive weeks with at least one shared workout.
- Leaderboard, pair cards, per-pair goals, and end-pair support.

### Reports
- Revenue over 3, 6, or 12 months.
- New members in the period, 30-day attendance, visits per active member, and expiring count.
- Membership status distribution, attendance trend, payment-method mix, plan mix, most active members, and class utilization/fill rate.
- One-click CSV exports for members, payments, and check-ins.

---

## Common tasks

### Start with an empty gym

The demo records are useful for exploring the app, but you will want a clean database for real members. This deletes all recorded members, memberships, payments, check-ins, classes, bookings, and buddy pairs while keeping the staff login and membership plans:

```powershell
npm run clear
```

The command asks you to type `clear` before deleting anything. For scripts, add `--yes`. To also delete the seeded membership plans so you can set up your own:

```powershell
npm run clear -- --yes --all
```

Nothing is deleted from the staff accounts, so `admin / admin123` (or your changed password) keeps working. `npm run seed` brings back the full demo at any time. Stop the app with `Ctrl+C` first if the clear command reports that the database is busy.

### Change the staff password

The demo password should not survive real deployment. Stop using the demo password with:

```powershell
npm run set-password -- admin "a-long-new-password"
```

The change applies to future sign-ins immediately. Passwords are stored as salted `scrypt` hashes.

### Run the automated tests

```powershell
npm test
```

The suite starts the real HTTP app on an ephemeral port against an isolated temporary SQLite database, then exercises authentication, CSRF protection, members, plans, memberships, payments/refunds/receipts, check-ins, buddies, classes/bookings, reporting, CSV exports, and logout. It runs twice: once against the local `node:sqlite` driver and once through an async driver shim that proves every database call works with hosted mode. No network or external services are used.

### Recommended editor and database viewer

Use **Visual Studio Code** (free). Open the `gym-buddies` folder and use its integrated terminal for `npm start`, `npm test`, and `npm run clear`.

Yes, the app uses a real database: a local SQLite file at `data\gym-buddies.db`, accessed through Node 24's built-in `node:sqlite`. You do not need to install MySQL, PostgreSQL, or any database server.

To browse the tables, install a VS Code extension such as **SQLite Viewer** or **SQLite3 Editor**, then open `data\gym-buddies.db`. Keep the app stopped while editing records directly, or use the app UI so membership and payment rules stay consistent.

### Back up the database

Stop the app, then copy:

```text
data\gym-buddies.db
```

SQLite may also create `gym-buddies.db-wal` and `gym-buddies.db-shm` while running. Copying the main `.db` file while the server is stopped is the safest simple backup.

### Run on another port or host

PowerShell:

```powershell
$env:PORT=3001
$env:HOST='0.0.0.0'
npm start
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `HOST` | `127.0.0.1` | Bind address; use `0.0.0.0` for LAN access |
| `DB_PATH` | `data/gym-buddies.db` | Local SQLite file location |
| `LIBSQL_URL` | — | Hosted libSQL/Turso URL; selects the remote driver when set |
| `LIBSQL_AUTH_TOKEN` | — | Turso auth token for the hosted database |
| `SESSION_SECRET` | local dev fallback | HMAC secret for signed cookies; required on Vercel |
| `SECURE_COOKIES` | off | Set to `1` when serving over HTTPS; automatic on Vercel |
| `ADMIN_PASSWORD` | — | Sets the admin password at startup when provided; also used by `npm run setup:remote` |

If you expose the app to a LAN, set `SECURE_COOKIES=1` behind HTTPS, use a real password, and restrict access at the firewall. For public deployment, follow the Vercel steps below and change the default admin password.

---

## Deploy to Vercel

The project is ready for Vercel. Local `npm start` still uses `data/gym-buddies.db`; Vercel uses `api/index.js` and hosted SQLite because the serverless filesystem is temporary. Sessions are signed cookies, so they survive separate function invocations.

### Using only the Vercel website

The Vercel dashboard imports from GitHub/GitLab/Bitbucket, so first push this folder to a repository. Then:

1. In [Turso](https://turso.tech/), create a database in **Singapore (`aws-ap-southeast-1`)**. Copy its `libsql://...` URL and create an auth token.
2. In Vercel, click **Add New… → Project**, import the repository, choose **Framework Preset: Other**, leave Build Command and Output Directory empty, and click **Deploy**.
3. Go to **Project Settings → Environment Variables** and add:

   | Name | Value |
   | --- | --- |
   | `LIBSQL_URL` | The `libsql://...` URL from Turso |
   | `LIBSQL_AUTH_TOKEN` | The token from Turso |
   | `SESSION_SECRET` | A long random string |
   | `ADMIN_PASSWORD` | A strong password you choose |

4. Open **Deployments**, choose the latest deployment, click **⋯ → Redeploy** so the new variables apply.
5. Open `/api/health`. Sign in with `admin` and the `ADMIN_PASSWORD` you set.

You only need the first Vercel deploy to create the project; the redeploy is what applies the environment variables.

### Zero-manual-setup deploy

Install the Turso CLI once, then run one command:

```powershell
# Windows — install Turso CLI, then reopen PowerShell
irm https://github.com/tursodatabase/turso/releases/latest/download/turso_cli-installer.ps1 | iex

npm install
npm run deploy:easy
```

`npm run deploy:easy` opens browser logins for Turso and Vercel, creates the hosted database in Singapore, generates a secure `SESSION_SECRET` and a strong admin password, seeds the database, uploads the three Vercel environment variables, and deploys. At the end it prints the admin username/password once — save them. You do not paste any URL or token anywhere.

The only unavoidable setup is having a Turso account and a Vercel account; the command handles the rest.

### If you already have a Turso database

Set four variables in the same PowerShell window and run:

```powershell
$env:LIBSQL_URL = "libsql://your-database.turso.io"
$env:LIBSQL_AUTH_TOKEN = "your-turso-auth-token"
$env:SESSION_SECRET = $(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
$env:ADMIN_PASSWORD = "ChooseAStrongPassword123"

npm run deploy
```

`npm run deploy` checks the values, initializes the hosted database, uploads `LIBSQL_URL`, `LIBSQL_AUTH_TOKEN`, and `SESSION_SECRET` to Vercel for Production and Preview, then deploys. `ADMIN_PASSWORD` is used locally only and is **never** stored in Vercel.

Use `npm run deploy:check` if you only want to test the database connection and setup without deploying.

`vercel.json` pins the function region to `sin1` (Singapore) to match the recommended Turso location `aws-ap-southeast-1`. If you chose Turso `aws-us-east-1` instead, change `"regions": ["sin1"]` to `"regions": ["iad1"]`.

### 1. Create a hosted SQLite database

Create a [Turso](https://turso.tech/) database, then copy its URL and create an auth token:

```powershell
turso db create gym-buddies
turso db show gym-buddies --url
turso db tokens create gym-buddies
```

### 2. Initialize the hosted database from your computer

```powershell
npm install
$env:LIBSQL_URL = "libsql://your-database.turso.io"
$env:LIBSQL_AUTH_TOKEN = "your-turso-auth-token"
$env:ADMIN_PASSWORD = "choose-a-strong-admin-password"
npm run setup:remote
```

`npm run setup:remote` creates the schema, seeds demo data only when the database is empty, and updates the `admin` password from `ADMIN_PASSWORD`. Do not run `npm run seed` against data you want to keep. To clear only recorded gym data later, set the same database variables and run `npm run clear`.

### 3. Deploy

Import the `gym-buddies` folder into Vercel with **Framework Preset: Other**. Leave the build command and output directory empty. Add these Environment Variables for Production (and Preview/Development if you use them):

| Variable | Value |
| --- | --- |
| `LIBSQL_URL` | The URL from `turso db show` |
| `LIBSQL_AUTH_TOKEN` | The token from `turso db tokens create` |
| `SESSION_SECRET` | A long random string, e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

`SESSION_SECRET` is required in production. Rotating it signs everyone out. Vercel sets `VERCEL` automatically, which enables `HttpOnly`, `Secure`, `SameSite=Strict` cookies. `vercel.json` routes API requests to the serverless handler and lets Vercel serve the `public/` assets directly.

### 4. Verify and use

Open `/api/health`; it should return `200` with `"app":"Gym Buddies by Jahren & Charles"`. Sign in with `admin` and the password you set in step 2. Camera QR scanning works on Vercel because the site is HTTPS; a USB scanner or manual member code also works.

> **Before going public:** never leave `admin / admin123` as the password. Members are created by staff only; there is no public signup. This is an internal front-desk tool, so restrict access further with Vercel password protection or your firewall.

---

## Other easy hosting options

You are not locked to Vercel. The same `npm start` server runs on any Node host, so you can reuse the Turso database and these three variables:

| Variable | Value |
| --- | --- |
| `LIBSQL_URL` | The URL from Turso |
| `LIBSQL_AUTH_TOKEN` | The token from Turso |
| `SESSION_SECRET` | A long random string |

`ADMIN_PASSWORD` is only needed locally when you run `npm run setup:remote` or `npm run deploy`; do not add it to the host. When `PORT` is set, the server binds to `0.0.0.0` so the platform's proxy can reach it, and secure cookies turn on automatically for Render, Railway, Fly.io, and Vercel.

### Render — easiest if you have GitHub

1. Push the `gym-buddies` folder to a GitHub repository.
2. Render Dashboard → **New + → Web Service** → connect the repo.
3. Runtime: **Node**. Build command: `npm install`. Start command: `npm start`.
4. Add the three environment variables above.
5. Create the service. Open `/api/health` to verify.

The Render free tier sleeps when idle; a paid instance stays online. Your data remains in Turso either way.

### Railway — easiest without GitHub

```powershell
npm i -g @railway/cli
railway login
railway init
railway variables set LIBSQL_URL="libsql://your-database.turso.io"
railway variables set LIBSQL_AUTH_TOKEN="your-turso-auth-token"
railway variables set SESSION_SECRET="a-long-random-string"
railway up
```

Railway detects `npm start`, assigns a public HTTPS URL, and keeps the Node process running.

### Fly.io

`fly launch`, then `fly secrets set LIBSQL_URL=... LIBSQL_AUTH_TOKEN=... SESSION_SECRET=...`, then `fly deploy`. It is reliable but has more setup than Render or Railway.

Netlify and Cloudflare Workers are **not** the easy path here: they do not run this Node HTTP server directly and would need code changes.

---

## Architecture

- **Runtime:** Node.js 24 locally; a Vercel serverless handler at `api/index.js`. The QR libraries are vendored under `public/js/vendor/`; `@libsql/client` is used only for hosted SQLite.
- **Database:** local SQLite through built-in `node:sqlite` (WAL mode, foreign keys on, transactional writes), or hosted Turso/libSQL SQLite via `openConfiguredDatabase()` in `lib/db.js`.
- **Backend:** custom HTTP dispatcher (`lib/app.js`), a small router, REST handlers in `lib/routes/`, domain rules in `lib/domain.js`, metrics in `lib/metrics.js`.
- **Frontend:** vanilla ES modules, hash-based SPA router, no build step. The UI is served from `public/`; the top bar and drawer have spring animations with reduced-motion fallbacks.
- **QR:** member passes encode the member code. QR generation uses vendored `qrcode-generator`; camera scanning uses vendored `jsQR` and runs entirely in the browser.
- **Auth:** scrypt password hashes and stateless HMAC-SHA256 `gb_session` cookies with `HttpOnly`, `Secure` on Vercel, `SameSite=Strict`, and a 12-hour expiry.
- **Protection:** all mutations require the custom `X-Gym-App: 1` header (CSRF defense), login attempts are rate-limited in the `login_attempts` table so throttling works across invocations, and responses carry CSP, frame, MIME-sniffing, and referrer headers.
- **Dates:** the server's local date drives membership state, reports, and check-ins. Seed dates are generated relative to the day you run `npm run seed`, so the demo always looks current.
- **Currency:** amounts are stored as integer centavos and displayed as Philippine pesos (`₱`) across the UI, receipts, and CSV exports.

### Project layout

```text
gym-buddies/
├─ server.js                 local long-running HTTP server
├─ api/index.js              Vercel serverless handler
├─ vercel.json               Vercel routes and function config
├─ .env.example              environment variable template
├─ lib/
│  ├─ app.js                 request dispatcher, auth, CSRF, static files
│  ├─ db.js                  schema, local driver, hosted libSQL adapter, transactions
│  ├─ auth.js                password hashes and signed stateless sessions
│  ├─ domain.js              membership/payment/check-in/buddy rules
│  ├─ metrics.js             dashboard and report queries
│  ├─ maintenance.js         clear recorded data, keep staff
│  ├─ seed.js                relative-date demo data generator
│  ├─ dates.js               ISO date helpers
│  ├─ validate.js            request validation
│  ├─ http.js                router, cookies, JSON/static responses
│  └─ routes/                REST endpoint modules
├─ public/
│  ├─ index.html             SPA shell and SVG icon sprite
│  ├─ css/styles.css         design system, motion system, print styles
│  └─ js/
│     ├─ main.js             login, shell, router, actions, forms
│     ├─ api.js              fetch wrapper and session-expiry event
│     ├─ ui.js               formatting, modals, toasts, charts
│     ├─ qr.js               QR passes, printing, camera scanner
│     ├─ modals.js           create/edit/receipt dialogs
│     ├─ vendor/             vendored QR generator + scanner (offline)
│     └─ views/              dashboard, members, plans, payments,
│                            check-ins, classes, buddies, reports
├─ scripts/
│  ├─ seed.js                reset demo data
│  ├─ clear-data.js          remove recorded data, keep staff
│  ├─ set-password.js        change a staff password
│  ├─ remote-setup.js        initialize hosted database + admin password
│  └─ run-async-tests.js     promise-driver regression runner
├─ tests/                    end-to-end HTTP and maintenance tests
└─ data/gym-buddies.db       generated locally on first run (not committed)
```

### Database tables

`staff`, `login_attempts`, `members`, `plans`, `subscriptions`, `payments`, `checkins`, `classes`, `bookings`, and `buddy_pairs`. Foreign keys preserve history when profiles are archived or plans are retired; destructive deletes are not exposed through the app.

---

## API reference

All endpoints are under `/api`. Authenticated requests use the `gb_session` cookie. Mutations (`POST`, `PATCH`, `PUT`, `DELETE`) also require:

```http
X-Gym-App: 1
Content-Type: application/json
```

Errors return a JSON body such as `{ "error": "Member not found." }` with an appropriate status code.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Public health check |
| `POST` | `/api/auth/login` | Sign in (`username`, `password`) |
| `POST` | `/api/auth/logout` | Destroy the current session |
| `GET` | `/api/auth/me` | Current staff user |
| `GET` | `/api/dashboard` | KPIs, charts, live check-ins, today's classes |
| `GET` | `/api/members` | Search/filter/paginate members |
| `POST` | `/api/members` | Create a member |
| `GET` | `/api/members/:id` | Full member detail |
| `PATCH` | `/api/members/:id` | Update a member |
| `POST` | `/api/members/:id/archive` | Deactivate a profile |
| `POST` | `/api/members/:id/restore` | Reactivate a profile |
| `GET` | `/api/members/lookup?code=GB-0001` | Front-desk lookup used by QR scanning |
| `POST` | `/api/members/:id/subscriptions` | Sell/renew a membership |
| `POST` | `/api/subscriptions/:id/freeze` | Freeze a membership |
| `POST` | `/api/subscriptions/:id/unfreeze` | Resume and extend |
| `POST` | `/api/subscriptions/:id/cancel` | Cancel a membership |
| `GET` | `/api/plans` | Sellable plans (`?all=1` includes retired) |
| `POST` | `/api/plans` | Create a plan |
| `PATCH` | `/api/plans/:id` | Edit a plan |
| `POST` | `/api/plans/:id/toggle` | Retire / re-list |
| `GET` | `/api/payments` | Search/filter/paginate payments |
| `POST` | `/api/payments` | Record a payment |
| `GET` | `/api/payments/:id/receipt` | Receipt data |
| `POST` | `/api/payments/:id/refund` | Mark a payment refunded |
| `GET` | `/api/checkins/today` | Live visits and today's log |
| `POST` | `/api/checkins` | Check in by `code` or `member_id` |
| `POST` | `/api/checkins/:id/checkout` | Close a visit |
| `GET` | `/api/classes` | Schedule; `scope` is upcoming, past, or all |
| `POST` | `/api/classes` | Create a session |
| `GET` | `/api/classes/:id` | Session and booking list |
| `PATCH` | `/api/classes/:id` | Edit or cancel a session |
| `POST` | `/api/classes/:id/bookings` | Book a member |
| `POST` | `/api/bookings/:id/status` | Attended / no-show / cancelled / booked |
| `GET` | `/api/buddies` | Pairs, leaderboard, shared stats |
| `POST` | `/api/buddies` | Create/re-pair buddies |
| `POST` | `/api/buddies/:id/end` | End a pair |
| `GET` | `/api/reports?months=6` | Business report (3, 6, or 12 months) |
| `GET` | `/api/export/members.csv` | Member export |
| `GET` | `/api/export/payments.csv` | Payment export |
| `GET` | `/api/export/checkins.csv` | Visit export |

Example flow:

```powershell
# Sign in and keep the session cookie
$login = '{"username":"admin","password":"admin123"}'
curl.exe -i -c cookies.txt -H "X-Gym-App: 1" -H "Content-Type: application/json" `
  -d $login http://127.0.0.1:3000/api/auth/login

# Dashboard
curl.exe -b cookies.txt http://127.0.0.1:3000/api/dashboard

# Check in by member code
$checkin = '{"code":"GB-0001"}'
curl.exe -b cookies.txt -H "X-Gym-App: 1" -H "Content-Type: application/json" `
  -d $checkin http://127.0.0.1:3000/api/checkins
```

There is no separate QR endpoint: the QR holds the plain member code, so the camera scanner, a USB QR scanner, and manual entry all use the same lookup and check-in calls above. QR images are generated in the browser from that code; any standard QR reader can display the pass.

---

## Demo data

`npm run seed` rebuilds a coherent dataset around **today's date**:

- 1 staff account (`admin / admin123`)
- 32 members with a mix of active, expiring, frozen, expired, scheduled, and inactive states
- 5 plans from day pass to annual, priced in pesos (₱300 day pass up to ₱14,000 annual)
- roughly 70 memberships and 80 receipts
- several hundred check-ins across recent weeks
- past and upcoming classes with bookings and attendance
- several active buddy pairs with shared-day history

This makes the dashboard, reports, class utilization, and buddy streaks immediately meaningful. Resetting is safe for demos; do not run it against data you want to keep.

---

## Troubleshooting

**Port 3000 is already in use.** Run on another port: `$env:PORT=3001; npm start`.

**`node:sqlite` errors or unexpected syntax errors.** Check `node --version`; use Node 24 LTS or newer.

**Sign-in is temporarily blocked.** Eight failed attempts from one address trigger a 15-minute block. The counter is stored in the database, so wait it out; restarting the server does not clear it.

**The demo looks stale.** `npm run seed` regenerates dates relative to today. Prices are demo amounts in pesos; change them under **Plans** for your gym.

**I forgot the staff password.** Locally, run `npm run set-password -- admin "new-password"`. On Vercel, set `LIBSQL_URL`, `LIBSQL_AUTH_TOKEN`, and `ADMIN_PASSWORD`, then run `npm run setup:remote`. Resetting the demo with `npm run seed` also restores `admin / admin123`.

**The camera scanner says scanning is unavailable or permission was denied.** Open the app at `127.0.0.1` (or serve it over HTTPS), allow camera access in the browser's address-bar prompt, and close other apps using the camera. A phone camera or a USB QR scanner also works — the QR is just the member code. You can always type the code into the front-desk field.

**`npm run clear` reports that the database is busy.** Stop the running app with `Ctrl+C` in its terminal, then run the clear command again. The server keeps the SQLite database open while it runs.

---

## Third-party notices

The browser loads two small vendored QR libraries on demand from `public/js/vendor/` so scanning and generation work offline. The only npm dependency is `@libsql/client`, used for hosted Vercel/Turso deployments:

- **qrcode-generator 1.4.4** by Kazuhiko Arase — MIT license. The notice is kept in the source header and a copy is in `public/js/vendor/LICENSE-qrcode-generator.txt`.
- **jsQR 1.4.0** by Cosmo Wolfe and Jefff Nelson — Apache License 2.0, in `public/js/vendor/LICENSE-jsqr.txt`.

See `public/js/vendor/README.md` for links and details. All other code in this project is MIT licensed.

---

## Scope and limitations

This is a real, runnable single-gym system, not a payment processor. Card, cash, online, and bank methods are bookkeeping labels — no gateway charge is made. There is no recurring auto-billing, email/SMS delivery, member-facing portal, or multi-branch tenancy. Signed sessions survive restarts and serverless invocations until they expire; changing `SESSION_SECRET` signs everyone out. For production use, keep a strong admin password, a proper database backup routine, and consider an external identity/payment integration as needed.

## License

MIT
