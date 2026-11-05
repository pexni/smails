import { handleApi } from "./api.ts";
import { migrateLocally } from "./dev-migrate.ts";
import { errorResponse, HttpError, json } from "./http.ts";
import { receiveEmail } from "./mail.ts";
import { HUB_NAME } from "./wait.ts";

export { InboxHub } from "./inbox-hub.ts";
export { Mailbox } from "./legacy.ts";

async function route(
	request: Request,
	env: Env,
	ctx: ExecutionContext,
): Promise<Response> {
	const { pathname } = new URL(request.url);
	if (pathname.startsWith("/api/")) {
		return handleApi(request, env, ctx);
	}
	throw new HttpError(404, "not_found", "No such endpoint.");
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		try {
			if (import.meta.env.DEV) {
				await migrateLocally(env);
			}
			return await route(request, env, ctx);
		} catch (error) {
			if (error instanceof HttpError) {
				return errorResponse(error);
			}
			console.error(error);
			return json({ error: "internal", message: "Internal error." }, 500);
		}
	},

	async email(message, env, ctx): Promise<void> {
		if (import.meta.env.DEV) {
			await migrateLocally(env);
		}
		await receiveEmail(message, env, (address) =>
			ctx.exports.InboxHub.getByName(HUB_NAME).notify(address),
		);
	},
} satisfies ExportedHandler<Env>;
