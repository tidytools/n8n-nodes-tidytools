import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class TidyToolsRapidApi implements ICredentialType {
	name = 'tidyToolsRapidApi';

	displayName = 'TidyTools RapidAPI API';

	icon: Icon = { light: 'file:../icons/tidytools.svg', dark: 'file:../icons/tidytools.dark.svg' };

	documentationUrl = 'https://github.com/tidytools/n8n-nodes-tidytools#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'RapidAPI Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description:
				'The X-RapidAPI-Key of your RapidAPI app (rapidapi.com → My Apps → your app → Authorization). Subscribe the app to each TidyTools API you use; every API has a free plan.',
		},
		{
			displayName: 'Test With',
			name: 'testWith',
			type: 'options',
			options: [
				{ name: 'SEO Audit API', value: 'seoAudit' },
				{ name: 'Website Contact Extractor', value: 'contact' },
			],
			default: 'contact',
			description:
				'API the credential test calls once (one request of that plan, on example.com). Pick one your app is subscribed to.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: { 'X-RapidAPI-Key': '={{$credentials.apiKey}}' },
		},
	};

	test: ICredentialTestRequest = {
		request: {
			method: 'GET',
			url: '={{$credentials.testWith === "seoAudit" ? "https://seo-audit-api15.p.rapidapi.com/api/v1/seo/audit?url=example.com&siteChecks=false&render=never" : "https://website-contact-extractor1.p.rapidapi.com/api/v1/contacts?url=example.com&maxPages=1&render=never&includeDetails=false"}}',
			headers: {
				'X-RapidAPI-Host':
					'={{$credentials.testWith === "seoAudit" ? "seo-audit-api15.p.rapidapi.com" : "website-contact-extractor1.p.rapidapi.com"}}',
			},
		},
	};
}
