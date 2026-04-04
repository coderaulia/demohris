import { promises as fs } from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const sourceDir = path.resolve(cwd, 'dist');

async function ensureSourceExists() {
    const stat = await fs.stat(sourceDir).catch(() => null);
    if (!stat || !stat.isDirectory()) {
        throw new Error(`Build output not found at ${sourceDir}`);
    }
}

async function mirrorDist() {
    await ensureSourceExists();

    const targets = [
        // For root-based deploys expecting ./dist
        path.resolve(cwd, '../../dist'),
        // For Hostinger cases that resolve output path relative to app root unexpectedly
        path.resolve(cwd, 'apps/web-react/dist'),
    ];

    for (const target of targets) {
        if (target === sourceDir) continue;
        await fs.rm(target, { recursive: true, force: true });
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.cp(sourceDir, target, { recursive: true, force: true });
    }

    console.log('[mirror-dist] source:', sourceDir);
    for (const target of targets) {
        if (target === sourceDir) continue;
        console.log('[mirror-dist] mirrored:', target);
    }
}

mirrorDist().catch(error => {
    console.error('[mirror-dist] failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
});

