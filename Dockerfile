# Production image for Render (or any Docker host). SQLite lives on a mounted
# disk: set DATABASE_URL to a file on it, e.g. file:/var/data/app.db.
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
# overwrites edits), then serve on $PORT (Render sets it; defaults to 3000).
# NEXTAUTH_URL falls back to the public URL Render assigns the service.
CMD ["sh", "-c", "if [ -z \"$NEXTAUTH_URL\" ] && [ -n \"$RENDER_EXTERNAL_URL\" ]; then export NEXTAUTH_URL=\"$RENDER_EXTERNAL_URL\"; fi; npx prisma migrate deploy && npx prisma db seed && npx next start"]
