const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const compiledSeed = path.resolve(__dirname, '../dist/seed/seed.js');
const tsSeed = path.resolve(__dirname, '../prisma/seed.ts');

if (fs.existsSync(compiledSeed)) {
  execFileSync(process.execPath, [compiledSeed], { stdio: 'inherit' });
} else {
  execFileSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['tsx', tsSeed],
    { stdio: 'inherit', cwd: path.resolve(__dirname, '..') },
  );
}
