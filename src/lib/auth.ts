import { betterAuth } from "better-auth";
import { Database } from "bun:sqlite";
import { magicLink } from "better-auth/plugins";
import { resend } from "./email";

export const auth = betterAuth({
  database: new Database("./moneyleh-auth.db"),
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        resend.emails.send({
          from: "onboarding@resend.dev",
          to: email,
          subject: "Sign in to moneyleh",
          html: `<p>Sign in to moneyleh: ${url}</p>`,
        });
      },
    }),
  ],
});
