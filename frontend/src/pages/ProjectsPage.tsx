import {
    useEffect,
    useRef,
    useState
} from "react";
import type { FormEvent } from "react";

import {
    createProjectWithFiles,
    fetchClients,
    fetchProjects,
    updateProjectCurrent
} from "../utils/businessApi";
import type {
    Client,
    ProjectInput,
    ProjectSummary
} from "../utils/businessApi";

import "../styles/business.css";


type ProjectsPageProps = {
    projectMenu: "En cours" | "En Soumission" | "Création";
};


const EMPTY_PROJECT: ProjectInput = {
    project_number: null,
    project_name: "",
    status: "PENDING",
    client_id: null,
    address_line1: null,
    address_line2: null,
    city: null,
    province: "QC",
    postal_code: null,
    bid_due_date: null,
    start_date: null,
    end_date: null,
    architect_name: null,
    probable_schedule: null,
    source_template_path: null,
    warranty_years: 1,
    tile_holdback_percent: 10
};


type DirectoryFile = File & {
    webkitRelativePath?: string;
};


const EMPTY_ADDENDA = {
    name: "",
    date: "",
    plans: false,
    specs: false,
    description: ""
};


function nullableValue(
    value: string
) {

    return value.trim() || null;

}


function fileDisplayName(
    file: File
) {

    return (file as DirectoryFile).webkitRelativePath || file.name;

}


function ProjectsPage({
    projectMenu
}: ProjectsPageProps) {

    const msgInputRef = useRef<HTMLInputElement | null>(null);
    const editMsgInputRef = useRef<HTMLInputElement | null>(null);
    const folderInputRef = useRef<HTMLInputElement | null>(null);
    const [projects, setProjects] = useState<ProjectSummary[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [form, setForm] = useState<ProjectInput>(EMPTY_PROJECT);
    const [msgFiles, setMsgFiles] = useState<File[]>([]);
    const [editMsgFiles, setEditMsgFiles] = useState<File[]>([]);
    const [folderFiles, setFolderFiles] = useState<File[]>([]);
    const [editingProject, setEditingProject] = useState<ProjectSummary | null>(null);
    const [editBidDueDate, setEditBidDueDate] = useState("");
    const [editClientIds, setEditClientIds] = useState<number[]>([]);
    const [editInvitationClientId, setEditInvitationClientId] = useState<number | null>(null);
    const [editAddenda, setEditAddenda] = useState(EMPTY_ADDENDA);
    const [isMsgDragActive, setIsMsgDragActive] = useState(false);
    const [isEditMsgDragActive, setIsEditMsgDragActive] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditSaving, setIsEditSaving] = useState(false);
    const [status, setStatus] = useState("");
    const [error, setError] = useState("");


    function loadProjects() {

        setIsLoading(true);
        setError("");

        fetchProjects(
            projectMenu === "En Soumission" ?
                "submission" :
                "current"
        )
            .then(setProjects)
            .catch(
                () =>
                    setError("Impossible de charger les projets.")
            )
            .finally(
                () =>
                    setIsLoading(false)
            );

    }


    function loadClients() {

        fetchClients()
            .then(
                nextClients =>
                    setClients(
                        nextClients.filter(
                            client =>
                                client.active
                        )
                    )
            )
            .catch(
                () =>
                    setError("Impossible de charger les clients.")
            );

    }


    function addMsgFiles(
        files: FileList | File[]
    ) {

        const nextFiles = Array.from(files);
        const validFiles = nextFiles.filter(
            file =>
                file.name.toLowerCase().endsWith(".msg")
        );

        if (validFiles.length !== nextFiles.length) {
            setError("Seuls les fichiers .msg sont acceptés dans cette zone.");
        }

        if (validFiles.length > 0) {
            setMsgFiles(
                currentFiles => [
                    ...currentFiles,
                    ...validFiles
                ]
            );
        }

    }


    function addEditMsgFiles(
        files: FileList | File[]
    ) {

        const nextFiles = Array.from(files);
        const validFiles = nextFiles.filter(
            file =>
                file.name.toLowerCase().endsWith(".msg")
        );

        if (validFiles.length !== nextFiles.length) {
            setError("Seuls les fichiers .msg sont acceptés dans cette zone.");
        }

        if (validFiles.length > 0) {
            setEditMsgFiles(
                currentFiles => [
                    ...currentFiles,
                    ...validFiles
                ]
            );
        }

    }


    function openProjectEditor(
        project: ProjectSummary
    ) {

        setEditingProject(project);
        setEditBidDueDate(project.bid_due_date || "");
        setEditClientIds(project.client_ids || []);
        setEditInvitationClientId(project.client_ids?.[0] || null);
        setEditMsgFiles([]);
        setEditAddenda(EMPTY_ADDENDA);
        setStatus("");
        setError("");

        if (editMsgInputRef.current)
            editMsgInputRef.current.value = "";

    }


    function toggleEditClient(
        clientId: number
    ) {

        setEditClientIds(
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

        setEditInvitationClientId(
            currentClientId =>
                currentClientId === clientId ?
                    null :
                    currentClientId || clientId
        );

    }


    function saveProjectEdit(
        event: FormEvent<HTMLFormElement>
    ) {

        event.preventDefault();

        if (!editingProject)
            return;

        setIsEditSaving(true);
        setError("");
        setStatus("");

        updateProjectCurrent(
            editingProject.id,
            {
                bid_due_date: editBidDueDate || null,
                client_ids: editClientIds,
                invitation_client_id: editInvitationClientId,
                msgFiles: editMsgFiles,
                addenda: editAddenda
            }
        )
            .then(
                response => {
                    setStatus(
                        "Projet modifié. Révision 0 " +
                        (
                            response.revision_zero_created ?
                                "créée" :
                                "déjà existante"
                        ) +
                        `. ${response.msg_file_count} courriel(s) ajouté(s).`
                    );
                    setEditingProject(null);
                    setEditMsgFiles([]);
                    setEditAddenda(EMPTY_ADDENDA);

                    if (editMsgInputRef.current)
                        editMsgInputRef.current.value = "";

                    loadProjects();
                }
            )
            .catch(
                error =>
                    setError(
                        error instanceof Error ?
                            error.message :
                            "Impossible de modifier le projet."
                    )
            )
            .finally(
                () =>
                    setIsEditSaving(false)
            );

    }


    function browseUploadFolder() {

        if (!folderInputRef.current)
            return;

        folderInputRef.current.setAttribute("webkitdirectory", "");
        folderInputRef.current.setAttribute("directory", "");
        folderInputRef.current.click();

    }


    function saveProject(
        event: FormEvent<HTMLFormElement>
    ) {

        event.preventDefault();
        setIsSaving(true);
        setError("");
        setStatus("");

        createProjectWithFiles(
            {
                ...form,
                project_number: nullableValue(form.project_number || ""),
                project_name: form.project_name.trim(),
                address_line1: nullableValue(form.address_line1 || ""),
                address_line2: nullableValue(form.address_line2 || ""),
                city: nullableValue(form.city || ""),
                province: nullableValue(form.province || ""),
                postal_code: nullableValue(form.postal_code || ""),
                architect_name: nullableValue(form.architect_name || ""),
                probable_schedule: nullableValue(form.probable_schedule || ""),
                source_template_path: nullableValue(form.source_template_path || "")
            },
            msgFiles,
            folderFiles
        )
            .then(
                response => {
                    setStatus(
                        `Projet créé dans ${response.folder_name}. ` +
                        `${response.msg_file_count || 0} courriel(s), ` +
                        `${response.upload_file_count || 0} fichier(s) téléversé(s).`
                    );
                    setForm(EMPTY_PROJECT);
                    setMsgFiles([]);
                    setFolderFiles([]);

                    if (msgInputRef.current)
                        msgInputRef.current.value = "";

                    if (folderInputRef.current)
                        folderInputRef.current.value = "";

                    loadProjects();
                }
            )
            .catch(
                error =>
                    setError(
                        error instanceof Error ?
                            error.message :
                            "Impossible de créer le projet."
                    )
            )
            .finally(
                () =>
                    setIsSaving(false)
            );

    }


    useEffect(
        () => {
            loadProjects();
            loadClients();
        },
        []
    );


    if (projectMenu === "Création") {
        return (
            <section className="business-page">
                <form
                    className="project-create"
                    onSubmit={saveProject}
                >
                    <div className="business-section-heading">
                        <div>
                            <span>Projets</span>
                            <h2>Création</h2>
                        </div>
                        <button
                            type="submit"
                            disabled={isSaving}
                        >
                            Créer projet
                        </button>
                    </div>

                    {status && (
                        <div className="business-status">{status}</div>
                    )}
                    {error && (
                        <div className="business-error">{error}</div>
                    )}

                    <div className="business-form-grid">
                        <label className="business-field">
                            <span>No projet</span>
                            <input
                                value={form.project_number || ""}
                                onChange={
                                    event =>
                                        setForm(
                                            {
                                                ...form,
                                                project_number: event.target.value
                                            }
                                        )
                                }
                            />
                        </label>

                        <label className="business-field wide">
                            <span>Nom du projet</span>
                            <input
                                value={form.project_name}
                                required
                                onChange={
                                    event =>
                                        setForm(
                                            {
                                                ...form,
                                                project_name: event.target.value
                                            }
                                        )
                                }
                            />
                        </label>

                        <label className="business-field">
                            <span>Client</span>
                            <select
                                value={form.client_id || ""}
                                onChange={
                                    event =>
                                        setForm(
                                            {
                                                ...form,
                                                client_id:
                                                    event.target.value ?
                                                        Number(event.target.value) :
                                                        null
                                            }
                                        )
                                }
                            >
                                <option value="">Aucun client</option>
                                {clients.map(
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

                        <label className="business-field">
                            <span>Date dépôt</span>
                            <input
                                type="date"
                                value={form.bid_due_date || ""}
                                onChange={
                                    event =>
                                        setForm(
                                            {
                                                ...form,
                                                bid_due_date: event.target.value || null
                                            }
                                        )
                                }
                            />
                        </label>

                        <label className="business-field wide">
                            <span>Adresse</span>
                            <input
                                value={form.address_line1 || ""}
                                onChange={
                                    event =>
                                        setForm(
                                            {
                                                ...form,
                                                address_line1: event.target.value
                                            }
                                        )
                                }
                            />
                        </label>

                        <label className="business-field">
                            <span>Ville</span>
                            <input
                                value={form.city || ""}
                                onChange={
                                    event =>
                                        setForm(
                                            {
                                                ...form,
                                                city: event.target.value
                                            }
                                        )
                                }
                            />
                        </label>

                        <label className="business-field">
                            <span>Province</span>
                            <input
                                value={form.province || ""}
                                onChange={
                                    event =>
                                        setForm(
                                            {
                                                ...form,
                                                province: event.target.value
                                            }
                                        )
                                }
                            />
                        </label>

                        <label className="business-field">
                            <span>Code postal</span>
                            <input
                                value={form.postal_code || ""}
                                onChange={
                                    event =>
                                        setForm(
                                            {
                                                ...form,
                                                postal_code: event.target.value
                                            }
                                        )
                                }
                            />
                        </label>

                        <label className="business-field">
                            <span>Début probable</span>
                            <input
                                type="date"
                                value={form.start_date || ""}
                                onChange={
                                    event =>
                                        setForm(
                                            {
                                                ...form,
                                                start_date: event.target.value || null
                                            }
                                        )
                                }
                            />
                        </label>

                        <label className="business-field">
                            <span>Fin probable</span>
                            <input
                                type="date"
                                value={form.end_date || ""}
                                onChange={
                                    event =>
                                        setForm(
                                            {
                                                ...form,
                                                end_date: event.target.value || null
                                            }
                                        )
                                }
                            />
                        </label>

                        <label className="business-field wide">
                            <span>Architecte</span>
                            <input
                                value={form.architect_name || ""}
                                onChange={
                                    event =>
                                        setForm(
                                            {
                                                ...form,
                                                architect_name: event.target.value
                                            }
                                        )
                                }
                            />
                        </label>
                    </div>

                    <div className="business-upload-grid">
                        <div
                            className={
                                "business-dropzone" +
                                (isMsgDragActive ? " dragging" : "")
                            }
                            onDragOver={
                                event => {
                                    event.preventDefault();
                                    setIsMsgDragActive(true);
                                }
                            }
                            onDragLeave={
                                () =>
                                    setIsMsgDragActive(false)
                            }
                            onDrop={
                                event => {
                                    event.preventDefault();
                                    setIsMsgDragActive(false);
                                    addMsgFiles(event.dataTransfer.files);
                                }
                            }
                        >
                            <div>
                                <span>Courriel Outlook</span>
                                <h3>Glisser un .msg</h3>
                            </div>
                            <button
                                type="button"
                                onClick={
                                    () =>
                                        msgInputRef.current?.click()
                                }
                            >
                                Parcourir .msg
                            </button>
                            <input
                                ref={msgInputRef}
                                className="business-hidden-input"
                                type="file"
                                accept=".msg"
                                multiple
                                onChange={
                                    event =>
                                        addMsgFiles(event.target.files || [])
                                }
                            />
                            {msgFiles.length > 0 && (
                                <ul className="business-file-list">
                                    {msgFiles.slice(0, 6).map(
                                        (file, index) => (
                                            <li key={`${file.name}-${index}`}>
                                                {file.name}
                                            </li>
                                        )
                                    )}
                                    {msgFiles.length > 6 && (
                                        <li>
                                            +{msgFiles.length - 6} autre(s)
                                        </li>
                                    )}
                                </ul>
                            )}
                        </div>

                        <div className="business-upload-panel">
                            <div>
                                <span>Dossier à téléverser</span>
                                <h3>Fichiers projet</h3>
                            </div>
                            <button
                                type="button"
                                onClick={browseUploadFolder}
                            >
                                Parcourir dossier
                            </button>
                            <input
                                ref={folderInputRef}
                                className="business-hidden-input"
                                type="file"
                                multiple
                                onChange={
                                    event =>
                                        setFolderFiles(
                                            Array.from(event.target.files || [])
                                        )
                                }
                            />
                            <div className="business-upload-count">
                                {folderFiles.length} fichier(s) sélectionné(s)
                            </div>
                            {folderFiles.length > 0 && (
                                <ul className="business-file-list">
                                    {folderFiles.slice(0, 6).map(
                                        (file, index) => (
                                            <li key={`${fileDisplayName(file)}-${index}`}>
                                                {fileDisplayName(file)}
                                            </li>
                                        )
                                    )}
                                    {folderFiles.length > 6 && (
                                        <li>
                                            +{folderFiles.length - 6} autre(s)
                                        </li>
                                    )}
                                </ul>
                            )}
                        </div>
                    </div>
                </form>
            </section>
        );
    }


    return (
        <section className="business-page">
            <div className="business-toolbar">
                <button
                    type="button"
                    onClick={loadProjects}
                    disabled={isLoading}
                >
                    Rafraîchir
                </button>
                <div className="business-summary">
                    <strong>{projects.length}</strong>
                    <span>
                        {projectMenu === "En Soumission" ?
                            "projets en soumission" :
                            "projets en cours"}
                    </span>
                </div>
            </div>

            {error && (
                <div className="business-error">{error}</div>
            )}

            <div className="business-table-wrap">
                <table className="business-table">
                    <thead>
                        <tr>
                            <th>No</th>
                            <th>Projet</th>
                            <th>Client</th>
                            <th>Adresse</th>
                            <th>Dépôt</th>
                            <th>Échéancier</th>
                            <th>Statut</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr>
                                <td colSpan={8}>Chargement...</td>
                            </tr>
                        ) : projects.length === 0 ? (
                            <tr>
                                <td colSpan={8}>Aucun projet en cours.</td>
                            </tr>
                        ) : (
                            projects.map(
                                project => (
                                    <tr key={project.id}>
                                        <td>{project.project_number || "-"}</td>
                                        <td>{project.project_name}</td>
                                        <td>{project.client_names || "-"}</td>
                                        <td>{project.address || "-"}</td>
                                        <td>{project.bid_due_date || "-"}</td>
                                        <td>
                                            {project.start_date || "-"}
                                            {" à "}
                                            {project.end_date || "-"}
                                        </td>
                                        <td>{project.status || "-"}</td>
                                        <td>
                                            <button
                                                type="button"
                                                className="business-table-action"
                                                onClick={
                                                    () =>
                                                        openProjectEditor(project)
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

            {editingProject && (
                <div className="business-modal-backdrop">
                    <form
                        className="business-modal project-edit-modal"
                        onSubmit={saveProjectEdit}
                    >
                        <header>
                            <div>
                                <span>Projet en cours</span>
                                <h2>Modifier</h2>
                            </div>
                            <button
                                type="button"
                                onClick={
                                    () =>
                                        setEditingProject(null)
                                }
                            >
                                Annuler
                            </button>
                        </header>

                        <div className="business-form-grid compact">
                            <label className="business-field wide">
                                <span>Projet</span>
                                <input
                                    value={editingProject.project_name}
                                    disabled
                                />
                            </label>

                            <label className="business-field">
                                <span>Date dépôt</span>
                                <input
                                    type="date"
                                    value={editBidDueDate}
                                    onChange={
                                        event =>
                                            setEditBidDueDate(event.target.value)
                                    }
                                />
                            </label>
                        </div>

                        <section className="business-edit-section">
                            <div className="business-section-heading">
                                <div>
                                    <span>Clients</span>
                                    <h2>Ajouter au projet</h2>
                                </div>
                            </div>
                            <div className="business-checkbox-grid">
                                {clients.map(
                                    client => (
                                        <label
                                            key={client.id}
                                            className="business-checkbox"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={editClientIds.includes(client.id)}
                                                onChange={
                                                    () =>
                                                        toggleEditClient(client.id)
                                                }
                                            />
                                            <span>{client.name}</span>
                                        </label>
                                    )
                                )}
                            </div>
                        </section>

                        <section className="business-edit-section">
                            <div className="business-section-heading">
                                <div>
                                    <span>Addenda</span>
                                    <h2>Ajouter une entrée</h2>
                                </div>
                            </div>
                            <div className="business-form-grid compact">
                                <label className="business-field">
                                    <span>Nom</span>
                                    <input
                                        value={editAddenda.name}
                                        onChange={
                                            event =>
                                                setEditAddenda(
                                                    {
                                                        ...editAddenda,
                                                        name: event.target.value
                                                    }
                                                )
                                        }
                                    />
                                </label>

                                <label className="business-field">
                                    <span>Date</span>
                                    <input
                                        type="date"
                                        value={editAddenda.date}
                                        onChange={
                                            event =>
                                                setEditAddenda(
                                                    {
                                                        ...editAddenda,
                                                        date: event.target.value
                                                    }
                                                )
                                        }
                                    />
                                </label>

                                <label className="business-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={editAddenda.plans}
                                        onChange={
                                            event =>
                                                setEditAddenda(
                                                    {
                                                        ...editAddenda,
                                                        plans: event.target.checked
                                                    }
                                                )
                                        }
                                    />
                                    <span>Plans</span>
                                </label>

                                <label className="business-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={editAddenda.specs}
                                        onChange={
                                            event =>
                                                setEditAddenda(
                                                    {
                                                        ...editAddenda,
                                                        specs: event.target.checked
                                                    }
                                                )
                                        }
                                    />
                                    <span>Devis</span>
                                </label>

                                <label className="business-field wide">
                                    <span>Incidences</span>
                                    <input
                                        value={editAddenda.description}
                                        onChange={
                                            event =>
                                                setEditAddenda(
                                                    {
                                                        ...editAddenda,
                                                        description: event.target.value
                                                    }
                                                )
                                        }
                                    />
                                </label>
                            </div>
                        </section>

                        <section
                            className={
                                "business-dropzone" +
                                (isEditMsgDragActive ? " dragging" : "")
                            }
                            onDragOver={
                                event => {
                                    event.preventDefault();
                                    setIsEditMsgDragActive(true);
                                }
                            }
                            onDragLeave={
                                () =>
                                    setIsEditMsgDragActive(false)
                            }
                            onDrop={
                                event => {
                                    event.preventDefault();
                                    setIsEditMsgDragActive(false);
                                    addEditMsgFiles(event.dataTransfer.files);
                                }
                            }
                        >
                            <div>
                                <span>Courriels clients</span>
                                <h3>Glisser des .msg</h3>
                            </div>
                            <label className="business-field">
                                <span>Client de l'invitation</span>
                                <select
                                    value={editInvitationClientId || ""}
                                    onChange={
                                        event =>
                                            setEditInvitationClientId(
                                                event.target.value ?
                                                    Number(event.target.value) :
                                                    null
                                            )
                                    }
                                >
                                    <option value="">Client non précisé</option>
                                    {clients.map(
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
                            <button
                                type="button"
                                onClick={
                                    () =>
                                        editMsgInputRef.current?.click()
                                }
                            >
                                Parcourir .msg
                            </button>
                            <input
                                ref={editMsgInputRef}
                                className="business-hidden-input"
                                type="file"
                                accept=".msg"
                                multiple
                                onChange={
                                    event =>
                                        addEditMsgFiles(event.target.files || [])
                                }
                            />
                            {editMsgFiles.length > 0 && (
                                <ul className="business-file-list">
                                    {editMsgFiles.map(
                                        (file, index) => (
                                            <li key={`${file.name}-${index}`}>
                                                {file.name}
                                            </li>
                                        )
                                    )}
                                </ul>
                            )}
                        </section>

                        <section className="business-edit-section">
                            <div className="business-section-heading">
                                <div>
                                    <span>Invitations</span>
                                    <h2>Clients reçus</h2>
                                </div>
                            </div>
                            {editingProject.invitations.length === 0 ? (
                                <div className="business-upload-count">
                                    Aucune invitation enregistrée.
                                </div>
                            ) : (
                                <ul className="business-invitation-list">
                                    {editingProject.invitations.map(
                                        invitation => (
                                            <li key={invitation.id}>
                                                <strong>
                                                    {invitation.client_name || "Client non précisé"}
                                                </strong>
                                                <span>
                                                    {invitation.invited_on || "-"}
                                                </span>
                                                <span>
                                                    {invitation.msg_filename}
                                                </span>
                                            </li>
                                        )
                                    )}
                                </ul>
                            )}
                        </section>

                        <footer>
                            <button
                                type="button"
                                onClick={
                                    () =>
                                        setEditingProject(null)
                                }
                            >
                                Annuler
                            </button>
                            <button
                                type="submit"
                                disabled={isEditSaving}
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


export default ProjectsPage;
