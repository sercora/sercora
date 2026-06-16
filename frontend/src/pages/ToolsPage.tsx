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


type PageSize = 20 | 50 | 100 | "all";
type ToolSort = "asset_tag" | "location" | "name";


const DEFAULT_PAGE_SIZE = 20;
const ALL_PAGE_LIMIT = 10000;


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
    const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
    const [pageIndex, setPageIndex] = useState(0);
    const [sortBy, setSortBy] = useState<ToolSort>("asset_tag");
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [statusMessage, setStatusMessage] = useState("");
    const [lastRefresh, setLastRefresh] = useState("");

    const effectiveLimit =
        pageSize === "all" ?
            ALL_PAGE_LIMIT :
            pageSize;
    const pageCount =
        pageSize === "all" ?
            1 :
            Math.max(
                1,
                Math.ceil(total / effectiveLimit)
            );
    const currentOffset =
        pageSize === "all" ?
            0 :
            pageIndex * effectiveLimit;
    const firstResult =
        total === 0 ?
            0 :
            currentOffset + 1;
    const lastResult =
        Math.min(
            currentOffset + tools.length,
            total
        );
    const canGoPrevious =
        pageSize !== "all" &&
        pageIndex > 0;
    const canGoNext =
        pageSize !== "all" &&
        pageIndex + 1 < pageCount;


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
        search = submittedQuery,
        nextPageIndex = pageIndex,
        nextPageSize = pageSize,
        nextSortBy = sortBy
    ) {

        const limit =
            nextPageSize === "all" ?
                ALL_PAGE_LIMIT :
                nextPageSize;
        const offset =
            nextPageSize === "all" ?
                0 :
                nextPageIndex * limit;

        setIsLoading(true);
        setStatusMessage("");

        fetchTools(
            {
                search,
                limit,
                offset,
                sort: nextSortBy
            }
        )

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

            fetchTools(
                {
                    search: "",
                    limit: DEFAULT_PAGE_SIZE,
                    offset: 0,
                    sort: "asset_tag"
                }
            )

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
        setPageIndex(0);
        loadTools(
            query,
            0,
            pageSize,
            sortBy
        );

    }


    function changePageSize(
        value: string
    ) {

        const nextPageSize =
            value === "all" ?
                "all" :
                Number(value) as PageSize;

        setPageSize(nextPageSize);
        setPageIndex(0);
        loadTools(
            submittedQuery,
            0,
            nextPageSize,
            sortBy
        );

    }


    function changeSort(
        value: string
    ) {

        const nextSortBy =
            value as ToolSort;

        setSortBy(nextSortBy);
        setPageIndex(0);
        loadTools(
            submittedQuery,
            0,
            pageSize,
            nextSortBy
        );

    }


    function goToPage(
        nextPageIndex: number
    ) {

        setPageIndex(nextPageIndex);
        loadTools(
            submittedQuery,
            nextPageIndex,
            pageSize,
            sortBy
        );

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
                            loadTools(
                                submittedQuery,
                                pageIndex,
                                pageSize,
                                sortBy
                            )
                    }
                    disabled={isLoading}
                >
                    Rafraîchir
                </button>

                <label className="tools-control">
                    Trier
                    <select
                        value={sortBy}
                        onChange={
                            event =>
                                changeSort(event.target.value)
                        }
                        disabled={isLoading}
                    >
                        <option value="asset_tag">Tag</option>
                        <option value="location">Chantier</option>
                        <option value="name">Nom</option>
                    </select>
                </label>

                <label className="tools-page-size">
                    Afficher
                    <select
                        value={String(pageSize)}
                        onChange={
                            event =>
                                changePageSize(event.target.value)
                        }
                        disabled={isLoading}
                    >
                        <option value="20">20</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                        <option value="all">Tous</option>
                    </select>
                </label>

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

            <div className="tools-pagination">

                <div className="tools-range">
                    {total > 0 ? (
                        <span>
                            {firstResult}-{lastResult} de {total}
                        </span>
                    ) : (
                        <span>0 outil</span>
                    )}
                    {pageSize !== "all" && (
                        <span>
                            Page {pageIndex + 1} de {pageCount}
                        </span>
                    )}
                </div>

                <div className="tools-page-controls">
                    <button
                        type="button"
                        onClick={
                            () =>
                                goToPage(0)
                        }
                        disabled={
                            isLoading ||
                            !canGoPrevious
                        }
                    >
                        Début
                    </button>

                    <button
                        type="button"
                        onClick={
                            () =>
                                goToPage(pageIndex - 1)
                        }
                        disabled={
                            isLoading ||
                            !canGoPrevious
                        }
                    >
                        Précédent
                    </button>

                    <button
                        type="button"
                        onClick={
                            () =>
                                goToPage(pageIndex + 1)
                        }
                        disabled={
                            isLoading ||
                            !canGoNext
                        }
                    >
                        Suivant
                    </button>

                    <button
                        type="button"
                        onClick={
                            () =>
                                goToPage(pageCount - 1)
                        }
                        disabled={
                            isLoading ||
                            !canGoNext
                        }
                    >
                        Fin
                    </button>
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
                            <th>Chantier</th>
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
