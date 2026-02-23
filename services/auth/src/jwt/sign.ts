import { SignJWT } from "jose";
import type { AuthPayload } from "../types";
import { getPrivateKey } from "./keys";

const ACCESS_TOKEN_EXPIRY = "15m";

export async function signAccessToken(payload: AuthPayload): Promise<string> {
	const key = await getPrivateKey();
	return new SignJWT({
		ct: payload.ct,
		...(payload.role && { role: payload.role }),
		...(payload.scp && { scp: payload.scp }),
		...(payload.org && { org: payload.org }),
	})
		.setProtectedHeader({ alg: "ES256", kid: "loctrec-auth-1" })
		.setSubject(payload.sub)
		.setIssuedAt()
		.setExpirationTime(ACCESS_TOKEN_EXPIRY)
		.setIssuer("loctrec-auth")
		.sign(key);
}
