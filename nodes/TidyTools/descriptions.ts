import type { INodeProperties } from 'n8n-workflow';

const show = (resource: string, extra: Record<string, string[]> = {}) => ({
	show: { resource: [resource], ...extra },
});

const rapidApiHostOption = (host: string): INodeProperties => ({
	displayName: 'Custom RapidAPI Host',
	name: 'rapidApiHost',
	type: 'string',
	default: '',
	placeholder: `e.g. ${host}`,
	description: `X-RapidAPI-Host to call instead of ${host}. Leave empty unless the API's RapidAPI page shows another host. Only hosts ending in .p.rapidapi.com are accepted.`,
});

const targetErrorsOption: INodeProperties = {
	displayName: 'Return Unreadable Sites as Items',
	name: 'targetErrorsAsItems',
	type: 'boolean',
	default: true,
	description:
		'Whether a site that blocks the request, does not resolve or has no such page returns an item with success false and an error code instead of failing the node',
};

const maxChargeOption: INodeProperties = {
	displayName: 'Max Total Charge (USD)',
	name: 'maxTotalChargeUsd',
	type: 'number',
	default: 0,
	typeOptions: { minValue: 0, numberPrecision: 2 },
	description:
		'Most the Apify run may charge to your Apify account; results beyond it are not produced. 0 = no limit (your Apify spending limit still applies).',
};

const combineItemsOption: INodeProperties = {
	displayName: 'Combine All Items Into One Run',
	name: 'combineItems',
	type: 'boolean',
	default: false,
	description:
		'Whether to send the inputs of all incoming items to a single Apify run (faster and cheaper for lists) instead of one run per item',
};

const maxWaitOption = (seconds: number): INodeProperties => ({
	displayName: 'Max Wait (Seconds)',
	name: 'maxWaitSeconds',
	type: 'number',
	default: seconds,
	typeOptions: { minValue: 10 },
	description:
		'How long the node waits for the Apify run to finish. When it is still running the node fails with the run ID; the run goes on in Apify.',
});

export const resourceProperty: INodeProperties = {
	displayName: 'Resource',
	name: 'resource',
	type: 'options',
	noDataExpression: true,
	options: [
		{
			name: 'AI Extract',
			value: 'aiExtract',
			description: 'Structured JSON with the fields you name from one web page (RapidAPI)',
		},
		{
			name: 'Classification',
			value: 'classification',
			description: 'Industry, page type, topic, sentiment or your own labels for websites or texts (Apify)',
		},
		{
			name: 'Contact',
			value: 'contact',
			description: 'Emails, phones, social profiles and address of a company website (RapidAPI)',
		},
		{
			name: 'SEO Audit',
			value: 'seoAudit',
			description: 'On-page SEO score, grade and issues of one page (RapidAPI)',
		},
		{
			name: 'Transcription',
			value: 'transcription',
			description: 'Transcripts of audio and video files, YouTube links and podcasts (Apify)',
		},
	],
	default: 'contact',
};

export const operationProperties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: show('aiExtract'),
		options: [
			{
				name: 'Extract',
				value: 'extract',
				action: 'Extract structured data from a web page',
				description: 'Read one public page and return the fields you name as JSON',
			},
		],
		default: 'extract',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: show('classification'),
		options: [
			{
				name: 'Classify',
				value: 'classify',
				action: 'Classify websites or texts',
				description: 'Label websites, pages or texts with AI',
			},
		],
		default: 'classify',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: show('contact'),
		options: [
			{
				name: 'Extract',
				value: 'extract',
				action: 'Extract contact details from a website',
				description: 'Read the home page and likely contact pages of a website',
			},
		],
		default: 'extract',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: show('seoAudit'),
		options: [
			{
				name: 'Audit',
				value: 'audit',
				action: 'Audit a page for search engine optimization',
				description: 'Score one page and list its SEO issues with fixes',
			},
		],
		default: 'audit',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: show('transcription'),
		options: [
			{
				name: 'Transcribe',
				value: 'transcribe',
				action: 'Transcribe audio or video',
				description: 'Transcribe media links or podcast feeds with timestamps',
			},
		],
		default: 'transcribe',
	},
];

export const contactProperties: INodeProperties[] = [
	{
		displayName: 'Website',
		name: 'url',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. stripe.com',
		displayOptions: show('contact'),
		description: 'Company website: a domain, a URL or an email address (its domain is used)',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add option',
		default: {},
		displayOptions: show('contact'),
		options: [
			rapidApiHostOption('website-contact-extractor1.p.rapidapi.com'),
			{
				displayName: 'Include Details',
				name: 'includeDetails',
				type: 'boolean',
				default: true,
				description: 'Whether to include where each email, phone and social profile was found',
			},
			{
				displayName: 'Max Pages',
				name: 'maxPages',
				type: 'number',
				default: 5,
				typeOptions: { minValue: 1, maxValue: 8 },
				description: 'Pages read per site, the home page included',
			},
			{
				displayName: 'Render',
				name: 'render',
				type: 'options',
				options: [
					{
						name: 'Auto',
						value: 'auto',
						description: 'Plain HTTP first, a real browser only when the site blocks it or needs JavaScript',
					},
					{ name: 'Never', value: 'never', description: 'Plain HTTP only (fastest)' },
				],
				default: 'auto',
			},
			targetErrorsOption,
		],
	},
];

export const seoAuditProperties: INodeProperties[] = [
	{
		displayName: 'Page URL',
		name: 'url',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. https://example.com/pricing',
		displayOptions: show('seoAudit'),
		description: 'Page to audit. A bare domain is accepted (https is assumed).',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add option',
		default: {},
		displayOptions: show('seoAudit'),
		options: [
			{
				displayName: 'Check Links',
				name: 'checkLinks',
				type: 'number',
				default: 0,
				typeOptions: { minValue: 0, maxValue: 50 },
				description: 'Also check the HTTP status of up to this many links on the page. 0 = no link checks (fastest).',
			},
			rapidApiHostOption('seo-audit-api15.p.rapidapi.com'),
			{
				displayName: 'Include Links',
				name: 'includeLinks',
				type: 'boolean',
				default: false,
				description: 'Whether to also return the links on the page (up to 500)',
			},
			{
				displayName: 'Link Scope',
				name: 'linkScope',
				type: 'options',
				options: [
					{ name: 'All (Internal First)', value: 'all' },
					{ name: 'External', value: 'external' },
					{ name: 'Internal', value: 'internal' },
				],
				default: 'all',
				description: 'Which links Check Links picks',
			},
			{
				displayName: 'Render',
				name: 'render',
				type: 'options',
				options: [
					{ name: 'Always', value: 'always', description: 'Real browser only' },
					{
						name: 'Auto',
						value: 'auto',
						description: 'Plain HTTP first, a real browser only when the site blocks it or sends a JavaScript shell',
					},
					{ name: 'Never', value: 'never', description: 'Plain HTTP only' },
				],
				default: 'auto',
			},
			targetErrorsOption,
			{
				displayName: 'Site Checks',
				name: 'siteChecks',
				type: 'boolean',
				default: true,
				description: 'Whether to read robots.txt, look for a sitemap and check the canonical target',
			},
			{
				displayName: 'Timeout (Ms)',
				name: 'timeoutMs',
				type: 'number',
				default: 15000,
				typeOptions: { minValue: 1000, maxValue: 30000 },
				description: 'Page-load timeout in milliseconds',
			},
		],
	},
];

export const aiExtractProperties: INodeProperties[] = [
	{
		displayName: 'Page URL',
		name: 'url',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. https://example.com/product/123',
		displayOptions: show('aiExtract'),
		description: 'Public HTML page to read',
	},
	{
		displayName: 'Define Output By',
		name: 'outputMode',
		type: 'options',
		noDataExpression: true,
		displayOptions: show('aiExtract'),
		options: [
			{ name: 'Field Names', value: 'fields', description: 'Each field is returned as text or null' },
			{ name: 'JSON Schema', value: 'schema', description: 'Typed values (numbers, booleans, arrays, objects)' },
		],
		default: 'fields',
	},
	{
		displayName: 'Fields',
		name: 'fields',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. title, price, currency, availability',
		displayOptions: show('aiExtract', { outputMode: ['fields'] }),
		description: 'Up to 50 field names, comma-separated or one per line',
	},
	{
		displayName: 'Schema',
		name: 'schema',
		type: 'json',
		required: true,
		default:
			'{\n  "type": "object",\n  "properties": {\n    "title": { "type": "string" },\n    "price": { "type": "number" }\n  }\n}',
		displayOptions: show('aiExtract', { outputMode: ['schema'] }),
		description: 'JSON Schema of type object with 1 to 50 properties (up to 10,000 characters)',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add option',
		default: {},
		displayOptions: show('aiExtract'),
		options: [
			rapidApiHostOption('ai-web-data-extractor-api-any-page-to-structured-json.p.rapidapi.com'),
			{
				displayName: 'Instructions',
				name: 'instructions',
				type: 'string',
				default: '',
				typeOptions: { rows: 3 },
				description: 'Extra extraction instructions, up to 2,000 characters',
			},
			{
				displayName: 'Max Characters',
				name: 'maxChars',
				type: 'number',
				default: 12000,
				typeOptions: { minValue: 1000, maxValue: 24000 },
				description: 'Most page characters (as Markdown) sent to the model',
			},
			{
				displayName: 'Max Output Tokens',
				name: 'maxTokens',
				type: 'number',
				default: 1024,
				typeOptions: { minValue: 256, maxValue: 2048 },
				description: 'Model output token budget',
			},
			targetErrorsOption,
			{
				displayName: 'Timeout (Ms)',
				name: 'timeoutMs',
				type: 'number',
				default: 15000,
				typeOptions: { minValue: 1000, maxValue: 20000 },
				description: 'Page fetch timeout in milliseconds (the AI step has its own limit)',
			},
		],
	},
];

export const classificationProperties: INodeProperties[] = [
	{
		displayName: 'Input Type',
		name: 'inputType',
		type: 'options',
		noDataExpression: true,
		displayOptions: show('classification'),
		options: [
			{ name: 'Texts', value: 'texts', description: 'Your own texts: reviews, posts, descriptions, tickets' },
			{ name: 'URLs or Domains', value: 'urls', description: 'Websites or pages, read and classified' },
		],
		default: 'urls',
	},
	{
		displayName: 'URLs or Domains',
		name: 'urls',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. stripe.com',
		displayOptions: show('classification', { inputType: ['urls'] }),
		description: 'One or more websites or pages, comma-separated or one per line',
	},
	{
		displayName: 'Text',
		name: 'text',
		type: 'string',
		required: true,
		default: '',
		typeOptions: { rows: 4 },
		displayOptions: show('classification', { inputType: ['texts'] }),
		description: 'The text to classify (one text per item)',
	},
	{
		displayName: 'Classify By',
		name: 'taxonomy',
		type: 'options',
		displayOptions: show('classification'),
		options: [
			{ name: 'Content Moderation', value: 'contentModeration', description: 'Safe, adult, violence, hate, spam, self-harm' },
			{ name: 'Custom Labels', value: 'custom', description: 'Your own labels' },
			{ name: 'IAB Categories (Tier 1)', value: 'iab' },
			{ name: 'Industry and Business Model', value: 'industry', description: 'Best with company domains' },
			{ name: 'Page Type', value: 'pageType', description: 'Homepage, product, article, pricing, careers…' },
			{ name: 'Sentiment', value: 'sentiment', description: 'Positive, neutral, negative or mixed' },
			{ name: 'Topic', value: 'topic', description: 'Technology, finance, health…' },
		],
		default: 'industry',
	},
	{
		displayName: 'Custom Labels',
		name: 'customLabels',
		type: 'string',
		required: true,
		default: '',
		typeOptions: { rows: 4 },
		placeholder: 'e.g. Competitor: sells project management software\nPartner\nOther',
		displayOptions: show('classification', { taxonomy: ['custom'] }),
		description: '2 to 100 labels, one per line, optionally with a description after a colon',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add option',
		default: {},
		displayOptions: show('classification'),
		options: [
			{
				displayName: 'Analysis Depth',
				name: 'analysisDepth',
				type: 'options',
				options: [
					{ name: 'Deep (32k Characters)', value: 'deep' },
					{ name: 'Quick (4k Characters)', value: 'quick' },
					{ name: 'Standard (12k Characters)', value: 'standard' },
				],
				default: 'standard',
				description: 'How much of each page the AI reads; each depth has its own price',
			},
			combineItemsOption,
			{
				displayName: 'Extra Instructions',
				name: 'instructions',
				type: 'string',
				default: '',
				typeOptions: { rows: 3 },
				description: 'Hints for the AI, up to 1,000 characters',
			},
			maxChargeOption,
			maxWaitOption(300),
			{
				displayName: 'Multiple Labels',
				name: 'multiLabel',
				type: 'boolean',
				default: false,
				description: 'Whether to return every label that clearly applies besides the main one',
			},
			{
				displayName: 'Page Fetching',
				name: 'mode',
				type: 'options',
				options: [
					{ name: 'Auto', value: 'auto', description: 'Plain HTTP, a real browser only when needed' },
					{ name: 'Browser Only', value: 'browser' },
					{ name: 'Plain HTTP Only', value: 'fast' },
				],
				default: 'auto',
			},
		],
	},
];

export const transcriptionProperties: INodeProperties[] = [
	{
		displayName: 'Source',
		name: 'source',
		type: 'options',
		noDataExpression: true,
		displayOptions: show('transcription'),
		options: [
			{
				name: 'Media URLs',
				value: 'urls',
				description: 'Audio or video files, cloud shares, YouTube, TikTok, Loom and similar links',
			},
			{ name: 'Podcast Feed', value: 'podcast', description: 'RSS feed or Apple Podcasts show link' },
		],
		default: 'urls',
	},
	{
		displayName: 'Media URLs',
		name: 'urls',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. https://example.com/episode.mp3',
		displayOptions: show('transcription', { source: ['urls'] }),
		description: 'One or more public media links, comma-separated or one per line (files up to 2 GB)',
	},
	{
		displayName: 'Podcast Feed URL',
		name: 'podcastFeed',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. https://feeds.example.com/show.rss',
		displayOptions: show('transcription', { source: ['podcast'] }),
	},
	{
		displayName: 'Episodes',
		name: 'maxEpisodesPerFeed',
		type: 'number',
		default: 1,
		typeOptions: { minValue: 1, maxValue: 1000 },
		displayOptions: show('transcription', { source: ['podcast'] }),
		description: 'How many of the newest episodes to transcribe',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add option',
		default: {},
		displayOptions: show('transcription'),
		options: [
			{
				displayName: 'AI Summary and Chapters',
				name: 'summarize',
				type: 'boolean',
				default: false,
				description: 'Whether to add a summary and timestamped chapters (charged as a separate event per file)',
			},
			combineItemsOption,
			{
				displayName: 'Engine',
				name: 'transcriptionEngine',
				type: 'options',
				options: [
					{ name: 'Accurate', value: 'accurate', description: 'Self-hosted Whisper, fewer errors, slower' },
					{ name: 'Fast', value: 'fast', description: 'Cloudflare Workers AI Whisper' },
				],
				default: 'fast',
			},
			{
				displayName: 'Language',
				name: 'language',
				type: 'string',
				default: '',
				placeholder: 'e.g. en',
				description: 'ISO 639-1 code such as en, es, de, ja or zh. Leave empty to detect it.',
			},
			{
				displayName: 'Max Minutes per File',
				name: 'maxMinutesPerFile',
				type: 'number',
				default: 0,
				typeOptions: { minValue: 0 },
				description: 'Skip longer files (free row with errorType too_large). 0 = no limit.',
			},
			maxChargeOption,
			maxWaitOption(900),
			{
				displayName: 'Meeting Notes',
				name: 'meetingNotes',
				type: 'boolean',
				default: false,
				description: 'Whether to add a summary, decisions and action items (no extra charge)',
			},
			{
				displayName: 'Resume Store Name',
				name: 'resumeStore',
				type: 'string',
				default: '',
				placeholder: 'e.g. n8n-recordings',
				description:
					'Remember finished transcripts by source file ID in a named store, so a retried workflow gets the saved transcript back without a new charge',
			},
			{
				displayName: 'Source File ID',
				name: 'sourceFileId',
				type: 'string',
				default: '',
				description: 'Your own ID of the file (e.g. a Drive file ID), copied to the result and used by Resume Store Name',
			},
			{
				displayName: 'Speaker Labels',
				name: 'speakerLabels',
				type: 'boolean',
				default: false,
				description: 'Whether to label who said what (billed at the speaker-label minute price)',
			},
			{
				displayName: 'Vocabulary Hints',
				name: 'vocabulary',
				type: 'string',
				default: '',
				placeholder: 'e.g. Apify, Cloudflare, Kubernetes',
				description: 'Names, brands or terms that appear in the audio',
			},
			{
				displayName: 'Word Timestamps',
				name: 'wordTimestamps',
				type: 'boolean',
				default: false,
				description: 'Whether to add the start and end time of every word',
			},
		],
	},
];
