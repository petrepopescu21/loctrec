import { describe, expect, test } from "bun:test";
import app from "./app";

describe("auth service", () => {
	test("GET /health returns 200 with service name", async () => {
		const res = await app.request("/health");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual({ status: "ok", service: "auth" });
	});

	test("GET /unknown returns 404", async () => {
		const res = await app.request("/unknown");
		expect(res.status).toBe(404);
	});
});
