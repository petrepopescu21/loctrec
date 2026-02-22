import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { sql } from "../db/connection";
import { signAccessToken } from "../jwt/sign";
import {
	createRefreshToken,
	revokeRefreshToken,
	validateRefreshToken,
} from "../refresh-tokens";
import { validateScopes } from "../scopes";
import type { Env } from "../types";
import { ErrorSchema } from "../types";

const TokenRequestSchema = z.object({
	grant_type: z.literal("client_credentials"),
	api_key: z.string().min(1),
	on_behalf_of: z.string().optional(),
});

const TokenResponseSchema = z.object({
	access_token: z.string(),
	token_type: z.literal("Bearer"),
	expires_in: z.number(),
});

const RefreshRequestSchema = z.object({
	refresh_token: z.string().min(1),
});

const RefreshResponseSchema = z.object({
	access_token: z.string(),
	refresh_token: z.string(),
	token_type: z.literal("Bearer"),
	expires_in: z.number(),
});

const RevokeRequestSchema = z.object({
	refresh_token: z.string().min(1),
});

const tokenRoute = createRoute({
	method: "post",
	path: "/token",
	request: {
		body: {
			content: {
				"application/json": {
					schema: TokenRequestSchema,
				},
			},
		},
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: TokenResponseSchema,
				},
			},
			description: "Access token issued",
		},
		400: {
			content: {
				"application/json": {
					schema: ErrorSchema,
				},
			},
			description: "Invalid grant type",
		},
		401: {
			content: {
				"application/json": {
					schema: ErrorSchema,
				},
			},
			description: "Invalid API key",
		},
	},
});

const refreshRoute = createRoute({
	method: "post",
	path: "/token/refresh",
	request: {
		body: {
			content: {
				"application/json": {
					schema: RefreshRequestSchema,
				},
			},
		},
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: RefreshResponseSchema,
				},
			},
			description: "Tokens refreshed",
		},
		401: {
			content: {
				"application/json": {
					schema: ErrorSchema,
				},
			},
			description: "Invalid refresh token",
		},
		404: {
			content: {
				"application/json": {
					schema: ErrorSchema,
				},
			},
			description: "User not found",
		},
	},
});

const revokeRoute = createRoute({
	method: "delete",
	path: "/token",
	request: {
		body: {
			content: {
				"application/json": {
					schema: RevokeRequestSchema,
				},
			},
		},
	},
	responses: {
		204: {
			description: "Token revoked",
		},
		500: {
			content: {
				"application/json": {
					schema: ErrorSchema,
				},
			},
			description: "Internal server error",
		},
	},
});

export const tokenRouter = new OpenAPIHono<Env>();

tokenRouter.openapi(tokenRoute, async (c) => {
	try {
		const body = c.req.valid("json");

		if (body.grant_type !== "client_credentials") {
			return c.json(
				{
					error: "invalid_grant",
					message: "Unsupported grant_type",
				},
				400,
			);
		}

		const apiKey = body.api_key;
		const prefix = apiKey.slice(0, 8);

		const [dbKey] = await sql`
			SELECT id, org_id, key_hash, scopes
			FROM auth.api_keys
			WHERE key_prefix = ${prefix}
			AND revoked_at IS NULL
			AND (expires_at IS NULL OR expires_at > now())
		`;

		if (!dbKey) {
			return c.json({ error: "invalid_key", message: "Invalid API key" }, 401);
		}

		const valid = await Bun.password.verify(apiKey, dbKey.key_hash);
		if (!valid) {
			return c.json({ error: "invalid_key", message: "Invalid API key" }, 401);
		}

		await sql`
			UPDATE auth.api_keys SET last_used_at = now()
			WHERE id = ${dbKey.id}
		`;

		const [org] = await sql`
			SELECT id, scopes FROM auth.organizations
			WHERE id = ${dbKey.org_id}
		`;

		if (!org) {
			return c.json(
				{
					error: "invalid_key",
					message: "Organization not found",
				},
				401,
			);
		}

		if (!validateScopes(dbKey.scopes, org.scopes)) {
			return c.json(
				{
					error: "invalid_scope",
					message: "Key scopes exceed organization scopes",
				},
				401,
			);
		}

		const sub = body.on_behalf_of ?? org.id;
		const accessToken = await signAccessToken({
			sub,
			ct: "tp",
			scp: dbKey.scopes,
			...(body.on_behalf_of && { org: org.id }),
		});

		return c.json(
			{
				access_token: accessToken,
				token_type: "Bearer" as const,
				expires_in: 900,
			},
			200,
		);
	} catch (err) {
		return c.json(
			{
				error: "server_error",
				message: err instanceof Error ? err.message : "Internal server error",
			},
			401,
		);
	}
});

tokenRouter.openapi(refreshRoute, async (c) => {
	try {
		const { refresh_token } = c.req.valid("json");

		let validated: { id: string; userId: string };
		try {
			validated = await validateRefreshToken(refresh_token);
		} catch {
			return c.json(
				{
					error: "invalid_token",
					message: "Invalid refresh token",
				},
				401,
			);
		}

		await revokeRefreshToken(refresh_token);

		const [user] = await sql`
			SELECT id, role FROM auth.users
			WHERE id = ${validated.userId}
		`;

		if (!user) {
			return c.json({ error: "not_found", message: "User not found" }, 404);
		}

		const accessToken = await signAccessToken({
			sub: user.id,
			ct: "fp",
			role: user.role,
		});

		const newRefreshToken = await createRefreshToken(user.id);

		return c.json(
			{
				access_token: accessToken,
				refresh_token: newRefreshToken,
				token_type: "Bearer" as const,
				expires_in: 900,
			},
			200,
		);
	} catch (err) {
		return c.json(
			{
				error: "server_error",
				message: err instanceof Error ? err.message : "Internal server error",
			},
			401,
		);
	}
});

tokenRouter.openapi(revokeRoute, async (c) => {
	try {
		const { refresh_token } = c.req.valid("json");
		await revokeRefreshToken(refresh_token);
		return c.body(null, 204);
	} catch (err) {
		return c.json(
			{
				error: "server_error",
				message: err instanceof Error ? err.message : "Internal server error",
			},
			500,
		);
	}
});
