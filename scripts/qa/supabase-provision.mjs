import fs from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';

const rootDir = process.cwd();
const cliWorkdir = rootDir;

function loadDotEnv(filePath = path.join(rootDir, '.env')) {
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

function env(name) {
    return String(process.env[name] || '').trim();
}

function mask(value) {
    if (!value) return '<missing>';
    if (value.length <= 6) return '***';
    return `${value.slice(0, 3)}***${value.slice(-3)}`;
}

function run(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            stdio: 'pipe',
            shell: true,
            ...options,
        });

        let stdout = '';
        let stderr = '';
        child.stdout.on('data', chunk => {
            const text = chunk.toString();
            stdout += text;
            process.stdout.write(text);
        });
        child.stderr.on('data', chunk => {
            const text = chunk.toString();
            stderr += text;
            process.stderr.write(text);
        });

        child.on('close', code => {
            if (code === 0) resolve({ stdout, stderr });
            else reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code}`));
        });
    });
}

async function applyMigrations(envLabel, projectRef, dbPassword) {
    console.log(`\n==> Applying migrations to ${envLabel} (ref: ${projectRef})`);
    await run('npx', [
        'supabase@latest',
        'link',
        '--project-ref',
        projectRef,
        '--password',
        dbPassword,
        '--workdir',
        cliWorkdir,
    ], {
        env: { ...process.env, SUPABASE_ACCESS_TOKEN: env('SUPABASE_ACCESS_TOKEN') },
    });

    await run('npx', [
        'supabase@latest',
        'db',
        'push',
        '--yes',
        '--workdir',
        cliWorkdir,
    ], {
        env: { ...process.env, SUPABASE_ACCESS_TOKEN: env('SUPABASE_ACCESS_TOKEN') },
    });

    const seedFile = path.join(rootDir, 'supabase', 'seeds', 'seed_dev_staging.sql');
    if (!fs.existsSync(seedFile)) {
        console.log(`- Seed skipped for ${envLabel}: ${seedFile} not found.`);
        return;
    }

    console.log(`- Applying seed file to ${envLabel}: ${seedFile}`);
    await run('npx', [
        'supabase@latest',
        'db',
        'query',
        '--linked',
        '--file',
        seedFile,
        '--workdir',
        cliWorkdir,
    ], {
        env: { ...process.env, SUPABASE_ACCESS_TOKEN: env('SUPABASE_ACCESS_TOKEN') },
    });
}

async function main() {
    const accessToken = env('SUPABASE_ACCESS_TOKEN');
    const devRef = env('SUPABASE_PROJECT_REF_DEV');
    const stagingRef = env('SUPABASE_PROJECT_REF_STAGING');
    const devDbPassword = env('SUPABASE_DB_PASSWORD_DEV') || env('SUPABASE_DB_PASSWORD');
    const stagingDbPassword = env('SUPABASE_DB_PASSWORD_STAGING') || env('SUPABASE_DB_PASSWORD');

    console.log('Supabase provisioning inputs:');
    console.log(`- SUPABASE_ACCESS_TOKEN: ${mask(accessToken)}`);
    console.log(`- SUPABASE_PROJECT_REF_DEV: ${mask(devRef)}`);
    console.log(`- SUPABASE_PROJECT_REF_STAGING: ${mask(stagingRef)}`);
    console.log(`- SUPABASE_DB_PASSWORD_DEV: ${mask(devDbPassword)}`);
    console.log(`- SUPABASE_DB_PASSWORD_STAGING: ${mask(stagingDbPassword)}`);

    if (!accessToken || !devRef || !stagingRef || !devDbPassword || !stagingDbPassword) {
        console.log('\nProvisioning skipped: missing required Supabase environment variables.');
        process.exit(2);
    }

    await applyMigrations('dev', devRef, devDbPassword);
    await applyMigrations('staging', stagingRef, stagingDbPassword);

    console.log('\nSupabase migration and seed baseline applied to dev and staging.');
}

main().catch(error => {
    console.error('\nSupabase provisioning failed:', error.message);
    process.exit(1);
});
