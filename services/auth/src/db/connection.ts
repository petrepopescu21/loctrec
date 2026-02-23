import postgres from "postgres";

const databaseUrl =
	process.env.DATABASE_URL ||
	"postgres://loctrec:loctrec@localhost:5432/loctrec";

export const sql = postgres(databaseUrl);

export async function runMigrations(): Promise<void> {
	await sql`CREATE SCHEMA IF NOT EXISTS auth`;
	await sql`
		CREATE TABLE IF NOT EXISTS auth.schema_migrations (
			version TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ DEFAULT now()
		)
	`;

	const migrationsDir = new URL("migrations", import.meta.url).pathname;
	const glob = new Bun.Glob("*.sql");
	const files = [...glob.scanSync(migrationsDir)].sort();

	for (const file of files) {
		const version = file.replace(".sql", "");
		const [existing] = await sql`
			SELECT version FROM auth.schema_migrations WHERE version = ${version}
		`;
		if (existing) continue;

		const content = await Bun.file(`${migrationsDir}/${file}`).text();
		await sql.unsafe(content);
		await sql`
			INSERT INTO auth.schema_migrations (version) VALUES (${version})
		`;
		console.log(`Applied migration: ${file}`);
	}
}
