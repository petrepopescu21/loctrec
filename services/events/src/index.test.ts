import { describe, expect, test } from "bun:test";
import app from "./app";

describe("events service", () => {
	test("GET /health returns 200 with service name", async () => {
		const res = await app.request("/health");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual({ status: "ok", service: "events" });
	});

	test("GET /unknown returns 404", async () => {
		const res = await app.request("/unknown");
		expect(res.status).toBe(404);
	});
});
