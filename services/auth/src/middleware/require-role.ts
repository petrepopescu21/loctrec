import { createMiddleware } from "hono/factory";
import type { Env } from "../types";

export function requireRole(...roles: string[]) {
	return createMiddleware<Env>(async (c, next) => {
		const auth = c.get("auth");
		if (auth.ct !== "fp" || !auth.role || !roles.includes(auth.role)) {
			return c.json({ error: "forbidden", message: "Insufficient role" }, 403);
		}
		await next();
	});
}
