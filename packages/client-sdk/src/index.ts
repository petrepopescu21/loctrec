import createClient from "openapi-fetch";
import type { paths as AuthPaths } from "./generated/auth";
import type { paths as EventsPaths } from "./generated/events";

export type { AuthPaths, EventsPaths };

export interface LocTrecClientConfig {
	authUrl: string;
	eventsUrl: string;
	wsUrl?: string;
}

export class LocTrecClient {
	public readonly auth: ReturnType<typeof createClient<AuthPaths>>;
	public readonly events: ReturnType<typeof createClient<EventsPaths>>;

	constructor(config: LocTrecClientConfig) {
		this.auth = createClient<AuthPaths>({ baseUrl: config.authUrl });
		this.events = createClient<EventsPaths>({ baseUrl: config.eventsUrl });
	}
}
