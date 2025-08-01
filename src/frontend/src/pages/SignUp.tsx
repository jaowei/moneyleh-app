import { useState } from "react";
import { authClient } from "../lib/auth-client";

const SIGNUP_EMAIL = "signup-email";

export const SignUp = () => {
  const [formError, setFormError] = useState<string>("");
  const [formSuccess, setFormSuccess] = useState<string>("");

  const handleSubmit = async (formData: FormData) => {
    setFormError("");
    const signupEmail = formData.get(SIGNUP_EMAIL)?.toString();
    if (signupEmail) {
      //   const {error, data} = await authClient.signUp.email({
      //     email: signupEmail,
      //     name: signupEmail,
      //     password: signupPassword,
      //   });
      const { error } = await authClient.signIn.magicLink({
        email: signupEmail,
        name: signupEmail,
      });
      if (error) {
        setFormError(`${error.message}`);
      } else {
        setFormSuccess(`Successfully signed up user, please check your email`);
      }
    } else {
      // the email should never be undefined
      // as we set required in the input below
      setFormError("Something goofed! Please contact developer");
    }
  };

  return (
    <div className="flex h-screen items-center justify-center">
      <form action={handleSubmit}>
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
          {formError && (
            <p className="label text-error">Error registering user: {formError}</p>
          )}
          {formSuccess && <p className="label text-success"> {formSuccess}</p>}
        </fieldset>
      </form>
    </div>
  );
};
