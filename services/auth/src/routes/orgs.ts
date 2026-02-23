import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { sql } from "../db/connection";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/require-role";
import { AVAILABLE_SCOPES, validateScopes } from "../scopes";
import { type Env, ErrorSchema } from "../types";

const OrgParamsSchema = z.object({
	orgId: z.string().uuid(),
});

const CreateOrgBodySchema = z.object({
	name: z.string().min(1),
	contact_email: z.string().email(),
	scopes: z.array(z.string()),
});

const OrgSchema = z.object({
	id: z.string().uuid(),
	name: z.string(),
	contact_email: z.string(),
	scopes: z.array(z.string()),
	owner_id: z.string().uuid(),
	created_at: z.string(),
});

const OrgDetailSchema = OrgSchema.extend({
	updated_at: z.string().nullable(),
});

const UpdateOrgBodySchema = z.object({
	name: z.string().min(1).optional(),
	contact_email: z.string().email().optional(),
	scopes: z.array(z.string()).optional(),
});

const createOrgRoute = createRoute({
	method: "post",
	path: "/orgs",
	security: [{ Bearer: [] }],
	request: {
		body: {
			content: {
				"application/json": {
					schema: CreateOrgBodySchema,
				},
			},
		},
	},
	responses: {
		201: {
			content: {
				"application/json": {
					schema: OrgSchema,
				},
			},
			description: "Organization created",
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
	},
});

const getOrgRoute = createRoute({
	method: "get",
	path: "/orgs/{orgId}",
	security: [{ Bearer: [] }],
	request: {
		params: OrgParamsSchema,
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: OrgDetailSchema,
				},
			},
			description: "Organization details",
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

const updateOrgRoute = createRoute({
	method: "patch",
	path: "/orgs/{orgId}",
	security: [{ Bearer: [] }],
	request: {
		params: OrgParamsSchema,
		body: {
			content: {
				"application/json": {
					schema: UpdateOrgBodySchema,
				},
			},
		},
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: OrgDetailSchema,
				},
			},
			description: "Organization updated",
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

export const orgsRouter = new OpenAPIHono<Env>();

orgsRouter.use("/orgs", authenticate, requireRole("organizer"));
orgsRouter.use("/orgs/*", authenticate, requireRole("organizer"));

orgsRouter.openapi(createOrgRoute, async (c) => {
	const auth = c.get("auth");
	const { name, contact_email, scopes } = c.req.valid("json");

	if (!validateScopes(scopes, [...AVAILABLE_SCOPES])) {
		return c.json(
			{ error: "invalid_scopes", message: "One or more scopes are invalid" },
			400,
		);
	}

	const [org] = await sql`
		INSERT INTO auth.organizations (name, contact_email, scopes, owner_id)
		VALUES (${name}, ${contact_email}, ${scopes}, ${auth.sub})
		RETURNING id, name, contact_email, scopes, owner_id, created_at
	`;

	return c.json(
		{
			id: org.id,
			name: org.name,
			contact_email: org.contact_email,
			scopes: org.scopes,
			owner_id: org.owner_id,
			created_at: org.created_at.toISOString(),
		},
		201,
	);
});

orgsRouter.openapi(getOrgRoute, async (c) => {
	const auth = c.get("auth");
	const { orgId } = c.req.valid("param");

	const [org] = await sql`
		SELECT id, name, contact_email, scopes, owner_id, created_at, updated_at
		FROM auth.organizations
		WHERE id = ${orgId} AND owner_id = ${auth.sub}
	`;

	if (!org) {
		return c.json(
			{ error: "not_found", message: "Organization not found" },
			404,
		);
	}

	return c.json(
		{
			id: org.id,
			name: org.name,
			contact_email: org.contact_email,
			scopes: org.scopes,
			owner_id: org.owner_id,
			created_at: org.created_at.toISOString(),
			updated_at: org.updated_at ? org.updated_at.toISOString() : null,
		},
		200,
	);
});

orgsRouter.openapi(updateOrgRoute, async (c) => {
	const auth = c.get("auth");
	const { orgId } = c.req.valid("param");
	const body = c.req.valid("json");

	if (body.scopes) {
		if (!validateScopes(body.scopes, [...AVAILABLE_SCOPES])) {
			return c.json(
				{
					error: "invalid_scopes",
					message: "One or more scopes are invalid",
				},
				400,
			);
		}
	}

	const updates: Record<string, unknown> = {};
	if (body.name !== undefined) updates.name = body.name;
	if (body.contact_email !== undefined)
		updates.contact_email = body.contact_email;
	if (body.scopes !== undefined) updates.scopes = body.scopes;

	if (Object.keys(updates).length === 0) {
		const [org] = await sql`
			SELECT id, name, contact_email, scopes, owner_id, created_at, updated_at
			FROM auth.organizations
			WHERE id = ${orgId} AND owner_id = ${auth.sub}
		`;

		if (!org) {
			return c.json(
				{ error: "not_found", message: "Organization not found" },
				404,
			);
		}

		return c.json(
			{
				id: org.id,
				name: org.name,
				contact_email: org.contact_email,
				scopes: org.scopes,
				owner_id: org.owner_id,
				created_at: org.created_at.toISOString(),
				updated_at: org.updated_at ? org.updated_at.toISOString() : null,
			},
			200,
		);
	}

	const [org] = await sql`
		UPDATE auth.organizations
		SET ${sql(updates)}, updated_at = now()
		WHERE id = ${orgId} AND owner_id = ${auth.sub}
		RETURNING id, name, contact_email, scopes, owner_id, created_at, updated_at
	`;

	if (!org) {
		return c.json(
			{ error: "not_found", message: "Organization not found" },
			404,
		);
	}

	return c.json(
		{
			id: org.id,
			name: org.name,
			contact_email: org.contact_email,
			scopes: org.scopes,
			owner_id: org.owner_id,
			created_at: org.created_at.toISOString(),
			updated_at: org.updated_at ? org.updated_at.toISOString() : null,
		},
		200,
	);
});
