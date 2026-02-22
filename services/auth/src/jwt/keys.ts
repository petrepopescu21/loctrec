import {
	exportJWK,
	generateKeyPair,
	importPKCS8,
	importSPKI,
	type JWK,
	type KeyLike,
} from "jose";

let privateKey: KeyLike | null = null;
let publicKey: KeyLike | null = null;

async function initKeys(): Promise<void> {
	if (privateKey && publicKey) return;

	const privPem = process.env.JWT_PRIVATE_KEY;
	const pubPem = process.env.JWT_PUBLIC_KEY;

	if (privPem && pubPem) {
		privateKey = await importPKCS8(privPem.replace(/\\n/g, "\n"), "ES256");
		publicKey = await importSPKI(pubPem.replace(/\\n/g, "\n"), "ES256");
	} else {
		const pair = await generateKeyPair("ES256");
		privateKey = pair.privateKey;
		publicKey = pair.publicKey;
		console.warn(
			"Generated ephemeral JWT key pair (set JWT_PRIVATE_KEY and JWT_PUBLIC_KEY for production)",
		);
	}
}

export async function getPrivateKey(): Promise<KeyLike> {
	await initKeys();
	if (!privateKey) throw new Error("Private key not initialized");
	return privateKey;
}

export async function getPublicKey(): Promise<KeyLike> {
	await initKeys();
	if (!publicKey) throw new Error("Public key not initialized");
	return publicKey;
}

export async function getJWKS(): Promise<{ keys: JWK[] }> {
	const pub = await getPublicKey();
	const jwk = await exportJWK(pub);
	jwk.kid = "loctrec-auth-1";
	jwk.alg = "ES256";
	jwk.use = "sig";
	return { keys: [jwk] };
}
