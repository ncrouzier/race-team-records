# syntax=docker/dockerfile:1

# ---- build ------------------------------------------------------------------
FROM node:22-bookworm-slim AS build
WORKDIR /app

# bower resolves several of its packages over git, so git has to be present
# before `bower install` runs.
RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./

# devDependencies are needed here, not just in development: the CSS build
# shells out to lessc and clean-css, and the JS build runs terser. A
# production-only install would leave `npm run build` unable to run.
RUN npm ci

COPY .bowerrc bower.json ./

# public/libs is gitignored and exists only after bower populates it, yet the
# LESS build reads the Bootstrap 3 sources out of it and copy:assets pulls the
# FontAwesome and Glyphicons webfonts from it. So this must come before the
# build, and it is why the app needs a Dockerfile rather than plain Nixpacks.
RUN npx bower install --allow-root --config.interactive=false

COPY . .

RUN npm run build

# The runtime needs neither the build tooling nor the image/ML tooling. sharp
# and the TensorFlow packages are devDependencies and are by far the largest
# things in node_modules; dropping them here keeps the final image small.
RUN npm prune --omit=dev


# ---- runtime ----------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8090

# curl is only here to give HEALTHCHECK something to call.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copied in ascending order of how often each part changes, so a routine code
# change only invalidates the last few small layers. A single `COPY /app /app`
# would put all ~840MB into one layer and force a full re-pull on every deploy.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/public/libs ./public/libs
COPY --from=build /app/public/images ./public/images
COPY --from=build /app/public/data ./public/data
COPY --from=build /app/public/dist ./public/dist
COPY --from=build /app/public/css ./public/css
COPY --from=build /app/public/less ./public/less
COPY --from=build /app/public/js ./public/js
COPY --from=build /app/public/views ./public/views
COPY --from=build /app/views ./views
COPY --from=build /app/config ./config
COPY --from=build /app/app ./app
COPY --from=build /app/package.json /app/server.js ./

USER node

EXPOSE 8090

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8090/api/health || exit 1

CMD ["node", "server.js"]
