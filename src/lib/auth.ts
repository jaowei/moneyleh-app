import {betterAuth} from "better-auth";
import {magicLink} from "better-auth/plugins";
import {resend} from "./email";
import {drizzleAdapter} from "better-auth/adapters/drizzle";
import {db} from "../db/db.ts";
import * as authSchema from '../db/auth-schema.ts'

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: 'sqlite',
        schema: authSchema
    }),
    emailAndPassword: {
        enabled: true,
    },
    plugins: [
        magicLink({
            sendMagicLink: async ({email, url}) => {
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
        cookieCache: {
            enabled: true,
            maxAge: 60 * 60 * 24
        }
    },
    account: {
        modelName: 'auth_account'
    }
});
