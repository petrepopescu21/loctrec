import { stringify } from "yaml";
import app from "../src/app";

const doc = app.getOpenAPI31Document({
	openapi: "3.1.0",
	info: { title: "Auth Service", version: "0.0.1" },
});

const yaml = stringify(doc);
await Bun.write("openapi.yaml", yaml);
console.log("Generated services/auth/openapi.yaml");
