import { jwtVerify } from "jose";
import type { AuthPayload } from "../types";
import { getPublicKey } from "./keys";

export async function verifyAccessToken(token: string): Promise<AuthPayload> {
	const key = await getPublicKey();
	const { payload } = await jwtVerify(token, key, {
		issuer: "loctrec-auth",
		algorithms: ["ES256"],
	});

	return {
		sub: payload.sub ?? "",
		ct: payload.ct as "fp" | "tp",
		role: payload.role as string | undefined,
		scp: payload.scp as string[] | undefined,
		org: payload.org as string | undefined,
	};
}
