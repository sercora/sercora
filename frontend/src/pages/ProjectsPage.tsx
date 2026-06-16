import {
    useEffect,
    useState
} from "react";
import type { FormEvent } from "react";

import {
    createProject,
    fetchClients,
    fetchProjects
} from "../utils/businessApi";
import type {
    Client,
    ProjectInput,
    ProjectSummary
} from "../utils/businessApi";

import "../styles/business.css";


type ProjectsPageProps = {
    projectMenu: "En cours" | "Création";
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


function nullableValue(
    value: string
) {

    return value.trim() || null;

}


function ProjectsPage({
    projectMenu
}: ProjectsPageProps) {

    const [projects, setProjects] = useState<ProjectSummary[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [form, setForm] = useState<ProjectInput>(EMPTY_PROJECT);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [status, setStatus] = useState("");
    const [error, setError] = useState("");


    function loadProjects() {

        setIsLoading(true);
        setError("");

        fetchProjects("current")
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


    function saveProject(
        event: FormEvent<HTMLFormElement>
    ) {

        event.preventDefault();
        setIsSaving(true);
        setError("");
        setStatus("");

        createProject(
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
            }
        )
            .then(
                response => {
                    setStatus(
                        response.folder_status === "not_created" ?
                            "Projet créé. Arborescence NAS en attente du montage RW." :
                            "Projet créé."
                    );
                    setForm(EMPTY_PROJECT);
                    loadProjects();
                }
            )
            .catch(
                () =>
                    setError("Impossible de créer le projet.")
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

                        <label className="business-field wide">
                            <span>Arborescence modèle</span>
                            <input
                                value={form.source_template_path || ""}
                                placeholder="/NAS/Soumissions en cours/Sercora/Template"
                                onChange={
                                    event =>
                                        setForm(
                                            {
                                                ...form,
                                                source_template_path: event.target.value
                                            }
                                        )
                                }
                            />
                        </label>
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
                    <span>projets en cours</span>
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
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr>
                                <td colSpan={7}>Chargement...</td>
                            </tr>
                        ) : projects.length === 0 ? (
                            <tr>
                                <td colSpan={7}>Aucun projet en cours.</td>
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
                                    </tr>
                                )
                            )
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    );

}


export default ProjectsPage;
