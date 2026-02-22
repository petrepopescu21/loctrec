const port = Number(process.env.PORT) || 8081;

const server = Bun.serve({
	port,
	async fetch(req) {
		const url = new URL(req.url);

		if (url.pathname === "/health") {
			return Response.json({ status: "ok", service: "auth" });
		}

		return Response.json({ error: "not found" }, { status: 404 });
	},
});

console.log(`Auth service listening on port ${server.port}`);
