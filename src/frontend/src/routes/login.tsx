import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { ERROR_MESSAGES } from "../lib/error";

export const Route = createFileRoute("/login")({
  validateSearch: (search) => ({
    redirect: (search.redirect as string) || "/",
  }),
  beforeLoad: ({ context, search }) => {
    // Redirect if already authenticated
    if (context.auth.isAuthenticated) {
      throw redirect({ to: search.redirect });
    }
  },
  component: LoginComponent,
});

const SIGNUP_EMAIL = "signup-email";

function LoginComponent() {
  const { auth } = Route.useRouteContext();
  const [error, setError] = useState("");
  const [formSuccess, setFormSuccess] = useState<string>("");

  const handleSubmit = async (formData: FormData) => {
    setError("");

    const signupEmail = formData.get(SIGNUP_EMAIL)?.toString();
    if (signupEmail) {
      try {
        await auth.login(signupEmail);
        setFormSuccess(`Successfully signed up user, please check your email`);
      } catch (e) {
        console.error(e);
        setError(ERROR_MESSAGES.GENERIC);
      }
    } else {
      // the email should never be undefined
      // as we set required in the input below
      setError(ERROR_MESSAGES.GENERIC);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form
        action={handleSubmit}
        className="max-w-md w-full space-y-4 p-6 border rounded-lg"
      >
        <fieldset className="fieldset bg-base-200 border-base-300 rounded-box w-xs border p-4">
          <legend className="fieldset-legend">Register via magic link</legend>

          <label className="label">Email</label>
          <input
            type="email"
            className="input"
            placeholder="Email"
            name="signup-email"
            required
          />
          <button type="submit" className="btn btn-neutral mt-4">
            Get link!
          </button>
          {error && (
            <p className="label text-error">Error registering user: {error}</p>
          )}
          {formSuccess && <p className="label text-success"> {formSuccess}</p>}
        </fieldset>
      </form>
    </div>
  );
}
