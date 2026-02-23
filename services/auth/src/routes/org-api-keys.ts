import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { sql } from "../db/connection";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/require-role";
import { validateScopes } from "../scopes";
import { type Env, ErrorSchema } from "../types";

const OrgParamsSchema = z.object({
	orgId: z.string().uuid(),
});

const KeyParamsSchema = z.object({
	orgId: z.string().uuid(),
	keyId: z.string().uuid(),
});

const CreateApiKeyBodySchema = z.object({
	label: z.string().optional(),
	scopes: z.array(z.string()),
});

const ApiKeyCreatedSchema = z.object({
	id: z.string().uuid(),
	key: z.string(),
	key_prefix: z.string(),
	label: z.string().nullable(),
	scopes: z.array(z.string()),
	created_at: z.string(),
});

const ApiKeySchema = z.object({
	id: z.string().uuid(),
	key_prefix: z.string(),
	label: z.string().nullable(),
	scopes: z.array(z.string()),
	expires_at: z.string().nullable(),
	last_used_at: z.string().nullable(),
	created_at: z.string(),
});

const ApiKeyListSchema = z.array(ApiKeySchema);

const createApiKeyRoute = createRoute({
	method: "post",
	path: "/orgs/{orgId}/api-keys",
	security: [{ Bearer: [] }],
	request: {
		params: OrgParamsSchema,
		body: {
			content: {
				"application/json": {
					schema: CreateApiKeyBodySchema,
				},
			},
		},
	},
	responses: {
		201: {
			content: {
				"application/json": {
					schema: ApiKeyCreatedSchema,
				},
			},
			description: "API key created",
		},
		400: {
			content: {
				"application/json": {
					schema: ErrorSchema,
				},
			},
			description: "Invalid scopes",
		},
		401: {
			content: {
				"application/json": {
					schema: ErrorSchema,
				},
			},
			description: "Unauthorized",
		},
		403: {
			content: {
				"application/json": {
					schema: ErrorSchema,
				},
			},
			description: "Forbidden",
		},
		404: {
			content: {
				"application/json": {
					schema: ErrorSchema,
				},
			},
			description: "Organization not found",
		},
	},
});

const listApiKeysRoute = createRoute({
	method: "get",
	path: "/orgs/{orgId}/api-keys",
	security: [{ Bearer: [] }],
	request: {
		params: OrgParamsSchema,
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: ApiKeyListSchema,
				},
			},
			description: "List of API keys",
		},
		401: {
			content: {
				"application/json": {
					schema: ErrorSchema,
				},
			},
			description: "Unauthorized",
		},
		403: {
			content: {
				"application/json": {
					schema: ErrorSchema,
				},
			},
			description: "Forbidden",
		},
		404: {
			content: {
				"application/json": {
					schema: ErrorSchema,
				},
			},
			description: "Organization not found",
		},
	},
});

const revokeApiKeyRoute = createRoute({
	method: "delete",
	path: "/orgs/{orgId}/api-keys/{keyId}",
	security: [{ Bearer: [] }],
	request: {
		params: KeyParamsSchema,
	},
	responses: {
		204: {
			description: "API key revoked",
		},
		401: {
			content: {
				"application/json": {
					schema: ErrorSchema,
				},
			},
			description: "Unauthorized",
		},
		403: {
			content: {
				"application/json": {
					schema: ErrorSchema,
				},
			},
			description: "Forbidden",
		},
		404: {
			content: {
				"application/json": {
					schema: ErrorSchema,
				},
			},
			description: "API key not found",
		},
	},
});

export const orgApiKeysRouter = new OpenAPIHono<Env>();

orgApiKeysRouter.use("/orgs/*", authenticate, requireRole("organizer"));

orgApiKeysRouter.openapi(createApiKeyRoute, async (c) => {
	const auth = c.get("auth");
	const { orgId } = c.req.valid("param");
	const { label, scopes } = c.req.valid("json");

	const [org] = await sql`
		SELECT id, scopes
		FROM auth.organizations
		WHERE id = ${orgId} AND owner_id = ${auth.sub}
	`;

	if (!org) {
		return c.json(
			{ error: "not_found", message: "Organization not found" },
			404,
		);
	}

	if (!validateScopes(scopes, org.scopes)) {
		return c.json(
			{
				error: "invalid_scopes",
				message: "Requested scopes must be a subset of the organization scopes",
			},
			400,
		);
	}

	const bytes = crypto.getRandomValues(new Uint8Array(16));
	const hex = Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
	const rawKey = `ltk_${hex}`;
	const keyPrefix = rawKey.slice(0, 8);
	const keyHash = await Bun.password.hash(rawKey, { algorithm: "argon2id" });

	const [apiKey] = await sql`
		INSERT INTO auth.api_keys (org_id, key_hash, key_prefix, label, scopes)
		VALUES (${orgId}, ${keyHash}, ${keyPrefix}, ${label ?? null}, ${scopes})
		RETURNING id, key_prefix, label, scopes, created_at
	`;

	return c.json(
		{
			id: apiKey.id,
			key: rawKey,
			key_prefix: apiKey.key_prefix,
			label: apiKey.label,
			scopes: apiKey.scopes,
			created_at: apiKey.created_at.toISOString(),
		},
		201,
	);
});

orgApiKeysRouter.openapi(listApiKeysRoute, async (c) => {
	const auth = c.get("auth");
	const { orgId } = c.req.valid("param");

	const [org] = await sql`
		SELECT id
		FROM auth.organizations
		WHERE id = ${orgId} AND owner_id = ${auth.sub}
	`;

	if (!org) {
		return c.json(
			{ error: "not_found", message: "Organization not found" },
			404,
		);
	}

	const keys = await sql`
		SELECT id, key_prefix, label, scopes, expires_at, last_used_at, created_at
		FROM auth.api_keys
		WHERE org_id = ${orgId} AND revoked_at IS NULL
		ORDER BY created_at DESC
	`;

	return c.json(
		keys.map((k) => ({
			id: k.id,
			key_prefix: k.key_prefix,
			label: k.label,
			scopes: k.scopes,
			expires_at: k.expires_at ? k.expires_at.toISOString() : null,
			last_used_at: k.last_used_at ? k.last_used_at.toISOString() : null,
			created_at: k.created_at.toISOString(),
		})),
		200,
	);
});

orgApiKeysRouter.openapi(revokeApiKeyRoute, async (c) => {
	const auth = c.get("auth");
	const { orgId, keyId } = c.req.valid("param");

	const [org] = await sql`
		SELECT id
		FROM auth.organizations
		WHERE id = ${orgId} AND owner_id = ${auth.sub}
	`;

	if (!org) {
		return c.json(
			{ error: "not_found", message: "Organization not found" },
			404,
		);
	}

	const [revoked] = await sql`
		UPDATE auth.api_keys
		SET revoked_at = now()
		WHERE id = ${keyId} AND org_id = ${orgId} AND revoked_at IS NULL
		RETURNING id
	`;

	if (!revoked) {
		return c.json({ error: "not_found", message: "API key not found" }, 404);
	}

	return c.body(null, 204);
});
