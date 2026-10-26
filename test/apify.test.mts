import assert from 'node:assert/strict';
import { type TestContext, test } from 'node:test';
import { TidyTools } from '../nodes/TidyTools/TidyTools.node';
import { APIFY_API } from '../nodes/TidyTools/transport';
import { fakeContext, run } from './helpers';

const execute = (ctx: ReturnType<typeof fakeContext>) => new TidyTools().execute.call(ctx as never);

const classified = (url: string, label: string, extra = {}) => ({ input: url, url: `https://${url}/`, label, confidence: 0.9, charged: true, ...extra });

test('classification: starts the Actor with the item input, long-polls until done and returns the dataset rows', async () => {
	const ctx = fakeContext({
		params: {
			resource: 'classification',
			operation: 'classify',
			inputType: 'urls',
			urls: 'stripe.com, allbirds.com',
			taxonomy: 'industry',
			options: { analysisDepth: 'quick', maxWaitSeconds: 120 },
		},
		answers: [run('RUNNING'), run('SUCCEEDED'), [classified('stripe.com', 'Financial Services'), classified('allbirds.com', 'Retail')]],
	});
	const [out] = await execute(ctx);
	const [start, poll, dataset] = ctx.calls;
	assert.equal(start.credential, 'tidyToolsApifyApi');
	assert.equal(start.request.method, 'POST');
	assert.equal(start.request.url, `${APIFY_API}/acts/tidytools~ai-page-classifier/runs`);
	assert.deepEqual(start.request.body, { taxonomy: 'industry', analysisDepth: 'quick', domains: ['stripe.com', 'allbirds.com'] });
	assert.ok(Number(start.request.qs?.waitForFinish) <= 60);
	assert.equal(start.request.qs?.maxTotalChargeUsd, undefined);
	assert.equal(poll.request.url, `${APIFY_API}/actor-runs/RUN1`);
	assert.equal(dataset.request.url, `${APIFY_API}/datasets/DS1/items`);
	assert.deepEqual(dataset.request.qs, { clean: true, format: 'json', offset: 0, limit: 1000 });
	assert.deepEqual(out.map((o) => o.json.label), ['Financial Services', 'Retail']);
	assert.deepEqual(out.map((o) => o.pairedItem), [{ item: 0 }, { item: 0 }]);
});

test('classification: texts and custom labels (one per line, descriptions may hold commas)', async () => {
	const ctx = fakeContext({
		params: {
			resource: 'classification',
			operation: 'classify',
			inputType: 'texts',
			text: 'The checkout kept failing, support never answered.',
			taxonomy: 'custom',
			customLabels: 'Bug report: something broken, crash, error\nBilling\nPraise',
			options: { maxTotalChargeUsd: 0.5 },
		},
		answers: [run('SUCCEEDED'), [{ input: null, label: 'Bug report' }]],
	});
	await execute(ctx);
	const start = ctx.calls[0].request;
	assert.deepEqual(start.body, {
		taxonomy: 'custom',
		customLabels: ['Bug report: something broken, crash, error', 'Billing', 'Praise'],
		texts: ['The checkout kept failing, support never answered.'],
	});
	assert.equal(start.qs?.maxTotalChargeUsd, 0.5);
	assert.equal(ctx.calls.length, 2, 'a run that already succeeded is not polled');
});

test('classification: fewer than 2 custom labels fails before starting a paid run', async () => {
	const ctx = fakeContext({
		params: { resource: 'classification', operation: 'classify', inputType: 'urls', urls: 'stripe.com', taxonomy: 'custom', customLabels: 'Only one', options: {} },
		answers: [],
	});
	await assert.rejects(execute(ctx), /at least 2 labels/);
	assert.equal(ctx.calls.length, 0);
});

test('classification: "Combine All Items Into One Run" sends every item in one run and pairs rows back by input (a merged duplicate to every item that sent it)', async () => {
	const ctx = fakeContext({
		params: (i) => ({
			resource: 'classification',
			operation: 'classify',
			inputType: 'urls',
			urls: ['stripe.com', 'bbc.com\nallbirds.com', 'stripe.com'][i],
			taxonomy: 'industry',
			options: { combineItems: true },
		}),
		items: 3,
		answers: [
			run('SUCCEEDED'),
			[
				classified('stripe.com', 'Financial Services', { inputs: ['stripe.com', 'stripe.com'] }),
				classified('bbc.com', 'Media'),
				classified('allbirds.com', 'Retail'),
				{ input: null, success: false, errorType: 'invalid_input' },
			],
		],
	});
	const [out] = await execute(ctx);
	assert.equal(ctx.calls.filter((c) => c.request.method === 'POST').length, 1);
	assert.deepEqual(ctx.calls[0].request.body?.domains, ['stripe.com', 'bbc.com', 'allbirds.com', 'stripe.com']);
	assert.deepEqual(out.map((o) => o.pairedItem), [
		[{ item: 0 }, { item: 2 }],
		{ item: 1 },
		{ item: 1 },
		[{ item: 0 }, { item: 1 }, { item: 2 }],
	]);
});

test('combined run: a duplicate row with only `input` (no `inputs`) is still paired with every item that sent it', async () => {
	const ctx = fakeContext({
		params: (i) => ({
			resource: 'classification',
			operation: 'classify',
			inputType: 'urls',
			urls: ['stripe.com', 'bbc.com', 'stripe.com, bbc.com'][i],
			taxonomy: 'industry',
			options: { combineItems: true },
		}),
		items: 3,
		answers: [run('SUCCEEDED'), [classified('stripe.com', 'Financial Services'), classified('bbc.com', 'Media')]],
	});
	const [out] = await execute(ctx);
	assert.deepEqual(out.map((o) => o.pairedItem), [
		[{ item: 0 }, { item: 2 }],
		[{ item: 1 }, { item: 2 }],
	]);
});

test('transcription: media URLs and the integration options map to the Actor input', async () => {
	const row = { input: 'https://example.com/a.mp3', success: true, text: 'Hello', billedMinutes: 1, charged: true };
	const ctx = fakeContext({
		params: {
			resource: 'transcription',
			operation: 'transcribe',
			source: 'urls',
			urls: 'https://example.com/a.mp3',
			options: { language: 'en', speakerLabels: true, sourceFileId: 'drive-123', resumeStore: 'n8n-recordings', vocabulary: '' },
		},
		answers: [run('SUCCEEDED'), [row]],
	});
	const [out] = await execute(ctx);
	assert.equal(ctx.calls[0].request.url, `${APIFY_API}/acts/tidytools~audio-transcriber/runs`);
	assert.deepEqual(ctx.calls[0].request.body, {
		language: 'en',
		speakerLabels: true,
		sourceFileId: 'drive-123',
		resumeStore: 'n8n-recordings',
		urls: ['https://example.com/a.mp3'],
	});
	assert.deepEqual(out, [{ json: row, pairedItem: { item: 0 } }]);
});

test('transcription: podcast feed with an episode count', async () => {
	const ctx = fakeContext({
		params: { resource: 'transcription', operation: 'transcribe', source: 'podcast', podcastFeed: 'https://feeds.example.com/show.rss', maxEpisodesPerFeed: 2, options: {} },
		answers: [run('SUCCEEDED'), []],
	});
	const [out] = await execute(ctx);
	assert.deepEqual(ctx.calls[0].request.body, { podcastFeeds: ['https://feeds.example.com/show.rss'], maxEpisodesPerFeed: 2 });
	assert.deepEqual(out, []);
});

test('apify: a failed run throws with its status message and console link', async () => {
	const ctx = fakeContext({
		params: { resource: 'transcription', operation: 'transcribe', source: 'urls', urls: 'https://example.com/a.mp3', options: {} },
		answers: [run('FAILED', { statusMessage: 'Out of memory' })],
	});
	await assert.rejects(execute(ctx), (error: Error & { description?: string }) => {
		assert.match(error.message, /RUN1 ended with status FAILED/);
		assert.match(String(error.description), /Out of memory https:\/\/console\.apify\.com\/view\/runs\/RUN1/);
		return true;
	});
});

test('apify: still running after Max Wait fails with the run ID (the run goes on in Apify)', async (t) => {
	let now = 1_000_000;
	t.mock.method(Date, 'now', () => now);
	const ctx = fakeContext({
		params: { resource: 'transcription', operation: 'transcribe', source: 'urls', urls: 'https://example.com/long.mp3', options: { maxWaitSeconds: 100 } },
		answers: [
			(request: { qs?: { waitForFinish?: number } }) => {
				now += Number(request.qs?.waitForFinish) * 1000;
				return run('RUNNING');
			},
			(request: { qs?: { waitForFinish?: number } }) => {
				now += Number(request.qs?.waitForFinish) * 1000;
				return run('RUNNING');
			},
		],
	});
	await assert.rejects(execute(ctx), /RUN1 is still RUNNING after 100 seconds/);
	assert.deepEqual(ctx.calls.map((c) => c.request.qs?.waitForFinish), [60, 40]);
});

/** Fails a run that never finishes and returns the seconds the node waited before giving up. */
async function waitedWithoutMaxWait(t: TestContext, params: object) {
	let now = 1_000_000;
	t.mock.method(Date, 'now', () => now);
	const polls: number[] = [];
	const advance = (request: { qs?: { waitForFinish?: number } }) => {
		polls.push(Number(request.qs?.waitForFinish));
		now += Number(request.qs?.waitForFinish) * 1000;
		return run('RUNNING');
	};
	const ctx = fakeContext({ params, answers: Array.from({ length: 40 }, () => advance) });
	await assert.rejects(execute(ctx), /is still RUNNING after (\d+) seconds/);
	return polls.reduce((a, b) => a + b, 0);
}

test('apify: an unset Max Wait waits 900 s for transcription (as the UI shows), not 300 s', async (t) => {
	const waited = await waitedWithoutMaxWait(t, { resource: 'transcription', operation: 'transcribe', source: 'urls', urls: 'https://example.com/long.mp3', options: {} });
	assert.equal(waited, 900);
});

test('apify: an unset Max Wait waits 300 s for classification; also in a combined run', async (t) => {
	const params = { resource: 'classification', operation: 'classify', inputType: 'urls', urls: 'a.com', taxonomy: 'topic', options: {} };
	assert.equal(await waitedWithoutMaxWait(t, params), 300);
	t.mock.restoreAll();
	assert.equal(await waitedWithoutMaxWait(t, { ...params, options: { combineItems: true } }), 300);
});

test('apify: datasets over 1,000 rows are read page by page', async () => {
	const page = (n: number, from: number) => Array.from({ length: n }, (_, i) => ({ input: `site${from + i}.com`, label: 'x' }));
	const ctx = fakeContext({
		params: { resource: 'classification', operation: 'classify', inputType: 'urls', urls: 'a.com', taxonomy: 'topic', options: {} },
		answers: [run('SUCCEEDED'), page(1000, 0), page(5, 1000)],
	});
	const [out] = await execute(ctx);
	assert.equal(out.length, 1005);
	assert.deepEqual(ctx.calls.slice(1).map((c) => c.request.qs?.offset), [0, 1000]);
});

test('apify: an HTTP error (bad token) is wrapped for n8n; continueOnFail gives one error item per item', async () => {
	const unauthorized = Object.assign(new Error('Request failed with status code 401'), { httpCode: '401' });
	const params = { resource: 'classification', operation: 'classify', inputType: 'urls', urls: 'a.com', taxonomy: 'topic', options: {} };
	await assert.rejects(execute(fakeContext({ params, answers: [unauthorized] })), /401|Authorization failed/); // real n8n-workflow maps 401 to its own message
	const [out] = await execute(fakeContext({ params, items: 2, answers: [unauthorized, unauthorized], continueOnFail: true }));
	assert.deepEqual(out.map((o) => o.pairedItem), [{ item: 0 }, { item: 1 }]);
	assert.ok(out.every((o) => typeof o.json.error === 'string'));
});
