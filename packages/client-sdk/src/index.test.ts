import { describe, expect, test } from "bun:test";
import { LocTrecClient } from "./index";

describe("LocTrecClient", () => {
	test("constructor stores config", () => {
		const client = new LocTrecClient({ baseUrl: "http://localhost:8080" });
		expect(client).toBeDefined();
	});

	test("constructor accepts optional wsUrl", () => {
		const client = new LocTrecClient({
			baseUrl: "http://localhost:8080",
			wsUrl: "ws://localhost:8083",
		});
		expect(client).toBeDefined();
	});
});
