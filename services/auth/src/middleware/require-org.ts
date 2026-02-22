import { createMiddleware } from "hono/factory";
import { sql } from "../db/connection";
import type { Env } from "../types";

export const requireOrgOwner = createMiddleware<Env>(async (c, next) => {
	const auth = c.get("auth");
	const orgId = c.req.param("orgId");

	const [org] = await sql`
		SELECT owner_id FROM auth.organizations WHERE id = ${orgId}
	`;

	if (!org) {
		return c.json(
			{ error: "not_found", message: "Organization not found" },
			404,
		);
	}

	if (org.owner_id !== auth.sub) {
		return c.json(
			{
				error: "forbidden",
				message: "Not the organization owner",
			},
			403,
		);
	}

	await next();
});
