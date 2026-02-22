import { OpenAPIHono } from "@hono/zod-openapi";
import { healthRoute } from "./routes/health";
import { jwksRouter } from "./routes/jwks";
import { meRouter } from "./routes/me";
import { oauthRouter } from "./routes/oauth";
import { orgApiKeysRouter } from "./routes/org-api-keys";
import { orgsRouter } from "./routes/orgs";
import { tokenRouter } from "./routes/token";
import type { Env } from "./types";

const app = new OpenAPIHono<Env>();

app.openAPIRegistry.registerComponent("securitySchemes", "Bearer", {
	type: "http",
	scheme: "bearer",
	bearerFormat: "JWT",
});

app.openapi(healthRoute, (c) => {
	return c.json({ status: "ok", service: "auth" }, 200);
});

app.route("/", oauthRouter);
app.route("/", tokenRouter);
app.route("/", meRouter);
app.route("/", jwksRouter);
app.route("/", orgsRouter);
app.route("/", orgApiKeysRouter);

app.doc31("/openapi.json", {
	openapi: "3.1.0",
	info: { title: "Auth Service", version: "0.0.1" },
});

export default app;
