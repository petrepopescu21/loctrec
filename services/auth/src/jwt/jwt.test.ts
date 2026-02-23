import { describe, expect, test } from "bun:test";
import { getJWKS, getPublicKey } from "./keys";
import { signAccessToken } from "./sign";
import { verifyAccessToken } from "./verify";

describe("JWT sign and verify", () => {
	test("round-trip: sign then verify first-party token", async () => {
		const payload = { sub: "user-123", ct: "fp" as const, role: "rider" };
		const token = await signAccessToken(payload);
		expect(typeof token).toBe("string");

		const decoded = await verifyAccessToken(token);
		expect(decoded.sub).toBe("user-123");
		expect(decoded.ct).toBe("fp");
		expect(decoded.role).toBe("rider");
		expect(decoded.scp).toBeUndefined();
		expect(decoded.org).toBeUndefined();
	});

	test("round-trip: sign then verify third-party token", async () => {
		const payload = {
			sub: "org-456",
			ct: "tp" as const,
			scp: ["events:read", "tracker:subscribe"],
		};
		const token = await signAccessToken(payload);
		const decoded = await verifyAccessToken(token);

		expect(decoded.sub).toBe("org-456");
		expect(decoded.ct).toBe("tp");
		expect(decoded.scp).toEqual(["events:read", "tracker:subscribe"]);
		expect(decoded.role).toBeUndefined();
	});

	test("round-trip: third-party with on_behalf_of", async () => {
		const payload = {
			sub: "external-user-789",
			ct: "tp" as const,
			scp: ["events:read"],
			org: "org-456",
		};
		const token = await signAccessToken(payload);
		const decoded = await verifyAccessToken(token);

		expect(decoded.sub).toBe("external-user-789");
		expect(decoded.org).toBe("org-456");
		expect(decoded.ct).toBe("tp");
	});

	test("verify rejects tampered token", async () => {
		const token = await signAccessToken({
			sub: "user-1",
			ct: "fp",
			role: "rider",
		});
		const tampered = `${token}x`;
		expect(verifyAccessToken(tampered)).rejects.toThrow();
	});

	test("verify rejects garbage input", async () => {
		expect(verifyAccessToken("not-a-jwt")).rejects.toThrow();
	});
});

describe("JWKS", () => {
	test("getPublicKey returns a key", async () => {
		const key = await getPublicKey();
		expect(key).toBeDefined();
	});

	test("getJWKS returns a valid JWKS structure", async () => {
		const jwks = await getJWKS();
		expect(jwks.keys).toBeArray();
		expect(jwks.keys).toHaveLength(1);
		expect(jwks.keys[0].kid).toBe("loctrec-auth-1");
		expect(jwks.keys[0].alg).toBe("ES256");
		expect(jwks.keys[0].use).toBe("sig");
		expect(jwks.keys[0].kty).toBe("EC");
	});
});
