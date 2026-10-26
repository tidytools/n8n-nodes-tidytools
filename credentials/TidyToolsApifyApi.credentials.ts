import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class TidyToolsApifyApi implements ICredentialType {
	name = 'tidyToolsApifyApi';

	displayName = 'TidyTools Apify API';

	icon: Icon = { light: 'file:../icons/tidytools.svg', dark: 'file:../icons/tidytools.dark.svg' };

	documentationUrl = 'https://github.com/tidytools/n8n-nodes-tidytools#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'Apify API Token',
			name: 'apiToken',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description:
				'Your personal API token from console.apify.com → Settings → API & Integrations. Transcription and classification run TidyTools Actors on your Apify account and are billed there per result.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: { Authorization: '=Bearer {{$credentials.apiToken}}' },
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.apify.com/v2',
			url: '/users/me',
		},
	};
}
