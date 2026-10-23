# Production image for Railway (or any Docker host). SQLite lives on a mounted
# volume: set DATABASE_URL to a file on it, e.g. file:/data/app.db.
FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dev dependencies stay installed: the seed runs through tsx on every start.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
EXPOSE 3000

# Apply pending migrations and add any new starter drills (the seed never
# overwrites edits), then serve on $PORT (Railway sets it; defaults to 3000).
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && npx next start"]
