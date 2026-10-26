import type { IDataObject, INodeProperties } from 'n8n-workflow';

type Resource = 'contact' | 'seoAudit' | 'aiExtract' | 'classification' | 'transcription';

// The first ten fields are also the Simplified output, in useful display order.
const fields: Record<Resource, string[]> = {
	contact: [
		'success', 'url', 'organizationName', 'primaryEmail', 'primaryPhone', 'emails', 'phones',
		'socialProfiles', 'address', 'error', 'domain', 'finalUrl', 'faxes', 'addressDetails',
		'country', 'logo', 'contactFormUrl', 'contactPages', 'foundAnything', 'title', 'language',
		'renderedWith', 'pagesChecked', 'pagesFailed', 'emailDetails', 'phoneDetails',
		'socialProfileSources', 'organization', 'contactForms', 'otherSocialLinks',
	],
	seoAudit: [
		'success', 'url', 'score', 'grade', 'summary', 'issues', 'title', 'metaDescription',
		'error', 'statusCode', 'finalUrl', 'categoryScores', 'canonical', 'indexability', 'links',
		'headings', 'sitemap', 'hreflang', 'social', 'structuredData', 'images', 'content',
		'mobile', 'performance', 'technical', 'renderedWith', 'durationMs',
	],
	aiExtract: [
		'success', 'url', 'title', 'data', 'truncated', 'model', 'usage', 'error',
		'statusCode', 'finalUrl', 'renderedWith', 'sourceChars', 'charsSent',
	],
	classification: ['input', 'url', 'label', 'confidence', 'businessModel', 'companySummary', 'charged', 'error', 'errorType', 'title', 'labels', 'reason', 'language', 'siteStatus'],
	transcription: [
		'input', 'url', 'success', 'language', 'durationSeconds', 'text', 'summary',
		'charged', 'error', 'errorType', 'episodeTitle', 'billedMinutes', 'wordCount',
		'segments', 'paragraphs', 'srtUrl', 'vttUrl', 'txtUrl', 'meetingNotesUrl', 'speakers',
	],
};
const simplifiedFields: Record<Resource, string[]> = {
	contact: fields.contact.slice(0, 10),
	seoAudit: fields.seoAudit.slice(0, 10),
	aiExtract: fields.aiExtract.slice(0, 8),
	classification: fields.classification.slice(0, 9),
	transcription: fields.transcription.slice(0, 10),
};

export const outputProperties: INodeProperties[] = [
	{
		displayName: 'Simplify',
		name: 'simplify',
		type: 'boolean',
		default: false,
		description: 'Whether to return a simplified version of the response instead of the raw data',
	},
	{
		displayName: 'Output',
		name: 'output',
		type: 'options',
		options: [
			{ name: 'Raw', value: 'raw', description: 'Return all fields' },
			{ name: 'Selected Fields', value: 'selected', description: 'Return only selected fields and the item identifier' },
			{ name: 'Simplified', value: 'simplified', description: 'Return up to ten useful fields' },
		],
		default: 'raw',
		description: 'Choose what to send to an AI agent. Selected Fields and Simplified also work in regular workflows.',
	},
	...(Object.entries(fields) as [Resource, string[]][]).map(([resource, names]): INodeProperties => ({
		displayName: 'Selected Fields',
		name: 'selectedFields',
		type: 'multiOptions',
		displayOptions: { show: { resource: [resource], output: ['selected'] } },
		options: names.map((name) => ({ name: name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase()), value: name })).sort((a, b) => a.name.localeCompare(b.name)),
		default: [],
		description: 'Fields to return along with an available item identifier',
	})),
];

function pick(row: IDataObject, keys: string[]): IDataObject {
	const result: IDataObject = {};
	for (const key of keys) if (Object.prototype.hasOwnProperty.call(row, key)) result[key] = row[key];
	return result;
}

export function shapeOutput(row: IDataObject, resource: string, output: string, simplify: boolean, selectedFields: string[]): IDataObject {
	if (output === 'raw' && !simplify) return row;
	const known = fields[resource as Resource];
	if (!known) return row;
	if (output === 'selected') {
		// These APIs often have no id. Keep the first available stable input identifier.
		const identifier = ['id', 'input', 'url', 'domain'].find((key) => Object.prototype.hasOwnProperty.call(row, key));
		const keys = [identifier, ...selectedFields.filter((key) => known.includes(key))].filter((key): key is string => Boolean(key));
		if (row.success === false || row.error !== undefined) keys.push('success', 'error', 'errorType');
		return pick(row, keys);
	}
	const keys = simplifiedFields[resource as Resource];
	const result = pick(row, keys);
	// A failed row must still expose its reason when it has one.
	if (row.error !== undefined && !Object.prototype.hasOwnProperty.call(result, 'error')) {
		const last = Object.keys(result)[Object.keys(result).length - 1];
		if (last) delete result[last];
		result.error = row.error;
	}
	return result;
}
