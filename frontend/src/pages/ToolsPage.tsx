import {
    useEffect,
    useState
} from "react";

import {
    API_URL,
    checkoutTool,
    fetchLocations,
    fetchStatusLabels,
    fetchTools,
    updateTool
} from "../utils/toolsApi";
import type {
    SnipeLocation,
    StatusLabel,
    ToolAsset,
    ToolInput,
    ToolScope,
    ToolSort,
    ToolSortOrder
} from "../utils/toolsApi";

import AssetQrCode from "../components/AssetQrCode";
import "../styles/tools.css";


type PageSize = 20 | 50 | 100 | "all";
type ToolsPageProps = {
    toolScope: ToolScope;
};


const DEFAULT_PAGE_SIZE = 20;
const ALL_PAGE_LIMIT = 10000;
const EMPTY_TOOL_FORM: ToolInput = {
    asset_tag: "",
    name: "",
    serial: "",
    notes: ""
};


function defaultCheckoutStatus(
    statusLabels: StatusLabel[]
) {

    return (
        statusLabels.find(
            statusLabel =>
                statusLabel.type === "deployable" &&
                !statusLabel.archived
        ) ||
        statusLabels.find(
            statusLabel =>
                statusLabel.name.toLowerCase().includes("ready")
        ) ||
        statusLabels[0]
    );

}


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


function ToolsPage({
    toolScope
}: ToolsPageProps) {

    const [tools, setTools] = useState<ToolAsset[]>([]);
    const [query, setQuery] = useState("");
    const [submittedQuery, setSubmittedQuery] = useState("");
    const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
    const [pageIndex, setPageIndex] = useState(0);
    const [sortBy, setSortBy] = useState<ToolSort>("asset_tag");
    const [sortOrder, setSortOrder] = useState<ToolSortOrder>("asc");
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isSavingTool, setIsSavingTool] = useState(false);
    const [statusMessage, setStatusMessage] = useState("");
    const [editingTool, setEditingTool] = useState<ToolAsset | null>(null);
    const [toolForm, setToolForm] = useState<ToolInput>(EMPTY_TOOL_FORM);
    const [locations, setLocations] = useState<SnipeLocation[]>([]);
    const [statusLabels, setStatusLabels] = useState<StatusLabel[]>([]);
    const [checkoutLocationId, setCheckoutLocationId] = useState("");
    const [checkoutStatusId, setCheckoutStatusId] = useState("");
    const [checkoutNote, setCheckoutNote] = useState("");
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
        nextSortBy = sortBy,
        nextSortOrder = sortOrder
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
                sort: nextSortBy,
                order: nextSortOrder,
                scope: toolScope
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
                    sort: "asset_tag",
                    order: "asc",
                    scope: toolScope
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

        [
            toolScope
        ]

    );


    useEffect(
        () => {
            let isCurrent = true;

            Promise.all(
                [
                    fetchLocations(
                        {
                            limit: ALL_PAGE_LIMIT,
                            sort: "name",
                            order: "asc"
                        }
                    ),
                    fetchStatusLabels()
                ]
            )
            .then(
                ([
                    locationResponse,
                    statusResponse
                ]) => {
                    if (!isCurrent)
                        return;

                    setLocations(locationResponse.rows);
                    setStatusLabels(statusResponse.rows);

                    const defaultStatus = defaultCheckoutStatus(statusResponse.rows);

                    if (defaultStatus)
                        setCheckoutStatusId(String(defaultStatus.id));
                }
            )
            .catch(
                () => {
                    if (isCurrent)
                        setStatusMessage("Impossible de charger les options Snipe-IT.");
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
            sortBy,
            sortOrder
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
            sortBy,
            sortOrder
        );

    }


    function changeSort(
        value: string
    ) {

        const nextSortBy = value as ToolSort;

        setSortBy(nextSortBy);
        setSortOrder("asc");
        setPageIndex(0);
        loadTools(
            submittedQuery,
            0,
            pageSize,
            nextSortBy,
            "asc"
        );

    }


    function sortResults(
        nextSortBy: ToolSort
    ) {

        const nextSortOrder =
            sortBy === nextSortBy && sortOrder === "asc" ?
                "desc" :
                "asc";

        setSortBy(nextSortBy);
        setSortOrder(nextSortOrder);
        setPageIndex(0);
        loadTools(
            submittedQuery,
            0,
            pageSize,
            nextSortBy,
            nextSortOrder
        );

    }


    function sortLabel(
        field: ToolSort,
        label: string
    ) {

        return (
            <button
                type="button"
                className="tools-sort-button"
                onClick={
                    () =>
                        sortResults(field)
                }
                disabled={isLoading}
            >
                <span>{label}</span>
                {sortBy === field && (
                    <span className="tools-sort-indicator">
                        {sortOrder === "asc" ? "▲" : "▼"}
                    </span>
                )}
            </button>
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
            sortBy,
            sortOrder
        );

    }


    function openToolEditor(
        tool: ToolAsset
    ) {

        setEditingTool(tool);
        setToolForm(
            {
                asset_tag: tool.asset_tag || "",
                name: tool.name || "",
                serial: tool.serial || "",
                notes: tool.notes || ""
            }
        );
        setCheckoutLocationId("");
        setCheckoutNote("");
        setStatusMessage("");

    }


    function closeToolEditor() {

        setEditingTool(null);
        setToolForm(EMPTY_TOOL_FORM);

    }


    function saveTool() {

        if (!editingTool)
            return;

        setIsSavingTool(true);
        setStatusMessage("");

        const updatePayload: ToolInput = {
            asset_tag: toolForm.asset_tag.trim(),
            name: toolForm.name.trim(),
            serial: toolForm.serial.trim()
        };
        const nextNotes = (toolForm.notes || "").trim();

        if (nextNotes !== (editingTool.notes || "").trim())
            updatePayload.notes = nextNotes;

        let request = updateTool(
            editingTool.id,
            updatePayload
        );

        if (checkoutLocationId && checkoutStatusId)
            request = request.then(
                () =>
                    checkoutTool(
                        editingTool.id,
                        {
                            location_id: Number(checkoutLocationId),
                            status_id: Number(checkoutStatusId),
                            note: checkoutNote.trim()
                        }
                    )
            );

        request
        .then(
            () => {
                closeToolEditor();
                setStatusMessage("Outil sauvegardé dans Snipe-IT.");
                loadTools(
                    submittedQuery,
                    pageIndex,
                    pageSize,
                    sortBy,
                    sortOrder
                );
            }
        )
        .catch(
            error => {
                setStatusMessage(
                    error instanceof Error ?
                        error.message :
                        "Impossible de sauvegarder l'outil."
                );
            }
        )
        .finally(
            () => {
                setIsSavingTool(false);
            }
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
                                sortBy,
                                sortOrder
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
                        <option value="name">Nom</option>
                        <option value="model">Modèle</option>
                        <option value="serial">Série</option>
                        <option value="category">Catégorie</option>
                        <option value="location">Chantier</option>
                        <option value="status">État</option>
                        <option value="updated_at">Mis à jour</option>
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
                            <th>Image</th>
                            <th>{sortLabel("asset_tag", "Tag")}</th>
                            <th>{sortLabel("name", "Outil")}</th>
                            <th>{sortLabel("model", "Modèle")}</th>
                            <th>{sortLabel("serial", "Série")}</th>
                            <th>{sortLabel("category", "Catégorie")}</th>
                            <th>{sortLabel("location", "Chantier")}</th>
                            <th>{sortLabel("status", "État")}</th>
                            <th>{sortLabel("updated_at", "Mis à jour")}</th>
                            <th>Action</th>
                        </tr>
                    </thead>

                    <tbody>
                        {tools.map(
                            tool => (
                                <tr key={tool.id}>
                                    <td>
                                        <div className="tool-image-cell">
                                            {tool.image_proxy_path ? (
                                                <img
                                                    src={API_URL + tool.image_proxy_path}
                                                    alt={tool.name || tool.asset_tag}
                                                    loading="lazy"
                                                />
                                            ) : (
                                                <span>-</span>
                                            )}
                                        </div>
                                    </td>
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
                                    <td>
                                        <button
                                            type="button"
                                            className="tools-row-action"
                                            onClick={() => openToolEditor(tool)}
                                        >
                                            Modifier
                                        </button>
                                    </td>
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

            {editingTool && (
                <div className="tools-modal-backdrop">
                    <section className="tools-modal">
                        <header>
                            <h2>Modifier outil</h2>
                            <button
                                type="button"
                                onClick={closeToolEditor}
                            >
                                Fermer
                            </button>
                        </header>
                        <div className="tools-modal-grid">
                            <label>
                                <span>Tag</span>
                                <input
                                    value={toolForm.asset_tag}
                                    onChange={
                                        event =>
                                            setToolForm(
                                                current => ({
                                                    ...current,
                                                    asset_tag: event.target.value
                                                })
                                            )
                                    }
                                />
                            </label>
                            <label>
                                <span>Nom</span>
                                <input
                                    value={toolForm.name}
                                    onChange={
                                        event =>
                                            setToolForm(
                                                current => ({
                                                    ...current,
                                                    name: event.target.value
                                                })
                                            )
                                    }
                                />
                            </label>
                            <label>
                                <span>Série</span>
                                <input
                                    value={toolForm.serial}
                                    onChange={
                                        event =>
                                            setToolForm(
                                                current => ({
                                                    ...current,
                                                    serial: event.target.value
                                                })
                                            )
                                    }
                                />
                            </label>
                            <label className="tools-modal-wide">
                                <span>Notes</span>
                                <textarea
                                    value={toolForm.notes}
                                    onChange={
                                        event =>
                                            setToolForm(
                                                current => ({
                                                    ...current,
                                                    notes: event.target.value
                                                })
                                            )
                                    }
                                />
                            </label>
                            <label>
                                <span>Déplacer vers chantier</span>
                                <select
                                    value={checkoutLocationId}
                                    onChange={
                                        event => setCheckoutLocationId(event.target.value)
                                    }
                                >
                                    <option value="">Ne pas déplacer</option>
                                    {locations.map(
                                        location => (
                                            <option
                                                key={location.id}
                                                value={location.id}
                                            >
                                                {location.name}
                                            </option>
                                        )
                                    )}
                                </select>
                            </label>
                            <label>
                                <span>Statut checkout</span>
                                <select
                                    value={checkoutStatusId}
                                    disabled={!checkoutLocationId}
                                    onChange={
                                        event => setCheckoutStatusId(event.target.value)
                                    }
                                >
                                    <option value="">Sélectionner</option>
                                    {statusLabels.map(
                                        statusLabel => (
                                            <option
                                                key={statusLabel.id}
                                                value={statusLabel.id}
                                            >
                                                {statusLabel.name}
                                            </option>
                                        )
                                    )}
                                </select>
                            </label>
                            <label className="tools-modal-wide">
                                <span>Note déplacement</span>
                                <textarea
                                    value={checkoutNote}
                                    disabled={!checkoutLocationId}
                                    onChange={
                                        event => setCheckoutNote(event.target.value)
                                    }
                                />
                            </label>
                        </div>
                        <div className="tools-qr-panel">
                            <AssetQrCode
                                value={editingTool.asset_url}
                                label={"QR " + editingTool.asset_tag}
                            />
                            {editingTool.asset_url && (
                                <a
                                    href={editingTool.asset_url}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    Ouvrir dans Snipe-IT
                                </a>
                            )}
                        </div>
                        <footer>
                            <button
                                type="button"
                                onClick={closeToolEditor}
                                disabled={isSavingTool}
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                onClick={saveTool}
                                disabled={isSavingTool}
                            >
                                {isSavingTool ? "Sauvegarde..." : "Sauvegarder"}
                            </button>
                        </footer>
                    </section>
                </div>
            )}

        </section>

    );

}


export default ToolsPage;
