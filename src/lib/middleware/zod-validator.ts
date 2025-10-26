import {createMiddleware} from "hono/factory";
import {HTTPException} from "hono/http-exception";
import {validator} from "hono/validator";
import * as z from "zod";
import type {ValidationTargets} from "hono";

export function zodValidator<T extends z.ZodType>(schema: T, validationTarget: keyof ValidationTargets = "json") {
    return validator(validationTarget, (value) => {
        const parsed = schema.safeParse(value);
        if (!parsed.success) {
            throw new HTTPException(400, {
                message: z.prettifyError(parsed.error)
            });
        }
        return parsed.data;
    })
} 