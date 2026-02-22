const port = Number(process.env.PORT) || 8082;

const server = Bun.serve({
	port,
	async fetch(req) {
		const url = new URL(req.url);

		if (url.pathname === "/health") {
			return Response.json({ status: "ok", service: "events" });
		}

		return Response.json({ error: "not found" }, { status: 404 });
	},
});

console.log(`Events service listening on port ${server.port}`);
