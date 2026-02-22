FROM oven/bun:1 AS builder

WORKDIR /app
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun build src/index.ts --outdir dist --target bun

FROM oven/bun:1-slim

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

EXPOSE 8081
CMD ["bun", "run", "dist/index.js"]
