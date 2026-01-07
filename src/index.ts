import {Hono} from "hono";
import {serveStatic} from "hono/bun";
import {auth} from "./lib/auth";
import {logger} from "hono/logger";
import {companyRoute} from "./routes/company";
import {HTTPException} from "hono/http-exception";
import {alreadyExistsResponse} from "./errors";
import {uiRoute} from "./routes/ui.ts";
import {transactionRoute} from "./routes/transaction.ts";
import {tagRoute} from "./routes/tag.ts";
import dayjs from "dayjs";

const app = new Hono();

export const appLogger = (message: string, ...rest: string[]) => {
    console.log(`[${dayjs().toISOString()}] ${message}`, ...rest)
}

app.use(logger(appLogger));

// better-auth setup
app.on(["POST", "GET"], "/api/auth/**", (c) => auth.handler(c.req.raw));

// routes
const routes = app.route("/api/company", companyRoute).route("/api/transaction", transactionRoute).route("/api/tag", tagRoute)

// all ui focused endpoints
app.route("/api/ui", uiRoute)

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

app.onError((err) => {
    appLogger(`${err} | ${JSON.stringify(err)}`)
    if (err.message.includes("UNIQUE constraint failed")) {
        return alreadyExistsResponse;
    } else if (err instanceof HTTPException) {
        return err.getResponse();
    }
    return new Response('Error', {
        status: 500
    });
});

export default {
    port: 9000,
    ...app
};
export type AppType = typeof routes
