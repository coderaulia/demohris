import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrationDir = path.join(root, 'migrations');

if (!fs.existsSync(migrationDir)) {
    throw new Error('migrations directory not found.');
}

const files = fs.readdirSync(migrationDir)
    .filter(name => name.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

const failures = [];

const bannedPatterns = [
    { regex: /\bdrop\s+table\b/i, label: 'DROP TABLE is not allowed in safe migrations' },
    { regex: /\btruncate\b/i, label: 'TRUNCATE is not allowed in safe migrations' },
    { regex: /\bdelete\s+from\b/i, label: 'DELETE FROM is not allowed in safe migrations' },
    { regex: /disable\s+row\s+level\s+security/i, label: 'Disabling RLS is not allowed' },
];

for (const file of files) {
    const fullPath = path.join(migrationDir, file);
    const sql = fs.readFileSync(fullPath, 'utf8');
    const sanitizedSql = sql
        .replace(/--.*$/gm, '')
        .replace(/\/\*[\\s\\S]*?\*\//g, '');
    const normalized = sanitizedSql.toLowerCase();

    if (!/^\d{8}_[a-z0-9_]+\.sql$/.test(file)) {
        failures.push(`${file}: filename must match YYYYMMDD_description.sql`);
    }

    if (!/\bbegin\s*;/i.test(normalized)) {
        failures.push(`${file}: missing BEGIN; transaction wrapper`);
    }

    if (!/\bcommit\s*;/i.test(normalized)) {
        failures.push(`${file}: missing COMMIT; transaction wrapper`);
    }

    for (const pattern of bannedPatterns) {
        if (pattern.regex.test(sanitizedSql)) {
            failures.push(`${file}: ${pattern.label}`);
        }
    }
}

console.log('=== Migration Safety Check ===');
console.log(`migrations_scanned: ${files.length}`);

if (failures.length > 0) {
    console.error(`failed_checks: ${failures.length}`);
    failures.forEach(item => console.error(`- ${item}`));
    process.exit(1);
}

console.log('failed_checks: 0');
console.log('Migration safety checks passed.');
