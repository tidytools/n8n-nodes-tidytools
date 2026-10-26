// A fake IExecuteFunctions: parameters per item, a queue of HTTP answers, and a log of the requests sent.
import type { IDataObject } from 'n8n-workflow';

export interface Call {
	credential: string;
	request: IDataObject & { method?: string; url: string; qs?: IDataObject; body?: IDataObject; headers?: IDataObject };
}

type Answer = unknown | Error | ((request: Call['request']) => unknown);

export function fakeContext(opts: {
	params: IDataObject | ((itemIndex: number) => IDataObject);
	items?: number;
	answers: Answer[];
	continueOnFail?: boolean;
}) {
	const calls: Call[] = [];
	const answers = [...opts.answers];
	const paramsOf = (i: number) => (typeof opts.params === 'function' ? opts.params(i) : opts.params);
	const context = {
		calls,
		getInputData: () => Array.from({ length: opts.items ?? 1 }, (_, i) => ({ json: { index: i } })),
		getNodeParameter: (name: string, itemIndex: number, fallback?: unknown) => {
			const params = paramsOf(itemIndex);
			return name in params ? params[name] : fallback;
		},
		getNode: () => ({ name: 'TidyTools', type: 'n8n-nodes-tidytools.tidyTools', typeVersion: 1 }),
		continueOnFail: () => opts.continueOnFail ?? false,
		helpers: {
			httpRequestWithAuthentication: async (credential: string, request: Call['request']) => {
				calls.push({ credential, request });
				if (!answers.length) throw new Error(`unexpected request ${request.method} ${request.url}`);
				const answer = answers.shift();
				if (answer instanceof Error) throw answer;
				return typeof answer === 'function' ? (answer as (r: Call['request']) => unknown)(request) : answer;
			},
		},
	};
	return context;
}

export const ok = (body: unknown, statusCode = 200) => ({ statusCode, body, headers: {} });

export const run = (status: string, extra: IDataObject = {}) => ({
	data: { id: 'RUN1', status, defaultDatasetId: 'DS1', ...extra },
});
