/** OAuth 端点的错误（RFC 6749 §5.2 的格式：`{ error, error_description }`）。 */
export class OAuthError extends Error {
	readonly status: number;
	readonly error: string;

	constructor(status: number, error: string, description: string) {
		super(description);
		this.status = status;
		this.error = error;
	}
}

export function oauthErrorResponse(error: OAuthError): Response {
	return new Response(
		JSON.stringify({ error: error.error, error_description: error.message }),
		{
			status: error.status,
			headers: {
				"Content-Type": "application/json; charset=utf-8",
				"Cache-Control": "no-store",
			},
		},
	);
}
