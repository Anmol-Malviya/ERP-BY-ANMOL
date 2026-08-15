import { existsSync } from 'node:fs';
const required = [
  'apps/api/src/server.ts',
  'apps/web/src/main.tsx',
  'apps/super-admin/src/main.tsx',
  'apps/worker/src/index.ts',
  'packages/contracts/src/index.ts',
  'docs/ARCHITECTURE.md',
  'docs/SECURITY.md'
];
const missing = required.filter((p) => !existsSync(new URL(`../${p}`, import.meta.url)));
if (missing.length) {
  console.error('Missing required files:', missing);
  process.exit(1);
}
console.log(`Structure OK (${required.length} critical files present).`);
