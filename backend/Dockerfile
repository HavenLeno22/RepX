# RepX API — production image.
#
# Build from the REPOSITORY ROOT, not from backend/:
#
#     docker build -f backend/Dockerfile -t repx-api .
#
# The build context has to be the root because this is an npm workspace: the
# backend imports @repx/shared, which is not on the registry and is resolved
# through the root node_modules. A build context of backend/ cannot see it and
# fails at the first import.

# ---------------------------------------------------------------- builder --
FROM node:20-slim AS builder

# Prisma's query engine is dynamically linked against OpenSSL. Without it the
# engine binary downloads fine and then fails to load at runtime with an error
# that does not mention OpenSSL at all.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Manifests first, so a change to source code does not invalidate the install
# layer. This is most of the build time.
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/

# The frontend is a workspace member, so npm resolves its manifest whether or
# not this image uses it — hence the COPY above. Its dependencies are installed
# and then left behind in the builder stage; nothing from it reaches the runner.
RUN npm ci

COPY tsconfig.base.json ./
COPY shared/ shared/
COPY backend/ backend/

# The datasource provider decides which query engine is compiled into the Prisma
# client, and Prisma forbids reading it from env() for exactly that reason. This
# has to be stamped into schema.prisma BEFORE `prisma generate` — set it here at
# build time, not in the runtime environment, or the image ships a SQLite client
# that cannot talk to PostgreSQL no matter what DATABASE_URL says.
ENV DATABASE_PROVIDER=postgresql

# Never connected to. `prisma generate` validates the whole datasource block
# before it emits anything, and an unset env() in that block fails the build with
# P1012 — the same error a fresh clone hits without backend/.env. The client it
# generates is bound to the *provider* above, never to this URL; the real one
# arrives from the environment at runtime.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"

RUN npm run build -w @repx/shared \
  && npm run db:generate -w @repx/backend \
  && npm run build -w @repx/backend

# ----------------------------------------------------------------- runner --
FROM node:20-slim AS runner

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV DATABASE_PROVIDER=postgresql
ENV PORT=4000

# node_modules is copied wholesale from the builder rather than reinstalled with
# --omit=dev. A fresh production install would drop the `prisma` CLI, which is a
# devDependency, and take the *generated* client in node_modules/.prisma with it
# — leaving an image that starts and then throws "@prisma/client did not
# initialize yet" on the first query.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared/package.json ./shared/package.json
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/shared/dist-esm ./shared/dist-esm
COPY --from=builder /app/backend/package.json ./backend/package.json
COPY --from=builder /app/backend/dist ./backend/dist

# Shipped so `prisma migrate deploy` can run as a release step against this same
# image — see docs/DEPLOYMENT.md. Migrations are deliberately NOT run on container start:
# with more than one replica they would race, and a failed migration would take
# down every instance instead of failing one deploy.
COPY --from=builder /app/backend/prisma ./backend/prisma

# Drop root. The node image ships this user; it owns nothing here, which is the
# point — the application has no business writing to its own code.
USER node

EXPOSE 4000

# The platform should point its readiness probe at /api/ready, which round-trips
# the database. This one only proves the process is answering.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

WORKDIR /app/backend
CMD ["node", "dist/main.js"]
