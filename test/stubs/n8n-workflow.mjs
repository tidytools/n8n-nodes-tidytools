// Minimal stand-in for the runtime values the node imports from n8n-workflow (used only when the real package is
// not installed; see test/loader.mjs). Types are erased, so only these values are needed.
export const NodeConnectionTypes = { Main: 'main', AiTool: 'ai_tool' };

export class NodeOperationError extends Error {
	constructor(node, message, options = {}) {
		super(typeof message === 'string' ? message : message?.message);
		this.node = node;
		this.description = options.description;
		this.itemIndex = options.itemIndex;
	}
}

export class NodeApiError extends Error {
	constructor(node, errorResponse, options = {}) {
		super(options.message ?? errorResponse?.message ?? 'API error');
		this.node = node;
		this.errorResponse = errorResponse;
		this.description = options.description;
		this.httpCode = options.httpCode;
		this.itemIndex = options.itemIndex;
	}
}
