import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function scripts(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? scripts(path) : path.endsWith('.js') ? [path] : [];
    });
}
let failed = false;
for (const path of [...scripts('web/src'), 'web/service-worker.js']) {
    const result = spawnSync(process.execPath, ['--check', path], { stdio: 'inherit' });
    if (result.status !== 0) failed = true;
}
process.exitCode = failed ? 1 : 0;
