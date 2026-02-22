import { afterAll, describe, expect, test } from "bun:test";

const port = 18081;
process.env.PORT = String(port);

const server = Bun.serve({
	port,
	async fetch(req) {
		const url = new URL(req.url);

		if (url.pathname === "/health") {
			return Response.json({ status: "ok", service: "auth" });
		}

		return Response.json({ error: "not found" }, { status: 404 });
	},
});

afterAll(() => {
	server.stop();
});

describe("auth service", () => {
	test("GET /health returns 200 with service name", async () => {
		const res = await fetch(`http://localhost:${port}/health`);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual({ status: "ok", service: "auth" });
	});

	test("GET /unknown returns 404", async () => {
		const res = await fetch(`http://localhost:${port}/unknown`);
		expect(res.status).toBe(404);
		const body = await res.json();
		expect(body).toEqual({ error: "not found" });
	});
});
