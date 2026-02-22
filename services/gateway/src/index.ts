const port = Number(process.env.PORT) || 8080;

const authServiceUrl = process.env.AUTH_SERVICE_URL || "http://localhost:8081";
const eventsServiceUrl =
	process.env.EVENTS_SERVICE_URL || "http://localhost:8082";
const trackerServiceUrl =
	process.env.TRACKER_SERVICE_URL || "http://localhost:8083";

const server = Bun.serve({
	port,
	async fetch(req) {
		const url = new URL(req.url);

		if (url.pathname === "/health") {
			return Response.json({ status: "ok", service: "gateway" });
		}

		// Route to internal services based on path prefix
		let targetUrl: string | null = null;

		if (url.pathname.startsWith("/api/auth")) {
			targetUrl = `${authServiceUrl}${url.pathname.replace("/api/auth", "")}${url.search}`;
		} else if (url.pathname.startsWith("/api/events")) {
			targetUrl = `${eventsServiceUrl}${url.pathname.replace("/api/events", "")}${url.search}`;
		} else if (url.pathname.startsWith("/api/tracker")) {
			targetUrl = `${trackerServiceUrl}${url.pathname.replace("/api/tracker", "")}${url.search}`;
		}

		if (!targetUrl) {
			return Response.json({ error: "not found" }, { status: 404 });
		}

		const response = await fetch(targetUrl, {
			method: req.method,
			headers: req.headers,
			body: req.body,
		});

		return new Response(response.body, {
			status: response.status,
			headers: response.headers,
		});
	},
});

console.log(`Gateway listening on port ${server.port}`);
