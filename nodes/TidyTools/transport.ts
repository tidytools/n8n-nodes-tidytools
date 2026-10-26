import type { IDataObject, IExecuteFunctions, IHttpRequestOptions, JsonObject } from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

/**
 * RapidAPI hosts of the TidyTools APIs (https://rapidapi.com/user/tidytools). Each listing has its own host; the
 * node's "Custom RapidAPI Host" option overrides them in case a listing moves.
 */
export const RAPIDAPI_HOSTS = {
	contact: 'website-contact-extractor1.p.rapidapi.com',
	seoAudit: 'seo-audit-api15.p.rapidapi.com',
	aiExtract: 'ai-web-data-extractor-api-any-page-to-structured-json.p.rapidapi.com',
} as const;

export type RapidApiResource = keyof typeof RAPIDAPI_HOSTS;

/** TidyTools Actors in the Apify Store (billed per result to the caller's Apify account). */
export const APIFY_ACTORS = {
	transcription: 'tidytools~audio-transcriber',
	classification: 'tidytools~ai-page-classifier',
} as const;

export type ApifyResource = keyof typeof APIFY_ACTORS;

export const APIFY_API = 'https://api.apify.com/v2';

const TERMINAL_RUN_STATUSES = ['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'];

/** Longest single long-poll the Apify API allows (`waitForFinish`, seconds). */
const APIFY_MAX_POLL_SECONDS = 60;

const DATASET_PAGE_SIZE = 1000;

/** HTTP 422 answers mean "this website or page could not be read" (blocked, unreachable, not found, not HTML). */
export const TARGET_ERROR_STATUS = 422;

/**
 * Splits a list typed into one field: one entry per line, or comma-separated when it is a single line.
 * Arrays (from expressions) are accepted as they are.
 */
export function splitList(value: unknown): string[] {
	if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
	const text = typeof value === 'string' ? value : value == null ? '' : String(value);
	const parts = text.includes('\n') ? text.split(/\r?\n/) : text.split(',');
	return parts.map((v) => v.trim()).filter(Boolean);
}

/** Copies the options that were set (n8n leaves unset collection options out) and drops empty strings. */
export function pickOptions(options: IDataObject, keys: string[]): IDataObject {
	const out: IDataObject = {};
	for (const key of keys) {
		const value = options[key];
		if (value === undefined || value === null || value === '') continue;
		out[key] = value;
	}
	return out;
}

/** A RapidAPI gateway host (`<listing>.p.rapidapi.com`): the only hosts the RapidAPI key may be sent to. */
const RAPIDAPI_HOST_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.p\.rapidapi\.com$/;

/**
 * The host to call. A custom host is accepted only when it is a RapidAPI gateway host, so the credential's key can
 * never be sent anywhere else; anything else returns undefined and the caller fails before any request.
 */
export function rapidApiHost(resource: RapidApiResource, options: IDataObject): string | undefined {
	const custom = typeof options.rapidApiHost === 'string' ? options.rapidApiHost.trim() : '';
	if (!custom) return RAPIDAPI_HOSTS[resource];
	const host = custom
		.toLowerCase()
		.replace(/^https:\/\//, '')
		.replace(/\/+$/, '');
	return RAPIDAPI_HOST_PATTERN.test(host) ? host : undefined;
}

export function buildRapidApiRequest(host: string, path: string, body: IDataObject): IHttpRequestOptions {
	return {
		method: 'POST',
		url: `https://${host}${path}`,
		headers: { 'X-RapidAPI-Host': host, 'Content-Type': 'application/json' },
		body,
		json: true,
		returnFullResponse: true,
		ignoreHttpStatusErrors: true,
	};
}

interface FullResponse {
	statusCode: number;
	body: unknown;
}

function errorOf(body: unknown): { code?: string; message?: string; retryable?: boolean } {
	if (body && typeof body === 'object' && 'error' in body) {
		const error = (body as IDataObject).error;
		if (error && typeof error === 'object') return error as { code?: string; message?: string };
	}
	return {};
}

const RAPIDAPI_HINTS: Record<number, string> = {
	401: 'Check the RapidAPI key in the TidyTools RapidAPI credential.',
	403: 'Subscribe to this API on RapidAPI (a free plan is available) with the app whose key is in the credential.',
	429: 'The monthly quota or the rate limit of your RapidAPI plan was reached. Upgrade the plan or retry later.',
};

/**
 * Calls one TidyTools API through RapidAPI. 2xx answers are returned as they are. A 422 (the target website could
 * not be read) is returned as an item with `success: false` when `targetErrorsAsItems` is on, so one blocked site does
 * not stop a whole list. Every other error (key, subscription, quota, invalid input, our side) throws.
 */
export async function callRapidApi(
	this: IExecuteFunctions,
	request: IHttpRequestOptions,
	itemIndex: number,
	targetErrorsAsItems: boolean,
): Promise<IDataObject> {
	const response = (await this.helpers.httpRequestWithAuthentication.call(
		this,
		'tidyToolsRapidApi',
		request,
	)) as FullResponse;
	const { statusCode, body } = response;
	if (statusCode >= 200 && statusCode < 300) return (body ?? {}) as IDataObject;
	if (statusCode === TARGET_ERROR_STATUS && targetErrorsAsItems && body && typeof body === 'object') {
		return body as IDataObject;
	}
	const error = errorOf(body);
	// RapidAPI's own gateway errors are {"message": "..."} without our error envelope.
	const gatewayMessage = body && typeof body === 'object' ? (body as IDataObject).message : undefined;
	const message = error.message ?? (typeof gatewayMessage === 'string' ? gatewayMessage : `HTTP ${statusCode}`);
	throw new NodeApiError(
		this.getNode(),
		{ ...(body && typeof body === 'object' ? (body as JsonObject) : {}), statusCode } as JsonObject,
		{
			message: error.code ? `${error.code}: ${message}` : message,
			description: RAPIDAPI_HINTS[statusCode],
			httpCode: String(statusCode),
			itemIndex,
		},
	);
}

async function apifyRequest(
	this: IExecuteFunctions,
	request: IHttpRequestOptions,
	itemIndex: number,
): Promise<unknown> {
	try {
		return await this.helpers.httpRequestWithAuthentication.call(this, 'tidyToolsApifyApi', {
			json: true,
			...request,
		});
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex });
	}
}

export interface ActorRunOptions {
	/** Stop waiting after this many seconds (the run itself goes on in Apify). */
	maxWaitSeconds: number;
	/** Apify `maxTotalChargeUsd`: the most this run may charge. */
	maxTotalChargeUsd?: number;
}

export interface ActorRunResult {
	run: IDataObject;
	items: IDataObject[];
}

/**
 * Starts a TidyTools Actor on the caller's Apify account, waits for it with Apify's server-side long poll
 * (`waitForFinish`, no timers in the node) and returns its dataset rows.
 */
export async function runActor(
	this: IExecuteFunctions,
	resource: ApifyResource,
	input: IDataObject,
	options: ActorRunOptions,
	itemIndex: number,
): Promise<ActorRunResult> {
	const actorId = APIFY_ACTORS[resource];
	const deadline = Date.now() + Math.max(1, options.maxWaitSeconds) * 1000;
	const pollSeconds = () =>
		Math.max(1, Math.min(APIFY_MAX_POLL_SECONDS, Math.ceil((deadline - Date.now()) / 1000)));

	const qs: IDataObject = { waitForFinish: pollSeconds() };
	if (options.maxTotalChargeUsd && options.maxTotalChargeUsd > 0) qs.maxTotalChargeUsd = options.maxTotalChargeUsd;
	const started = (await apifyRequest.call(
		this,
		{ method: 'POST', url: `${APIFY_API}/acts/${actorId}/runs`, qs, body: input },
		itemIndex,
	)) as IDataObject;
	let run = (started.data ?? {}) as IDataObject;

	while (!TERMINAL_RUN_STATUSES.includes(String(run.status)) && Date.now() < deadline) {
		const polled = (await apifyRequest.call(
			this,
			{ method: 'GET', url: `${APIFY_API}/actor-runs/${run.id}`, qs: { waitForFinish: pollSeconds() } },
			itemIndex,
		)) as IDataObject;
		run = (polled.data ?? run) as IDataObject;
	}

	const consoleUrl = `https://console.apify.com/view/runs/${run.id}`;
	if (!TERMINAL_RUN_STATUSES.includes(String(run.status))) {
		throw new NodeOperationError(
			this.getNode(),
			`The Apify run ${run.id} is still ${run.status} after ${options.maxWaitSeconds} seconds`,
			{
				description: `The run goes on in Apify and its results stay in dataset ${run.defaultDatasetId} (${consoleUrl}). Raise "Max Wait (Seconds)" for long recordings or big lists.`,
				itemIndex,
			},
		);
	}
	if (run.status !== 'SUCCEEDED') {
		throw new NodeOperationError(this.getNode(), `The Apify run ${run.id} ended with status ${run.status}`, {
			description: `${run.statusMessage ?? ''} ${consoleUrl}`.trim(),
			itemIndex,
		});
	}

	const items: IDataObject[] = [];
	for (let offset = 0; ; offset += DATASET_PAGE_SIZE) {
		const page = (await apifyRequest.call(
			this,
			{
				method: 'GET',
				url: `${APIFY_API}/datasets/${run.defaultDatasetId}/items`,
				qs: { clean: true, format: 'json', offset, limit: DATASET_PAGE_SIZE },
			},
			itemIndex,
		)) as IDataObject[];
		const rows = Array.isArray(page) ? page : [];
		items.push(...rows);
		if (rows.length < DATASET_PAGE_SIZE) break;
	}
	return { run, items };
}
