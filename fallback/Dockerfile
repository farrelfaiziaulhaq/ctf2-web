FROM oven/bun:1.3.11

RUN apt-get update && \
    apt-get install -y chromium ca-certificates curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

RUN mkdir -p /app/data && \
    printf 'PLAYIT{fake}\n' > /flag.txt

ENV PORT=3000
ENV APP_ORIGIN=http://127.0.0.1:3000
ENV CHROMIUM_PATH=/usr/bin/chromium
ENV FLAG_PATH=/flag.txt

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=3s --retries=5 CMD curl -fsS http://127.0.0.1:3000/healthz || exit 1

CMD ["bun", "run", "src/server.ts"]
