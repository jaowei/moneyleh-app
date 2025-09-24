import { betterAuth } from "better-auth";
import { Database } from "bun:sqlite";
import {anonymous, magicLink} from "better-auth/plugins";
import { resend } from "./email";

export const auth = betterAuth({
  database: new Database("./moneyleh-auth.db"),
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
});
