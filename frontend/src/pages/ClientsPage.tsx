import {
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";
import type { FormEvent } from "react";

import ColumnMenu from "../components/ColumnMenu";
import {
    useColumnPreferences
} from "../hooks/useColumnPreferences";
import {
    bulkUpdateClients,
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
    federal_tax_number: "",
    provincial_tax_number: "",
    active: true
};

type ClientDisplayField =
    "name" |
    "type" |
    "phone" |
    "fax" |
    "mobile" |
    "billing_address" |
    "billing_postal_code" |
    "rbq" |
    "federal_tax_number" |
    "provincial_tax_number" |
    "project_count" |
    "active";


const CLIENT_DISPLAY_FIELDS: {
    id: ClientDisplayField;
    label: string;
}[] = [
    {
        id: "name",
        label: "Nom"
    },
    {
        id: "type",
        label: "Type"
    },
    {
        id: "phone",
        label: "Téléphone"
    },
    {
        id: "fax",
        label: "Fax"
    },
    {
        id: "mobile",
        label: "Mobile"
    },
    {
        id: "billing_address",
        label: "Adresse"
    },
    {
        id: "billing_postal_code",
        label: "Code postal"
    },
    {
        id: "rbq",
        label: "RBQ"
    },
    {
        id: "federal_tax_number",
        label: "Taxes fédérales"
    },
    {
        id: "provincial_tax_number",
        label: "Taxes provinciales"
    },
    {
        id: "project_count",
        label: "Projets"
    },
    {
        id: "active",
        label: "État"
    }
];


function getUniformValue<T>(
    clients: Client[],
    getter: (client: Client) => T | null
) {

    if (clients.length === 0)
        return null;

    const firstValue = getter(clients[0]);

    return clients.every(
        client =>
            getter(client) === firstValue
    ) ?
        firstValue :
        null;

}


function ClientsPage() {

    const [clients, setClients] = useState<Client[]>([]);
    const [clientTypes, setClientTypes] = useState<ClientType[]>([]);
    const [search, setSearch] = useState("");
    const [selectedClientIds, setSelectedClientIds] = useState<number[]>([]);
    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const [form, setForm] = useState<ClientInput>(EMPTY_CLIENT);
    const [bulkActiveChoice, setBulkActiveChoice] = useState<"" | "true" | "false">("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [status, setStatus] = useState("");
    const [error, setError] = useState("");
    const selectAllRef = useRef<HTMLInputElement | null>(null);
    const clientColumns = useColumnPreferences(
        "columns.clients",
        CLIENT_DISPLAY_FIELDS
    );
    const visibleClientColumnCount = clientColumns.visibleColumns.length + 1;

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
                        client.rbq || "",
                        client.federal_tax_number || "",
                        client.provincial_tax_number || ""
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

    const selectedClients = useMemo(
        () =>
            clients.filter(
                client =>
                    selectedClientIds.includes(client.id)
            ),
        [
            clients,
            selectedClientIds
        ]
    );

    const selectedVisibleCount = useMemo(
        () =>
            filteredClients.filter(
                client =>
                    selectedClientIds.includes(client.id)
            ).length,
        [
            filteredClients,
            selectedClientIds
        ]
    );

    const allVisibleSelected =
        filteredClients.length > 0 &&
        selectedVisibleCount === filteredClients.length;

    const someVisibleSelected =
        selectedVisibleCount > 0 &&
        !allVisibleSelected;


    useEffect(
        () => {
            if (selectAllRef.current)
                selectAllRef.current.indeterminate = someVisibleSelected;
        },
        [
            someVisibleSelected
        ]
    );


    function loadClients() {

        setIsLoading(true);
        setError("");
        setSelectedClientIds([]);

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
        setSelectedClientIds([]);
        setForm(EMPTY_CLIENT);
        setBulkActiveChoice("");
        setStatus("");
        setError("");
        setIsModalOpen(true);

    }


    function openEditClient(
        client: Client
    ) {

        setEditingClient(client);
        setSelectedClientIds(
            [
                client.id
            ]
        );
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
                federal_tax_number: client.federal_tax_number || "",
                provincial_tax_number: client.provincial_tax_number || "",
                active: client.active
            }
        );
        setBulkActiveChoice(
            client.active ?
                "true" :
                "false"
        );
        setStatus("");
        setError("");
        setIsModalOpen(true);

    }


    function toggleClientSelection(
        clientId: number
    ) {

        setSelectedClientIds(
            currentIds =>
                currentIds.includes(clientId) ?
                    currentIds.filter(
                        currentId =>
                            currentId !== clientId
                    ) :
                    [
                        ...currentIds,
                        clientId
                    ]
        );

    }


    function toggleVisibleClients() {

        setSelectedClientIds(
            currentIds => {
                if (allVisibleSelected) {
                    return currentIds.filter(
                        clientId =>
                            !filteredClients.some(
                                client =>
                                    client.id === clientId
                            )
                    );
                }

                return [
                    ...new Set(
                        [
                            ...currentIds,
                            ...filteredClients.map(
                                client =>
                                    client.id
                            )
                        ]
                    )
                ];
            }
        );

    }


    function openSelectedClients() {

        if (selectedClients.length === 0)
            return;

        setStatus("");
        setError("");

        if (selectedClients.length === 1) {
            openEditClient(
                selectedClients[0]
            );
            return;
        }

        setEditingClient(null);
        setForm(
            {
                name: "",
                client_type_id: getUniformValue(
                    selectedClients,
                    client =>
                        client.client_type_id
                ),
                phone: getUniformValue(
                    selectedClients,
                    client =>
                        client.phone
                ) || "",
                fax: getUniformValue(
                    selectedClients,
                    client =>
                        client.fax
                ) || "",
                mobile: getUniformValue(
                    selectedClients,
                    client =>
                        client.mobile
                ) || "",
                billing_address: getUniformValue(
                    selectedClients,
                    client =>
                        client.billing_address
                ) || "",
                billing_postal_code: getUniformValue(
                    selectedClients,
                    client =>
                        client.billing_postal_code
                ) || "",
                rbq: getUniformValue(
                    selectedClients,
                    client =>
                        client.rbq
                ) || "",
                federal_tax_number: getUniformValue(
                    selectedClients,
                    client =>
                        client.federal_tax_number
                ) || "",
                provincial_tax_number: getUniformValue(
                    selectedClients,
                    client =>
                        client.provincial_tax_number
                ) || "",
                active: true
            }
        );
        setBulkActiveChoice(
            getUniformValue(
                selectedClients,
                client =>
                    client.active
            ) === null ?
                "" :
                (
                    getUniformValue(
                        selectedClients,
                        client =>
                            client.active
                    ) ?
                        "true" :
                        "false"
                )
        );
        setIsModalOpen(true);

    }


    function closeModal() {

        setIsModalOpen(false);
        setEditingClient(null);
        setForm(EMPTY_CLIENT);
        setBulkActiveChoice("");

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
            rbq: form.rbq.trim(),
            federal_tax_number: form.federal_tax_number.trim(),
            provincial_tax_number: form.provincial_tax_number.trim()
        };

        const request =
            editingClient ?
                updateClient(
                    editingClient.id,
                    payload
                ) :
                selectedClients.length > 1 ?
                    bulkUpdateClients(
                        {
                            client_ids: selectedClients.map(
                                client =>
                                    client.id
                            ),
                            ...(form.client_type_id !== null ? {
                                client_type_id: form.client_type_id
                            } : {}),
                            ...(form.phone.trim() ? {
                                phone: form.phone.trim()
                            } : {}),
                            ...(form.fax.trim() ? {
                                fax: form.fax.trim()
                            } : {}),
                            ...(form.mobile.trim() ? {
                                mobile: form.mobile.trim()
                            } : {}),
                            ...(form.billing_address.trim() ? {
                                billing_address: form.billing_address.trim()
                            } : {}),
                            ...(form.billing_postal_code.trim() ? {
                                billing_postal_code: form.billing_postal_code.trim()
                            } : {}),
                            ...(form.rbq.trim() ? {
                                rbq: form.rbq.trim()
                            } : {}),
                            ...(form.federal_tax_number.trim() ? {
                                federal_tax_number: form.federal_tax_number.trim()
                            } : {}),
                            ...(form.provincial_tax_number.trim() ? {
                                provincial_tax_number: form.provincial_tax_number.trim()
                            } : {}),
                            ...(bulkActiveChoice === "" ? {} : {
                                active: bulkActiveChoice === "true"
                            })
                        }
                    ) :
                    createClient(payload);

        request
            .then(
                () => {
                    setStatus(
                        editingClient ?
                            "Client sauvegardé." :
                            selectedClients.length > 1 ?
                                "Clients sauvegardés." :
                                "Client créé."
                    );
                    closeModal();
                    setSelectedClientIds([]);
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
                <button
                    type="button"
                    onClick={openSelectedClients}
                    disabled={selectedClients.length === 0}
                >
                    Modifier
                </button>
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
                {selectedClientIds.length > 0 && (
                    <div className="business-summary selection">
                        <strong>{selectedClientIds.length}</strong>
                        <span>sélectionnés</span>
                    </div>
                )}
            </div>

            {status && (
                <div className="business-status">{status}</div>
            )}

            {error && (
                <div className="business-error">{error}</div>
            )}

            <div className="business-column-toolbar">
                <ColumnMenu
                    columns={CLIENT_DISPLAY_FIELDS}
                    visibleColumns={clientColumns.visibleColumns}
                    isColumnVisible={clientColumns.isColumnVisible}
                    toggleColumn={clientColumns.toggleColumn}
                />
            </div>

            <div className="business-table-wrap">
                <table className="business-table clients-table">
                    <thead>
                        <tr>
                            <th className="clients-select-cell">
                                <input
                                    ref={selectAllRef}
                                    type="checkbox"
                                    checked={allVisibleSelected}
                                    onChange={toggleVisibleClients}
                                    aria-label="Sélectionner tous les clients visibles"
                                />
                            </th>
                            {clientColumns.isColumnVisible("name") && (
                                <th>Nom</th>
                            )}
                            {clientColumns.isColumnVisible("type") && (
                                <th>Type</th>
                            )}
                            {clientColumns.isColumnVisible("phone") && (
                                <th>Téléphone</th>
                            )}
                            {clientColumns.isColumnVisible("fax") && (
                                <th>Fax</th>
                            )}
                            {clientColumns.isColumnVisible("mobile") && (
                                <th>Mobile</th>
                            )}
                            {clientColumns.isColumnVisible("billing_address") && (
                                <th>Adresse</th>
                            )}
                            {clientColumns.isColumnVisible("billing_postal_code") && (
                                <th>Code postal</th>
                            )}
                            {clientColumns.isColumnVisible("rbq") && (
                                <th>RBQ</th>
                            )}
                            {clientColumns.isColumnVisible("federal_tax_number") && (
                                <th>Taxes fédérales</th>
                            )}
                            {clientColumns.isColumnVisible("provincial_tax_number") && (
                                <th>Taxes provinciales</th>
                            )}
                            {clientColumns.isColumnVisible("project_count") && (
                                <th>Projets</th>
                            )}
                            {clientColumns.isColumnVisible("active") && (
                                <th>État</th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr>
                                <td colSpan={visibleClientColumnCount}>Chargement...</td>
                            </tr>
                        ) : filteredClients.length === 0 ? (
                            <tr>
                                <td colSpan={visibleClientColumnCount}>Aucun client.</td>
                            </tr>
                        ) : (
                            filteredClients.map(
                                client => (
                                    <tr key={client.id}>
                                        <td className="clients-select-cell">
                                            <input
                                                type="checkbox"
                                                checked={selectedClientIds.includes(client.id)}
                                                onChange={
                                                    () =>
                                                        toggleClientSelection(
                                                            client.id
                                                        )
                                                }
                                                aria-label={`Sélectionner ${client.name}`}
                                            />
                                        </td>
                                        {clientColumns.isColumnVisible("name") && (
                                            <td>{client.name}</td>
                                        )}
                                        {clientColumns.isColumnVisible("type") && (
                                            <td>{client.client_type_name || "-"}</td>
                                        )}
                                        {clientColumns.isColumnVisible("phone") && (
                                            <td>{client.phone || "-"}</td>
                                        )}
                                        {clientColumns.isColumnVisible("fax") && (
                                            <td>{client.fax || "-"}</td>
                                        )}
                                        {clientColumns.isColumnVisible("mobile") && (
                                            <td>{client.mobile || "-"}</td>
                                        )}
                                        {clientColumns.isColumnVisible("billing_address") && (
                                            <td>{client.billing_address || "-"}</td>
                                        )}
                                        {clientColumns.isColumnVisible("billing_postal_code") && (
                                            <td>{client.billing_postal_code || "-"}</td>
                                        )}
                                        {clientColumns.isColumnVisible("rbq") && (
                                            <td>{client.rbq || "-"}</td>
                                        )}
                                        {clientColumns.isColumnVisible("federal_tax_number") && (
                                            <td>{client.federal_tax_number || "-"}</td>
                                        )}
                                        {clientColumns.isColumnVisible("provincial_tax_number") && (
                                            <td>{client.provincial_tax_number || "-"}</td>
                                        )}
                                        {clientColumns.isColumnVisible("project_count") && (
                                            <td>{client.project_count}</td>
                                        )}
                                        {clientColumns.isColumnVisible("active") && (
                                            <td>
                                                <span className={
                                                    client.active ?
                                                        "business-pill active" :
                                                        "business-pill inactive"
                                                }>
                                                    {client.active ? "Actif" : "Inactif"}
                                                </span>
                                            </td>
                                        )}
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
                                {editingClient ?
                                    "Modifier client" :
                                    selectedClients.length > 1 ?
                                        `Modifier ${selectedClients.length} clients` :
                                        "Ajouter client"}
                            </h2>
                            <button
                                type="button"
                                onClick={closeModal}
                            >
                                Fermer
                            </button>
                        </header>

                        <div className="business-form-grid compact">
                            {selectedClients.length <= 1 && (
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
                            )}

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
                                    <option value="">
                                        {selectedClients.length > 1 ?
                                            "Sans changement" :
                                            "Non classé"}
                                    </option>
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

                            {selectedClients.length > 1 ? (
                                <label className="business-field">
                                    <span>État</span>
                                    <select
                                        value={bulkActiveChoice}
                                        onChange={
                                            event =>
                                                setBulkActiveChoice(
                                                    event.target.value as "" | "true" | "false"
                                                )
                                        }
                                    >
                                        <option value="">Sans changement</option>
                                        <option value="true">Actif</option>
                                        <option value="false">Inactif</option>
                                    </select>
                                </label>
                            ) : (
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
                            )}

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

                            <label className="business-field">
                                <span>No taxes fédérales</span>
                                <input
                                    value={form.federal_tax_number}
                                    onChange={
                                        event =>
                                            setForm(
                                                {
                                                    ...form,
                                                    federal_tax_number: event.target.value
                                                }
                                            )
                                    }
                                />
                            </label>

                            <label className="business-field">
                                <span>No taxes provinciales</span>
                                <input
                                    value={form.provincial_tax_number}
                                    onChange={
                                        event =>
                                            setForm(
                                                {
                                                    ...form,
                                                    provincial_tax_number: event.target.value
                                                }
                                            )
                                    }
                                />
                            </label>
                        </div>

                        {selectedClients.length > 1 && (
                            <div className="business-muted-panel">
                                Les valeurs saisies seront appliquées à tous les clients sélectionnés. Les champs laissés vides ne seront pas modifiés.
                            </div>
                        )}

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
