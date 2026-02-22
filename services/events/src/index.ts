import app from "./app";

const port = Number(process.env.PORT) || 8082;

const server = Bun.serve({
	port,
	fetch: app.fetch,
});

console.log(`Events service listening on port ${server.port}`);
