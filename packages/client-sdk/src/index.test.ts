import { describe, expect, test } from "bun:test";
import { LocTrecClient } from "./index";

describe("LocTrecClient", () => {
	test("constructor creates typed clients", () => {
		const client = new LocTrecClient({
			authUrl: "http://localhost:8081",
			eventsUrl: "http://localhost:8082",
		});
		expect(client).toBeDefined();
		expect(client.auth).toBeDefined();
		expect(client.events).toBeDefined();
	});

	test("constructor accepts optional wsUrl", () => {
		const client = new LocTrecClient({
			authUrl: "http://localhost:8081",
			eventsUrl: "http://localhost:8082",
			wsUrl: "ws://localhost:8083",
		});
		expect(client).toBeDefined();
	});
});
