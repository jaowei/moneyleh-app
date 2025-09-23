import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { validator } from "hono/validator";
import * as z from "zod";

export function zodValidator<T extends z.ZodType>(schema: T) {
    return validator("json", (value) => {
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      throw new HTTPException(400, {
        message: z.prettifyError(parsed.error)
      });
    }
    return parsed.data;
  })
} 