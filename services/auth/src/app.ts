import { OpenAPIHono } from "@hono/zod-openapi";
import { healthRoute } from "./routes/health";

const app = new OpenAPIHono();

app.openapi(healthRoute, (c) => {
	return c.json({ status: "ok", service: "auth" }, 200);
});

app.doc31("/openapi.json", {
	openapi: "3.1.0",
	info: { title: "Auth Service", version: "0.0.1" },
});

export default app;
