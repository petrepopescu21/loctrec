import { createRoute, z } from "@hono/zod-openapi";

const HealthResponseSchema = z.object({
	status: z.string(),
	service: z.string(),
});

export const healthRoute = createRoute({
	method: "get",
	path: "/health",
	responses: {
		200: {
			content: {
				"application/json": {
					schema: HealthResponseSchema,
				},
			},
			description: "Health check response",
		},
	},
});
