# PAWS Testing API container (University runtime, Testing environment only).
# Same server source as Production; environment, SQL target, identity project and write gates
# come exclusively from the Testing deployment's configuration (GitHub Environment "testing").
FROM node:22-bookworm-slim
WORKDIR /app
COPY server/package.json server/package-lock.json ./server/
# msnodesqlv8 (Windows-only driver) is not built; the container uses tedious + managed identity.
RUN cd server && npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY server/src ./server/src
ENV NODE_ENV=production \
    PAWS_API_HOST=0.0.0.0 \
    PAWS_API_PORT=8080
# PAWS_ENVIRONMENT is intentionally NOT set here: the deployment must declare it explicitly,
# and the runtime refuses to start without it.
USER node
EXPOSE 8080
CMD ["node", "server/src/runtime/university-api.js"]
