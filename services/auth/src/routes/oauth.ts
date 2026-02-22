import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { Google, generateCodeVerifier, generateState } from "arctic";
import { getCookie, setCookie } from "hono/cookie";
import { sql } from "../db/connection";
import { signAccessToken } from "../jwt/sign";
import { createRefreshToken } from "../refresh-tokens";
import { ErrorSchema } from "../types";

const clientId = process.env.GOOGLE_CLIENT_ID || "";
const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
const redirectUri =
	process.env.GOOGLE_REDIRECT_URI ||
	"http://localhost:8081/oauth/google/callback";

const google = new Google(clientId, clientSecret, redirectUri);

const googleRedirectRoute = createRoute({
	method: "get",
	path: "/oauth/google",
	responses: {
		302: {
			description: "Redirect to Google",
		},
	},
});

const OAuthUserSchema = z.object({
	id: z.string(),
	email: z.string(),
	name: z.string(),
	role: z.string(),
});

const OAuthTokenResponseSchema = z.object({
	access_token: z.string(),
	refresh_token: z.string(),
	token_type: z.literal("Bearer"),
	expires_in: z.number(),
	user: OAuthUserSchema,
});

const googleCallbackRoute = createRoute({
	method: "get",
	path: "/oauth/google/callback",
	request: {
		query: z.object({
			code: z.string(),
			state: z.string(),
		}),
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: OAuthTokenResponseSchema,
				},
			},
			description: "OAuth tokens and user info",
		},
		400: {
			content: {
				"application/json": {
					schema: ErrorSchema,
				},
			},
			description: "OAuth error",
		},
	},
});

export const oauthRouter = new OpenAPIHono();

oauthRouter.openapi(googleRedirectRoute, (c) => {
	const state = generateState();
	const codeVerifier = generateCodeVerifier();
	const scopes = ["openid", "email", "profile"];
	const url = google.createAuthorizationURL(state, codeVerifier, scopes);

	setCookie(c, "oauth_state", state, {
		httpOnly: true,
		maxAge: 600,
		path: "/",
	});
	setCookie(c, "oauth_code_verifier", codeVerifier, {
		httpOnly: true,
		maxAge: 600,
		path: "/",
	});

	return c.redirect(url.toString());
});

oauthRouter.openapi(googleCallbackRoute, async (c) => {
	try {
		const { code, state } = c.req.valid("query");
		const storedState = getCookie(c, "oauth_state");
		const codeVerifier = getCookie(c, "oauth_code_verifier");

		if (!storedState || !codeVerifier || state !== storedState) {
			return c.json(
				{ error: "invalid_state", message: "OAuth state mismatch" },
				400,
			);
		}

		const tokens = await google.validateAuthorizationCode(code, codeVerifier);
		const accessToken = tokens.accessToken();

		const userInfoResponse = await fetch(
			"https://openidconnect.googleapis.com/v1/userinfo",
			{ headers: { Authorization: `Bearer ${accessToken}` } },
		);
		const googleUser = (await userInfoResponse.json()) as {
			sub: string;
			email: string;
			name: string;
		};

		const [user] = await sql`
			INSERT INTO auth.users (oauth_provider, oauth_provider_id, email, name, role)
			VALUES ('google', ${googleUser.sub}, ${googleUser.email}, ${googleUser.name}, 'rider')
			ON CONFLICT (oauth_provider, oauth_provider_id)
			DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, updated_at = now()
			RETURNING *
		`;

		const accessTokenJwt = await signAccessToken({
			sub: user.id,
			ct: "fp",
			role: user.role,
		});
		const refreshToken = await createRefreshToken(user.id);

		setCookie(c, "oauth_state", "", { maxAge: 0, path: "/" });
		setCookie(c, "oauth_code_verifier", "", { maxAge: 0, path: "/" });

		return c.json(
			{
				access_token: accessTokenJwt,
				refresh_token: refreshToken,
				token_type: "Bearer" as const,
				expires_in: 900,
				user: {
					id: user.id,
					email: user.email,
					name: user.name,
					role: user.role,
				},
			},
			200,
		);
	} catch (err) {
		const message =
			err instanceof Error ? err.message : "OAuth callback failed";
		return c.json({ error: "oauth_error", message }, 400);
	}
});
