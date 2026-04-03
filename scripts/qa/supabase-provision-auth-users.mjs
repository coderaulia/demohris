import fs from 'node:fs';
import path from 'node:path';

function loadDotEnv(filePath = path.join(process.cwd(), '.env')) {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
        const line = String(rawLine || '').trim();
        if (!line || line.startsWith('#')) continue;
        const idx = line.indexOf('=');
        if (idx <= 0) continue;
        const key = line.slice(0, idx).trim();
        let value = line.slice(idx + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"'))
            || (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        if (!key) continue;
        if (!process.env[key]) process.env[key] = value;
    }
}

loadDotEnv();

function env(name, fallback = '') {
    const value = process.env[name];
    return value === undefined || value === null ? fallback : String(value).trim();
}

function required(name) {
    const value = env(name);
    if (!value) throw new Error(`Missing required env var: ${name}`);
    return value;
}

async function parseJsonSafe(response) {
    const text = await response.text();
    if (!text) return {};
    try {
        return JSON.parse(text);
    } catch {
        return { raw: text };
    }
}

async function fetchAllAuthUsers({ supabaseUrl, serviceRoleKey }) {
    const response = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1000`, {
        method: 'GET',
        headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
        },
    });
    const payload = await parseJsonSafe(response);
    if (!response.ok) {
        throw new Error(`Failed to list auth users (${response.status}): ${JSON.stringify(payload)}`);
    }
    return Array.isArray(payload?.users) ? payload.users : [];
}

async function createAuthUser({ supabaseUrl, serviceRoleKey, email, password, employeeId, role, name }) {
    const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            email,
            password,
            email_confirm: true,
            user_metadata: { employee_id: employeeId, name },
            app_metadata: { role },
        }),
    });
    const payload = await parseJsonSafe(response);
    if (response.ok) return payload?.user || null;
    if (response.status === 422 || response.status === 409) return null;
    throw new Error(`Failed creating auth user ${email} (${response.status}): ${JSON.stringify(payload)}`);
}

async function upsertProfile({ supabaseUrl, serviceRoleKey, userId, email, role, employeeId }) {
    const response = await fetch(`${supabaseUrl}/rest/v1/profiles`, {
        method: 'POST',
        headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify([{
            id: userId,
            email,
            role,
            metadata: {
                employee_id: employeeId,
                source: 'seed-auth-provision',
                synced_at: new Date().toISOString(),
            },
        }]),
    });
    if (!response.ok) {
        const payload = await parseJsonSafe(response);
        throw new Error(`Failed upserting profile for ${email} (${response.status}): ${JSON.stringify(payload)}`);
    }
}

async function updateEmployeeAuthMapping({ supabaseUrl, serviceRoleKey, employeeId, email, userId }) {
    const response = await fetch(
        `${supabaseUrl}/rest/v1/employees?employee_id=eq.${encodeURIComponent(employeeId)}`,
        {
            method: 'PATCH',
            headers: {
                apikey: serviceRoleKey,
                Authorization: `Bearer ${serviceRoleKey}`,
                'Content-Type': 'application/json',
                Prefer: 'return=minimal',
            },
            body: JSON.stringify({
                auth_id: userId,
                auth_email: email,
            }),
        }
    );
    if (!response.ok) {
        const payload = await parseJsonSafe(response);
        throw new Error(`Failed updating employee auth mapping for ${employeeId} (${response.status}): ${JSON.stringify(payload)}`);
    }
}

async function main() {
    const supabaseUrl = required('SUPABASE_URL').replace(/\/$/, '');
    const serviceRoleKey = required('SUPABASE_SERVICE_ROLE_KEY');
    const defaultPassword = env('SUPABASE_SEED_USER_PASSWORD', 'Demo123!');

    const accounts = [
        { employeeId: 'ADM001', email: 'admin.demo@xenos.local', role: 'superadmin', name: 'Aulia Pratama' },
        { employeeId: 'HR001', email: 'hr.demo@xenos.local', role: 'hr', name: 'Maya Suryani' },
        { employeeId: 'MGR001', email: 'manager.demo@xenos.local', role: 'manager', name: 'Sinta Wibowo' },
        { employeeId: 'EMP001', email: 'farhan.demo@xenos.local', role: 'employee', name: 'Farhan Akbar' },
    ];

    const existingUsers = await fetchAllAuthUsers({ supabaseUrl, serviceRoleKey });
    const byEmail = new Map(existingUsers.map(user => [String(user?.email || '').toLowerCase(), user]));

    for (const account of accounts) {
        const email = account.email.toLowerCase();
        let user = byEmail.get(email) || null;

        if (!user) {
            user = await createAuthUser({
                supabaseUrl,
                serviceRoleKey,
                email,
                password: defaultPassword,
                employeeId: account.employeeId,
                role: account.role,
                name: account.name,
            });
            if (!user) {
                const refreshed = await fetchAllAuthUsers({ supabaseUrl, serviceRoleKey });
                user = refreshed.find(item => String(item?.email || '').toLowerCase() === email) || null;
            }
        }

        if (!user?.id) {
            throw new Error(`Unable to resolve auth user id for ${email}`);
        }

        await upsertProfile({
            supabaseUrl,
            serviceRoleKey,
            userId: user.id,
            email,
            role: account.role,
            employeeId: account.employeeId,
        });

        await updateEmployeeAuthMapping({
            supabaseUrl,
            serviceRoleKey,
            employeeId: account.employeeId,
            email,
            userId: user.id,
        });

        console.log(`Synced auth user: ${email} -> ${account.employeeId} (${account.role})`);
    }

    console.log('\nSeed auth users and profile mappings are ready.');
}

main().catch(error => {
    console.error('\nSupabase auth user provisioning failed:', error.message);
    process.exit(1);
});
