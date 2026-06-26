import {
    useEffect,
    useMemo,
    useState
} from "react";
import type { FormEvent } from "react";

import {
    createClient,
    fetchClientTypes,
    fetchClients,
    updateClient
} from "../utils/businessApi";
import type {
    Client,
    ClientInput,
    ClientType
} from "../utils/businessApi";

import "../styles/business.css";


const EMPTY_CLIENT: ClientInput = {
    name: "",
    client_type_id: null,
    phone: "",
    fax: "",
    mobile: "",
    billing_address: "",
    billing_postal_code: "",
    rbq: "",
    active: true
};


function ClientsPage() {

    const [clients, setClients] = useState<Client[]>([]);
    const [clientTypes, setClientTypes] = useState<ClientType[]>([]);
    const [search, setSearch] = useState("");
    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const [form, setForm] = useState<ClientInput>(EMPTY_CLIENT);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [status, setStatus] = useState("");
    const [error, setError] = useState("");

    const filteredClients = useMemo(
        () => {
            const normalizedSearch = search.trim().toLowerCase();

            if (!normalizedSearch)
                return clients;

            return clients.filter(
                client =>
                    [
                        client.name,
                        client.client_type_name || "",
                        client.phone || "",
                        client.fax || "",
                        client.mobile || "",
                        client.billing_address || "",
                        client.billing_postal_code || "",
                        client.rbq || ""
                    ].some(
                        value =>
                            value.toLowerCase().includes(normalizedSearch)
                    )
            );
        },
        [
            clients,
            search
        ]
    );


    function loadClients() {

        setIsLoading(true);
        setError("");

        Promise.all(
            [
                fetchClients(),
                fetchClientTypes()
            ]
        )

        .then(
            ([nextClients, nextTypes]) => {
                setClients(nextClients);
                setClientTypes(nextTypes);
            }
        )

        .catch(
            () =>
                setError("Impossible de charger les clients.")
        )

        .finally(
            () =>
                setIsLoading(false)
        );

    }


    function openNewClient() {

        setEditingClient(null);
        setForm(EMPTY_CLIENT);
        setStatus("");
        setError("");
        setIsModalOpen(true);

    }


    function openEditClient(
        client: Client
    ) {

        setEditingClient(client);
        setForm(
            {
                name: client.name,
                client_type_id: client.client_type_id,
                phone: client.phone || "",
                fax: client.fax || "",
                mobile: client.mobile || "",
                billing_address: client.billing_address || "",
                billing_postal_code: client.billing_postal_code || "",
                rbq: client.rbq || "",
                active: client.active
            }
        );
        setStatus("");
        setError("");
        setIsModalOpen(true);

    }


    function closeModal() {

        setIsModalOpen(false);
        setEditingClient(null);
        setForm(EMPTY_CLIENT);

    }


    function saveClient(
        event: FormEvent<HTMLFormElement>
    ) {

        event.preventDefault();
        setIsSaving(true);
        setStatus("");
        setError("");

        const payload: ClientInput = {
            ...form,
            name: form.name.trim(),
            phone: form.phone.trim(),
            fax: form.fax.trim(),
            mobile: form.mobile.trim(),
            billing_address: form.billing_address.trim(),
            billing_postal_code: form.billing_postal_code.trim(),
            rbq: form.rbq.trim()
        };

        const request =
            editingClient ?
                updateClient(
                    editingClient.id,
                    payload
                ) :
                createClient(payload);

        request
            .then(
                () => {
                    setStatus(
                        editingClient ?
                            "Client sauvegardé." :
                            "Client créé."
                    );
                    closeModal();
                    loadClients();
                }
            )
            .catch(
                () =>
                    setError("Impossible de sauvegarder le client.")
            )
            .finally(
                () =>
                    setIsSaving(false)
            );

    }


    useEffect(
        loadClients,
        []
    );


    return (
        <section className="business-page">
            <div className="business-toolbar">
                <input
                    type="search"
                    value={search}
                    onChange={
                        event =>
                            setSearch(event.target.value)
                    }
                    placeholder="Rechercher un client, une adresse ou un numéro"
                />
                <button
                    type="button"
                    onClick={openNewClient}
                >
                    Ajouter
                </button>
                <button
                    type="button"
                    onClick={loadClients}
                    disabled={isLoading}
                >
                    Rafraîchir
                </button>
                <div className="business-summary">
                    <strong>{filteredClients.length}</strong>
                    <span>clients</span>
                </div>
            </div>

            {status && (
                <div className="business-status">{status}</div>
            )}

            {error && (
                <div className="business-error">{error}</div>
            )}

            <div className="business-table-wrap">
                <table className="business-table clients-table">
                    <thead>
                        <tr>
                            <th>Nom</th>
                            <th>Type</th>
                            <th>Coordonnées</th>
                            <th>Adresse</th>
                            <th>RBQ</th>
                            <th>Projets</th>
                            <th>État</th>
                            <th>Créé</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr>
                                <td colSpan={9}>Chargement...</td>
                            </tr>
                        ) : filteredClients.length === 0 ? (
                            <tr>
                                <td colSpan={9}>Aucun client.</td>
                            </tr>
                        ) : (
                            filteredClients.map(
                                client => (
                                    <tr key={client.id}>
                                        <td>{client.name}</td>
                                        <td>{client.client_type_name || "-"}</td>
                                        <td>
                                            {client.phone || "-"}
                                            {client.fax && (
                                                <span className="business-muted-line">
                                                    Fax: {client.fax}
                                                </span>
                                            )}
                                            {client.mobile && (
                                                <span className="business-muted-line">
                                                    Mobile: {client.mobile}
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            {client.billing_address || "-"}
                                            {client.billing_postal_code && (
                                                <span className="business-muted-line">
                                                    {client.billing_postal_code}
                                                </span>
                                            )}
                                        </td>
                                        <td>{client.rbq || "-"}</td>
                                        <td>{client.project_count}</td>
                                        <td>
                                            <span className={
                                                client.active ?
                                                    "business-pill active" :
                                                    "business-pill inactive"
                                            }>
                                                {client.active ? "Actif" : "Inactif"}
                                            </span>
                                        </td>
                                        <td>
                                            {client.created_at ?
                                                new Date(
                                                    client.created_at
                                                ).toLocaleDateString("fr-CA") :
                                                "-"}
                                        </td>
                                        <td>
                                            <button
                                                type="button"
                                                className="business-table-action"
                                                onClick={
                                                    () =>
                                                        openEditClient(client)
                                                }
                                            >
                                                Modifier
                                            </button>
                                        </td>
                                    </tr>
                                )
                            )
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="business-modal-backdrop">
                    <form
                        className="business-modal client-modal"
                        onSubmit={saveClient}
                    >
                        <header>
                            <h2>
                                {editingClient ? "Modifier client" : "Ajouter client"}
                            </h2>
                            <button
                                type="button"
                                onClick={closeModal}
                            >
                                Fermer
                            </button>
                        </header>

                        <div className="business-form-grid compact">
                            <label className="business-field">
                                <span>Nom</span>
                                <input
                                    value={form.name}
                                    required
                                    onChange={
                                        event =>
                                            setForm(
                                                {
                                                    ...form,
                                                    name: event.target.value
                                                }
                                            )
                                    }
                                />
                            </label>

                            <label className="business-field">
                                <span>Type</span>
                                <select
                                    value={form.client_type_id || ""}
                                    onChange={
                                        event =>
                                            setForm(
                                                {
                                                    ...form,
                                                    client_type_id:
                                                        event.target.value ?
                                                            Number(event.target.value) :
                                                            null
                                                }
                                            )
                                    }
                                >
                                    <option value="">Non classé</option>
                                    {clientTypes.map(
                                        clientType => (
                                            <option
                                                key={clientType.id}
                                                value={clientType.id}
                                            >
                                                {clientType.name}
                                            </option>
                                        )
                                    )}
                                </select>
                            </label>

                            <label className="business-field">
                                <span>Téléphone</span>
                                <input
                                    value={form.phone}
                                    onChange={
                                        event =>
                                            setForm(
                                                {
                                                    ...form,
                                                    phone: event.target.value
                                                }
                                            )
                                    }
                                />
                            </label>

                            <label className="business-field">
                                <span>Fax</span>
                                <input
                                    value={form.fax}
                                    onChange={
                                        event =>
                                            setForm(
                                                {
                                                    ...form,
                                                    fax: event.target.value
                                                }
                                            )
                                    }
                                />
                            </label>

                            <label className="business-field">
                                <span>Mobile</span>
                                <input
                                    value={form.mobile}
                                    onChange={
                                        event =>
                                            setForm(
                                                {
                                                    ...form,
                                                    mobile: event.target.value
                                                }
                                            )
                                    }
                                />
                            </label>

                            <label className="business-field">
                                <span>Code postal de facturation</span>
                                <input
                                    value={form.billing_postal_code}
                                    onChange={
                                        event =>
                                            setForm(
                                                {
                                                    ...form,
                                                    billing_postal_code: event.target.value
                                                }
                                            )
                                    }
                                />
                            </label>

                            <label className="business-field wide">
                                <span>Adresse de facturation</span>
                                <input
                                    value={form.billing_address}
                                    onChange={
                                        event =>
                                            setForm(
                                                {
                                                    ...form,
                                                    billing_address: event.target.value
                                                }
                                            )
                                    }
                                />
                            </label>

                            <label className="business-field">
                                <span>RBQ</span>
                                <input
                                    value={form.rbq}
                                    onChange={
                                        event =>
                                            setForm(
                                                {
                                                    ...form,
                                                    rbq: event.target.value
                                                }
                                            )
                                    }
                                />
                            </label>
                        </div>

                        <label className="business-checkbox">
                            <input
                                type="checkbox"
                                checked={form.active}
                                onChange={
                                    event =>
                                        setForm(
                                            {
                                                ...form,
                                                active: event.target.checked
                                            }
                                        )
                                }
                            />
                            <span>Client actif</span>
                        </label>

                        <footer>
                            <button
                                type="button"
                                onClick={closeModal}
                            >
                                Annuler
                            </button>
                            <button
                                type="submit"
                                disabled={isSaving}
                            >
                                Sauvegarder
                            </button>
                        </footer>
                    </form>
                </div>
            )}
        </section>
    );

}


export default ClientsPage;
