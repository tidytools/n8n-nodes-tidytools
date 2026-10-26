// Test-only module hooks for `node --test` (Node 22.18+ / 24, which strip TypeScript types natively):
// - extensionless relative imports (n8n/tsc style, `./transport`) resolve to the `.ts` file next to them;
// - `n8n-workflow` resolves to the installed package when present (after `npm install`), else to a tiny stub
//   (test/stubs/n8n-workflow.mjs) so the unit tests also run on a machine without node_modules.
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const STUB = new URL('./stubs/n8n-workflow.mjs', import.meta.url).href;

export async function resolve(specifier, context, next) {
	if (specifier === 'n8n-workflow') {
		try {
			// The package's ESM build uses extensionless imports that Node cannot load; its CommonJS build works.
			const require = createRequire(context.parentURL ?? import.meta.url);
			return { url: pathToFileURL(require.resolve(specifier)).href, shortCircuit: true, format: 'commonjs' };
		} catch {
			return { url: STUB, shortCircuit: true, format: 'module' };
		}
	}
	// Tests are .mts so the n8n lint (strict default config, **/*.ts) does not lint Node-only test code.
	if ((specifier.startsWith('./') || specifier.startsWith('../')) && /\.m?ts$/.test(context.parentURL ?? '')) {
		for (const ext of ['.ts', '.mts']) {
			const candidate = new URL(`${specifier}${ext}`, context.parentURL);
			if (!/\.[cm]?[jt]s$/.test(specifier) && existsSync(fileURLToPath(candidate))) {
				return { url: pathToFileURL(fileURLToPath(candidate)).href, shortCircuit: true, format: 'module-typescript' };
			}
		}
	}
	const resolved = await next(specifier, context);
	if (/\.m?ts$/.test(resolved.url)) return { ...resolved, format: 'module-typescript' };
	return resolved;
}
