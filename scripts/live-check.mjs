// Live check: runs the node's real execute() for every resource against the real APIs and prints one line plus a
// short response excerpt per operation. Keys come from the environment only and are never printed:
//   RAPIDAPI_KEY  - a RapidAPI app key subscribed to Website Contact Extractor, SEO Audit API and AI Web Data
//                   Extractor API (free plans are enough: this script makes 1 request to each)
//   APIFY_TOKEN   - an Apify token (runs tidytools/ai-page-classifier on 1 domain and tidytools/audio-transcriber
//                   on a 5-second sample: billed to that account, a few tenths of a cent)
// Usage (Node 22.18+): node scripts/live-check.mjs [contact|seoAudit|aiExtract|classification|transcription ...]
// Exit code 1 when any selected operation fails.
import '../test/register.mjs';

const { TidyTools } = await import('../nodes/TidyTools/TidyTools.node.ts');

const AUTH = {
	tidyToolsRapidApi: () => ({ 'X-RapidAPI-Key': required('RAPIDAPI_KEY') }),
	tidyToolsApifyApi: () => ({ Authorization: `Bearer ${required('APIFY_TOKEN')}` }),
};

function required(name) {
	const value = process.env[name];
	if (!value) throw new Error(`${name} is not set`);
	return value;
}

/** The subset of n8n's httpRequest options the node uses. */
async function httpRequest(credential, options) {
	const url = new URL(options.url);
	for (const [k, v] of Object.entries(options.qs ?? {})) url.searchParams.set(k, String(v));
	const response = await fetch(url, {
		method: options.method ?? 'GET',
		headers: { 'content-type': 'application/json', 'user-agent': 'n8n-nodes-tidytools live-check', ...(options.headers ?? {}), ...AUTH[credential]() },
		body: options.body === undefined ? undefined : JSON.stringify(options.body),
	});
	const text = await response.text();
	let body;
	try {
		body = JSON.parse(text);
	} catch {
		body = text;
	}
	if (options.returnFullResponse) return { statusCode: response.status, body, headers: Object.fromEntries(response.headers) };
	if (!response.ok && !options.ignoreHttpStatusErrors) {
		throw Object.assign(new Error(`HTTP ${response.status}: ${text.slice(0, 300)}`), { httpCode: String(response.status) });
	}
	return body;
}

const CASES = {
	contact: { resource: 'contact', operation: 'extract', url: 'stumptowncoffee.com', options: { maxPages: 3 } },
	seoAudit: { resource: 'seoAudit', operation: 'audit', url: 'https://www.python.org/', options: { siteChecks: false } },
	aiExtract: {
		resource: 'aiExtract',
		operation: 'extract',
		url: 'https://www.python.org/downloads/',
		outputMode: 'fields',
		fields: 'latest_python_version, release_date',
		options: {},
	},
	classification: {
		resource: 'classification',
		operation: 'classify',
		inputType: 'urls',
		urls: 'stripe.com',
		taxonomy: 'industry',
		options: { analysisDepth: 'quick', maxTotalChargeUsd: 0.05, maxWaitSeconds: 300 },
	},
	transcription: {
		resource: 'transcription',
		operation: 'transcribe',
		source: 'urls',
		urls: 'https://webcapture-api.yukailin.workers.dev/samples/speech-sample.wav',
		options: { language: 'en', maxTotalChargeUsd: 0.05, maxWaitSeconds: 600 },
	},
};

function context(params) {
	return {
		getInputData: () => [{ json: {} }],
		getNodeParameter: (name, _i, fallback) => (name in params ? params[name] : fallback),
		getNode: () => ({ name: 'TidyTools', type: 'n8n-nodes-tidytools.tidyTools', typeVersion: 1 }),
		continueOnFail: () => false,
		helpers: { httpRequestWithAuthentication: httpRequest },
	};
}

const KEEP = ['success', 'domain', 'primaryEmail', 'emails', 'phones', 'score', 'grade', 'data', 'model', 'label', 'businessModel', 'confidence', 'text', 'billedMinutes', 'charged', 'error', 'errorType'];
const excerpt = (row) => JSON.stringify(Object.fromEntries(KEEP.filter((k) => k in row).map((k) => [k, row[k]]))).slice(0, 400);

const selected = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CASES);
let failed = 0;
for (const name of selected) {
	const started = Date.now();
	try {
		const [out] = await new TidyTools().execute.call(context(CASES[name]));
		const ok = out.length > 0 && out.every((o) => o.json.success !== false);
		if (!ok) failed++;
		console.log(`${ok ? 'OK  ' : 'FAIL'} ${name} items=${out.length} ${Date.now() - started}ms ${out[0] ? excerpt(out[0].json) : ''}`);
	} catch (error) {
		failed++;
		console.log(`FAIL ${name} ${Date.now() - started}ms ${error.message}${error.description ? ` (${error.description})` : ''}`);
	}
}
process.exit(failed ? 1 : 0);
