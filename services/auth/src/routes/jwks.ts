import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { getJWKS } from "../jwt/keys";
import type { Env } from "../types";

const JWKSResponseSchema = z.object({
	keys: z.array(z.record(z.string(), z.any())),
});

const jwksRoute = createRoute({
	method: "get",
	path: "/.well-known/jwks.json",
	responses: {
		200: {
			content: {
				"application/json": {
					schema: JWKSResponseSchema,
				},
			},
			description: "JSON Web Key Set",
		},
	},
});

export const jwksRouter = new OpenAPIHono<Env>();

jwksRouter.openapi(jwksRoute, async (c) => {
	const jwks = await getJWKS();
	c.header("Cache-Control", "public, max-age=3600");
	return c.json(jwks, 200);
});
