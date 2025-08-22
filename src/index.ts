import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { auth } from "./lib/auth";
import { db } from "./lib/db/db";
import { movies } from "./lib/db/schema";
import { logger } from "hono/logger";

const app = new Hono();
app.use(logger())

// better-auth setup
app.on(["POST", "GET"], "/api/auth/**", (c) => auth.handler(c.req.raw));

// routes
app.get("/api/movies", async (c) => {
  const result = await db.select().from(movies);
  return c.json({
    movies: result,
  });
});

// serve the frontend SPA build
// hack to serve SPA
// https://github.com/honojs/hono/issues/1859
app
  .use(
    "/*",
    serveStatic({
      root: "./src/frontend/dist",
    })
  )
  .use(
    "*",
    serveStatic({
      path: "index.html",
      root: "./src/frontend/dist",
    })
  );

export default app;
