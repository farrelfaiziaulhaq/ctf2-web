FROM oven/bun:1.2.18

RUN apt-get update && apt-get install -y --no-install-recommends chromium ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json webpack.config.cjs ./
COPY src ./src
COPY views ./views
COPY frontend ./frontend
COPY public ./public
RUN bun install
RUN bun run build

CMD ["bun", "run", "src/server.ts"]
