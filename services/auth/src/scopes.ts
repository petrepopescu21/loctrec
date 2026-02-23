export const AVAILABLE_SCOPES = [
	"events:read",
	"events:write",
	"registrations:read",
	"registrations:write",
	"tracker:subscribe",
	"tracker:read",
] as const;

export type Scope = (typeof AVAILABLE_SCOPES)[number];

export function validateScopes(
	requested: string[],
	allowed: string[],
): boolean {
	return requested.every(
		(s) =>
			allowed.includes(s) &&
			(AVAILABLE_SCOPES as readonly string[]).includes(s),
	);
}
