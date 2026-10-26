import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TidyTools } from '../nodes/TidyTools/TidyTools.node';
import { RAPIDAPI_HOSTS, splitList } from '../nodes/TidyTools/transport';
import { fakeContext, ok } from './helpers';

// Trimmed from the real /api/v1/contacts answer for stumptowncoffee.com (marketing example, 2026-10).
const CONTACTS = {
	success: true,
	url: 'https://stumptowncoffee.com/',
	domain: 'stumptowncoffee.com',
	organizationName: 'Stumptown Coffee Roasters',
	primaryEmail: 'info@stumptowncoffee.com',
	primaryPhone: '+18777113385',
	emails: ['info@stumptowncoffee.com'],
	phones: ['+18777113385'],
	socialProfiles: { instagram: 'https://www.instagram.com/stumptowncoffee' },
	foundAnything: true,
};

const execute = (ctx: ReturnType<typeof fakeContext>) => new TidyTools().execute.call(ctx as never);

test('contact: POSTs the website and only the options that were set to the contacts host', async () => {
	const ctx = fakeContext({
		params: { resource: 'contact', operation: 'extract', url: ' stumptowncoffee.com ', options: { maxPages: 3 } },
		answers: [ok(CONTACTS)],
	});
	const [out] = await execute(ctx);
	assert.equal(ctx.calls.length, 1);
	const { credential, request } = ctx.calls[0];
	assert.equal(credential, 'tidyToolsRapidApi');
	assert.equal(request.method, 'POST');
	assert.equal(request.url, `https://${RAPIDAPI_HOSTS.contact}/api/v1/contacts`);
	assert.equal(request.headers?.['X-RapidAPI-Host'], RAPIDAPI_HOSTS.contact);
	assert.deepEqual(request.body, { url: 'stumptowncoffee.com', maxPages: 3 });
	assert.equal(request.ignoreHttpStatusErrors, true);
	assert.deepEqual(out, [{ json: CONTACTS, pairedItem: { item: 0 } }]);
});

test('contact: a site that blocks us (422) becomes an item, so a list keeps going', async () => {
	const blocked = { success: false, error: { code: 'target_blocked', message: 'target returned HTTP 403', retryable: false } };
	const ctx = fakeContext({
		params: (i) => ({ resource: 'contact', operation: 'extract', url: i ? 'stripe.com' : 'g2.com', options: {} }),
		items: 2,
		answers: [ok(blocked, 422), ok(CONTACTS)],
	});
	const [out] = await execute(ctx);
	assert.deepEqual(out.map((o) => o.json.success), [false, true]);
	assert.equal((out[0].json.error as { code: string }).code, 'target_blocked');
	assert.deepEqual(out.map((o) => o.pairedItem), [{ item: 0 }, { item: 1 }]);
});

test('contact: with "Return Unreadable Sites as Items" off a 422 fails the node with the API error code', async () => {
	const ctx = fakeContext({
		params: { resource: 'contact', operation: 'extract', url: 'g2.com', options: { targetErrorsAsItems: false } },
		answers: [ok({ success: false, error: { code: 'target_blocked', message: 'target returned HTTP 403' } }, 422)],
	});
	await assert.rejects(execute(ctx), /target_blocked: target returned HTTP 403/);
});

test('contact: a key without a subscription (403 from RapidAPI) throws with a hint; continueOnFail gives an error item', async () => {
	const answer = ok({ message: 'You are not subscribed to this API.' }, 403);
	const params = { resource: 'contact', operation: 'extract', url: 'stripe.com', options: {} };
	await assert.rejects(execute(fakeContext({ params, answers: [answer] })), (error: Error & { description?: string }) => {
		assert.match(error.message, /not subscribed/);
		assert.match(String(error.description), /Subscribe to this API on RapidAPI/);
		return true;
	});
	const [out] = await execute(fakeContext({ params, answers: [answer], continueOnFail: true }));
	assert.deepEqual(out, [{ json: { error: 'You are not subscribed to this API.' }, pairedItem: { item: 0 } }]);
});

test('contact: an empty website fails before any request', async () => {
	const ctx = fakeContext({ params: { resource: 'contact', operation: 'extract', url: '  ', options: {} }, answers: [] });
	await assert.rejects(execute(ctx), /Website is empty/);
	assert.equal(ctx.calls.length, 0);
});

test('seo audit: maps every option and honours a custom host (scheme and slash stripped)', async () => {
	const report = { success: true, url: 'https://example.com/', score: 82, grade: 'B', issues: [] };
	const ctx = fakeContext({
		params: {
			resource: 'seoAudit',
			operation: 'audit',
			url: 'example.com',
			options: {
				checkLinks: 10,
				linkScope: 'internal',
				siteChecks: false,
				includeLinks: true,
				render: 'never',
				timeoutMs: 20000,
				rapidApiHost: 'https://seo-audit-api99.p.rapidapi.com/',
			},
		},
		answers: [ok(report)],
	});
	const [out] = await execute(ctx);
	const { request } = ctx.calls[0];
	assert.equal(request.url, 'https://seo-audit-api99.p.rapidapi.com/api/v1/seo/audit');
	assert.equal(request.headers?.['X-RapidAPI-Host'], 'seo-audit-api99.p.rapidapi.com');
	assert.deepEqual(request.body, {
		url: 'example.com',
		checkLinks: 10,
		linkScope: 'internal',
		siteChecks: false,
		includeLinks: true,
		render: 'never',
		timeoutMs: 20000,
	});
	assert.equal(out[0].json.score, 82);
});

test('custom host: anything but a <name>.p.rapidapi.com host fails before the key is sent', async () => {
	for (const rapidApiHost of [
		'evil.example.com',
		'https://evil.example.com/',
		'seo-audit-api15.p.rapidapi.com.evil.com',
		'evil.com/seo-audit-api15.p.rapidapi.com',
		'evil.com#.p.rapidapi.com',
		'user@seo-audit-api15.p.rapidapi.com',
		'seo-audit-api15.p.rapidapi.com:8443',
		'http://seo-audit-api15.p.rapidapi.com',
		'p.rapidapi.com',
		'rapidapi.com',
	]) {
		const ctx = fakeContext({
			params: { resource: 'seoAudit', operation: 'audit', url: 'example.com', options: { rapidApiHost } },
			answers: [],
		});
		await assert.rejects(execute(ctx), /is not a RapidAPI host/, rapidApiHost);
		assert.equal(ctx.calls.length, 0, rapidApiHost);
	}
	const ctx = fakeContext({
		params: { resource: 'contact', operation: 'extract', url: 'stripe.com', options: { rapidApiHost: 'evil.example.com' } },
		answers: [],
		continueOnFail: true,
	});
	const [out] = await execute(ctx);
	assert.equal(ctx.calls.length, 0);
	assert.match(String(out[0].json.error), /is not a RapidAPI host/);
	// Case and a trailing slash are normalised.
	const upper = fakeContext({
		params: { resource: 'contact', operation: 'extract', url: 'stripe.com', options: { rapidApiHost: 'HTTPS://Website-Contact-Extractor2.P.RapidAPI.com/' } },
		answers: [ok(CONTACTS)],
	});
	await execute(upper);
	assert.equal(upper.calls[0].request.url, 'https://website-contact-extractor2.p.rapidapi.com/api/v1/contacts');
});

test('ai extract: field names from a comma list or lines; options passed through', async () => {
	const answer = ok({ success: true, data: { title: 'Example Domain', summary: 'x' } });
	for (const fields of ['title, summary', 'title\nsummary\n', ['title', 'summary']]) {
		const ctx = fakeContext({
			params: { resource: 'aiExtract', operation: 'extract', url: 'https://example.com/', outputMode: 'fields', fields, options: { maxChars: 4000, instructions: 'Short summary' } },
			answers: [answer],
		});
		const [out] = await execute(ctx);
		const { request } = ctx.calls[0];
		assert.equal(request.url, `https://${RAPIDAPI_HOSTS.aiExtract}/api/v1/ai-extract`);
		assert.deepEqual(request.body, { url: 'https://example.com/', fields: ['title', 'summary'], maxChars: 4000, instructions: 'Short summary' });
		assert.deepEqual(out[0].json.data, { title: 'Example Domain', summary: 'x' });
	}
});

test('ai extract: a JSON schema is parsed and sent instead of fields; bad schemas and field counts fail early', async () => {
	const schema = { type: 'object', properties: { price: { type: 'number' } } };
	const ctx = fakeContext({
		params: { resource: 'aiExtract', operation: 'extract', url: 'https://example.com/', outputMode: 'schema', schema: JSON.stringify(schema), options: {} },
		answers: [ok({ success: true, data: { price: 9.5 } })],
	});
	await execute(ctx);
	assert.deepEqual(ctx.calls[0].request.body, { url: 'https://example.com/', schema });

	const bad = (extra: object) =>
		execute(fakeContext({ params: { resource: 'aiExtract', operation: 'extract', url: 'https://example.com/', options: {}, ...extra }, answers: [] }));
	await assert.rejects(bad({ outputMode: 'schema', schema: '{not json' }), /Schema is not valid JSON/);
	await assert.rejects(bad({ outputMode: 'schema', schema: '[1]' }), /Schema must be a JSON object/);
	await assert.rejects(bad({ outputMode: 'fields', fields: '' }), /1 to 50 names \(got 0\)/);
	const many = Array.from({ length: 51 }, (_, i) => `f${i}`).join(',');
	await assert.rejects(bad({ outputMode: 'fields', fields: many }), /got 51/);
});

test('splitList: lines win over commas, so a label description may contain commas', () => {
	assert.deepEqual(splitList('a, b ,c'), ['a', 'b', 'c']);
	assert.deepEqual(splitList('Competitor: sells x, y\nPartner\n\n'), ['Competitor: sells x, y', 'Partner']);
	assert.deepEqual(splitList(undefined), []);
});
