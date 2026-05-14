import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import * as authSchema from "../db/auth-schema.ts";
import { db } from "../db/db.ts";
import { resend } from "./email";

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "sqlite",
		schema: authSchema,
	}),
	emailAndPassword: {
		enabled: true,
	},
	plugins: [
		magicLink({
			sendMagicLink: async ({ email, url }) => {
				await resend.emails.send({
					from: "onboarding@resend.dev",
					to: email,
					subject: "Sign in to moneyleh",
					html: `<p>Sign in to moneyleh: ${url}</p>`,
				});
			},
		}),
	],
	session: {
		expiresIn: 60 * 60 * 24 * 60, // 60 days
		cookieCache: {
			enabled: true,
			maxAge: 60 * 60 * 24,
		},
	},
	account: {
		modelName: "auth_account",
	},
});
