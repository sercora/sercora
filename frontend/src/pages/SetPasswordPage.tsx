import {
    useState
} from "react";
import type { FormEvent } from "react";

import sercoraLogo from "../assets/sercora-logo.png";
import {
    setPasswordFromToken
} from "../utils/authApi";

import "../styles/auth.css";


type SetPasswordPageProps = {
    setupToken: string;
    onComplete: () => void;
};


function SetPasswordPage({
    setupToken,
    onComplete
}: SetPasswordPageProps) {

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);


    async function submit(
        event: FormEvent<HTMLFormElement>
    ) {

        event.preventDefault();
        setStatus(null);
        setError(null);

        if (password !== confirmPassword) {
            setError("Les mots de passe ne correspondent pas");
            return;
        }

        setIsSaving(true);

        try {
            await setPasswordFromToken(
                setupToken,
                password
            );
            setStatus("Mot de passe sauvegarde. Vous pouvez vous connecter.");

        } catch (saveError) {
            setError(
                saveError instanceof Error ?
                    saveError.message :
                    "Impossible de sauvegarder le mot de passe"
            );

        } finally {
            setIsSaving(false);
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

                <div className="auth-section-heading">
                    <div>
                        <span className="eyebrow">Compte Sercora</span>
                        <h2>Creer le mot de passe</h2>
                    </div>
                </div>

                <label className="field-stack">
                    <span>Nouveau mot de passe</span>
                    <input
                        value={password}
                        type="password"
                        autoComplete="new-password"
                        onChange={
                            event => setPassword(event.target.value)
                        }
                    />
                </label>

                <label className="field-stack">
                    <span>Confirmer</span>
                    <input
                        value={confirmPassword}
                        type="password"
                        autoComplete="new-password"
                        onChange={
                            event => setConfirmPassword(event.target.value)
                        }
                    />
                </label>

                {error && (
                    <div className="auth-error">
                        {error}
                    </div>
                )}

                {status && (
                    <div className="auth-success">
                        {status}
                    </div>
                )}

                <button
                    type="submit"
                    className="primary-auth-button"
                    disabled={
                        isSaving ||
                        password.length < 8 ||
                        !confirmPassword
                    }
                >
                    {isSaving ? "Sauvegarde..." : "Sauvegarder"}
                </button>

                {status && (
                    <button
                        type="button"
                        className="secondary-auth-button"
                        onClick={onComplete}
                    >
                        Aller a la connexion
                    </button>
                )}
            </form>
        </main>
    );

}


export default SetPasswordPage;
