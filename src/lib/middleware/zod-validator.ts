import {HTTPException} from "hono/http-exception";
import * as z from "zod";
import type {ValidationTargets} from "hono";
import {zValidator} from "@hono/zod-validator";

export function zodValidator<T extends z.ZodType, Target extends keyof ValidationTargets>(target: Target, schema: T) {
    return zValidator(target, schema, (result, c) => {
        if (!result.success) {
            throw new HTTPException(400, {
                message: z.prettifyError(result.error)
            });
        }
    })
} 