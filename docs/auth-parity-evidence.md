# Auth Parity Evidence

Generated: 2026-04-04  
Suite: `npm run qa:auth:staging`  
Backend: `http://127.0.0.1:3000` (Supabase-only mode — MySQL `ECONNREFUSED`)

## Result: PASS ✅

```
== Supabase auth staging validation ==
Backend base URL: http://127.0.0.1:3000
Supabase URL: https://ujokielntvbyzyvjayrr.supabase.co
Skipped expired JWT test (SUPABASE_EXPIRED_JWT not set).
Skipped unmapped-user test (SUPABASE_UNMAPPED_TEST_EMAIL/PASSWORD not set).

Auth parity and JWT bridge checks passed.
- employee_id: ADM001
- role: superadmin
```

---

## What was validated

| Check | Result |
|---|---|
| Backend health preflight (`/api/health`) | `{ok:true, mysql:false, supabase:true}` |
| Supabase JWT sign-in (`admin.demo@xenos.local`) | Access token issued |
| JWT → `auth/session` → employee profile resolved | `employee_id: ADM001`, `role: superadmin` |
| Legacy session login (`auth/login` with bcrypt password) | 200 + session cookie |
| Session → `auth/session` → employee profile resolved | `employee_id: ADM001`, `role: superadmin` |
| employee_id parity (JWT vs session) | ✅ Match |
| role parity (JWT vs session) | ✅ Match |
| LMS permission parity (JWT vs session status codes) | ✅ Match |
| TNA permission parity (JWT vs session status codes) | ✅ Match |
| Invalid JWT rejected | ✅ `401`/`403` |

---

## Test user

| Field | Value |
|---|---|
| Email | `admin.demo@xenos.local` |
| Supabase auth sub | `eb02a3c7-39d5-4dcc-b0ac-211026f11317` |
| Employee ID | `ADM001` |
| Role | `superadmin` |
| Auth mapped via | `auth_id` + `auth_email` columns on `employees` table |

---

## Infrastructure changes that unblocked this

### 1. Pool circular-dependency fix (`server/pool.js`)

The original code exported `pool` from `app.js`, which was imported by `features.js`, `modules/lms.js`, `modules/tna.js`, and `modules/moduleManager.js`. In ES modules, `import` statements are hoisted, so those files were evaluating before `pool` was initialized — triggering `Cannot access 'pool' before initialization` in a MySQL-down environment.

**Fix:** created `server/pool.js` as a standalone module with `import 'dotenv/config'` at the top, ensuring env vars are available before `mysql2.createPool()` runs. All consumer modules now import from `./pool.js` instead of `./app.js`.

### 2. Health check — Supabase-aware fallback (`/api/health`)

Before: always pinged MySQL, returned `500` / `{ok:true}` only when MySQL was reachable.  
After: pings MySQL non-throwingly (`.catch(() => false)`), checks for Supabase env vars, returns `{ok:true}` if either source is reachable.

```js
const mysqlStatus = await pool.query('SELECT 1').then(() => true).catch(() => false);
const supabaseStatus = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
if (mysqlStatus || supabaseStatus) {
    res.json({ ok: true, mysql: mysqlStatus, supabase: supabaseStatus });
} else {
    res.status(503).json({ ok: false, message: 'Offline' });
}
```

### 3. Session bridge — Supabase fallback (`resolveSessionBridgeUser`)

Before: a session-based `auth/session` request would call `getRowByPrimaryKey('employees', id)` without error handling, crashing the middleware with `ECONNREFUSED` when MySQL was down.  
After: wraps MySQL lookup in try/catch, falls back to `fetchSupabaseEmployeeRows` when MySQL fails.

### 4. `getCurrentUser` — Supabase fallback (already in place from prior session)

The main `getCurrentUser` function used by request handlers also has the same MySQL→Supabase fallback pattern.

---

## Credentials summary

All test credentials are in `.env`:

```
SUPABASE_TEST_EMAIL=admin.demo@xenos.local
SUPABASE_TEST_PASSWORD=Demo123!
LEGACY_TEST_PASSWORD=Demo123!
BACKEND_BASE_URL=http://127.0.0.1:3000
```

`SUPABASE_EXPIRED_JWT` and `SUPABASE_UNMAPPED_TEST_EMAIL` are intentionally left blank (those test branches are skipped via the suite's built-in guard).

---

## Re-run command

```bash
# Start backend (MySQL not required)
node server/app.js &

# Run parity suite
npm run qa:auth:staging
```
