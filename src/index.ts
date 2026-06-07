import os from "node:os";
import process from "node:process";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { alreadyExistsResponse } from "./errors";
import { auth } from "./lib/auth";
import DocTrainerWorkerPool from "./lib/descriptionTagger/classifier-trainer-worker-pool.ts";
import { appLogger } from "./lib/logger.ts";
import { accountRoute } from "./routes/account.ts";
import { cardRoute } from "./routes/card.ts";
import { companyRoute } from "./routes/company";
import { tagRoute } from "./routes/tag.ts";
import { transactionRoute } from "./routes/transaction.ts";
import { uiRoute } from "./routes/ui.ts";

export const docTrainerPool = new DocTrainerWorkerPool(
	Math.max(1, os.cpus().length - 2),
);

const app = new Hono();

app.use(logger(appLogger));

// better-auth setup
app.on(["POST", "GET"], "/api/auth/**", (c) => auth.handler(c.req.raw));

// routes
const routes = app
	.route("/api/company", companyRoute)
	.route("/api/transaction", transactionRoute)
	.route("/api/tag", tagRoute)
	.route("/api/account", accountRoute)
	.route("/api/card", cardRoute);

// all ui focused endpoints
app.route("/api/ui", uiRoute);

// serve the frontend SPA build
// hack to serve SPA
// https://github.com/honojs/hono/issues/1859
app
	.use(
		"/*",
		serveStatic({
			root: "./src/frontend/dist",
		}),
	)
	.use(
		"*",
		serveStatic({
			path: "index.html",
			root: "./src/frontend/dist",
		}),
	);

app.onError((err) => {
	const errMsg = `${err} | ${JSON.stringify(err)}`;
	appLogger(`At global exception handler, message is: ${errMsg}`);
	if (err.message.includes("UNIQUE constraint failed")) {
		return alreadyExistsResponse;
	} else if (err instanceof HTTPException) {
		return err.getResponse();
	}
	return new Response("Error", {
		status: 500,
		statusText: errMsg,
	});
});

process.on("exit", () => {
	appLogger("Shutting down");
	docTrainerPool.close();
});

export default {
	port: 9000,
	...app,
};
export type AppType = typeof routes;
