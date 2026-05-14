import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import { HTTPException } from "hono/http-exception";
import * as z from "zod";

export function zodValidator<
	T extends z.ZodType,
	Target extends keyof ValidationTargets,
>(target: Target, schema: T) {
	return zValidator(target, schema, (result) => {
		if (!result.success) {
			throw new HTTPException(400, {
				message: z.prettifyError(result.error),
			});
		}
	});
}
