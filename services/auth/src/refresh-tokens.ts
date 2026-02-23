import { sql } from "./db/connection";

function sha256(data: string): string {
	return new Bun.CryptoHasher("sha256").update(data).digest("hex");
}

export async function createRefreshToken(userId: string): Promise<string> {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	const raw = Buffer.from(bytes).toString("hex");
	const hash = sha256(raw);

	const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
	await sql`
		INSERT INTO auth.refresh_tokens (user_id, token_hash, expires_at)
		VALUES (${userId}, ${hash}, ${thirtyDays})
	`;

	return raw;
}

export async function validateRefreshToken(
	token: string,
): Promise<{ id: string; userId: string }> {
	const hash = sha256(token);
	const [row] = await sql`
		SELECT id, user_id FROM auth.refresh_tokens
		WHERE token_hash = ${hash}
		AND expires_at > now()
		AND revoked_at IS NULL
	`;

	if (!row) throw new Error("Invalid refresh token");
	return { id: row.id, userId: row.user_id };
}

export async function revokeRefreshToken(token: string): Promise<void> {
	const hash = sha256(token);
	await sql`
		UPDATE auth.refresh_tokens SET revoked_at = now()
		WHERE token_hash = ${hash} AND revoked_at IS NULL
	`;
}
