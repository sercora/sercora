import { useState } from "react";
import type { FormEvent } from "react";

import sercoraLogo from "../assets/sercora-logo.png";

import "../styles/auth.css";


type LoginPageProps = {
    onLogin: (
        username: string,
        password: string
    ) => Promise<void>;
};


function LoginPage({
    onLogin
}: LoginPageProps) {

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);


    async function submit(
        event: FormEvent<HTMLFormElement>
    ) {

        event.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            await onLogin(
                username,
                password
            );

        } catch (loginError) {
            setError(
                loginError instanceof Error ?
                    loginError.message :
                    "Connexion refusee"
            );

        } finally {
            setIsSubmitting(false);
        }

    }


    return (
        <main className="login-page">
            <form
                className="login-panel"
                onSubmit={submit}
            >
                <img
                    src={sercoraLogo}
                    alt="Sercora"
                    className="login-logo"
                />

                <label className="field-stack">
                    <span>Usager</span>
                    <input
                        value={username}
                        autoComplete="username"
                        onChange={
                            event => setUsername(event.target.value)
                        }
                    />
                </label>

                <label className="field-stack">
                    <span>Mot de passe</span>
                    <input
                        value={password}
                        type="password"
                        autoComplete="current-password"
                        onChange={
                            event => setPassword(event.target.value)
                        }
                    />
                </label>

                {error && (
                    <div className="auth-error">
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    className="primary-auth-button"
                    disabled={
                        isSubmitting ||
                        !username.trim() ||
                        !password
                    }
                >
                    {isSubmitting ? "Connexion..." : "Se connecter"}
                </button>
            </form>
        </main>
    );

}


export default LoginPage;
