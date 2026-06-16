import {
    useEffect,
    useMemo,
    useState
} from "react";
import type { FormEvent } from "react";

import type {
    SercoraUser,
    UserInput,
    UserRole
} from "../utils/authApi";
import {
    createUser,
    fetchUsers,
    inviteExistingUser,
    inviteNewUser,
    sendPasswordReset,
    updateUser
} from "../utils/authApi";

import "../styles/auth.css";


const ROLE_OPTIONS: UserRole[] = [
    "admin",
    "execution",
    "estimation",
    "entrepot"
];


const EMPTY_USER: UserInput = {
    username: "",
    full_name: "",
    email: null,
    role: "execution",
    active: true
};


type UsersPageProps = {
    token: string;
    currentUser: SercoraUser;
};


function UsersPage({
    token,
    currentUser
}: UsersPageProps) {

    const [users, setUsers] = useState<SercoraUser[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [form, setForm] = useState<UserInput>(EMPTY_USER);
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<string | null>(null);

    const selectedUser = useMemo(
        () => users.find(
            user => user.id === selectedId
        ) || null,
        [
            selectedId,
            users
        ]
    );


    async function loadUsers() {

        setIsLoading(true);
        setError(null);

        try {
            setUsers(
                await fetchUsers(token)
            );

        } catch (loadError) {
            setError(
                loadError instanceof Error ?
                    loadError.message :
                    "Impossible de charger les usagers"
            );

        } finally {
            setIsLoading(false);
        }

    }


    function startNewUser() {

        setSelectedId(null);
        setForm(EMPTY_USER);
        setPassword("");
        setStatus(null);
        setError(null);

    }


    function editUser(
        user: SercoraUser
    ) {

        setSelectedId(user.id);
        setForm(
            {
                username: user.username,
                full_name: user.full_name,
                email: user.email,
                role: user.role,
                active: user.active
            }
        );
        setPassword("");
        setStatus(null);
        setError(null);

    }


    async function saveUser(
        event: FormEvent<HTMLFormElement>
    ) {

        event.preventDefault();
        setStatus(null);
        setError(null);
        setIsSaving(true);

        const payload: UserInput = {
            ...form,
            username: form.username.trim(),
            full_name: form.full_name.trim(),
            email: (form.email || "").trim() || null
        };

        try {
            if (selectedUser) {
                await updateUser(
                    token,
                    selectedUser.id,
                    password ?
                        {
                            ...payload,
                            password
                        } :
                        payload
                );
                setStatus("Usager sauvegarde");

            } else {
                await createUser(
                    token,
                    {
                        ...payload,
                        password
                    }
                );
                setStatus("Usager cree");
                startNewUser();
            }

            await loadUsers();

        } catch (saveError) {
            setError(
                saveError instanceof Error ?
                    saveError.message :
                    "Impossible de sauvegarder l'usager"
            );

        } finally {
            setIsSaving(false);
        }

    }


    async function createAndInvite() {

        setStatus(null);
        setError(null);
        setIsSendingEmail(true);

        const payload: UserInput = {
            ...form,
            username: form.username.trim(),
            full_name: form.full_name.trim(),
            email: (form.email || "").trim() || null
        };

        try {
            await inviteNewUser(
                token,
                payload
            );
            startNewUser();
            setStatus("Invitation envoyee");
            await loadUsers();

        } catch (inviteError) {
            setError(
                inviteError instanceof Error ?
                    inviteError.message :
                    "Impossible d'envoyer l'invitation"
            );

        } finally {
            setIsSendingEmail(false);
        }

    }


    async function sendInvitation() {

        if (!selectedUser)
            return;

        setStatus(null);
        setError(null);
        setIsSendingEmail(true);

        try {
            await inviteExistingUser(
                token,
                selectedUser.id
            );
            setStatus("Invitation envoyee");

        } catch (inviteError) {
            setError(
                inviteError instanceof Error ?
                    inviteError.message :
                    "Impossible d'envoyer l'invitation"
            );

        } finally {
            setIsSendingEmail(false);
        }

    }


    async function resetPassword() {

        if (!selectedUser)
            return;

        setStatus(null);
        setError(null);
        setIsSendingEmail(true);

        try {
            await sendPasswordReset(
                token,
                selectedUser.id
            );
            setStatus("Lien de mot de passe envoye");

        } catch (resetError) {
            setError(
                resetError instanceof Error ?
                    resetError.message :
                    "Impossible d'envoyer le lien"
            );

        } finally {
            setIsSendingEmail(false);
        }

    }


    useEffect(
        () => {
            let isMounted = true;

            fetchUsers(token)
                .then(
                    fetchedUsers => {
                        if (isMounted)
                            setUsers(fetchedUsers);
                    }
                )
                .catch(
                    loadError => {
                        if (!isMounted)
                            return;

                        setError(
                            loadError instanceof Error ?
                                loadError.message :
                                "Impossible de charger les usagers"
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


    if (currentUser.role !== "admin") {
        return (
            <section className="auth-page">
                <div className="profile-editor">
                    Acces reserve aux administrateurs.
                </div>
            </section>
        );
    }

    return (
        <section className="auth-page users-layout">
            <div className="users-list-panel">
                <div className="auth-section-heading">
                    <div>
                        <span className="eyebrow">Administration</span>
                        <h2>Usagers</h2>
                    </div>
                    <button
                        type="button"
                        className="secondary-auth-button"
                        onClick={startNewUser}
                    >
                        Nouvel usager
                    </button>
                </div>

                {isLoading ? (
                    <div className="auth-muted">Chargement...</div>
                ) : (
                    <div className="users-table-wrap">
                        <table className="users-table">
                            <thead>
                                <tr>
                                    <th>Usager</th>
                                    <th>Nom</th>
                                    <th>Role</th>
                                    <th>Etat</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(
                                    user => (
                                        <tr
                                            key={user.id}
                                            className={
                                                user.id === selectedId ?
                                                    "selected" :
                                                    ""
                                            }
                                            onClick={
                                                () => editUser(user)
                                            }
                                        >
                                            <td>{user.username}</td>
                                            <td>{user.full_name}</td>
                                            <td>{user.role}</td>
                                            <td>
                                                {user.active ? "Actif" : "Inactif"}
                                            </td>
                                        </tr>
                                    )
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <form
                className="user-editor-panel"
                onSubmit={saveUser}
            >
                <div className="auth-section-heading">
                    <div>
                        <span className="eyebrow">
                            {selectedUser ? "Modification" : "Creation"}
                        </span>
                        <h2>
                            {selectedUser ? selectedUser.username : "Nouvel usager"}
                        </h2>
                    </div>
                </div>

                <label className="field-stack">
                    <span>Nom d'usager</span>
                    <input
                        value={form.username}
                        onChange={
                            event => setForm(
                                {
                                    ...form,
                                    username: event.target.value
                                }
                            )
                        }
                    />
                </label>

                <label className="field-stack">
                    <span>Nom complet</span>
                    <input
                        value={form.full_name}
                        onChange={
                            event => setForm(
                                {
                                    ...form,
                                    full_name: event.target.value
                                }
                            )
                        }
                    />
                </label>

                <label className="field-stack">
                    <span>Courriel</span>
                    <input
                        value={form.email || ""}
                        type="email"
                        onChange={
                            event => setForm(
                                {
                                    ...form,
                                    email: event.target.value
                                }
                            )
                        }
                    />
                </label>

                <div className="auth-form-grid">
                    <label className="field-stack">
                        <span>Role</span>
                        <select
                            value={form.role}
                            onChange={
                                event => setForm(
                                    {
                                        ...form,
                                        role: event.target.value as UserRole
                                    }
                                )
                            }
                        >
                            {ROLE_OPTIONS.map(
                                role => (
                                    <option
                                        key={role}
                                        value={role}
                                    >
                                        {role}
                                    </option>
                                )
                            )}
                        </select>
                    </label>

                    <label className="field-stack">
                        <span>Mot de passe</span>
                        <input
                            value={password}
                            type="password"
                            autoComplete="new-password"
                            placeholder={
                                selectedUser ?
                                    "Laisser vide pour conserver" :
                                    ""
                            }
                            onChange={
                                event => setPassword(event.target.value)
                            }
                        />
                    </label>
                </div>

                <label className="checkbox-line">
                    <input
                        type="checkbox"
                        checked={form.active}
                        onChange={
                            event => setForm(
                                {
                                    ...form,
                                    active: event.target.checked
                                }
                            )
                        }
                    />
                    <span>Usager actif</span>
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

                <div className="auth-actions">
                    {selectedUser && (
                        <>
                            <button
                                type="button"
                                className="secondary-auth-button"
                                disabled={
                                    isSendingEmail ||
                                    !selectedUser.email
                                }
                                onClick={sendInvitation}
                            >
                                Invitation
                            </button>
                            <button
                                type="button"
                                className="secondary-auth-button"
                                disabled={
                                    isSendingEmail ||
                                    !selectedUser.email
                                }
                                onClick={resetPassword}
                            >
                                Reset mot de passe
                            </button>
                        </>
                    )}
                    {!selectedUser && (
                        <button
                            type="button"
                            className="secondary-auth-button"
                            disabled={
                                isSendingEmail ||
                                !form.username.trim() ||
                                !form.full_name.trim() ||
                                !(form.email || "").trim()
                            }
                            onClick={createAndInvite}
                        >
                            Creer et inviter
                        </button>
                    )}
                    <button
                        type="button"
                        className="secondary-auth-button"
                        onClick={startNewUser}
                    >
                        Annuler
                    </button>
                    <button
                        type="submit"
                        className="primary-auth-button"
                        disabled={
                            isSaving ||
                            !form.username.trim() ||
                            !form.full_name.trim() ||
                            (!selectedUser && !password)
                        }
                    >
                        {isSaving ? "Sauvegarde..." : "Sauvegarder"}
                    </button>
                </div>
            </form>
        </section>
    );

}


export default UsersPage;
