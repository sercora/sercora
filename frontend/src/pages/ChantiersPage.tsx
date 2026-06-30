import {
    useEffect,
    useState
} from "react";
import type { FormEvent } from "react";

import {
    checkoutTool,
    createLocation,
    fetchLocationTools,
    fetchLocations,
    fetchStatusLabels,
    updateLocation,
    updateTool
} from "../utils/toolsApi";
import type {
    LocationSort,
    LocationSortOrder,
    SnipeLocation,
    SnipeLocationInput,
    StatusLabel,
    ToolAsset,
    ToolInput
} from "../utils/toolsApi";

import AssetQrCode from "../components/AssetQrCode";
import "../styles/chantiers.css";


type PageSize = 20 | 50 | 100 | "all";


const DEFAULT_PAGE_SIZE = 20;
const ALL_PAGE_LIMIT = 10000;
const EMPTY_LOCATION: SnipeLocationInput = {
    name: "",
    address: "",
    address2: "",
    city: "",
    state: "",
    postal_code: "",
    country: ""
};
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


function formatAddress(
    location: SnipeLocation
) {

    return [
        location.address,
        location.address2,
        [
            location.city,
            location.state,
            location.postal_code
        ].filter(Boolean).join(" "),
        location.country
    ]
    .filter(Boolean)
    .join(", ");

}


function locationToInput(
    location: SnipeLocation
): SnipeLocationInput {

    return {
        name: location.name || "",
        address: location.address || "",
        address2: location.address2 || "",
        city: location.city || "",
        state: location.state || "",
        postal_code: location.postal_code || "",
        country: location.country || ""
    };

}


function sortLabel(
    label: string,
    currentSort: LocationSort,
    currentOrder: LocationSortOrder,
    sortBy: LocationSort
) {

    const isActive = currentSort === sortBy;
    const arrow = isActive ? (currentOrder === "asc" ? " ▲" : " ▼") : "";

    return label + arrow;

}


function ChantiersPage() {

    const [locations, setLocations] = useState<SnipeLocation[]>([]);
    const [selectedLocation, setSelectedLocation] = useState<SnipeLocation | null>(null);
    const [locationTools, setLocationTools] = useState<ToolAsset[]>([]);
    const [query, setQuery] = useState("");
    const [submittedQuery, setSubmittedQuery] = useState("");
    const [toolQuery, setToolQuery] = useState("");
    const [minToolCount, setMinToolCount] = useState("");
    const [maxToolCount, setMaxToolCount] = useState("");
    const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
    const [pageIndex, setPageIndex] = useState(0);
    const [sortBy, setSortBy] = useState<LocationSort>("name");
    const [sortOrder, setSortOrder] = useState<LocationSortOrder>("asc");
    const [total, setTotal] = useState(0);
    const [form, setForm] = useState<SnipeLocationInput>(EMPTY_LOCATION);
    const [editingTool, setEditingTool] = useState<ToolAsset | null>(null);
    const [toolForm, setToolForm] = useState<ToolInput>(EMPTY_TOOL_FORM);
    const [statusLabels, setStatusLabels] = useState<StatusLabel[]>([]);
    const [checkoutLocationId, setCheckoutLocationId] = useState("");
    const [checkoutStatusId, setCheckoutStatusId] = useState("");
    const [checkoutNote, setCheckoutNote] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isToolsLoading, setIsToolsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isSavingTool, setIsSavingTool] = useState(false);
    const [statusMessage, setStatusMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
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
            currentOffset + locations.length,
            total
        );
    const canGoPrevious =
        pageSize !== "all" &&
        pageIndex > 0;
    const canGoNext =
        pageSize !== "all" &&
        pageIndex + 1 < pageCount;

    const parsedMinToolCount =
        minToolCount.trim() ?
            Number(minToolCount) :
            null;
    const parsedMaxToolCount =
        maxToolCount.trim() ?
            Number(maxToolCount) :
            null;


    function applyResponse(
        response: {
            total: number;
            rows: SnipeLocation[];
        }
    ) {

        setLocations(response.rows);
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

        if (!selectedLocation && response.rows[0])
            selectLocation(response.rows[0]);

    }


    function loadLocations(
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
        setErrorMessage("");

        fetchLocations(
            {
                search,
                limit,
                offset,
                sort: nextSortBy,
                order: nextSortOrder,
                minTools: parsedMinToolCount,
                maxTools: parsedMaxToolCount
            }
        )
        .then(applyResponse)
        .catch(() => {
            setErrorMessage(
                "Impossible de charger les chantiers depuis Snipe-IT."
            );
        })
        .finally(() => {
            setIsLoading(false);
        });

    }


    function loadToolsForLocation(
        location: SnipeLocation,
        search = toolQuery
    ) {

        setIsToolsLoading(true);
        setErrorMessage("");

        fetchLocationTools(
            location.id,
            {
                limit: 100,
                offset: 0,
                search,
                sort: "asset_tag",
                order: "asc"
            }
        )
        .then(
            response => {
                setLocationTools(response.rows);
            }
        )
        .catch(
            () => {
                setLocationTools([]);
                setErrorMessage(
                    "Impossible de charger les outils de ce chantier."
                );
            }
        )
        .finally(
            () => {
                setIsToolsLoading(false);
            }
        );

    }


    function selectLocation(
        location: SnipeLocation
    ) {

        setSelectedLocation(location);
        setForm(locationToInput(location));
        setIsCreating(false);
        setStatusMessage("");
        setErrorMessage("");
        loadToolsForLocation(location);

    }


    function startNewLocation() {

        setSelectedLocation(null);
        setLocationTools([]);
        setForm(EMPTY_LOCATION);
        setIsCreating(true);
        setStatusMessage("");
        setErrorMessage("");

    }


    function submitSearch() {

        setSubmittedQuery(query);
        setPageIndex(0);
        loadLocations(
            query,
            0,
            pageSize,
            sortBy,
            sortOrder
        );

    }


    function submitToolSearch() {

        if (!selectedLocation)
            return;

        loadToolsForLocation(
            selectedLocation,
            toolQuery
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
        loadLocations(
            submittedQuery,
            0,
            nextPageSize,
            sortBy,
            sortOrder
        );

    }


    function goToPage(
        nextPageIndex: number
    ) {

        setPageIndex(nextPageIndex);
        loadLocations(
            submittedQuery,
            nextPageIndex,
            pageSize,
            sortBy,
            sortOrder
        );

    }


    function toggleSort(
        nextSortBy: LocationSort
    ) {

        const nextSortOrder: LocationSortOrder =
            sortBy === nextSortBy && sortOrder === "asc" ?
                "desc" :
                "asc";

        setSortBy(nextSortBy);
        setSortOrder(nextSortOrder);
        setPageIndex(0);
        loadLocations(
            submittedQuery,
            0,
            pageSize,
            nextSortBy,
            nextSortOrder
        );

    }


    function updateForm(
        field: keyof SnipeLocationInput,
        value: string
    ) {

        setForm(
            current =>
                ({
                    ...current,
                    [field]: value
                })
        );

    }


    function saveLocation(
        event: FormEvent<HTMLFormElement>
    ) {

        event.preventDefault();
        setIsSaving(true);
        setStatusMessage("");
        setErrorMessage("");

        const payload = {
            ...form,
            name: form.name.trim(),
            address: form.address.trim(),
            address2: form.address2.trim(),
            city: form.city.trim(),
            state: form.state.trim(),
            postal_code: form.postal_code.trim(),
            country: form.country.trim()
        };

        const request =
            selectedLocation && !isCreating ?
                updateLocation(
                    selectedLocation.id,
                    payload
                ) :
                createLocation(payload);

        request
            .then(
                savedLocation => {
                    setStatusMessage(
                        isCreating ?
                            "Chantier créé dans Snipe-IT." :
                            "Chantier sauvegardé dans Snipe-IT."
                    );
                    setIsCreating(false);
                    setSelectedLocation(savedLocation);
                    setForm(locationToInput(savedLocation));
                    loadToolsForLocation(savedLocation);
                    loadLocations(
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
                    setErrorMessage(
                        error instanceof Error ?
                            error.message :
                            "Impossible de sauvegarder le chantier."
                    );
                }
            )
            .finally(
                () => {
                    setIsSaving(false);
                }
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
        setErrorMessage("");

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
        setErrorMessage("");

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

                if (selectedLocation)
                    loadToolsForLocation(selectedLocation);
            }
        )
        .catch(
            error => {
                setErrorMessage(
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


    useEffect(
        () => {
            loadLocations(
                "",
                0,
                DEFAULT_PAGE_SIZE,
                "name",
                "asc"
            );
        },
        []
    );


    useEffect(
        () => {
            let isCurrent = true;

            fetchStatusLabels()
                .then(
                    response => {
                        if (!isCurrent)
                            return;

                        setStatusLabels(response.rows);

                        const defaultStatus = defaultCheckoutStatus(response.rows);

                        if (defaultStatus)
                            setCheckoutStatusId(String(defaultStatus.id));
                    }
                )
                .catch(
                    () => {
                        if (isCurrent)
                            setErrorMessage("Impossible de charger les statuts Snipe-IT.");
                    }
                );

            return () => {
                isCurrent = false;
            };
        },
        []
    );


    return (
        <section className="chantiers-page">
            <div className="chantiers-toolbar">
                <label className="chantiers-search">
                    <span>Recherche</span>
                    <input
                        value={query}
                        onChange={
                            event => setQuery(event.target.value)
                        }
                        onKeyDown={
                            event => {
                                if (event.key === "Enter")
                                    submitSearch();
                            }
                        }
                        placeholder="Nom, adresse, ville, pays"
                    />
                </label>
                <label className="chantiers-tool-count-filter">
                    <span>Outils min</span>
                    <input
                        type="number"
                        min="0"
                        value={minToolCount}
                        onChange={
                            event => setMinToolCount(event.target.value)
                        }
                        onKeyDown={
                            event => {
                                if (event.key === "Enter")
                                    submitSearch();
                            }
                        }
                    />
                </label>
                <label className="chantiers-tool-count-filter">
                    <span>Outils max</span>
                    <input
                        type="number"
                        min="0"
                        value={maxToolCount}
                        onChange={
                            event => setMaxToolCount(event.target.value)
                        }
                        onKeyDown={
                            event => {
                                if (event.key === "Enter")
                                    submitSearch();
                            }
                        }
                    />
                </label>
                <button
                    type="button"
                    onClick={submitSearch}
                >
                    Rechercher
                </button>
                <button
                    type="button"
                    onClick={startNewLocation}
                >
                    Nouveau chantier
                </button>
                <button
                    type="button"
                    onClick={() => loadLocations()}
                    disabled={isLoading}
                >
                    Rafraichir
                </button>
                <label className="chantiers-page-size">
                    <span>Ligne</span>
                    <select
                        value={pageSize}
                        onChange={
                            event => changePageSize(event.target.value)
                        }
                    >
                        <option value="20">20</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                        <option value="all">Toutes</option>
                    </select>
                </label>
                <div className="chantiers-summary">
                    <strong>{total}</strong>
                    <span>chantiers</span>
                    {lastRefresh && (
                        <span className="chantiers-refresh">
                            Maj {lastRefresh}
                        </span>
                    )}
                </div>
            </div>

            {statusMessage && (
                <div className="chantiers-status">
                    {statusMessage}
                </div>
            )}

            {errorMessage && (
                <div className="chantiers-alert">
                    {errorMessage}
                </div>
            )}

            <div className="chantiers-workspace">
                <div className="chantiers-list-panel">
                    <div className="chantiers-pagination">
                        <div className="chantiers-range">
                            {total === 0 ? (
                                <span>Aucun chantier trouvé</span>
                            ) : (
                                <span>
                                    {firstResult} à {lastResult} sur {total}
                                </span>
                            )}
                        </div>
                        <div className="chantiers-page-controls">
                            <button
                                type="button"
                                disabled={!canGoPrevious}
                                onClick={() => goToPage(0)}
                            >
                                Début
                            </button>
                            <button
                                type="button"
                                disabled={!canGoPrevious}
                                onClick={() => goToPage(pageIndex - 1)}
                            >
                                Précédent
                            </button>
                            <span>
                                Page {pageIndex + 1} de {pageCount}
                            </span>
                            <button
                                type="button"
                                disabled={!canGoNext}
                                onClick={() => goToPage(pageIndex + 1)}
                            >
                                Suivant
                            </button>
                            <button
                                type="button"
                                disabled={!canGoNext}
                                onClick={() => goToPage(pageCount - 1)}
                            >
                                Fin
                            </button>
                        </div>
                    </div>

                    <div className="chantiers-table-wrap">
                        <table className="chantiers-table">
                            <thead>
                                <tr>
                                    <th>
                                        <button type="button" onClick={() => toggleSort("name")}>
                                            {sortLabel("Nom", sortBy, sortOrder, "name")}
                                        </button>
                                    </th>
                                    <th>
                                        <button type="button" onClick={() => toggleSort("city")}>
                                            {sortLabel("Ville", sortBy, sortOrder, "city")}
                                        </button>
                                    </th>
                                    <th>
                                        <button type="button" onClick={() => toggleSort("assets_count")}>
                                            {sortLabel("Outils", sortBy, sortOrder, "assets_count")}
                                        </button>
                                    </th>
                                    <th>
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {locations.map(
                                    location => (
                                        <tr
                                            key={location.id}
                                            className={
                                                selectedLocation?.id === location.id ?
                                                    "selected" :
                                                    ""
                                            }
                                        >
                                            <td>
                                                <strong>{location.name || "-"}</strong>
                                                <span className="chantiers-muted-line">
                                                    {formatAddress(location) || "-"}
                                                </span>
                                            </td>
                                            <td>{location.city || "-"}</td>
                                            <td>{location.assets_count}</td>
                                            <td>
                                                <button
                                                    type="button"
                                                    className="chantiers-row-action"
                                                    onClick={() => selectLocation(location)}
                                                >
                                                    Ouvrir
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                )}
                            </tbody>
                        </table>

                        {!isLoading && locations.length === 0 && (
                            <div className="chantiers-empty">
                                Aucun chantier ne correspond à la recherche actuelle.
                            </div>
                        )}

                        {isLoading && (
                            <div className="chantiers-empty">
                                Chargement des chantiers...
                            </div>
                        )}
                    </div>
                </div>

                <aside className="chantiers-detail-panel">
                    <form
                        className="chantiers-editor"
                        onSubmit={saveLocation}
                    >
                        <header>
                            <div>
                                <span className="chantiers-kicker">Snipe-IT</span>
                                <h2>
                                    {isCreating ? "Nouveau chantier" : selectedLocation?.name || "Chantier"}
                                </h2>
                            </div>
                            <button
                                type="submit"
                                disabled={isSaving}
                            >
                                {isSaving ? "Sauvegarde..." : "Sauvegarder"}
                            </button>
                        </header>

                        <div className="chantiers-form-grid">
                            <label>
                                <span>Nom</span>
                                <input
                                    value={form.name}
                                    required
                                    onChange={
                                        event => updateForm("name", event.target.value)
                                    }
                                />
                            </label>
                            <label>
                                <span>Adresse</span>
                                <input
                                    value={form.address}
                                    onChange={
                                        event => updateForm("address", event.target.value)
                                    }
                                />
                            </label>
                            <label>
                                <span>Adresse 2</span>
                                <input
                                    value={form.address2}
                                    onChange={
                                        event => updateForm("address2", event.target.value)
                                    }
                                />
                            </label>
                            <label>
                                <span>Ville</span>
                                <input
                                    value={form.city}
                                    onChange={
                                        event => updateForm("city", event.target.value)
                                    }
                                />
                            </label>
                            <label>
                                <span>Province</span>
                                <input
                                    value={form.state}
                                    onChange={
                                        event => updateForm("state", event.target.value)
                                    }
                                />
                            </label>
                            <label>
                                <span>Code postal</span>
                                <input
                                    value={form.postal_code}
                                    onChange={
                                        event => updateForm("postal_code", event.target.value)
                                    }
                                />
                            </label>
                            <label>
                                <span>Pays</span>
                                <input
                                    value={form.country}
                                    onChange={
                                        event => updateForm("country", event.target.value)
                                    }
                                />
                            </label>
                        </div>
                    </form>

                    <section className="chantiers-tools-panel">
                        <header>
                            <div>
                                <span className="chantiers-kicker">Outils</span>
                                <h2>
                                    {selectedLocation ? selectedLocation.name : "Aucun chantier sélectionné"}
                                </h2>
                            </div>
                            <strong>{locationTools.length}</strong>
                        </header>

                        <div className="chantiers-tool-search">
                            <input
                                value={toolQuery}
                                disabled={!selectedLocation}
                                onChange={
                                    event => setToolQuery(event.target.value)
                                }
                                onKeyDown={
                                    event => {
                                        if (event.key === "Enter")
                                            submitToolSearch();
                                    }
                                }
                                placeholder="Rechercher un outil du chantier"
                            />
                            <button
                                type="button"
                                disabled={!selectedLocation || isToolsLoading}
                                onClick={submitToolSearch}
                            >
                                Filtrer
                            </button>
                        </div>

                        <div className="chantiers-tools-table-wrap">
                            <table className="chantiers-tools-table">
                                <thead>
                                    <tr>
                                        <th>Tag</th>
                                        <th>Outil</th>
                                        <th>Chantier</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {locationTools.map(
                                        tool => (
                                            <tr key={tool.id}>
                                                <td>{tool.asset_tag || "-"}</td>
                                                <td>
                                                    <strong>{tool.name || tool.model || "-"}</strong>
                                                    <span className="chantiers-muted-line">
                                                        {[
                                                            tool.category,
                                                            tool.serial
                                                        ].filter(Boolean).join(" | ") || "-"}
                                                    </span>
                                                </td>
                                                <td>{tool.location || selectedLocation?.name || "-"}</td>
                                                <td>
                                                    <button
                                                        type="button"
                                                        className="chantiers-row-action"
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

                            {!selectedLocation && (
                                <div className="chantiers-empty">
                                    Sélectionner un chantier pour voir ses outils.
                                </div>
                            )}

                            {selectedLocation && !isToolsLoading && locationTools.length === 0 && (
                                <div className="chantiers-empty">
                                    Aucun outil trouvé pour ce chantier.
                                </div>
                            )}

                            {isToolsLoading && (
                                <div className="chantiers-empty">
                                    Chargement des outils...
                                </div>
                            )}
                        </div>
                    </section>
                </aside>
            </div>

            {editingTool && (
                <div className="chantiers-modal-backdrop">
                    <section className="chantiers-modal">
                        <header>
                            <h2>Modifier outil</h2>
                            <button
                                type="button"
                                onClick={closeToolEditor}
                            >
                                Fermer
                            </button>
                        </header>
                        <div className="chantiers-modal-grid">
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
                            <label className="chantiers-modal-wide">
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
                            <label className="chantiers-modal-wide">
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
                        <div className="chantiers-qr-panel">
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


export default ChantiersPage;
