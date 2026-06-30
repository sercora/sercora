import {
    useEffect,
    useMemo,
    useState
} from "react";
import type { FormEvent } from "react";

import {
    createContact,
    fetchContactOptions,
    fetchContactTasks,
    fetchContactTypes,
    fetchContacts,
    fetchSuppliers,
    updateSupplier,
    updateContact
} from "../utils/contactsApi";
import type {
    Contact,
    ContactInput,
    ContactOption,
    ContactOptions,
    ContactTask,
    ContactType,
    Supplier,
    SupplierInput
} from "../utils/contactsApi";

import "../styles/business.css";


const EMPTY_CONTACT: ContactInput = {
    contact_type_id: null,
    client_id: null,
    supplier_id: null,
    name: "",
    title: "",
    email: "",
    phone: "",
    mobile: "",
    active: true,
    task_ids: []
};


const EMPTY_SUPPLIER: SupplierInput = {
    name: "",
    federal_tax_number: "",
    provincial_tax_number: "",
    active: true
};


type ContactsPageProps = {
    defaultContactTypeCode?: "client" | "supplier" | null;
};


function ContactsPage({
    defaultContactTypeCode = null
}: ContactsPageProps) {

    const [contacts, setContacts] = useState<Contact[]>([]);
    const [contactTypes, setContactTypes] = useState<ContactType[]>([]);
    const [contactTasks, setContactTasks] = useState<ContactTask[]>([]);
    const [contactOptions, setContactOptions] = useState<ContactOptions>({
        clients: [],
        suppliers: []
    });
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [search, setSearch] = useState("");
    const [editingContact, setEditingContact] = useState<Contact | null>(null);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [form, setForm] = useState<ContactInput>(EMPTY_CONTACT);
    const [supplierForm, setSupplierForm] = useState<SupplierInput>(EMPTY_SUPPLIER);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isSupplierSaving, setIsSupplierSaving] = useState(false);
    const [status, setStatus] = useState("");
    const [error, setError] = useState("");

    const selectedType = useMemo(
        () =>
            contactTypes.find(
                contactType =>
                    contactType.id === form.contact_type_id
            ) || null,
        [
            contactTypes,
            form.contact_type_id
        ]
    );

    const companyOptions: ContactOption[] = useMemo(
        () => {
            if (selectedType?.code === "client")
                return contactOptions.clients;

            if (selectedType?.code === "supplier")
                return contactOptions.suppliers;

            return [];
        },
        [
            contactOptions,
            selectedType
        ]
    );

    const selectedCompanyId =
        selectedType?.code === "client" ?
            form.client_id :
            selectedType?.code === "supplier" ?
                form.supplier_id :
                null;

    const filteredContacts = useMemo(
        () => {
            const normalizedSearch = search.trim().toLowerCase();
            const normalizedType = defaultContactTypeCode
                ? defaultContactTypeCode.trim().toLowerCase()
                : "";

            return contacts.filter(
                contact =>
                    (
                        !normalizedType ||
                        contact.contact_type_code.toLowerCase() === normalizedType
                    ) &&
                    (
                        !normalizedSearch ||
                        [
                            contact.contact_type_name,
                            contact.client_name || contact.supplier_name || "",
                            contact.name,
                            contact.title || "",
                            contact.email || "",
                            contact.phone || "",
                            contact.mobile || "",
                            contact.tasks.map(task => task.name).join(" ")
                        ].some(
                            value =>
                                value.toLowerCase().includes(normalizedSearch)
                        )
                    )
            );
        },
        [
            contacts,
            search,
            defaultContactTypeCode
        ]
    );

    const summaryLabel = defaultContactTypeCode === "supplier" ? "fournisseurs" : "contacts";
    const filteredSuppliers = useMemo(
        () => {
            const normalizedSearch = search.trim().toLowerCase();

            if (defaultContactTypeCode !== "supplier")
                return [];

            return suppliers.filter(
                supplier =>
                    !normalizedSearch ||
                    [
                        supplier.name,
                        supplier.federal_tax_number,
                        supplier.provincial_tax_number
                    ].some(
                        value =>
                            value.toLowerCase().includes(normalizedSearch)
                    )
            );
        },
        [
            defaultContactTypeCode,
            search,
            suppliers
        ]
    );


    function loadContacts() {

        setIsLoading(true);
        setError("");

        Promise.all(
            [
                fetchContacts(),
                fetchContactTypes(),
                fetchContactTasks(),
                fetchContactOptions(),
                fetchSuppliers()
            ]
        )

        .then(
            ([
                nextContacts,
                nextTypes,
                nextTasks,
                nextOptions,
                nextSuppliers
            ]) => {
                setContacts(nextContacts);
                setContactTypes(nextTypes);
                setContactTasks(nextTasks);
                setContactOptions(nextOptions);
                setSuppliers(nextSuppliers);
            }
        )

        .catch(
            () =>
                setError("Impossible de charger les contacts.")
        )

        .finally(
            () =>
                setIsLoading(false)
        );

    }


    function openNewContact() {

        setEditingContact(null);
        setForm(EMPTY_CONTACT);
        setStatus("");
        setError("");
        setIsModalOpen(true);

    }


    function openEditContact(
        contact: Contact
    ) {

        setEditingContact(contact);
        setForm(
            {
                contact_type_id: contact.contact_type_id,
                client_id: contact.client_id,
                supplier_id: contact.supplier_id,
                name: contact.name,
                title: contact.title || "",
                email: contact.email || "",
                phone: contact.phone || "",
                mobile: contact.mobile || "",
                active: contact.active,
                task_ids: contact.tasks.map(
                    task =>
                        task.id
                )
            }
        );
        setStatus("");
        setError("");
        setIsModalOpen(true);

    }


    function closeModal() {

        setIsModalOpen(false);
        setEditingContact(null);
        setForm(EMPTY_CONTACT);

    }


    function openSupplierEditor(
        supplier: Supplier
    ) {

        setEditingSupplier(supplier);
        setSupplierForm(
            {
                name: supplier.name || "",
                federal_tax_number: supplier.federal_tax_number || "",
                provincial_tax_number: supplier.provincial_tax_number || "",
                active: supplier.active
            }
        );
        setStatus("");
        setError("");
        setIsSupplierModalOpen(true);

    }


    function closeSupplierModal() {

        setIsSupplierModalOpen(false);
        setEditingSupplier(null);
        setSupplierForm(EMPTY_SUPPLIER);

    }


    function saveSupplier(
        event: FormEvent<HTMLFormElement>
    ) {

        event.preventDefault();

        if (!editingSupplier)
            return;

        setIsSupplierSaving(true);
        setStatus("");
        setError("");

        updateSupplier(
            editingSupplier.id,
            {
                name: supplierForm.name.trim(),
                federal_tax_number: supplierForm.federal_tax_number.trim(),
                provincial_tax_number: supplierForm.provincial_tax_number.trim(),
                active: supplierForm.active
            }
        )
        .then(
            () => {
                setStatus("Fournisseur sauvegardé.");
                closeSupplierModal();
                loadContacts();
            }
        )
        .catch(
            error => {
                setError(
                    error instanceof Error ?
                        error.message :
                        "Impossible de sauvegarder le fournisseur."
                );
            }
        )
        .finally(
            () =>
                setIsSupplierSaving(false)
        );

    }


    function toggleTask(
        taskId: number
    ) {

        setForm(
            current =>
                ({
                    ...current,
                    task_ids: current.task_ids.includes(taskId) ?
                        current.task_ids.filter(
                            currentId =>
                                currentId !== taskId
                        ) :
                        [
                            ...current.task_ids,
                            taskId
                        ]
                })
        );

    }


    function handleContactTypeChange(
        nextContactTypeId: number | null
    ) {

        const nextContactType = contactTypes.find(
            contactType =>
                contactType.id === nextContactTypeId
        );

        setForm(
            current =>
                ({
                    ...current,
                    contact_type_id: nextContactTypeId,
                    client_id: nextContactType?.code === "client" ? current.client_id : null,
                    supplier_id: nextContactType?.code === "supplier" ? current.supplier_id : null
                })
        );

    }


    function saveContact(
        event: FormEvent<HTMLFormElement>
    ) {

        event.preventDefault();
        setIsSaving(true);
        setStatus("");
        setError("");

        const payload: ContactInput = {
            ...form,
            name: form.name.trim(),
            title: form.title.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
            mobile: form.mobile.trim(),
            client_id: selectedType?.code === "client" ? form.client_id : null,
            supplier_id: selectedType?.code === "supplier" ? form.supplier_id : null,
            task_ids: Array.from(new Set(form.task_ids))
        };

        if (!payload.contact_type_id) {
            setError("Le type de contact est requis.");
            setIsSaving(false);
            return;
        }

        if (selectedType?.code === "client" && !payload.client_id) {
            setError("Le client lié est requis.");
            setIsSaving(false);
            return;
        }

        if (selectedType?.code === "supplier" && !payload.supplier_id) {
            setError("Le fournisseur lié est requis.");
            setIsSaving(false);
            return;
        }

        const request =
            editingContact ?
                updateContact(
                    editingContact.id,
                    payload
                ) :
                createContact(payload);

        request
            .then(
                () => {
                    setStatus(
                        editingContact ?
                            "Contact sauvegardé." :
                            "Contact créé."
                    );
                    closeModal();
                    loadContacts();
                }
            )
            .catch(
                error => {
                    setError(
                        error instanceof Error ?
                            error.message :
                            "Impossible de sauvegarder le contact."
                    );
                }
            )
            .finally(
                () =>
                    setIsSaving(false)
            );

    }


    useEffect(
        loadContacts,
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
                    placeholder={
                        defaultContactTypeCode === "supplier" ?
                            "Rechercher un fournisseur, une société, un courriel ou une tâche" :
                            "Rechercher un contact, une société, un courriel ou une tâche"
                    }
                />
                <button
                    type="button"
                    onClick={openNewContact}
                >
                    {defaultContactTypeCode === "supplier" ? "Ajouter contact" : "Ajouter"}
                </button>
                <button
                    type="button"
                    onClick={loadContacts}
                    disabled={isLoading}
                >
                    Rafraîchir
                </button>
                <div className="business-summary">
                    <strong>
                        {defaultContactTypeCode === "supplier" ? filteredSuppliers.length : filteredContacts.length}
                    </strong>
                    <span>
                        {defaultContactTypeCode === "supplier" ? "fiches fournisseurs" : summaryLabel}
                    </span>
                </div>
            </div>

            {status && (
                <div className="business-status">{status}</div>
            )}

            {error && (
                <div className="business-error">{error}</div>
            )}

            {defaultContactTypeCode === "supplier" && (
                <section className="business-supplier-panel">
                    <div className="business-panel-heading">
                        <div>
                            <h2>Fiches fournisseurs</h2>
                            <span>No taxes fédérales et provinciales requis pour la facturation future</span>
                        </div>
                        <strong>{filteredSuppliers.length}</strong>
                    </div>
                    <div className="business-table-wrap compact">
                        <table className="business-table">
                            <thead>
                                <tr>
                                    <th>Fournisseur</th>
                                    <th>No taxes fédérales</th>
                                    <th>No taxes provinciales</th>
                                    <th>État</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSuppliers.length === 0 ? (
                                    <tr>
                                        <td colSpan={5}>Aucun fournisseur.</td>
                                    </tr>
                                ) : (
                                    filteredSuppliers.map(
                                        supplier => (
                                            <tr key={supplier.id}>
                                                <td>{supplier.name}</td>
                                                <td>{supplier.federal_tax_number || "-"}</td>
                                                <td>{supplier.provincial_tax_number || "-"}</td>
                                                <td>
                                                    <span className={
                                                        supplier.active ?
                                                            "business-pill active" :
                                                            "business-pill inactive"
                                                    }>
                                                        {supplier.active ? "Actif" : "Inactif"}
                                                    </span>
                                                </td>
                                                <td>
                                                    <button
                                                        type="button"
                                                        className="business-table-action"
                                                        onClick={
                                                            () =>
                                                                openSupplierEditor(supplier)
                                                        }
                                                    >
                                                        Modifier fiche
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    )
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {defaultContactTypeCode === "supplier" && (
                <div className="business-subsection-heading">
                    <h2>Contacts fournisseurs</h2>
                    <span>Personnes et tâches de transmission</span>
                </div>
            )}

            <div className="business-table-wrap">
                <table className="business-table contacts-table">
                    <thead>
                        <tr>
                            <th>Type</th>
                            <th>Entreprise</th>
                            <th>Contact</th>
                            <th>Tâches</th>
                            <th>Coordonnées</th>
                            <th>État</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr>
                                <td colSpan={7}>Chargement...</td>
                            </tr>
                        ) : filteredContacts.length === 0 ? (
                            <tr>
                                <td colSpan={7}>Aucun contact.</td>
                            </tr>
                        ) : (
                            filteredContacts.map(
                                contact => (
                                    <tr key={contact.id}>
                                        <td>{contact.contact_type_name}</td>
                                        <td>
                                            {contact.client_name || contact.supplier_name || "-"}
                                        </td>
                                        <td>
                                            <div>{contact.name}</div>
                                            {contact.title && (
                                                <span className="business-muted-line">
                                                    {contact.title}
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            {contact.tasks.length > 0 ? (
                                                contact.tasks.map(
                                                    task => (
                                                        <span
                                                            key={task.id}
                                                            className="business-tag"
                                                        >
                                                            {task.name}
                                                        </span>
                                                    )
                                                )
                                            ) : (
                                                "-"
                                            )}
                                        </td>
                                        <td>
                                            {contact.email || "-"}
                                            {contact.phone && (
                                                <span className="business-muted-line">
                                                    Tél: {contact.phone}
                                                </span>
                                            )}
                                            {contact.mobile && (
                                                <span className="business-muted-line">
                                                    Mobile: {contact.mobile}
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <span className={
                                                contact.active ?
                                                    "business-pill active" :
                                                    "business-pill inactive"
                                            }>
                                                {contact.active ? "Actif" : "Inactif"}
                                            </span>
                                        </td>
                                        <td>
                                            <button
                                                type="button"
                                                className="business-table-action"
                                                onClick={
                                                    () =>
                                                        openEditContact(contact)
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
                        className="business-modal contact-modal"
                        onSubmit={saveContact}
                    >
                        <header>
                            <h2>
                                {editingContact ? "Modifier contact" : "Ajouter contact"}
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
                                <span>Type</span>
                                <select
                                    value={form.contact_type_id || ""}
                                    onChange={
                                        event =>
                                            handleContactTypeChange(
                                                event.target.value ?
                                                    Number(event.target.value) :
                                                    null
                                            )
                                    }
                                >
                                    <option value="">Sélectionner</option>
                                    {contactTypes.map(
                                        contactType => (
                                            <option
                                                key={contactType.id}
                                                value={contactType.id}
                                            >
                                                {contactType.name}
                                            </option>
                                        )
                                    )}
                                </select>
                            </label>

                            {selectedType?.code === "client" && (
                                <label className="business-field wide">
                                    <span>Client</span>
                                    <select
                                        value={selectedCompanyId || ""}
                                        onChange={
                                            event =>
                                                setForm(
                                                    current =>
                                                        ({
                                                            ...current,
                                                            client_id: event.target.value ?
                                                                Number(event.target.value) :
                                                                null
                                                        })
                                                )
                                        }
                                    >
                                        <option value="">Sélectionner un client</option>
                                        {companyOptions.map(
                                            client => (
                                                <option
                                                    key={client.id}
                                                    value={client.id}
                                                >
                                                    {client.name}
                                                </option>
                                            )
                                        )}
                                    </select>
                                </label>
                            )}

                            {selectedType?.code === "supplier" && (
                                <label className="business-field wide">
                                    <span>Fournisseur</span>
                                    <select
                                        value={selectedCompanyId || ""}
                                        onChange={
                                            event =>
                                                setForm(
                                                    current =>
                                                        ({
                                                            ...current,
                                                            supplier_id: event.target.value ?
                                                                Number(event.target.value) :
                                                                null
                                                        })
                                                )
                                        }
                                    >
                                        <option value="">Sélectionner un fournisseur</option>
                                        {companyOptions.map(
                                            supplier => (
                                                <option
                                                    key={supplier.id}
                                                    value={supplier.id}
                                                >
                                                    {supplier.name}
                                                </option>
                                            )
                                        )}
                                    </select>
                                </label>
                            )}

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
                                <span>Poste</span>
                                <input
                                    value={form.title}
                                    onChange={
                                        event =>
                                            setForm(
                                                {
                                                    ...form,
                                                    title: event.target.value
                                                }
                                            )
                                    }
                                />
                            </label>

                            <label className="business-field">
                                <span>Courriel</span>
                                <input
                                    value={form.email}
                                    onChange={
                                        event =>
                                            setForm(
                                                {
                                                    ...form,
                                                    email: event.target.value
                                                }
                                            )
                                    }
                                />
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
                        </div>

                        <div className="business-edit-section">
                            <div className="business-section-heading">
                                <h2>Tâches</h2>
                                <span>Transmission et suivi</span>
                            </div>
                            <div className="business-checkbox-grid contact-task-grid">
                                {contactTasks.map(
                                    task => (
                                        <label
                                            key={task.id}
                                            className="business-checkbox"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={form.task_ids.includes(task.id)}
                                                onChange={
                                                    () =>
                                                        toggleTask(task.id)
                                                }
                                            />
                                            <span>{task.name}</span>
                                        </label>
                                    )
                                )}
                            </div>
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
                            <span>Contact actif</span>
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

            {isSupplierModalOpen && editingSupplier && (
                <div className="business-modal-backdrop">
                    <form
                        className="business-modal contact-modal"
                        onSubmit={saveSupplier}
                    >
                        <header>
                            <h2>Modifier fiche fournisseur</h2>
                            <button
                                type="button"
                                onClick={closeSupplierModal}
                            >
                                Fermer
                            </button>
                        </header>

                        <div className="business-form-grid compact">
                            <label className="business-field wide">
                                <span>Fournisseur</span>
                                <input
                                    value={supplierForm.name}
                                    required
                                    onChange={
                                        event =>
                                            setSupplierForm(
                                                {
                                                    ...supplierForm,
                                                    name: event.target.value
                                                }
                                            )
                                    }
                                />
                            </label>

                            <label className="business-field">
                                <span>No taxes fédérales</span>
                                <input
                                    value={supplierForm.federal_tax_number}
                                    placeholder="TPS / GST"
                                    onChange={
                                        event =>
                                            setSupplierForm(
                                                {
                                                    ...supplierForm,
                                                    federal_tax_number: event.target.value
                                                }
                                            )
                                    }
                                />
                            </label>

                            <label className="business-field">
                                <span>No taxes provinciales</span>
                                <input
                                    value={supplierForm.provincial_tax_number}
                                    placeholder="TVQ / QST"
                                    onChange={
                                        event =>
                                            setSupplierForm(
                                                {
                                                    ...supplierForm,
                                                    provincial_tax_number: event.target.value
                                                }
                                            )
                                    }
                                />
                            </label>
                        </div>

                        <label className="business-checkbox">
                            <input
                                type="checkbox"
                                checked={supplierForm.active}
                                onChange={
                                    event =>
                                        setSupplierForm(
                                            {
                                                ...supplierForm,
                                                active: event.target.checked
                                            }
                                        )
                                }
                            />
                            <span>Fournisseur actif</span>
                        </label>

                        <footer>
                            <button
                                type="button"
                                onClick={closeSupplierModal}
                            >
                                Annuler
                            </button>
                            <button
                                type="submit"
                                disabled={isSupplierSaving}
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


export default ContactsPage;
