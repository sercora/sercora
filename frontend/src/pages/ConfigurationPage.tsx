import {
    useEffect,
    useState
} from "react";
import type { FormEvent } from "react";

import type {
    EmailSettings,
    SercoraUser
} from "../utils/authApi";
import {
    fetchEmailSettings,
    saveEmailSettings,
    testEmailSettings
} from "../utils/authApi";

import "../styles/auth.css";


const EMPTY_SETTINGS: EmailSettings = {
    smtp_host: "",
    smtp_port: 587,
    smtp_username: "",
    smtp_password: "",
    from_email: "",
    from_name: "Sercora",
    use_tls: true,
    use_ssl: false,
    active: false
};


type ConfigurationPageProps = {
    token: string;
    currentUser: SercoraUser;
};


function ConfigurationPage({
    token,
    currentUser
}: ConfigurationPageProps) {

    const [settings, setSettings] = useState<EmailSettings>(EMPTY_SETTINGS);
    const [testRecipient, setTestRecipient] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [status, setStatus] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);


    useEffect(
        () => {
            let isMounted = true;

            fetchEmailSettings(token)
                .then(
                    fetchedSettings => {
                        if (!isMounted)
                            return;

                        setSettings(
                            {
                                ...fetchedSettings,
                                smtp_password: ""
                            }
                        );
                        setTestRecipient(fetchedSettings.from_email || "");
                    }
                )
                .catch(
                    loadError => {
                        if (!isMounted)
                            return;

                        setError(
                            loadError instanceof Error ?
                                loadError.message :
                                "Impossible de charger la configuration"
                        );
                    }
                )
                .finally(
                    () => {
                        if (isMounted)
                            setIsLoading(false);
                    }
                );

            return () => {
                isMounted = false;
            };
        },
        [
            token
        ]
    );


    async function save(
        event: FormEvent<HTMLFormElement>
    ) {

        event.preventDefault();
        setStatus(null);
        setError(null);
        setIsSaving(true);

        try {
            const savedSettings = await saveEmailSettings(
                token,
                settings
            );

            setSettings(
                {
                    ...savedSettings,
                    smtp_password: ""
                }
            );
            setStatus("Configuration SMTP sauvegardee");

        } catch (saveError) {
            setError(
                saveError instanceof Error ?
                    saveError.message :
                    "Impossible de sauvegarder le SMTP"
            );

        } finally {
            setIsSaving(false);
        }

    }


    async function sendTest() {

        setStatus(null);
        setError(null);
        setIsTesting(true);

        try {
            await testEmailSettings(
                token,
                testRecipient
            );
            setStatus("Courriel de test envoye");

        } catch (testError) {
            setError(
                testError instanceof Error ?
                    testError.message :
                    "Impossible d'envoyer le test"
            );

        } finally {
            setIsTesting(false);
        }

    }


    if (currentUser.role !== "admin") {
        return (
            <section className="auth-page">
                <div className="profile-editor">
                    Acces reserve aux administrateurs.
                </div>
            </section>
        );
    }


    if (isLoading) {
        return (
            <section className="auth-page">
                <div className="profile-editor">
                    Chargement...
                </div>
            </section>
        );
    }


    return (
        <section className="auth-page configuration-page">
            <form
                className="profile-editor"
                onSubmit={save}
            >
                <div className="auth-section-heading">
                    <div>
                        <span className="eyebrow">Configuration</span>
                        <h2>Courriel SMTP</h2>
                    </div>
                    <span className="role-badge">
                        {settings.active ? "Actif" : "Inactif"}
                    </span>
                </div>

                <div className="auth-form-grid">
                    <label className="field-stack">
                        <span>Serveur SMTP</span>
                        <input
                            value={settings.smtp_host}
                            placeholder="smtp.migadu.com"
                            onChange={
                                event => setSettings(
                                    {
                                        ...settings,
                                        smtp_host: event.target.value
                                    }
                                )
                            }
                        />
                    </label>

                    <label className="field-stack">
                        <span>Port</span>
                        <input
                            value={settings.smtp_port}
                            type="number"
                            min={1}
                            max={65535}
                            onChange={
                                event => setSettings(
                                    {
                                        ...settings,
                                        smtp_port: Number(event.target.value)
                                    }
                                )
                            }
                        />
                    </label>
                </div>

                <div className="auth-form-grid">
                    <label className="field-stack">
                        <span>Usager SMTP</span>
                        <input
                            value={settings.smtp_username}
                            autoComplete="username"
                            onChange={
                                event => setSettings(
                                    {
                                        ...settings,
                                        smtp_username: event.target.value
                                    }
                                )
                            }
                        />
                    </label>

                    <label className="field-stack">
                        <span>Mot de passe SMTP</span>
                        <input
                            value={settings.smtp_password || ""}
                            type="password"
                            autoComplete="new-password"
                            placeholder={
                                settings.password_configured ?
                                    "Laisser vide pour conserver" :
                                    ""
                            }
                            onChange={
                                event => setSettings(
                                    {
                                        ...settings,
                                        smtp_password: event.target.value
                                    }
                                )
                            }
                        />
                    </label>
                </div>

                <div className="auth-form-grid">
                    <label className="field-stack">
                        <span>Courriel expediteur</span>
                        <input
                            value={settings.from_email}
                            type="email"
                            onChange={
                                event => setSettings(
                                    {
                                        ...settings,
                                        from_email: event.target.value
                                    }
                                )
                            }
                        />
                    </label>

                    <label className="field-stack">
                        <span>Nom expediteur</span>
                        <input
                            value={settings.from_name}
                            onChange={
                                event => setSettings(
                                    {
                                        ...settings,
                                        from_name: event.target.value
                                    }
                                )
                            }
                        />
                    </label>
                </div>

                <div className="checkbox-grid">
                    <label className="checkbox-line">
                        <input
                            type="checkbox"
                            checked={settings.use_tls}
                            onChange={
                                event => setSettings(
                                    {
                                        ...settings,
                                        use_tls: event.target.checked
                                    }
                                )
                            }
                        />
                        <span>STARTTLS</span>
                    </label>

                    <label className="checkbox-line">
                        <input
                            type="checkbox"
                            checked={settings.use_ssl}
                            onChange={
                                event => setSettings(
                                    {
                                        ...settings,
                                        use_ssl: event.target.checked
                                    }
                                )
                            }
                        />
                        <span>SSL direct</span>
                    </label>

                    <label className="checkbox-line">
                        <input
                            type="checkbox"
                            checked={settings.active}
                            onChange={
                                event => setSettings(
                                    {
                                        ...settings,
                                        active: event.target.checked
                                    }
                                )
                            }
                        />
                        <span>Activer le courriel</span>
                    </label>
                </div>

                <div className="smtp-test-row">
                    <label className="field-stack">
                        <span>Destinataire test</span>
                        <input
                            value={testRecipient}
                            type="email"
                            onChange={
                                event => setTestRecipient(event.target.value)
                            }
                        />
                    </label>
                    <button
                        type="button"
                        className="secondary-auth-button"
                        disabled={
                            isTesting ||
                            !testRecipient.trim()
                        }
                        onClick={sendTest}
                    >
                        {isTesting ? "Envoi..." : "Tester"}
                    </button>
                </div>

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

                <div className="auth-actions">
                    <button
                        type="submit"
                        className="primary-auth-button"
                        disabled={
                            isSaving ||
                            !settings.smtp_host.trim() ||
                            !settings.from_email.trim()
                        }
                    >
                        {isSaving ? "Sauvegarde..." : "Sauvegarder"}
                    </button>
                </div>
            </form>
        </section>
    );

}


export default ConfigurationPage;
