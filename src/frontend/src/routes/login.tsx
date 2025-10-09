import {createFileRoute, redirect} from "@tanstack/react-router";
import {useState} from "react";
import {ERROR_MESSAGES} from "../lib/error";
import {authClient} from "../lib/auth-client.ts";

export const Route = createFileRoute("/login")({
    validateSearch: (search) => ({
        redirect: (search.redirect as string) || "/",
    }),
    beforeLoad: ({context, search}) => {
        // Redirect if already authenticated
        if (context.auth.isAuthenticated) {
            throw redirect({to: search.redirect});
        }
    },
    component: LoginComponent,
});

const emailInputName = "email";
const passwordInputName = "password"
const usernameInputName = "username"

function LoginComponent() {
    const {auth} = Route.useRouteContext();
    const [error, setError] = useState("");
    const [formSuccess, setFormSuccess] = useState<string>("");
    const [isSignUp, setIsSignUp] = useState<boolean>(false)

    const handleSubmit = async (formData: FormData) => {
        setError("");

        const email = formData.get(emailInputName)?.toString()
        const password = formData.get(passwordInputName)?.toString()
        const username = formData.get(usernameInputName)?.toString()
        if (email && password) {
            try {
                if (isSignUp && username) {
                    // TODO: Handle error response
                    await authClient.signUp.email({
                        name: username,
                        email,
                        password
                    })
                } else {
                    await auth.login(email, password);
                }
                setFormSuccess(`Successfully signed up user, please check your email`);
            } catch (e) {
                console.error(e);
                setError(ERROR_MESSAGES.GENERIC);
            }
        }
    };

    const handleInputClick = () => {
        setIsSignUp((prev) => !prev)
    }

    const formType = isSignUp ? 'Sign Up' : 'Login'

    return (
        <div className="min-h-screen flex items-center justify-center">
            <form
                action={handleSubmit}
                className="max-w-md w-full space-y-4 p-6 border rounded-lg"
            >
                <div className="tabs tabs-box">
                    <input type="radio" name="login" className="tab" aria-label="Sign Up" onClick={handleInputClick}/>
                    <input type="radio" name="login" className="tab" aria-label="Login" defaultChecked
                           onClick={handleInputClick}/>
                </div>
                <fieldset className="fieldset bg-base-200 border-base-300 rounded-box w-xs border p-4">
                    <legend className="fieldset-legend">{formType}</legend>

                    <label className="label">Email</label>
                    <input
                        type="text"
                        className="input"
                        placeholder="Enter an email"
                        name={emailInputName}
                        required
                    />
                    <label className="label">Password:</label>
                    <input
                        type="password"
                        className="input"
                        placeholder="Enter a password"
                        name={passwordInputName}
                        required
                    />
                    {isSignUp && (
                        <>
                            <label className="label">Username:</label>
                            <input
                                type="text"
                                className="input"
                                placeholder="Enter a username"
                                name={usernameInputName}
                                required
                            />
                        </>
                    )}
                    <button type="submit" className="btn btn-neutral mt-4">
                        {formType}
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
