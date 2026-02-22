import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { sql } from "../db/connection";
import { authenticate } from "../middleware/authenticate";
import { type Env, ErrorSchema } from "../types";

const FirstPartyUserSchema = z.object({
	id: z.string(),
	email: z.string(),
	name: z.string(),
	role: z.string(),
	created_at: z.string(),
});

const ThirdPartyUserSchema = z.object({
	sub: z.string(),
	ct: z.literal("tp"),
	org: z.string().optional(),
	scp: z.array(z.string()).optional(),
});

const MeResponseSchema = z.union([FirstPartyUserSchema, ThirdPartyUserSchema]);

const meRoute = createRoute({
	method: "get",
	path: "/me",
	security: [{ Bearer: [] }],
	responses: {
		200: {
			content: {
				"application/json": {
					schema: MeResponseSchema,
				},
			},
			description: "Current user info",
		},
		401: {
			content: {
				"application/json": {
					schema: ErrorSchema,
				},
			},
			description: "Unauthorized",
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

export const meRouter = new OpenAPIHono<Env>();

meRouter.use("/me", authenticate);

meRouter.openapi(meRoute, async (c) => {
	const auth = c.get("auth");

	if (auth.ct === "tp") {
		return c.json(
			{
				sub: auth.sub,
				ct: "tp" as const,
				org: auth.org,
				scp: auth.scp,
			},
			200,
		);
	}

	const [user] = await sql`
		SELECT id, email, name, role, created_at
		FROM auth.users
		WHERE id = ${auth.sub}
	`;

	if (!user) {
		return c.json({ error: "not_found", message: "User not found" }, 404);
	}

	return c.json(
		{
			id: user.id,
			email: user.email,
			name: user.name,
			role: user.role,
			created_at: user.created_at.toISOString(),
		},
		200,
	);
});
