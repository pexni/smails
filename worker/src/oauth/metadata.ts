import { SCOPE } from "../tokens.ts";

/** RFC 9728：受保护资源的元数据。MCP 客户端从 401 的 WWW-Authenticate 里找到它。 */
export function protectedResourceMetadata(
	origin: string,
	resource: "mcp" | "api",
) {
	return {
		resource: `${origin}/${resource}`,
		authorization_servers: [origin],
		scopes_supported: [SCOPE],
		bearer_methods_supported: ["header"],
		resource_name: "smails",
		resource_documentation: `${origin}/docs/${resource}`,
	};
}

/** RFC 8414：授权服务器元数据。 */
export function authorizationServerMetadata(origin: string) {
	return {
		issuer: origin,
		authorization_endpoint: `${origin}/authorize`,
		token_endpoint: `${origin}/token`,
		registration_endpoint: `${origin}/register`,
		revocation_endpoint: `${origin}/revoke`,
		device_authorization_endpoint: `${origin}/device/code`,
		response_types_supported: ["code"],
		response_modes_supported: ["query"],
		grant_types_supported: [
			"authorization_code",
			"refresh_token",
			"urn:ietf:params:oauth:grant-type:device_code",
		],
		code_challenge_methods_supported: ["S256"],
		token_endpoint_auth_methods_supported: ["none"],
		revocation_endpoint_auth_methods_supported: ["none"],
		scopes_supported: [SCOPE],
		client_id_metadata_document_supported: true,
		authorization_response_iss_parameter_supported: true,
		service_documentation: `${origin}/docs/mcp`,
	};
}
