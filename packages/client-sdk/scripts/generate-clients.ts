import { execSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../..");
const bun = process.execPath;
const outDir = resolve(import.meta.dirname, "../src/generated");

const services = [
	{ name: "auth", specPath: resolve(root, "services/auth/openapi.yaml") },
	{
		name: "events",
		specPath: resolve(root, "services/events/openapi.yaml"),
	},
];

for (const { name, specPath } of services) {
	const outFile = resolve(outDir, `${name}.ts`);
	execSync(`${bun} x openapi-typescript ${specPath} -o ${outFile}`, {
		stdio: "inherit",
	});
	console.log(`Generated ${name} client types → src/generated/${name}.ts`);
}
