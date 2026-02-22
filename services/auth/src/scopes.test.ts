import { describe, expect, test } from "bun:test";
import { AVAILABLE_SCOPES, validateScopes } from "./scopes";

describe("scopes", () => {
	test("AVAILABLE_SCOPES contains all expected scopes", () => {
		expect(AVAILABLE_SCOPES).toContain("events:read");
		expect(AVAILABLE_SCOPES).toContain("events:write");
		expect(AVAILABLE_SCOPES).toContain("registrations:read");
		expect(AVAILABLE_SCOPES).toContain("registrations:write");
		expect(AVAILABLE_SCOPES).toContain("tracker:subscribe");
		expect(AVAILABLE_SCOPES).toContain("tracker:read");
		expect(AVAILABLE_SCOPES).toHaveLength(6);
	});

	test("validateScopes returns true for valid subset", () => {
		expect(
			validateScopes(["events:read"], ["events:read", "events:write"]),
		).toBe(true);
	});

	test("validateScopes returns true for empty requested", () => {
		expect(validateScopes([], ["events:read"])).toBe(true);
	});

	test("validateScopes returns false for scope not in allowed", () => {
		expect(validateScopes(["events:write"], ["events:read"])).toBe(false);
	});

	test("validateScopes returns false for invalid scope", () => {
		expect(validateScopes(["invalid:scope"], ["invalid:scope"])).toBe(false);
	});

	test("validateScopes returns true for exact match", () => {
		const all = [...AVAILABLE_SCOPES];
		expect(validateScopes(all, all)).toBe(true);
	});
});
