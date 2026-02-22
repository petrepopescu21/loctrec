import app from "./app";

const port = Number(process.env.PORT) || 8081;

const server = Bun.serve({
	port,
	fetch: app.fetch,
});

console.log(`Auth service listening on port ${server.port}`);
