import { createMiddleware } from "hono/factory";
import { verifyAccessToken } from "../jwt/verify";
import type { Env } from "../types";

export const authenticate = createMiddleware<Env>(async (c, next) => {
	const header = c.req.header("Authorization");
	if (!header?.startsWith("Bearer ")) {
		return c.json(
			{
				error: "unauthorized",
				message: "Missing or invalid Authorization header",
			},
			401,
		);
	}

	const token = header.slice(7);
	try {
		const payload = await verifyAccessToken(token);
		c.set("auth", payload);
		await next();
	} catch {
		return c.json(
			{ error: "unauthorized", message: "Invalid or expired token" },
			401,
		);
	}
});
