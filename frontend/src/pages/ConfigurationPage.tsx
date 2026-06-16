import {
    useEffect,
    useState
} from "react";
import type { FormEvent } from "react";

import type {
    EmailSettings,
    SmsSettings,
    SercoraUser
} from "../utils/authApi";
import {
    fetchEmailSettings,
    fetchSmsSettings,
    saveEmailSettings,
    saveSmsSettings,
    testEmailSettings,
    testSmsSettings
} from "../utils/authApi";
import ImportationPage from "./ImportationPage";

import "../styles/auth.css";


const EMPTY_SETTINGS: EmailSettings = {
    smtp_host: "",
    smtp_port: 587,
    smtp_username: "",
    smtp_password: "",
    from_email: "",
    from_name: "Sercora",
    reply_to_email: "",
    use_tls: true,
    use_ssl: false,
    active: false
};


const EMPTY_SMS_SETTINGS: SmsSettings = {
    provider_name: "",
    account_id: "",
    api_key: "",
    api_secret: "",
    from_number: "",
    alert_minutes_before: 30,
    active: false
};


type ConfigurationPageProps = {
    token: string;
    currentUser: SercoraUser;
    configurationMenu: "Courriel" | "VoIP/SMS" | "Importation";
};


function ConfigurationPage({
    token,
    currentUser,
    configurationMenu
}: ConfigurationPageProps) {

    const [settings, setSettings] = useState<EmailSettings>(EMPTY_SETTINGS);
    const [smsSettings, setSmsSettings] = useState<SmsSettings>(EMPTY_SMS_SETTINGS);
    const [testRecipient, setTestRecipient] = useState("");
    const [smsTestDestination, setSmsTestDestination] = useState("");
    const [smsTestMessage, setSmsTestMessage] = useState("Test SMS Sercora");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [isSmsTesting, setIsSmsTesting] = useState(false);
    const [status, setStatus] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);


    useEffect(
        () => {
            if (configurationMenu !== "Courriel")
                return;

            let isMounted = true;
            setIsLoading(true);
            setError(null);
            setStatus(null);

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
            configurationMenu,
            token
        ]
    );


    useEffect(
        () => {
            if (configurationMenu !== "VoIP/SMS")
                return;

            let isMounted = true;
            setIsLoading(true);
            setError(null);
            setStatus(null);

            fetchSmsSettings(token)
                .then(
                    fetchedSettings => {
                        if (!isMounted)
                            return;

                        setSmsSettings(
                            {
                                ...fetchedSettings,
                                api_secret: ""
                            }
                        );
                    }
                )
                .catch(
                    loadError => {
                        if (!isMounted)
                            return;

                        setError(
                            loadError instanceof Error ?
                                loadError.message :
                                "Impossible de charger la configuration SMS"
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
            configurationMenu,
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


    async function saveSms(
        event: FormEvent<HTMLFormElement>
    ) {

        event.preventDefault();
        setStatus(null);
        setError(null);
        setIsSaving(true);

        try {
            const savedSettings = await saveSmsSettings(
                token,
                smsSettings
            );

            setSmsSettings(
                {
                    ...savedSettings,
                    api_secret: ""
                }
            );
            setStatus("Configuration VoIP/SMS sauvegardee");

        } catch (saveError) {
            setError(
                saveError instanceof Error ?
                    saveError.message :
                    "Impossible de sauvegarder la configuration SMS"
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


    async function sendSmsTest() {

        setStatus(null);
        setError(null);
        setIsSmsTesting(true);

        try {
            const response = await testSmsSettings(
                token,
                smsTestDestination,
                smsTestMessage
            );
            setStatus(
                "SMS accepte par " +
                response.provider +
                " (" +
                response.provider_status +
                ")" +
                (
                    response.provider_detail ?
                        " : " + response.provider_detail :
                        ""
                )
            );

        } catch (testError) {
            setError(
                testError instanceof Error ?
                    testError.message :
                    "Impossible d'envoyer le SMS de test"
            );

        } finally {
            setIsSmsTesting(false);
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


    if (configurationMenu === "Importation") {
        return (
            <section className="auth-page configuration-page">
                <ImportationPage />
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


    if (configurationMenu === "VoIP/SMS") {
        return (
            <section className="auth-page configuration-page">
                <form
                    className="profile-editor"
                    onSubmit={saveSms}
                >
                    <div className="auth-section-heading">
                        <div>
                            <span className="eyebrow">Configuration</span>
                            <h2>VoIP/SMS</h2>
                        </div>
                        <span className="role-badge">
                            {smsSettings.active ? "Actif" : "Inactif"}
                        </span>
                    </div>

                    <div className="auth-muted">
                        Ces paramètres serviront aux alertes SMS des estimateurs 30 minutes avant une tombée BSDQ.
                    </div>

                    <div className="auth-form-grid">
                        <label className="field-stack">
                            <span>Fournisseur</span>
                            <input
                                value={smsSettings.provider_name}
                                placeholder="Twilio, VoIP.ms, Telnyx..."
                                onChange={
                                    event => setSmsSettings(
                                        {
                                            ...smsSettings,
                                            provider_name: event.target.value
                                        }
                                    )
                                }
                            />
                        </label>

                        <label className="field-stack">
                            <span>No expediteur SMS</span>
                            <input
                                value={smsSettings.from_number}
                                placeholder="+15145551212"
                                onChange={
                                    event => setSmsSettings(
                                        {
                                            ...smsSettings,
                                            from_number: event.target.value
                                        }
                                    )
                                }
                            />
                        </label>
                    </div>

                    <div className="auth-form-grid">
                        <label className="field-stack">
                            <span>ID compte</span>
                            <input
                                value={smsSettings.account_id}
                                autoComplete="username"
                                onChange={
                                    event => setSmsSettings(
                                        {
                                            ...smsSettings,
                                            account_id: event.target.value
                                        }
                                    )
                                }
                            />
                        </label>

                        <label className="field-stack">
                            <span>Cle API</span>
                            <input
                                value={smsSettings.api_key}
                                autoComplete="username"
                                onChange={
                                    event => setSmsSettings(
                                        {
                                            ...smsSettings,
                                            api_key: event.target.value
                                        }
                                    )
                                }
                            />
                        </label>
                    </div>

                    <div className="auth-form-grid">
                        <label className="field-stack">
                            <span>Secret / token API</span>
                            <input
                                value={smsSettings.api_secret || ""}
                                type="password"
                                autoComplete="new-password"
                                placeholder={
                                    smsSettings.secret_configured ?
                                        "Laisser vide pour conserver" :
                                        ""
                                }
                                onChange={
                                    event => setSmsSettings(
                                        {
                                            ...smsSettings,
                                            api_secret: event.target.value
                                        }
                                    )
                                }
                            />
                        </label>

                        <label className="field-stack">
                            <span>Alerte avant depot BSDQ</span>
                            <input
                                value={smsSettings.alert_minutes_before}
                                type="number"
                                min={1}
                                max={1440}
                                onChange={
                                    event => setSmsSettings(
                                        {
                                            ...smsSettings,
                                            alert_minutes_before: Number(event.target.value)
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
                                checked={smsSettings.active}
                                onChange={
                                    event => setSmsSettings(
                                        {
                                            ...smsSettings,
                                            active: event.target.checked
                                        }
                                    )
                                }
                            />
                            <span>Activer les alertes SMS BSDQ</span>
                        </label>
                    </div>

                    <div className="sms-test-panel">
                        <div className="auth-section-heading compact">
                            <div>
                                <span className="eyebrow">Test</span>
                                <h2>Envoi SMS manuel</h2>
                            </div>
                        </div>

                        <div className="auth-form-grid">
                            <label className="field-stack">
                                <span>Destination test</span>
                                <input
                                    value={smsTestDestination}
                                    type="tel"
                                    placeholder="+15145551212"
                                    onChange={
                                        event => setSmsTestDestination(event.target.value)
                                    }
                                />
                            </label>

                            <label className="field-stack">
                                <span>Message test</span>
                                <textarea
                                    value={smsTestMessage}
                                    rows={3}
                                    maxLength={480}
                                    onChange={
                                        event => setSmsTestMessage(event.target.value)
                                    }
                                />
                            </label>
                        </div>

                        <div className="auth-actions">
                            <button
                                type="button"
                                className="secondary-auth-button"
                                disabled={
                                    isSmsTesting ||
                                    !smsSettings.active ||
                                    !smsTestDestination.trim() ||
                                    !smsTestMessage.trim()
                                }
                                onClick={sendSmsTest}
                            >
                                {isSmsTesting ? "Envoi..." : "Tester SMS"}
                            </button>
                        </div>
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
                                !smsSettings.provider_name.trim() ||
                                !smsSettings.from_number.trim()
                            }
                        >
                            {isSaving ? "Sauvegarde..." : "Sauvegarder"}
                        </button>
                    </div>
                </form>
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

                <label className="field-stack">
                    <span>Adresse Reply-To</span>
                    <input
                        value={settings.reply_to_email}
                        type="email"
                        placeholder="Laisser vide pour utiliser l'expediteur"
                        onChange={
                            event => setSettings(
                                {
                                    ...settings,
                                    reply_to_email: event.target.value
                                }
                            )
                        }
                    />
                </label>

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
