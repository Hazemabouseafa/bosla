const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');

async function main() {
  if (process.env.AUTO_SEED_ON_EMPTY === 'false') {
    console.log('[bosla-api] AUTO_SEED_ON_EMPTY=false; skipping initial seed check.');
    return;
  }

  const compiledSeedPath = path.resolve(__dirname, '../dist/seed/seed.js');
  if (!fs.existsSync(compiledSeedPath)) {
    console.warn(`[bosla-api] Compiled seed not found at ${compiledSeedPath}; skipping.`);
    return;
  }

  const prisma = new PrismaClient();
  let adminCount = 0;
  try {
    adminCount = await prisma.user.count({
      where: {
        role: { in: ['ADMIN', 'SUPER_ADMIN'] },
      },
    });
  } finally {
    await prisma.$disconnect();
  }

  if (adminCount > 0) {
    console.log(`[bosla-api] Found ${adminCount} admin account(s); skipping initial auto-seed.`);
    return;
  }

  console.log('[bosla-api] No ADMIN/SUPER_ADMIN users found — running initial production database seed...');
  execFileSync(process.execPath, [compiledSeedPath], {
    stdio: 'inherit',
  });
  console.log('[bosla-api] Initial production database seed finished.');
}

main().catch((err) => {
  console.error('[bosla-api] Failed during initial auto-seed check:', err);
  process.exit(1);
});
