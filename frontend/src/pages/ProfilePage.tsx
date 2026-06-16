import { useState } from "react";
import type { FormEvent } from "react";

import type {
    ProfileInput,
    SercoraUser
} from "../utils/authApi";
import {
    updateProfile
} from "../utils/authApi";

import "../styles/auth.css";


type ProfilePageProps = {
    token: string;
    user: SercoraUser;
    onUserUpdate: (user: SercoraUser) => void;
};


function ProfilePage({
    token,
    user,
    onUserUpdate
}: ProfilePageProps) {

    const [fullName, setFullName] = useState(user.full_name);
    const [email, setEmail] = useState(user.email || "");
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [status, setStatus] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);


    async function save(
        event: FormEvent<HTMLFormElement>
    ) {

        event.preventDefault();
        setStatus(null);
        setError(null);
        setIsSaving(true);

        const payload: ProfileInput = {
            full_name: fullName,
            email: email.trim() || null
        };

        if (newPassword) {
            payload.current_password = currentPassword;
            payload.new_password = newPassword;
        }

        try {
            const updatedUser = await updateProfile(
                token,
                payload
            );

            setCurrentPassword("");
            setNewPassword("");
            setStatus("Profil sauvegarde");
            onUserUpdate(updatedUser);

        } catch (profileError) {
            setError(
                profileError instanceof Error ?
                    profileError.message :
                    "Impossible de sauvegarder le profil"
            );

        } finally {
            setIsSaving(false);
        }

    }


    return (
        <section className="auth-page">
            <form
                className="profile-editor"
                onSubmit={save}
            >
                <div className="auth-section-heading">
                    <div>
                        <span className="eyebrow">Profil</span>
                        <h2>{user.username}</h2>
                    </div>
                    <span className="role-badge">{user.role}</span>
                </div>

                {user.must_change_password && (
                    <div className="auth-warning">
                        Le mot de passe temporaire doit etre remplace.
                    </div>
                )}

                <label className="field-stack">
                    <span>Nom complet</span>
                    <input
                        value={fullName}
                        onChange={
                            event => setFullName(event.target.value)
                        }
                    />
                </label>

                <label className="field-stack">
                    <span>Courriel</span>
                    <input
                        value={email}
                        type="email"
                        onChange={
                            event => setEmail(event.target.value)
                        }
                    />
                </label>

                <div className="auth-form-grid">
                    <label className="field-stack">
                        <span>Mot de passe actuel</span>
                        <input
                            value={currentPassword}
                            type="password"
                            autoComplete="current-password"
                            onChange={
                                event => setCurrentPassword(event.target.value)
                            }
                        />
                    </label>

                    <label className="field-stack">
                        <span>Nouveau mot de passe</span>
                        <input
                            value={newPassword}
                            type="password"
                            autoComplete="new-password"
                            onChange={
                                event => setNewPassword(event.target.value)
                            }
                        />
                    </label>
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
                            !fullName.trim() ||
                            (Boolean(newPassword) && !currentPassword)
                        }
                    >
                        {isSaving ? "Sauvegarde..." : "Sauvegarder"}
                    </button>
                </div>
            </form>
        </section>
    );

}


export default ProfilePage;
