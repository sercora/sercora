import {
    useEffect,
    useMemo,
    useState
} from "react";

import { API_URL } from "../utils/matrixApi";


type StatusTab = "operations" | "frontend" | "backend" | "commits";


type BacklogCommit = {
    hash: string;
    shortHash: string;
    date: string;
    refs: string;
    subject: string;
    category: string;
};


type OperationGroup = {
    title: string;
    summary: string;
};


type OperationsBacklog = {
    generatedAt: string;
    branch: string;
    head: BacklogCommit | null;
    commitCount: number;
    releases: string[];
    operationGroups: OperationGroup[];
    categoryCounts: Record<string, number>;
    commits: BacklogCommit[];
};


const STATUS_TABS: {
    key: StatusTab;
    label: string;
}[] = [
    {
        key: "operations",
        label: "Operations"
    },
    {
        key: "frontend",
        label: "Frontend"
    },
    {
        key: "backend",
        label: "Backend"
    },
    {
        key: "commits",
        label: "Commits / releases"
    }
];


function formatDateTime(
    value: string | null | undefined
) {

    if (!value)
        return "Non disponible";

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime()))
        return value;

    return parsed.toLocaleString(
        "fr-CA",
        {
            dateStyle: "medium",
            timeStyle: "short"
        }
    );

}


function OperationsStatusPage() {

    const [activeTab, setActiveTab] = useState<StatusTab>("operations");
    const [backlog, setBacklog] = useState<OperationsBacklog | null>(null);
    const [backlogError, setBacklogError] = useState("");
    const [backendStatus, setBackendStatus] = useState("Verification...");
    const [backendDetail, setBackendDetail] = useState("");

    useEffect(
        () => {
            fetch(
                "/operations-backlog.json",
                {
                    cache: "no-store"
                }
            )
                .then(
                    response => {
                        if (!response.ok)
                            throw new Error("Backlog non publie dans ce build.");

                        return response.json();
                    }
                )
                .then(setBacklog)
                .catch(
                    error => setBacklogError(
                        error instanceof Error ?
                            error.message :
                            "Impossible de charger le backlog."
                    )
                );
        },
        []
    );

    useEffect(
        () => {
            fetch(API_URL + "/health")
                .then(
                    response => {
                        if (!response.ok)
                            throw new Error("HTTP " + response.status);

                        return response.json();
                    }
                )
                .then(
                    payload => {
                        setBackendStatus("Operationnel");
                        setBackendDetail(JSON.stringify(payload));
                    }
                )
                .catch(
                    error => {
                        setBackendStatus("A verifier");
                        setBackendDetail(
                            error instanceof Error ?
                                error.message :
                                "Backend non joignable"
                        );
                    }
                );
        },
        []
    );

    const logLines = useMemo(
        () => {
            const lines = [
                "[frontend] Interface Sercora chargee dans le navigateur.",
                "[frontend] Build " + __SERCORA_BUILD_NUMBER__ + " publie le " + __SERCORA_BUILD_DATE__ + ".",
                "[backend] API health: " + backendStatus + " " + backendDetail,
                "[operations] Backlog: " + (
                    backlog ?
                        backlog.commitCount + " commits charges depuis " + backlog.branch + "." :
                        "chargement en cours."
                )
            ];

            if (backlog?.head)
                lines.push("[git] HEAD " + backlog.head.shortHash + " - " + backlog.head.subject);

            if (backlogError)
                lines.push("[erreur] " + backlogError);

            return lines;
        },
        [
            backendDetail,
            backendStatus,
            backlog,
            backlogError
        ]
    );

    return (
        <section className="auth-page configuration-page operations-status-page">
            <div className="profile-editor operations-status-shell">
                <div className="auth-section-heading">
                    <div>
                        <span className="eyebrow">Configuration</span>
                        <h2>Statut des operations</h2>
                    </div>
                    <span className="role-badge">
                        {backlog?.branch || "Build"}
                    </span>
                </div>

                <div className="operations-status-grid">
                    <div className="operations-status-card">
                        <span>Frontend</span>
                        <strong>Operationnel</strong>
                        <small>Build {__SERCORA_BUILD_NUMBER__}</small>
                    </div>
                    <div className="operations-status-card">
                        <span>Backend</span>
                        <strong>{backendStatus}</strong>
                        <small>{backendDetail || API_URL}</small>
                    </div>
                    <div className="operations-status-card">
                        <span>Commits</span>
                        <strong>{backlog?.commitCount || "..."}</strong>
                        <small>{backlog?.head?.shortHash || "Chargement"}</small>
                    </div>
                    <div className="operations-status-card">
                        <span>Releases</span>
                        <strong>{backlog?.releases.length || 0}</strong>
                        <small>{backlog?.releases[0] || "Aucune release"}</small>
                    </div>
                </div>

                <div className="operations-tabs">
                    {STATUS_TABS.map(
                        tab => (
                            <button
                                key={tab.key}
                                type="button"
                                className={
                                    activeTab === tab.key ?
                                        "active" :
                                        ""
                                }
                                onClick={
                                    () => setActiveTab(tab.key)
                                }
                            >
                                {tab.label}
                            </button>
                        )
                    )}
                </div>

                {activeTab === "operations" && (
                    <div className="operations-section">
                        <div className="operations-list">
                            {backlog?.operationGroups.map(
                                operation => (
                                    <article key={operation.title}>
                                        <h3>{operation.title}</h3>
                                        <p>{operation.summary}</p>
                                        <strong>
                                            {backlog.categoryCounts[operation.title] || 0} commit(s)
                                        </strong>
                                    </article>
                                )
                            )}
                        </div>
                    </div>
                )}

                {activeTab === "frontend" && (
                    <div className="operations-section operations-console">
                        <h3>Journal frontend</h3>
                        <pre>{logLines.join("\n")}</pre>
                    </div>
                )}

                {activeTab === "backend" && (
                    <div className="operations-section operations-console">
                        <h3>Journal backend</h3>
                        <pre>{[
                            "[api] URL: " + API_URL,
                            "[api] /health: " + backendStatus,
                            "[api] detail: " + (backendDetail || "En attente"),
                            "[database] PostgreSQL utilise par l'API Sercora.",
                            "[services] SMTP, VoIP/SMS, imports fournisseurs, NAS et Snipe-IT exposes via backend."
                        ].join("\n")}</pre>
                    </div>
                )}

                {activeTab === "commits" && (
                    <div className="operations-section">
                        <div className="operations-release-row">
                            <span>Genere le {formatDateTime(backlog?.generatedAt)}</span>
                            <span>Branche {backlog?.branch || "inconnue"}</span>
                            <span>Release {backlog?.releases.join(", ") || "aucune"}</span>
                        </div>

                        {backlogError && (
                            <div className="auth-error">
                                {backlogError}
                            </div>
                        )}

                        <div className="operations-commit-table">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Commit</th>
                                        <th>Categorie</th>
                                        <th>Operation</th>
                                        <th>Refs</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {backlog?.commits.map(
                                        commit => (
                                            <tr key={commit.hash}>
                                                <td>{commit.date}</td>
                                                <td>{commit.shortHash}</td>
                                                <td>{commit.category}</td>
                                                <td>{commit.subject}</td>
                                                <td>{commit.refs}</td>
                                            </tr>
                                        )
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );

}


export default OperationsStatusPage;
