FROM oven/bun:1 AS base
WORKDIR /usr/src/app

# install dependencies into temp directory
# this will cache them and speed up future builds
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

# install with --production (exclude devDependencies)
RUN mkdir -p /temp/prod
COPY package.json bun.lock /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

FROM base AS frontend-install
COPY --from=install /temp/dev/node_modules node_modules
COPY . . 
RUN cd src/frontend && bun install --frozen-lockfile && bun run build

# copy node_modules from temp directory
# copy the frontend build
# then copy all (non-ignored) project files into the image
FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY --from=frontend-install /usr/src/app/src/frontend/dist /usr/src/app/src/frontend/dist
COPY . .

# copy production dependencies and source code into final image
FROM base AS release
ENV DATABASE_NAME /data/moneyleh-app.db
ENV NODE_ENV production
ENV BETTER_AUTH_URL http://localhost:9000
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=prerelease /usr/src/app/src ./src
COPY --from=prerelease /usr/src/app/drizzle ./drizzle
COPY --from=prerelease /usr/src/app/package.json .

# run the app
EXPOSE 9000/tcp
ENTRYPOINT [ "bun", "run", "docker:start" ]