// Structural checks that mirror the n8n community-node lint rules most often failed in review (sorted options,
// "Whether" booleans, actions on operations, credential wiring), plus the example workflows. `npm run lint` with
// @n8n/node-cli is the authoritative check; these keep the basics green where it cannot run.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';
import { TidyToolsApifyApi } from '../credentials/TidyToolsApifyApi.credentials';
import { TidyToolsRapidApi } from '../credentials/TidyToolsRapidApi.credentials';
import { TidyTools } from '../nodes/TidyTools/TidyTools.node';
import { RAPIDAPI_HOSTS } from '../nodes/TidyTools/transport';

const root = new URL('../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
const description = new TidyTools().description;
const properties = description.properties;

function walk(props: INodeProperties[], visit: (p: INodeProperties) => void) {
	for (const p of props) {
		visit(p);
		if (p.type === 'collection' || p.type === 'fixedCollection') walk((p.options ?? []) as INodeProperties[], visit);
	}
}

test('every options list is sorted by name and every collection by display name', () => {
	walk(properties, (p) => {
		if (p.type === 'options') {
			const names = (p.options as INodePropertyOptions[]).map((o) => o.name);
			assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)), `options of ${p.name}`);
			assert.ok((p.options as INodePropertyOptions[]).some((o) => o.value === p.default), `default of ${p.name}`);
		}
		if (p.type === 'collection') {
			const names = (p.options as INodeProperties[]).map((o) => o.displayName);
			assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)), `collection ${p.name}`);
		}
	});
});

test('booleans start with "Whether", one-sentence descriptions have no final period, multi-sentence ones do', () => {
	walk(properties, (p) => {
		if (!p.description) return;
		if (p.type === 'boolean') assert.match(p.description, /^Whether /, p.name);
		const sentences = p.description.split(/(?<=\.)\s+(?=[A-Z0-9])/).length;
		if (sentences === 1) assert.ok(!p.description.endsWith('.'), `${p.name}: ${p.description}`);
		else assert.ok(p.description.endsWith('.') || p.description.endsWith(').'), `${p.name}: ${p.description}`);
	});
});

test('each resource has one operation parameter with an action, and the right credential', () => {
	const resources = (properties[0].options as INodePropertyOptions[]).map((o) => String(o.value));
	assert.deepEqual(resources.sort(), ['aiExtract', 'classification', 'contact', 'seoAudit', 'transcription']);
	for (const resource of resources) {
		const ops = properties.filter((p) => p.name === 'operation' && p.displayOptions?.show?.resource?.includes(resource));
		assert.equal(ops.length, 1, resource);
		for (const o of ops[0].options as INodePropertyOptions[]) assert.ok(o.action, `${resource}.${o.value} action`);
		const creds = (description.credentials ?? []).filter((c) => (c.displayOptions?.show?.resource as string[]).includes(resource));
		assert.equal(creds.length, 1, `${resource} credential`);
		const expected = ['transcription', 'classification'].includes(resource) ? 'tidyToolsApifyApi' : 'tidyToolsRapidApi';
		assert.equal(creds[0].name, expected);
	}
	assert.equal(description.usableAsTool, true);
});

test('credentials: names match package.json, secrets are password fields, tests hit the hosts the node uses', () => {
	const pkg = JSON.parse(read('package.json'));
	assert.equal(pkg.name, 'n8n-nodes-tidytools');
	assert.ok(pkg.keywords.includes('n8n-community-node-package'));
	assert.equal(pkg.license, 'MIT');
	assert.equal(pkg.dependencies, undefined, 'verified community nodes may not have runtime dependencies');
	assert.deepEqual(pkg.n8n.credentials, [
		'dist/credentials/TidyToolsRapidApi.credentials.js',
		'dist/credentials/TidyToolsApifyApi.credentials.js',
	]);
	assert.deepEqual(pkg.n8n.nodes, ['dist/nodes/TidyTools/TidyTools.node.js']);

	const rapid = new TidyToolsRapidApi();
	const apify = new TidyToolsApifyApi();
	assert.deepEqual([rapid.name, apify.name].sort(), (description.credentials ?? []).map((c) => c.name).sort());
	for (const cred of [rapid, apify]) {
		const secret = cred.properties[0];
		assert.equal(secret.typeOptions?.password, true, cred.name);
		assert.ok(cred.test, `${cred.name} has a credential test`);
	}
	const testRequest = JSON.stringify(rapid.test.request);
	assert.ok(testRequest.includes(RAPIDAPI_HOSTS.contact) && testRequest.includes(RAPIDAPI_HOSTS.seoAudit));
	const codex = JSON.parse(read('nodes/TidyTools/TidyTools.node.json'));
	assert.equal(codex.node, `n8n-nodes-tidytools.${description.name}`);
});

test('example workflows import: valid JSON, known node type, known parameters, connected nodes exist', () => {
	const files = readdirSync(new URL('examples/', root)).filter((f) => f.endsWith('.json'));
	assert.ok(files.length >= 3);
	const topLevel = new Set(properties.map((p) => p.name));
	for (const file of files) {
		const wf = JSON.parse(read(`examples/${file}`));
		const names = new Set(wf.nodes.map((n: { name: string }) => n.name));
		for (const [from, conn] of Object.entries(wf.connections as Record<string, { main: { node: string }[][] }>)) {
			assert.ok(names.has(from), `${file}: ${from}`);
			for (const target of conn.main.flat()) assert.ok(names.has(target.node), `${file}: ${target.node}`);
		}
		for (const node of wf.nodes.filter((n: { type: string }) => n.type === 'n8n-nodes-tidytools.tidyTools')) {
			const params = node.parameters as Record<string, unknown>;
			for (const key of Object.keys(params)) assert.ok(topLevel.has(key), `${file}: ${node.name}.${key}`);
			const collection = properties.find(
				(p) => p.name === 'options' && p.displayOptions?.show?.resource?.includes(params.resource as string),
			);
			const allowed = new Set(((collection?.options ?? []) as INodeProperties[]).map((o) => o.name));
			for (const key of Object.keys((params.options ?? {}) as object)) assert.ok(allowed.has(key), `${file}: ${node.name}.options.${key}`);
		}
	}
});

test('Output controls expose three AI modes and per-resource selected-field lists', () => {
	const output = properties.find((p) => p.name === 'output');
	assert.deepEqual((output?.options as INodePropertyOptions[]).map((o) => o.value), ['raw', 'selected', 'simplified']);
	assert.ok(properties.some((p) => p.name === 'simplify' && p.type === 'boolean'));
	for (const resource of ['contact', 'seoAudit', 'aiExtract', 'classification', 'transcription']) {
		const selector = properties.find((p) => p.name === 'selectedFields' && p.displayOptions?.show?.resource?.includes(resource));
		assert.equal(selector?.type, 'multiOptions', resource);
		assert.deepEqual(selector?.displayOptions?.show?.output, ['selected']);
		const names = (selector?.options as INodePropertyOptions[]).map((o) => o.name);
		assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)), resource);
	}
});