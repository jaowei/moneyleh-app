import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { auth } from "./lib/auth";
import { logger } from "hono/logger";
import { companyRoute } from "./routes/company";
import { HTTPException } from "hono/http-exception";
import { alreadyExistsResponse } from "./errors";

const app = new Hono();
app.use(logger());

// better-auth setup
app.on(["POST", "GET"], "/api/auth/**", (c) => auth.handler(c.req.raw));

// routes
app.route("/api/company", companyRoute);

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

app.onError((err, c) => {
  if (err.name === "SQLiteError") {
    return alreadyExistsResponse;
  } else if (err instanceof HTTPException) {
    return err.getResponse();
  }
  return c.res;
});

export default app;
