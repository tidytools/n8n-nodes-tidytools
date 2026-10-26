import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { TidyTools } from '../nodes/TidyTools/TidyTools.node';
import { outputProperties, shapeOutput } from '../nodes/TidyTools/output';
import { fakeContext, ok, run } from './helpers';

const execute = (ctx: ReturnType<typeof fakeContext>) => new TidyTools().execute.call(ctx as never);

test('Raw stays unchanged; Simplify returns at most ten useful fields for every resource', () => {
	const samples = {
		contact: { success: true, url: 'https://example.com', organizationName: 'Example', primaryEmail: 'a@example.com' },
		seoAudit: { success: true, url: 'https://example.com', score: 92, grade: 'A' },
		aiExtract: { success: true, url: 'https://example.com', data: { title: 'Example' } },
		classification: { input: 'example.com', label: 'Technology', confidence: 0.9 },
		transcription: { input: 'https://example.com/a.mp3', text: 'Hello', charged: true },
	};
	for (const [resource, sample] of Object.entries(samples)) {
		const row = { ...sample, unexpected: 'large payload', another: 1 };
		assert.equal(shapeOutput(row, resource, 'raw', false, []), row, resource);
		const simplified = shapeOutput(row, resource, 'raw', true, []);
		assert.ok(Object.keys(simplified).length <= 10, resource);
		assert.ok(!('unexpected' in simplified), resource);
	}
});

test('AI Output modes return selected fields and a stable identifier; errors remain visible', () => {
	const row = { id: 'abc', input: 'site.com', label: 'Retail', confidence: 0.8, error: 'blocked', errorType: 'target_error', success: false, internal: 'hidden' };
	assert.deepEqual(shapeOutput(row, 'classification', 'selected', false, ['label']), {
		id: 'abc', label: 'Retail', success: false, error: 'blocked', errorType: 'target_error',
	});
	assert.deepEqual(shapeOutput(row, 'classification', 'selected', true, ['label']), {
		id: 'abc', label: 'Retail', success: false, error: 'blocked', errorType: 'target_error',
	});
	assert.ok(Object.keys(shapeOutput(row, 'classification', 'simplified', false, [])).length <= 10);
	const ai = { url: 'https://example.com', data: { title: 'Example' }, usage: { tokens: 30 } };
	assert.deepEqual(shapeOutput(ai, 'aiExtract', 'selected', false, ['data']), { url: ai.url, data: ai.data });
});

test('Selected Fields exposes documented top-level fields and returns the chosen values', () => {
	const cases = [
		{ resource: 'contact', identifier: 'url', field: 'pagesChecked', value: 5 },
		{ resource: 'seoAudit', identifier: 'url', field: 'structuredData', value: { valid: true } },
		{ resource: 'aiExtract', identifier: 'url', field: 'charsSent', value: 2400 },
		{ resource: 'classification', identifier: 'input', field: 'siteStatus', value: 'ok' },
		{ resource: 'transcription', identifier: 'input', field: 'meetingNotesUrl', value: 'https://example.com/notes' },
	];
	for (const { resource, identifier, field, value } of cases) {
		const selection = outputProperties.find((property) =>
			property.name === 'selectedFields' && property.displayOptions?.show?.resource?.includes(resource));
		assert.ok(selection?.options?.some((option) => option.value === field), `${resource}: ${field} is selectable`);
		const row = { [identifier]: 'https://example.com/a.mp3', [field]: value };
		assert.deepEqual(shapeOutput(row, resource, 'selected', false, [field]), row);
	}
});

test('every README output field is selectable for its resource', () => {
	const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
	const headings = {
		contact: 'Contact → Extract',
		seoAudit: 'SEO Audit → Audit',
		aiExtract: 'AI Extract → Extract',
		classification: 'Classification → Classify',
		transcription: 'Transcription → Transcribe',
	};
	for (const [resource, heading] of Object.entries(headings)) {
		const section = readme.split(`### ${heading}\n`)[1]?.split('\n### ')[0];
		assert.ok(section, `${resource}: README section exists`);
		const outputLine = section.split('\n').find((line) => line.startsWith('- Output'));
		assert.ok(outputLine, `${resource}: README output line exists`);
		const documented = [...outputLine.matchAll(/`([a-z][A-Za-z0-9]*)`/g)].map((match) => match[1]);
		const selection = outputProperties.find((property) =>
			property.name === 'selectedFields' && property.displayOptions?.show?.resource?.includes(resource));
		const selectable = new Set(selection?.options?.map((option) => option.value));
		for (const field of documented) assert.ok(selectable.has(field), `${resource}: ${field} is selectable`);
	}
});

test('RapidAPI output selection changes n8n item only, not the HTTP request', async () => {
	const response = { success: true, url: 'https://example.com', organizationName: 'Example', pagesChecked: 5 };
	const ctx = fakeContext({
		params: { resource: 'contact', operation: 'extract', url: 'example.com', options: {}, output: 'selected', selectedFields: ['organizationName'] },
		answers: [ok(response)],
	});
	const [out] = await execute(ctx);
	assert.deepEqual(out[0].json, { url: response.url, organizationName: 'Example' });
	assert.equal(ctx.calls[0].request.body?.url, 'example.com');
});

test('Combined Apify run keeps pairing while simplifying each result', async () => {
	const row = { input: 'example.com', label: 'Technology', confidence: 0.9, charged: true, debug: 'large' };
	const ctx = fakeContext({
		params: { resource: 'classification', operation: 'classify', inputType: 'urls', urls: 'example.com', taxonomy: 'industry', options: { combineItems: true }, simplify: true },
		answers: [run('SUCCEEDED'), [row]],
	});
	const [out] = await execute(ctx);
	assert.deepEqual(out[0].pairedItem, { item: 0 });
	assert.equal(out[0].json.label, 'Technology');
	assert.equal(out[0].json.debug, undefined);
});
