// Entry point for `npm test` = `node --test test/run.test.mjs` (Node 22.18+ / 24, which strip TypeScript types
// natively): register.mjs installs test/loader.mjs, then every test/*.test.mts is loaded through it.
import { readdirSync } from 'node:fs';
import './register.mjs';

const dir = new URL('./', import.meta.url);
for (const file of readdirSync(dir).filter((f) => f.endsWith('.test.mts')).sort()) {
	await import(new URL(file, dir).href);
}
