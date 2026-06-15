import {
    useEffect,
    useState
} from "react";

import {
    fetchTools
} from "../utils/toolsApi";
import type {
    ToolAsset
} from "../utils/toolsApi";

import "../styles/tools.css";


function statusClass(
    tool: ToolAsset
) {

    const status =
        (
            tool.status_type ||
            tool.status
        ).toLowerCase();

    if (
        status.includes("deploy") ||
        status.includes("ready") ||
        status.includes("disponible")
    )
        return "available";

    if (
        status.includes("pending") ||
        status.includes("checkout") ||
        status.includes("assigned") ||
        tool.assigned_to
    )
        return "assigned";

    return "neutral";

}


function ToolsPage() {

    const [tools, setTools] = useState<ToolAsset[]>([]);
    const [query, setQuery] = useState("");
    const [submittedQuery, setSubmittedQuery] = useState("");
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState("");
    const [lastRefresh, setLastRefresh] = useState("");


    function applyToolsResponse(
        response: {
            total: number;
            rows: ToolAsset[];
        }
    ) {

        setTools(response.rows);
        setTotal(response.total);
        setLastRefresh(
            new Date().toLocaleString(
                "fr-CA",
                {
                    dateStyle: "short",
                    timeStyle: "short"
                }
            )
        );

    }


    function loadTools(
        search = submittedQuery
    ) {

        setIsLoading(true);
        setStatusMessage("");

        fetchTools(search)

        .then(
            applyToolsResponse
        )

        .catch(
            () => {

                setStatusMessage(
                    "Impossible de charger les outils depuis Snipe-IT."
                );

            }
        )

        .finally(
            () => {

                setIsLoading(false);

            }
        );

    }


    useEffect(

        () => {

            let isCurrent = true;

            fetchTools("")

            .then(
                response => {

                    if (isCurrent)
                        applyToolsResponse(response);

                }
            )

            .catch(
                () => {

                    if (isCurrent) {
                        setStatusMessage(
                            "Impossible de charger les outils depuis Snipe-IT."
                        );
                    }

                }
            )

            .finally(
                () => {

                    if (isCurrent)
                        setIsLoading(false);

                }
            );

            return () => {

                isCurrent = false;

            };

        },

        []

    );


    function submitSearch() {

        setSubmittedQuery(query);
        loadTools(query);

    }


    return (

        <section className="tools-page">

            <div className="tools-toolbar">

                <input
                    type="search"
                    value={query}
                    onChange={
                        event =>
                            setQuery(event.target.value)
                    }
                    onKeyDown={
                        event => {

                            if (event.key === "Enter")
                                submitSearch();

                        }
                    }
                    placeholder="Rechercher Snipe-IT"
                />

                <button
                    type="button"
                    onClick={submitSearch}
                    disabled={isLoading}
                >
                    Rechercher
                </button>

                <button
                    type="button"
                    onClick={
                        () =>
                            loadTools(submittedQuery)
                    }
                    disabled={isLoading}
                >
                    Rafraîchir
                </button>

                <div className="tools-summary">
                    <strong>{total}</strong>
                    <span>outils</span>
                    {lastRefresh && (
                        <span>
                            Maj {lastRefresh}
                        </span>
                    )}
                </div>

            </div>

            {statusMessage && (
                <div className="tools-alert">
                    {statusMessage}
                </div>
            )}

            <div className="tools-table-wrap">

                <table className="tools-table">
                    <thead>
                        <tr>
                            <th>Tag</th>
                            <th>Outil</th>
                            <th>Modèle</th>
                            <th>Série</th>
                            <th>Catégorie</th>
                            <th>Assigné à</th>
                            <th>Lieu</th>
                            <th>État</th>
                            <th>Mis à jour</th>
                        </tr>
                    </thead>

                    <tbody>
                        {tools.map(
                            tool => (
                                <tr key={tool.id}>
                                    <td>{tool.asset_tag}</td>
                                    <td>{tool.name}</td>
                                    <td>
                                        {tool.manufacturer && (
                                            <span>{tool.manufacturer} </span>
                                        )}
                                        {tool.model}
                                    </td>
                                    <td>{tool.serial}</td>
                                    <td>{tool.category}</td>
                                    <td>{tool.assigned_to || "-"}</td>
                                    <td>{tool.location || "-"}</td>
                                    <td>
                                        <span
                                            className={
                                                "tool-status " +
                                                statusClass(tool)
                                            }
                                        >
                                            {tool.status || "-"}
                                        </span>
                                    </td>
                                    <td>{tool.updated_at}</td>
                                </tr>
                            )
                        )}
                    </tbody>
                </table>

                {!isLoading && tools.length === 0 && (
                    <div className="tools-empty">
                        Aucun outil trouvé.
                    </div>
                )}

                {isLoading && (
                    <div className="tools-empty">
                        Chargement...
                    </div>
                )}

            </div>

        </section>

    );

}


export default ToolsPage;
