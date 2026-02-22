export interface LocTrecClientConfig {
	baseUrl: string;
	wsUrl?: string;
}

export class LocTrecClient {
	private config: LocTrecClientConfig;

	constructor(config: LocTrecClientConfig) {
		this.config = config;
	}

	async health(): Promise<{ status: string; service: string }> {
		const res = await fetch(`${this.config.baseUrl}/health`);
		return res.json();
	}
}
