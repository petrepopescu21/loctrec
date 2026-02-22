import app from "./app";
import { runMigrations } from "./db/connection";

const port = Number(process.env.PORT) || 8081;

await runMigrations().catch((err) => {
	console.error("Migration failed:", err);
	process.exit(1);
});

const server = Bun.serve({
	port,
	fetch: app.fetch,
});

console.log(`Auth service listening on port ${server.port}`);
