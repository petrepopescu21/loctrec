import { z } from "@hono/zod-openapi";

export interface AuthPayload {
	sub: string;
	ct: "fp" | "tp";
	role?: string;
	scp?: string[];
	org?: string;
}

export type Env = {
	Variables: {
		auth: AuthPayload;
	};
};

export const ErrorSchema = z.object({
	error: z.string(),
	message: z.string(),
});
