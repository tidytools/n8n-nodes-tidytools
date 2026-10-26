import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IPairedItemData,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import {
	aiExtractProperties,
	classificationProperties,
	contactProperties,
	operationProperties,
	resourceProperty,
	seoAuditProperties,
	transcriptionProperties,
} from './descriptions';
import { outputProperties, shapeOutput } from './output';
import {
	type ApifyResource,
	type RapidApiResource,
	buildRapidApiRequest,
	callRapidApi,
	pickOptions,
	rapidApiHost,
	runActor,
	splitList,
} from './transport';

const RAPIDAPI_RESOURCES = ['contact', 'seoAudit', 'aiExtract'];
const APIFY_RESOURCES = ['transcription', 'classification'];

const MAX_FIELDS = 50;

/** One Actor input built from one n8n item, plus the list entries it contributed (to pair rows back to items). */
interface ActorInputPart {
	input: IDataObject;
	entries: string[];
}

export class TidyTools implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'TidyTools',
		name: 'tidyTools',
		icon: { light: 'file:../../icons/tidytools.svg', dark: 'file:../../icons/tidytools.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Website contacts, SEO audits and AI web data extraction (RapidAPI); audio/video transcription and website classification (Apify)',
		defaults: { name: 'TidyTools' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'tidyToolsRapidApi',
				required: true,
				displayOptions: { show: { resource: RAPIDAPI_RESOURCES } },
			},
			{
				name: 'tidyToolsApifyApi',
				required: true,
				displayOptions: { show: { resource: APIFY_RESOURCES } },
			},
		],
		properties: [
			resourceProperty,
			...operationProperties,
			...contactProperties,
			...seoAuditProperties,
			...aiExtractProperties,
			...classificationProperties,
			...transcriptionProperties,
			...outputProperties,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;

		if (APIFY_RESOURCES.includes(resource) && items.length > 0) {
			const firstOptions = this.getNodeParameter('options', 0, {}) as IDataObject;
			if (firstOptions.combineItems === true) {
				return [await runCombined.call(this, resource as ApifyResource, items.length)];
			}
		}

		for (let i = 0; i < items.length; i++) {
			try {
				if (RAPIDAPI_RESOURCES.includes(resource)) {
					const options = this.getNodeParameter('options', i, {}) as IDataObject;
					const host = rapidApiHost(resource as RapidApiResource, options);
					if (!host) {
						throw new NodeOperationError(
							this.getNode(),
							`Custom RapidAPI Host "${String(options.rapidApiHost)}" is not a RapidAPI host (expected <name>.p.rapidapi.com)`,
							{ itemIndex: i },
						);
					}
					const { path, body } = rapidApiCall.call(this, resource, i, options);
					const targetErrorsAsItems = options.targetErrorsAsItems !== false;
					const json = await callRapidApi.call(this, buildRapidApiRequest(host, path, body), i, targetErrorsAsItems);
					returnData.push({ json: outputRow.call(this, json, resource, i), pairedItem: { item: i } });
				} else if (APIFY_RESOURCES.includes(resource)) {
					const part = actorInput.call(this, resource as ApifyResource, i);
					const options = this.getNodeParameter('options', i, {}) as IDataObject;
					const { items: rows } = await runActor.call(this, resource as ApifyResource, part.input, runOptions(resource as ApifyResource, options), i);
					for (const row of rows) returnData.push({ json: outputRow.call(this, row, resource, i), pairedItem: { item: i } });
				} else {
					throw new NodeOperationError(this.getNode(), `Unknown resource "${resource}"`, { itemIndex: i });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}
		return [returnData];
	}
}

/** Max Wait when the option is left unset; matches the defaults shown in the node UI. */
export const DEFAULT_MAX_WAIT_SECONDS: Record<ApifyResource, number> = { transcription: 900, classification: 300 };

function runOptions(resource: ApifyResource, options: IDataObject) {
	return {
		maxWaitSeconds:
			Number(options.maxWaitSeconds) > 0 ? Number(options.maxWaitSeconds) : DEFAULT_MAX_WAIT_SECONDS[resource],
		maxTotalChargeUsd: Number(options.maxTotalChargeUsd) > 0 ? Number(options.maxTotalChargeUsd) : undefined,
	};
}

function requireText(this: IExecuteFunctions, name: string, label: string, itemIndex: number): string {
	const value = String(this.getNodeParameter(name, itemIndex, '') ?? '').trim();
	if (!value) throw new NodeOperationError(this.getNode(), `${label} is empty`, { itemIndex });
	return value;
}

/** Path and JSON body of a RapidAPI call, from the item's parameters. */
function rapidApiCall(
	this: IExecuteFunctions,
	resource: string,
	itemIndex: number,
	options: IDataObject,
): { path: string; body: IDataObject } {
	if (resource === 'contact') {
		const url = requireText.call(this, 'url', 'Website', itemIndex);
		return { path: '/api/v1/contacts', body: { url, ...pickOptions(options, ['maxPages', 'render', 'includeDetails']) } };
	}
	if (resource === 'seoAudit') {
		const url = requireText.call(this, 'url', 'Page URL', itemIndex);
		const picked = pickOptions(options, ['checkLinks', 'linkScope', 'siteChecks', 'includeLinks', 'render', 'timeoutMs']);
		return { path: '/api/v1/seo/audit', body: { url, ...picked } };
	}
	const url = requireText.call(this, 'url', 'Page URL', itemIndex);
	const body: IDataObject = { url, ...pickOptions(options, ['instructions', 'maxChars', 'maxTokens', 'timeoutMs']) };
	if (this.getNodeParameter('outputMode', itemIndex, 'fields') === 'schema') {
		body.schema = parseSchema.call(this, this.getNodeParameter('schema', itemIndex, ''), itemIndex);
	} else {
		const fields = splitList(this.getNodeParameter('fields', itemIndex, ''));
		if (!fields.length || fields.length > MAX_FIELDS) {
			throw new NodeOperationError(this.getNode(), `Fields must list 1 to ${MAX_FIELDS} names (got ${fields.length})`, {
				itemIndex,
			});
		}
		body.fields = fields;
	}
	return { path: '/api/v1/ai-extract', body };
}

function parseSchema(this: IExecuteFunctions, value: unknown, itemIndex: number): IDataObject {
	let schema: unknown = value;
	if (typeof value === 'string') {
		try {
			schema = JSON.parse(value);
		} catch {
			throw new NodeOperationError(this.getNode(), 'Schema is not valid JSON', { itemIndex });
		}
	}
	if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
		throw new NodeOperationError(this.getNode(), 'Schema must be a JSON object', { itemIndex });
	}
	return schema as IDataObject;
}

/** The Actor input for one item. */
function actorInput(this: IExecuteFunctions, resource: ApifyResource, itemIndex: number): ActorInputPart {
	const options = this.getNodeParameter('options', itemIndex, {}) as IDataObject;
	if (resource === 'classification') {
		const taxonomy = this.getNodeParameter('taxonomy', itemIndex, 'industry') as string;
		const input: IDataObject = {
			taxonomy,
			...pickOptions(options, ['analysisDepth', 'instructions', 'multiLabel', 'mode']),
		};
		if (taxonomy === 'custom') {
			const labels = splitList(this.getNodeParameter('customLabels', itemIndex, ''));
			if (labels.length < 2) {
				throw new NodeOperationError(this.getNode(), 'Custom Labels needs at least 2 labels', { itemIndex });
			}
			input.customLabels = labels;
		}
		let entries: string[];
		if (this.getNodeParameter('inputType', itemIndex, 'urls') === 'texts') {
			entries = [requireText.call(this, 'text', 'Text', itemIndex)];
			input.texts = entries;
		} else {
			entries = splitList(this.getNodeParameter('urls', itemIndex, ''));
			if (!entries.length) throw new NodeOperationError(this.getNode(), 'URLs or Domains is empty', { itemIndex });
			input.domains = entries;
		}
		return { input, entries };
	}

	const input: IDataObject = pickOptions(options, [
		'language',
		'vocabulary',
		'transcriptionEngine',
		'summarize',
		'meetingNotes',
		'speakerLabels',
		'wordTimestamps',
		'maxMinutesPerFile',
		'sourceFileId',
		'resumeStore',
	]);
	let entries: string[];
	if (this.getNodeParameter('source', itemIndex, 'urls') === 'podcast') {
		entries = [requireText.call(this, 'podcastFeed', 'Podcast Feed URL', itemIndex)];
		input.podcastFeeds = entries;
		input.maxEpisodesPerFeed = Number(this.getNodeParameter('maxEpisodesPerFeed', itemIndex, 1)) || 1;
	} else {
		entries = splitList(this.getNodeParameter('urls', itemIndex, ''));
		if (!entries.length) throw new NodeOperationError(this.getNode(), 'Media URLs is empty', { itemIndex });
		input.urls = entries;
	}
	return { input, entries };
}

/** The list field of an Actor input that combined runs concatenate. */
function listKey(input: IDataObject): string {
	for (const key of ['domains', 'texts', 'urls', 'podcastFeeds']) if (Array.isArray(input[key])) return key;
	return 'urls';
}

/**
 * "Combine All Items Into One Run": the list entries of every item go to one Actor run (settings from the first
 * item). Each result row is paired with every item its `input` (or merged `inputs`) came from, or with all items when it
 * cannot tell.
 */
async function runCombined(
	this: IExecuteFunctions,
	resource: ApifyResource,
	itemCount: number,
): Promise<INodeExecutionData[]> {
	const parts: ActorInputPart[] = [];
	for (let i = 0; i < itemCount; i++) parts.push(actorInput.call(this, resource, i));
	const key = listKey(parts[0].input);
	// Every item that sent an entry: the Actor merges duplicate inputs into one row, which then belongs to all of them.
	const origin = new Map<string, Set<number>>();
	const combined: string[] = [];
	parts.forEach((part, i) => {
		for (const entry of part.entries) {
			const from = origin.get(entry) ?? new Set<number>();
			from.add(i);
			origin.set(entry, from);
			combined.push(entry);
		}
	});
	const input: IDataObject = { ...parts[0].input, [key]: combined };
	const options = this.getNodeParameter('options', 0, {}) as IDataObject;
	const allItems: IPairedItemData[] = parts.map((_, i) => ({ item: i }));
	try {
		const { items: rows } = await runActor.call(this, resource, input, runOptions(resource, options), 0);
		return rows.map((row) => {
			const sources = [row.input, ...(Array.isArray(row.inputs) ? row.inputs : [])].filter(
				(v): v is string => typeof v === 'string',
			);
			const indices = new Set<number>();
			for (const source of sources) for (const i of origin.get(source) ?? []) indices.add(i);
			const paired = [...indices].sort((a, b) => a - b).map((i) => ({ item: i }));
			return { json: outputRow.call(this, row, resource, 0), pairedItem: paired.length === 0 ? allItems : paired.length === 1 ? paired[0] : paired };
		});
	} catch (error) {
		if (this.continueOnFail()) return [{ json: { error: (error as Error).message }, pairedItem: allItems }];
		throw new NodeOperationError(this.getNode(), error as Error);
	}
}

function outputRow(this: IExecuteFunctions, row: IDataObject, resource: string, itemIndex: number): IDataObject {
	const output = this.getNodeParameter('output', itemIndex, 'raw') as string;
	const simplify = this.getNodeParameter('simplify', itemIndex, false) === true;
	const selected = this.getNodeParameter('selectedFields', itemIndex, []) as string[];
	return shapeOutput(row, resource, output, simplify, Array.isArray(selected) ? selected : []);
}