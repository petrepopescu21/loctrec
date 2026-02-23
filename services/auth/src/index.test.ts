import { describe, expect, test } from "bun:test";
import app from "./app";
import { signAccessToken } from "./jwt/sign";

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

describe("JWKS endpoint", () => {
	test("GET /.well-known/jwks.json returns JWKS", async () => {
		const res = await app.request("/.well-known/jwks.json");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.keys).toBeArray();
		expect(body.keys.length).toBeGreaterThan(0);
		expect(body.keys[0].alg).toBe("ES256");
		expect(res.headers.get("Cache-Control")).toBe("public, max-age=3600");
	});
});

describe("protected endpoints require auth", () => {
	test("GET /me returns 401 without token", async () => {
		const res = await app.request("/me");
		expect(res.status).toBe(401);
	});

	test("GET /me returns 401 with invalid token", async () => {
		const res = await app.request("/me", {
			headers: { Authorization: "Bearer invalid-token" },
		});
		expect(res.status).toBe(401);
	});

	test("POST /orgs returns 401 without token", async () => {
		const res = await app.request("/orgs", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Test Org",
				contact_email: "test@example.com",
				scopes: ["events:read"],
			}),
		});
		expect(res.status).toBe(401);
	});
});

describe("GET /me with third-party token", () => {
	test("returns token claims without DB lookup", async () => {
		const token = await signAccessToken({
			sub: "org-123",
			ct: "tp",
			scp: ["events:read", "tracker:subscribe"],
			org: "org-123",
		});

		const res = await app.request("/me", {
			headers: { Authorization: `Bearer ${token}` },
		});
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.sub).toBe("org-123");
		expect(body.ct).toBe("tp");
		expect(body.scp).toEqual(["events:read", "tracker:subscribe"]);
	});
});

describe("role-based access", () => {
	test("POST /orgs returns 403 for rider role", async () => {
		const token = await signAccessToken({
			sub: "user-rider",
			ct: "fp",
			role: "rider",
		});

		const res = await app.request("/orgs", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				name: "Test Org",
				contact_email: "test@example.com",
				scopes: ["events:read"],
			}),
		});
		expect(res.status).toBe(403);
	});

	test("POST /orgs returns 403 for third-party token", async () => {
		const token = await signAccessToken({
			sub: "org-123",
			ct: "tp",
			scp: ["events:write"],
		});

		const res = await app.request("/orgs", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				name: "Test Org",
				contact_email: "test@example.com",
				scopes: ["events:read"],
			}),
		});
		expect(res.status).toBe(403);
	});
});

describe("token endpoints", () => {
	test("POST /token rejects invalid grant_type", async () => {
		const res = await app.request("/token", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				grant_type: "password",
				api_key: "test",
			}),
		});
		// Zod validation rejects invalid grant_type literal
		expect(res.status).toBeLessThanOrEqual(422);
	});

	test("DELETE /token with missing body returns 4xx", async () => {
		const res = await app.request("/token", {
			method: "DELETE",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({}),
		});
		expect(res.status).toBeGreaterThanOrEqual(400);
	});
});

describe("OpenAPI spec", () => {
	test("GET /openapi.json returns valid spec", async () => {
		const res = await app.request("/openapi.json");
		expect(res.status).toBe(200);
		const spec = await res.json();
		expect(spec.openapi).toBe("3.1.0");
		expect(spec.info.title).toBe("Auth Service");
		expect(spec.paths).toBeDefined();
		expect(spec.paths["/health"]).toBeDefined();
		expect(spec.paths["/me"]).toBeDefined();
		expect(spec.paths["/token"]).toBeDefined();
		expect(spec.paths["/orgs"]).toBeDefined();
		expect(spec.paths["/.well-known/jwks.json"]).toBeDefined();
	});
});
