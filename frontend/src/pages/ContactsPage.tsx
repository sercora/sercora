import {
    useEffect,
    useMemo,
    useState
} from "react";
import type { FormEvent } from "react";

import ColumnMenu from "../components/ColumnMenu";
import {
    useColumnPreferences
} from "../hooks/useColumnPreferences";
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
    phone: "",
    fax: "",
    mobile: "",
    billing_address: "",
    billing_postal_code: "",
    email: "",
    contact_name: "",
    account_number: "",
    website: "",
    company_name: "",
    tax_identification_number: "",
    federal_tax_number: "",
    provincial_tax_number: "",
    active: true
};


type ContactsPageProps = {
    defaultContactTypeCode?: "client" | "supplier" | null;
};

type SupplierDisplayField =
    "name" |
    "company_name" |
    "contact_name" |
    "phone" |
    "fax" |
    "mobile" |
    "email" |
    "billing_address" |
    "billing_postal_code" |
    "account_number" |
    "website" |
    "tax_identification_number" |
    "federal_tax_number" |
    "provincial_tax_number" |
    "active";

type ContactDisplayField =
    "type" |
    "company" |
    "name" |
    "title" |
    "tasks" |
    "email" |
    "phone" |
    "mobile" |
    "active";


const SUPPLIER_DISPLAY_FIELDS: {
    id: SupplierDisplayField;
    label: string;
}[] = [
    {
        id: "name",
        label: "Fournisseur"
    },
    {
        id: "company_name",
        label: "Entreprise"
    },
    {
        id: "contact_name",
        label: "Contact principal"
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
        id: "email",
        label: "Courriel"
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
        id: "account_number",
        label: "No de compte"
    },
    {
        id: "website",
        label: "Site Web"
    },
    {
        id: "tax_identification_number",
        label: "Identification taxe"
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
        id: "active",
        label: "État"
    }
];


const CONTACT_DISPLAY_FIELDS: {
    id: ContactDisplayField;
    label: string;
}[] = [
    {
        id: "type",
        label: "Type"
    },
    {
        id: "company",
        label: "Entreprise"
    },
    {
        id: "name",
        label: "Contact"
    },
    {
        id: "title",
        label: "Poste"
    },
    {
        id: "tasks",
        label: "Tâches"
    },
    {
        id: "email",
        label: "Courriel"
    },
    {
        id: "phone",
        label: "Téléphone"
    },
    {
        id: "mobile",
        label: "Mobile"
    },
    {
        id: "active",
        label: "État"
    }
];


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
    const [selectedContactIds, setSelectedContactIds] = useState<number[]>([]);
    const [selectedSupplierIds, setSelectedSupplierIds] = useState<number[]>([]);
    const [form, setForm] = useState<ContactInput>(EMPTY_CONTACT);
    const [supplierForm, setSupplierForm] = useState<SupplierInput>(EMPTY_SUPPLIER);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isSupplierSaving, setIsSupplierSaving] = useState(false);
    const [status, setStatus] = useState("");
    const [error, setError] = useState("");
    const supplierColumns = useColumnPreferences(
        "columns.suppliers",
        SUPPLIER_DISPLAY_FIELDS
    );
    const contactColumns = useColumnPreferences(
        "columns.contacts",
        CONTACT_DISPLAY_FIELDS
    );

    const visibleSupplierFieldCount = supplierColumns.visibleColumns.length + 1;
    const visibleContactFieldCount = contactColumns.visibleColumns.length + 1;
    const selectedContacts = useMemo(
        () =>
            contacts.filter(
                contact =>
                    selectedContactIds.includes(contact.id)
            ),
        [
            contacts,
            selectedContactIds
        ]
    );
    const selectedSuppliers = useMemo(
        () =>
            suppliers.filter(
                supplier =>
                    selectedSupplierIds.includes(supplier.id)
            ),
        [
            suppliers,
            selectedSupplierIds
        ]
    );
    const selectedEditableCount =
        defaultContactTypeCode === "supplier" ?
            selectedSuppliers.length :
            selectedContacts.length;

    function toggleContactSelection(
        contactId: number
    ) {

        setSelectedSupplierIds([]);
        setSelectedContactIds(
            currentIds =>
                currentIds.includes(contactId) ?
                    [] :
                    [
                        contactId
                    ]
        );

    }


    function toggleSupplierSelection(
        supplierId: number
    ) {

        setSelectedContactIds([]);
        setSelectedSupplierIds(
            currentIds =>
                currentIds.includes(supplierId) ?
                    [] :
                    [
                        supplierId
                    ]
        );

    }


    function openSelectedEditable() {

        if (defaultContactTypeCode === "supplier" && selectedSuppliers.length === 1) {
            openSupplierEditor(selectedSuppliers[0]);
            return;
        }

        if (defaultContactTypeCode !== "supplier" && selectedContacts.length === 1)
            openEditContact(selectedContacts[0]);

    }

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
                        supplier.phone,
                        supplier.fax,
                        supplier.mobile,
                        supplier.billing_address,
                        supplier.billing_postal_code,
                        supplier.email,
                        supplier.contact_name,
                        supplier.account_number,
                        supplier.website,
                        supplier.company_name,
                        supplier.tax_identification_number,
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
        setSelectedContactIds([]);
        setSelectedSupplierIds([]);
        setForm(EMPTY_CONTACT);
        setStatus("");
        setError("");
        setIsModalOpen(true);

    }


    function openEditContact(
        contact: Contact
    ) {

        setEditingContact(contact);
        setSelectedContactIds(
            [
                contact.id
            ]
        );
        setSelectedSupplierIds([]);
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
        setSelectedSupplierIds(
            [
                supplier.id
            ]
        );
        setSelectedContactIds([]);
        setSupplierForm(
            {
                name: supplier.name || "",
                phone: supplier.phone || "",
                fax: supplier.fax || "",
                mobile: supplier.mobile || "",
                billing_address: supplier.billing_address || "",
                billing_postal_code: supplier.billing_postal_code || "",
                email: supplier.email || "",
                contact_name: supplier.contact_name || "",
                account_number: supplier.account_number || "",
                website: supplier.website || "",
                company_name: supplier.company_name || "",
                tax_identification_number: supplier.tax_identification_number || "",
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
                phone: supplierForm.phone.trim(),
                fax: supplierForm.fax.trim(),
                mobile: supplierForm.mobile.trim(),
                billing_address: supplierForm.billing_address.trim(),
                billing_postal_code: supplierForm.billing_postal_code.trim(),
                email: supplierForm.email.trim(),
                contact_name: supplierForm.contact_name.trim(),
                account_number: supplierForm.account_number.trim(),
                website: supplierForm.website.trim(),
                company_name: supplierForm.company_name.trim(),
                tax_identification_number: supplierForm.tax_identification_number.trim(),
                federal_tax_number: supplierForm.federal_tax_number.trim(),
                provincial_tax_number: supplierForm.provincial_tax_number.trim(),
                active: supplierForm.active
            }
        )
        .then(
            () => {
                setStatus("Fournisseur sauvegardé.");
                closeSupplierModal();
                setSelectedSupplierIds([]);
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
                    setSelectedContactIds([]);
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
                <button
                    type="button"
                    onClick={openSelectedEditable}
                    disabled={selectedEditableCount !== 1}
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
                    placeholder={
                        defaultContactTypeCode === "supplier" ?
                            "Rechercher un fournisseur, une société, un courriel ou un compte" :
                            "Rechercher un contact, une société, un courriel ou une tâche"
                    }
                />
                {defaultContactTypeCode !== "supplier" && (
                    <button
                        type="button"
                        onClick={openNewContact}
                    >
                        Ajouter
                    </button>
                )}
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
                {selectedEditableCount > 0 && (
                    <div className="business-summary selection">
                        <strong>{selectedEditableCount}</strong>
                        <span>sélectionné</span>
                    </div>
                )}
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
                            <span>Coordonnées, adresse et numéros de taxes pour la facturation future</span>
                        </div>
                        <strong>{filteredSuppliers.length}</strong>
                    </div>
                    <ColumnMenu
                        columns={SUPPLIER_DISPLAY_FIELDS}
                        visibleColumns={supplierColumns.visibleColumns}
                        isColumnVisible={supplierColumns.isColumnVisible}
                        toggleColumn={supplierColumns.toggleColumn}
                    />
                    <div className="business-table-wrap compact">
                        <table className="business-table">
                            <thead>
                                <tr>
                                    <th className="clients-select-cell"></th>
                                    {supplierColumns.isColumnVisible("name") && (
                                        <th>Fournisseur</th>
                                    )}
                                    {supplierColumns.isColumnVisible("company_name") && (
                                        <th>Entreprise</th>
                                    )}
                                    {supplierColumns.isColumnVisible("contact_name") && (
                                        <th>Contact principal</th>
                                    )}
                                    {supplierColumns.isColumnVisible("phone") && (
                                        <th>Téléphone</th>
                                    )}
                                    {supplierColumns.isColumnVisible("fax") && (
                                        <th>Fax</th>
                                    )}
                                    {supplierColumns.isColumnVisible("mobile") && (
                                        <th>Mobile</th>
                                    )}
                                    {supplierColumns.isColumnVisible("email") && (
                                        <th>Courriel</th>
                                    )}
                                    {supplierColumns.isColumnVisible("billing_address") && (
                                        <th>Adresse</th>
                                    )}
                                    {supplierColumns.isColumnVisible("billing_postal_code") && (
                                        <th>Code postal</th>
                                    )}
                                    {supplierColumns.isColumnVisible("account_number") && (
                                        <th>No de compte</th>
                                    )}
                                    {supplierColumns.isColumnVisible("website") && (
                                        <th>Site Web</th>
                                    )}
                                    {supplierColumns.isColumnVisible("tax_identification_number") && (
                                        <th>Identification taxe</th>
                                    )}
                                    {supplierColumns.isColumnVisible("federal_tax_number") && (
                                        <th>Taxes fédérales</th>
                                    )}
                                    {supplierColumns.isColumnVisible("provincial_tax_number") && (
                                        <th>Taxes provinciales</th>
                                    )}
                                    {supplierColumns.isColumnVisible("active") && (
                                        <th>État</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSuppliers.length === 0 ? (
                                    <tr>
                                        <td colSpan={visibleSupplierFieldCount}>Aucun fournisseur.</td>
                                    </tr>
                                ) : (
                                    filteredSuppliers.map(
                                        supplier => (
                                            <tr key={supplier.id}>
                                                <td className="clients-select-cell">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedSupplierIds.includes(supplier.id)}
                                                        onChange={
                                                            () =>
                                                                toggleSupplierSelection(supplier.id)
                                                        }
                                                        aria-label={`Sélectionner ${supplier.name}`}
                                                    />
                                                </td>
                                                {supplierColumns.isColumnVisible("name") && (
                                                    <td>{supplier.name}</td>
                                                )}
                                                {supplierColumns.isColumnVisible("company_name") && (
                                                    <td>{supplier.company_name || "-"}</td>
                                                )}
                                                {supplierColumns.isColumnVisible("contact_name") && (
                                                    <td>{supplier.contact_name || "-"}</td>
                                                )}
                                                {supplierColumns.isColumnVisible("phone") && (
                                                    <td>{supplier.phone || "-"}</td>
                                                )}
                                                {supplierColumns.isColumnVisible("fax") && (
                                                    <td>{supplier.fax || "-"}</td>
                                                )}
                                                {supplierColumns.isColumnVisible("mobile") && (
                                                    <td>{supplier.mobile || "-"}</td>
                                                )}
                                                {supplierColumns.isColumnVisible("email") && (
                                                    <td>{supplier.email || "-"}</td>
                                                )}
                                                {supplierColumns.isColumnVisible("billing_address") && (
                                                    <td>{supplier.billing_address || "-"}</td>
                                                )}
                                                {supplierColumns.isColumnVisible("billing_postal_code") && (
                                                    <td>{supplier.billing_postal_code || "-"}</td>
                                                )}
                                                {supplierColumns.isColumnVisible("account_number") && (
                                                    <td>{supplier.account_number || "-"}</td>
                                                )}
                                                {supplierColumns.isColumnVisible("website") && (
                                                    <td>{supplier.website || "-"}</td>
                                                )}
                                                {supplierColumns.isColumnVisible("tax_identification_number") && (
                                                    <td>{supplier.tax_identification_number || "-"}</td>
                                                )}
                                                {supplierColumns.isColumnVisible("federal_tax_number") && (
                                                    <td>{supplier.federal_tax_number || "-"}</td>
                                                )}
                                                {supplierColumns.isColumnVisible("provincial_tax_number") && (
                                                    <td>{supplier.provincial_tax_number || "-"}</td>
                                                )}
                                                {supplierColumns.isColumnVisible("active") && (
                                                    <td>
                                                        <span className={
                                                            supplier.active ?
                                                                "business-pill active" :
                                                                "business-pill inactive"
                                                        }>
                                                            {supplier.active ? "Actif" : "Inactif"}
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
                </section>
            )}

            {defaultContactTypeCode !== "supplier" && (
            <>
            <div className="business-column-toolbar">
                <ColumnMenu
                    columns={CONTACT_DISPLAY_FIELDS}
                    visibleColumns={contactColumns.visibleColumns}
                    isColumnVisible={contactColumns.isColumnVisible}
                    toggleColumn={contactColumns.toggleColumn}
                />
            </div>
            <div className="business-table-wrap">
                <table className="business-table contacts-table">
                    <thead>
                        <tr>
                            <th className="clients-select-cell"></th>
                            {contactColumns.isColumnVisible("type") && (
                                <th>Type</th>
                            )}
                            {contactColumns.isColumnVisible("company") && (
                                <th>Entreprise</th>
                            )}
                            {contactColumns.isColumnVisible("name") && (
                                <th>Contact</th>
                            )}
                            {contactColumns.isColumnVisible("title") && (
                                <th>Poste</th>
                            )}
                            {contactColumns.isColumnVisible("tasks") && (
                                <th>Tâches</th>
                            )}
                            {contactColumns.isColumnVisible("email") && (
                                <th>Courriel</th>
                            )}
                            {contactColumns.isColumnVisible("phone") && (
                                <th>Téléphone</th>
                            )}
                            {contactColumns.isColumnVisible("mobile") && (
                                <th>Mobile</th>
                            )}
                            {contactColumns.isColumnVisible("active") && (
                                <th>État</th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr>
                                <td colSpan={visibleContactFieldCount}>Chargement...</td>
                            </tr>
                        ) : filteredContacts.length === 0 ? (
                            <tr>
                                <td colSpan={visibleContactFieldCount}>Aucun contact.</td>
                            </tr>
                        ) : (
                            filteredContacts.map(
                                contact => (
                                    <tr key={contact.id}>
                                        <td className="clients-select-cell">
                                            <input
                                                type="checkbox"
                                                checked={selectedContactIds.includes(contact.id)}
                                                onChange={
                                                    () =>
                                                        toggleContactSelection(contact.id)
                                                }
                                                aria-label={`Sélectionner ${contact.name}`}
                                            />
                                        </td>
                                        {contactColumns.isColumnVisible("type") && (
                                            <td>{contact.contact_type_name}</td>
                                        )}
                                        {contactColumns.isColumnVisible("company") && (
                                            <td>{contact.client_name || contact.supplier_name || "-"}</td>
                                        )}
                                        {contactColumns.isColumnVisible("name") && (
                                            <td>{contact.name}</td>
                                        )}
                                        {contactColumns.isColumnVisible("title") && (
                                            <td>{contact.title || "-"}</td>
                                        )}
                                        {contactColumns.isColumnVisible("tasks") && (
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
                                        )}
                                        {contactColumns.isColumnVisible("email") && (
                                            <td>{contact.email || "-"}</td>
                                        )}
                                        {contactColumns.isColumnVisible("phone") && (
                                            <td>{contact.phone || "-"}</td>
                                        )}
                                        {contactColumns.isColumnVisible("mobile") && (
                                            <td>{contact.mobile || "-"}</td>
                                        )}
                                        {contactColumns.isColumnVisible("active") && (
                                            <td>
                                                <span className={
                                                    contact.active ?
                                                        "business-pill active" :
                                                        "business-pill inactive"
                                                }>
                                                    {contact.active ? "Actif" : "Inactif"}
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
            </>
            )}

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
                                <span>Entreprise</span>
                                <input
                                    value={supplierForm.company_name}
                                    onChange={
                                        event =>
                                            setSupplierForm(
                                                {
                                                    ...supplierForm,
                                                    company_name: event.target.value
                                                }
                                            )
                                    }
                                />
                            </label>

                            <label className="business-field">
                                <span>Contact principal</span>
                                <input
                                    value={supplierForm.contact_name}
                                    onChange={
                                        event =>
                                            setSupplierForm(
                                                {
                                                    ...supplierForm,
                                                    contact_name: event.target.value
                                                }
                                            )
                                    }
                                />
                            </label>

                            <label className="business-field">
                                <span>Courriel</span>
                                <input
                                    value={supplierForm.email}
                                    onChange={
                                        event =>
                                            setSupplierForm(
                                                {
                                                    ...supplierForm,
                                                    email: event.target.value
                                                }
                                            )
                                    }
                                />
                            </label>

                            <label className="business-field">
                                <span>Téléphone</span>
                                <input
                                    value={supplierForm.phone}
                                    onChange={
                                        event =>
                                            setSupplierForm(
                                                {
                                                    ...supplierForm,
                                                    phone: event.target.value
                                                }
                                            )
                                    }
                                />
                            </label>

                            <label className="business-field">
                                <span>Fax</span>
                                <input
                                    value={supplierForm.fax}
                                    onChange={
                                        event =>
                                            setSupplierForm(
                                                {
                                                    ...supplierForm,
                                                    fax: event.target.value
                                                }
                                            )
                                    }
                                />
                            </label>

                            <label className="business-field">
                                <span>Mobile</span>
                                <input
                                    value={supplierForm.mobile}
                                    onChange={
                                        event =>
                                            setSupplierForm(
                                                {
                                                    ...supplierForm,
                                                    mobile: event.target.value
                                                }
                                            )
                                    }
                                />
                            </label>

                            <label className="business-field">
                                <span>Code postal de facturation</span>
                                <input
                                    value={supplierForm.billing_postal_code}
                                    onChange={
                                        event =>
                                            setSupplierForm(
                                                {
                                                    ...supplierForm,
                                                    billing_postal_code: event.target.value
                                                }
                                            )
                                    }
                                />
                            </label>

                            <label className="business-field wide">
                                <span>Adresse de facturation</span>
                                <input
                                    value={supplierForm.billing_address}
                                    onChange={
                                        event =>
                                            setSupplierForm(
                                                {
                                                    ...supplierForm,
                                                    billing_address: event.target.value
                                                }
                                            )
                                    }
                                />
                            </label>

                            <label className="business-field">
                                <span>No de compte</span>
                                <input
                                    value={supplierForm.account_number}
                                    onChange={
                                        event =>
                                            setSupplierForm(
                                                {
                                                    ...supplierForm,
                                                    account_number: event.target.value
                                                }
                                            )
                                    }
                                />
                            </label>

                            <label className="business-field">
                                <span>Site Web</span>
                                <input
                                    value={supplierForm.website}
                                    onChange={
                                        event =>
                                            setSupplierForm(
                                                {
                                                    ...supplierForm,
                                                    website: event.target.value
                                                }
                                            )
                                    }
                                />
                            </label>

                            <label className="business-field">
                                <span>Identification taxe</span>
                                <input
                                    value={supplierForm.tax_identification_number}
                                    onChange={
                                        event =>
                                            setSupplierForm(
                                                {
                                                    ...supplierForm,
                                                    tax_identification_number: event.target.value
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
