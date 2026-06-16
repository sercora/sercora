import {
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";

import MatrixGrid from "../components/MatrixGrid";
import ZoomToolbar from "../components/ZoomToolbar";

import {
    getInstallationSellTotal,
    getLossQuantity,
    getProfit,
    getQtyTotal,
    getQtyWithLoss,
    getSellPrice,
    getUnitProfit,
    getUnitSellPrice
} from "../utils/matrixCalculations";

import {
    createEstimateLine,
    createEstimateRoom,
    estimateFileUrl,
    fetchEstimateMatrix,
    fetchEstimateFolders,
    fetchSurfaceTypes,
    updateEstimateMatrixSummary,
    updateEstimateLine as saveEstimateLine,
    updateEstimateQuantity as saveEstimateQuantity
} from "../utils/matrixApi";
import type {
    EstimateFolderItem,
    EstimateLineInput,
    EstimateMatrixResponse,
    EstimateMatrixSummary,
    EstimateMatrixSummaryInput,
    SurfaceType
} from "../utils/matrixApi";
import {
    fetchProductPage
} from "../utils/productsApi";
import type {
    Product
} from "../utils/productsApi";

import "../styles/grid.css";


const LINE_EDITABLE_FIELDS = [
    "surface_name",
    "loss_percent",
    "purchase_price",
    "profit_percent",
    "installation_cost"
];

const ZOOM_LEVELS: Record<string, number> = {
    "100": 1,
    "125": 1.25,
    "150": 1.5
};

const GRID_LOCALE_TEXT = {
    noRowsToShow: "Aucune ligne à afficher",
    loadingOoo: "Chargement...",
    searchOoo: "Rechercher...",
    selectAll: "Tout sélectionner",
    blanks: "Vides",
    filterOoo: "Filtrer...",
    equals: "Égal à",
    notEqual: "Différent de",
    contains: "Contient",
    notContains: "Ne contient pas",
    startsWith: "Commence par",
    endsWith: "Se termine par",
    lessThan: "Plus petit que",
    greaterThan: "Plus grand que",
    lessThanOrEqual: "Plus petit ou égal à",
    greaterThanOrEqual: "Plus grand ou égal à",
    inRange: "Entre",
    andCondition: "ET",
    orCondition: "OU",
    applyFilter: "Appliquer",
    resetFilter: "Réinitialiser",
    clearFilter: "Effacer",
    cancelFilter: "Annuler",
    copy: "Copier",
    copyWithHeaders: "Copier avec en-têtes",
    paste: "Coller",
    export: "Exporter",
    csvExport: "Export CSV",
    excelExport: "Export Excel",
    pinColumn: "Figer la colonne",
    pinLeft: "Figer à gauche",
    pinRight: "Figer à droite",
    noPin: "Ne pas figer",
    autosizeThiscolumn: "Ajuster cette colonne",
    autosizeAllColumns: "Ajuster toutes les colonnes",
    groupBy: "Grouper par",
    ungroupBy: "Retirer le groupe",
    columns: "Colonnes",
    filters: "Filtres",
    rowGroupColumnsEmptyMessage: "Glisser ici pour grouper",
    valueColumnsEmptyMessage: "Glisser ici pour agréger",
    pivotMode: "Mode pivot",
    groups: "Groupes",
    values: "Valeurs",
    pivots: "Pivots"
};


type EstimateMenuKey = "En cours" | "Envoyées" | "Refusées";


type MatrixViewProps = {
    estimateMenu: EstimateMenuKey;
};


function MatrixView({
    estimateMenu
}: MatrixViewProps) {

    const gridRef = useRef<any>(null);

    const [columnDefs, setColumnDefs] = useState<any[]>([]);

    const [rowData, setRowData] = useState<any[]>([]);

    const [zoom, setZoom] = useState("100");
    const [surfaceTypes, setSurfaceTypes] = useState<SurfaceType[]>([]);
    const [matrixSummary, setMatrixSummary] = useState<EstimateMatrixSummary | null>(null);
    const [summaryForm, setSummaryForm] = useState({
        used_hourly_rate: "",
        global_profit_percent: "",
        probable_schedule: "",
        tile_holdback_percent: "",
        warranty_years: ""
    });
    const [isSummarySaving, setIsSummarySaving] = useState(false);
    const [summaryStatus, setSummaryStatus] = useState("");
    const [newRoomName, setNewRoomName] = useState("");
    const [productSearch, setProductSearch] = useState("");
    const [productResults, setProductResults] = useState<Product[]>([]);
    const [selectedProductId, setSelectedProductId] = useState("");
    const [matrixActionStatus, setMatrixActionStatus] = useState("");
    const [isMatrixActionLoading, setIsMatrixActionLoading] = useState(false);
    const [folderPath, setFolderPath] = useState("");
    const [rootName, setRootName] = useState("");
    const [folderItems, setFolderItems] = useState<EstimateFolderItem[]>([]);
    const [folderSearch, setFolderSearch] = useState("");
    const [isFolderLoading, setIsFolderLoading] = useState(false);
    const [folderError, setFolderError] = useState("");


    const folderStatus = useMemo(
        () => {
            if (estimateMenu === "En cours")
                return "in_progress";

            if (estimateMenu === "Envoyées")
                return "sent";

            return null;
        },
        [
            estimateMenu
        ]
    );


    const filteredFolderItems = useMemo(
        () => {
            const normalizedSearch =
                folderSearch.trim().toLowerCase();

            if (!normalizedSearch)
                return folderItems;

            return folderItems.filter(
                item =>
                    item.name.toLowerCase().includes(normalizedSearch)
            );
        },
        [
            folderItems,
            folderSearch
        ]
    );


    const breadcrumbs = useMemo(
        () => {
            const parts =
                folderPath ?
                    folderPath.split("/") :
                    [];

            return [
                {
                    label: rootName || "Soumissions",
                    path: ""
                },
                ...parts.map(
                    (_part, index) => ({
                        label: parts[index],
                        path: parts.slice(
                            0,
                            index + 1
                        ).join("/")
                    })
                )
            ];
        },
        [
            folderPath,
            rootName
        ]
    );


    const selectedProduct = useMemo(
        () =>
            productResults.find(
                product =>
                    String(product.id) === selectedProductId
            ) || null,
        [
            productResults,
            selectedProductId
        ]
    );


    function refreshGrid() {

        setRowData(
            previousRows => [
                ...previousRows
            ]
        );

        gridRef.current?.api?.refreshCells(
            {
                force: true
            }
        );

    }


    function formatMoney(value: number) {

        return Number(value || 0).toFixed(2);

    }


    function parseNumber(value: any) {

        const parsedValue = Number(value);

        if (Number.isNaN(parsedValue))
            return 0;

        return parsedValue;

    }


    function isLineEditableField(field: string) {

        return LINE_EDITABLE_FIELDS.includes(
            field
        );

    }


    function getSupplierClass(params: any) {

        const supplier =
            String(
                params.data?.manufacturer_name ||
                params.data?.product_name ||
                ""
            ).toLowerCase();

        if (supplier.includes("olympia"))
            return "supplier-olympia";

        if (supplier.includes("mapei"))
            return "supplier-mapei";

        if (supplier.includes("schluter"))
            return "supplier-schluter";

        return "";

    }


    function updateEstimateQuantity(
        params: any,
        room: string
    ) {

        const quantityId =
            params.data[
                room + "_id"
            ];

        const request =
            saveEstimateQuantity(
                quantityId,
                parseNumber(
                    params.newValue
                )
            );

        if (!request)
            return;

        request.then(
            () => {

                refreshGrid();

            }
        );

    }


    function updateEstimateLine(
        params: any
    ) {

        saveEstimateLine(
            params.data.line_id,
            {

                surface_type_id:
                    parseNumber(
                        params.data.surface_type_id
                    ),

                loss_percent:
                    parseNumber(
                        params.data.loss_percent
                    ),

                purchase_price:
                    parseNumber(
                        params.data.purchase_price
                    ),

                profit_percent:
                    parseNumber(
                        params.data.profit_percent
                    ),

                installation_cost:
                    parseNumber(
                        params.data.installation_cost
                    )

            }
        )

        .then(
            () => {

                refreshGrid();

            }
        );

    }


    function onCellValueChanged(
        params: any
    ) {

        const field =
            params.column.getColId();

        if (
            params.newValue === params.oldValue
        )
            return;

        if (field === "surface_name") {

            const surfaceType =
                surfaceTypes.find(
                    surface =>
                        surface.name === params.newValue
                );

            if (!surfaceType) {
                refreshGrid();
                return;
            }

            params.data.surface_name =
                surfaceType.name;

            params.data.surface_type_id =
                surfaceType.id;

        } else {

            params.data[field] =
                parseNumber(
                    params.newValue
                );

        }

        refreshGrid();

        if (
            isLineEditableField(
                field
            )
        ) {

            updateEstimateLine(
                params
            );

            return;

        }

        updateEstimateQuantity(
            params,
            field
        );

    }


    function applyZoom(
        nextZoom: string
    ) {

        setZoom(
            nextZoom
        );

        const scale =
            ZOOM_LEVELS[nextZoom] || 1;

        gridRef.current?.api?.setGridOption(
            "rowHeight",
            Math.round(22 * scale)
        );

        gridRef.current?.api?.setGridOption(
            "headerHeight",
            Math.round(34 * scale)
        );

        gridRef.current?.api?.setGridOption(
            "groupHeaderHeight",
            Math.round(24 * scale)
        );

        gridRef.current?.api?.resetRowHeights();

        refreshGrid();

    }


    function fitToScreen() {

        setZoom(
            "fit"
        );

        gridRef.current?.api?.sizeColumnsToFit();

    }


    function parentFolderPath() {

        if (!folderPath)
            return "";

        const parts =
            folderPath.split("/");

        return parts.slice(
            0,
            -1
        ).join("/");

    }


    function formatFileSize(
        size: number
    ) {

        if (!size)
            return "";

        if (size < 1024)
            return size + " o";

        if (size < 1024 * 1024)
            return Math.round(size / 1024) + " Ko";

        return (
            size /
            1024 /
            1024
        ).toFixed(1) + " Mo";

    }


    function formatModifiedAt(
        timestamp: number
    ) {

        if (!timestamp)
            return "";

        return new Date(
            timestamp * 1000
        ).toLocaleDateString("fr-CA");

    }


    function formatDate(
        value: string | null | undefined
    ) {

        if (!value)
            return "";

        return new Date(value).toLocaleDateString("fr-CA");

    }


    function formatRate(
        value: number | null | undefined
    ) {

        if (value === null || value === undefined)
            return "";

        return value.toLocaleString(
            "fr-CA",
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        ) + " $";

    }


    function nullableNumber(
        value: string
    ) {

        const normalizedValue =
            value.trim().replace(",", ".");

        if (!normalizedValue)
            return null;

        const parsedValue =
            Number(normalizedValue);

        if (Number.isNaN(parsedValue))
            return null;

        return parsedValue;

    }


    function summaryInputPayload(): EstimateMatrixSummaryInput {

        return {
            used_hourly_rate:
                nullableNumber(summaryForm.used_hourly_rate),
            global_profit_percent:
                nullableNumber(summaryForm.global_profit_percent),
            probable_schedule:
                summaryForm.probable_schedule.trim() || null,
            tile_holdback_percent:
                nullableNumber(summaryForm.tile_holdback_percent),
            warranty_years:
                nullableNumber(summaryForm.warranty_years)
        };

    }


    function syncSummaryForm(
        summary: EstimateMatrixSummary
    ) {

        setSummaryForm(
            {
                used_hourly_rate:
                    summary.rates.used_hourly_rate?.toString() || "",
                global_profit_percent:
                    summary.rates.global_profit_percent?.toString() || "",
                probable_schedule:
                    summary.rates.probable_schedule || "",
                tile_holdback_percent:
                    summary.rates.tile_holdback_percent?.toString() || "",
                warranty_years:
                    summary.rates.warranty_years?.toString() || ""
            }
        );

    }


    function buildMatrixRows(
        matrix: EstimateMatrixResponse
    ) {

        return matrix.lines.map(

            (line: any) => {

                const row: any = {

                    line_id:
                        line.line_id,

                    surface_type_id:
                        line.surface_type_id,

                    surface_name:
                        line.surface_name,

                    product_name:
                        line.product_name,

                    manufacturer_name:
                        line.manufacturer_name,

                    unit_name:
                        line.unit_name,

                    grout_color:
                        line.grout_color,

                    loss_percent:
                        line.loss_percent,

                    purchase_price:
                        line.purchase_price,

                    profit_percent:
                        line.profit_percent,

                    installation_cost:
                        line.installation_cost

                };

                matrix.rooms.forEach(

                    (room: string) => {

                        row[room] =
                            line.quantities[room]?.quantity ?? 0;

                        row[
                            room + "_id"
                        ] =
                            line.quantities[room]?.id;

                    }

                );

                return row;

            }

        );

    }


    function buildMatrixColumns(
        matrix: EstimateMatrixResponse,
        surfaceRows: SurfaceType[]
    ) {

        const numericEditableClass = [
            "editable-cell",
            "numeric-cell"
        ];

        const calculatedClass = [
            "calculated-cell",
            "numeric-cell"
        ];

        const surfaceNames =
            surfaceRows.map(
                surface =>
                    surface.name
            );

        const roomColumns = matrix.rooms.map(

            (room: string) => ({

                field: room,

                headerName: room,

                width: 82,

                minWidth: 72,

                editable: true,

                valueParser: (params: any) =>
                    parseNumber(params.newValue),

                cellClass: numericEditableClass

            })

        );

        return [

            {
                headerName: "FINI",
                marryChildren: true,
                children: [
                    {
                        field: "surface_name",
                        headerName: "SURFACE",
                        width: 120,
                        minWidth: 96,
                        pinned: "left",
                        editable: true,
                        cellEditor: "agSelectCellEditor",
                        cellEditorParams: {
                            values: surfaceNames
                        },
                        cellClass: "editable-cell"
                    },
                    {
                        field: "product_name",
                        headerName: "DESCRIPTION",
                        width: 300,
                        minWidth: 220,
                        pinned: "left",
                        cellClass: getSupplierClass
                    },
                    {
                        field: "unit_name",
                        headerName: "UNITÉ DE MESURE",
                        width: 92,
                        minWidth: 72,
                        cellClass: "calculated-cell"
                    },
                    {
                        field: "grout_color",
                        headerName: "COULIS",
                        width: 88,
                        minWidth: 72,
                        cellClass: "calculated-cell"
                    }
                ]
            },

            {
                headerName: "TAKE OFF",
                marryChildren: true,
                children: roomColumns
            },

            {
                headerName: "MATÉRIEL",
                marryChildren: true,
                children: [
                    {
                        headerName: "TOTAL",
                        width: 82,
                        minWidth: 72,
                        cellClass: calculatedClass,
                        valueGetter:
                            (params: any) =>
                                getQtyTotal(
                                    params,
                                    matrix.rooms
                                )
                    },
                    {
                        field: "loss_percent",
                        headerName: "PERTE EN %",
                        width: 86,
                        minWidth: 74,
                        editable: true,
                        valueParser: (params: any) =>
                            parseNumber(params.newValue),
                        cellClass: numericEditableClass
                    },
                    {
                        headerName: "PERTE EN UNITÉ",
                        width: 96,
                        minWidth: 84,
                        cellClass: calculatedClass,
                        valueGetter:
                            (params: any) =>
                                getLossQuantity(
                                    params,
                                    matrix.rooms
                                ).toFixed(2)
                    },
                    {
                        headerName: "QUANTITÉ AVEC PERTE",
                        width: 112,
                        minWidth: 96,
                        cellClass: calculatedClass,
                        valueGetter:
                            (params: any) =>
                                getQtyWithLoss(
                                    params,
                                    matrix.rooms
                                ).toFixed(2)
                    },
                    {
                        field: "purchase_price",
                        headerName: "COUTANT",
                        width: 86,
                        minWidth: 76,
                        editable: true,
                        valueParser: (params: any) =>
                            parseNumber(params.newValue),
                        valueFormatter: (params: any) =>
                            formatMoney(params.value),
                        cellClass: numericEditableClass
                    },
                    {
                        field: "profit_percent",
                        headerName: "PROFIT %",
                        width: 78,
                        minWidth: 70,
                        editable: true,
                        valueParser: (params: any) =>
                            parseNumber(params.newValue),
                        cellClass: numericEditableClass
                    },
                    {
                        headerName: "PROFIT UNITAIRE",
                        width: 94,
                        minWidth: 82,
                        cellClass: calculatedClass,
                        valueGetter:
                            (params: any) =>
                                getUnitProfit(params).toFixed(2)
                    },
                    {
                        headerName: "PROFIT TOTAL",
                        width: 94,
                        minWidth: 82,
                        cellClass: calculatedClass,
                        valueGetter:
                            (params: any) =>
                                getProfit(
                                    params,
                                    matrix.rooms
                                ).toFixed(2)
                    },
                    {
                        headerName: "VENDANT UNITAIRE",
                        width: 102,
                        minWidth: 90,
                        cellClass: calculatedClass,
                        valueGetter:
                            (params: any) =>
                                getUnitSellPrice(params).toFixed(2)
                    },
                    {
                        headerName: "VENDANT TOTAL",
                        width: 100,
                        minWidth: 88,
                        cellClass: [
                            "calculated-cell",
                            "numeric-cell",
                            "total-cell"
                        ],
                        valueGetter:
                            (params: any) =>
                                getSellPrice(
                                    params,
                                    matrix.rooms
                                ).toFixed(2)
                    }
                ]
            },

            {
                headerName: "INSTALLATION",
                marryChildren: true,
                children: [
                    {
                        field: "installation_cost",
                        headerName: "UNITAIRE",
                        width: 86,
                        minWidth: 78,
                        editable: true,
                        valueParser: (params: any) =>
                            parseNumber(params.newValue),
                        valueFormatter: (params: any) =>
                            formatMoney(params.value),
                        cellClass: numericEditableClass
                    },
                    {
                        headerName: "TOTAL VENDANT",
                        width: 104,
                        minWidth: 92,
                        cellClass: [
                            "calculated-cell",
                            "numeric-cell",
                            "total-cell"
                        ],
                        valueGetter:
                            (params: any) =>
                                getInstallationSellTotal(
                                    params,
                                    matrix.rooms
                                ).toFixed(2)
                    }
                ]
            }

        ];

    }


    function applyMatrix(
        matrix: EstimateMatrixResponse,
        surfaceRows: SurfaceType[]
    ) {

        setColumnDefs(
            buildMatrixColumns(
                matrix,
                surfaceRows
            )
        );

        setMatrixSummary(
            matrix.summary
        );

        syncSummaryForm(
            matrix.summary
        );

        setRowData(
            buildMatrixRows(
                matrix
            )
        );

    }


    function reloadMatrix() {

        return Promise.all(
            [
                fetchEstimateMatrix(),
                fetchSurfaceTypes()
            ]
        )

        .then(
            ([
                matrix,
                surfaceRows
            ]) => {
                setSurfaceTypes(
                    surfaceRows
                );

                applyMatrix(
                    matrix,
                    surfaceRows
                );
            }
        );

    }


    function saveSummaryBlock() {

        if (!matrixSummary)
            return;

        setIsSummarySaving(true);
        setSummaryStatus("");

        updateEstimateMatrixSummary(
            matrixSummary.estimate.id,
            summaryInputPayload()
        )

        .then(
            response => {
                setMatrixSummary(response.summary);
                syncSummaryForm(response.summary);
                setSummaryStatus(
                    "Paramètres sauvegardés" +
                    (
                        response.updated_lines ?
                            " - profit appliqué à " +
                            response.updated_lines +
                            " lignes" :
                            ""
                    )
                );

                return reloadMatrix();
            }
        )

        .catch(
            () => {
                setSummaryStatus("Sauvegarde impossible.");
            }
        )

        .finally(
            () => {
                setIsSummarySaving(false);
            }
        );

    }


    function updateSummaryForm(
        field: keyof typeof summaryForm,
        value: string
    ) {

        setSummaryForm(
            previousForm => ({
                ...previousForm,
                [field]:
                    value
            })
        );

    }


    function searchProductsForLine() {

        setIsMatrixActionLoading(true);
        setMatrixActionStatus("");

        fetchProductPage(
            {
                limit: 20,
                offset: 0,
                search: productSearch.trim(),
                supplier: "",
                status: "active",
                productMenu: "Tous"
            }
        )

        .then(
            response => {
                setProductResults(response.rows);
                setSelectedProductId(
                    response.rows[0] ?
                        String(response.rows[0].id) :
                        ""
                );
                setMatrixActionStatus(
                    response.rows.length ?
                        response.rows.length + " produit(s) trouvé(s)." :
                        "Aucun produit trouvé."
                );
            }
        )

        .catch(
            () => {
                setProductResults([]);
                setSelectedProductId("");
                setMatrixActionStatus("Recherche de produit impossible.");
            }
        )

        .finally(
            () => {
                setIsMatrixActionLoading(false);
            }
        );

    }


    function addRoom() {

        if (!matrixSummary)
            return;

        const roomName =
            newRoomName.trim();

        if (!roomName) {
            setMatrixActionStatus("Inscrire un nom de local.");
            return;
        }

        setIsMatrixActionLoading(true);
        setMatrixActionStatus("");

        createEstimateRoom(
            {
                estimate_id:
                    matrixSummary.estimate.id,
                phase_name:
                    "",
                floor_name:
                    "",
                room_name:
                    roomName
            }
        )

        .then(
            () => {
                setNewRoomName("");
                setMatrixActionStatus("Local ajouté.");
                return reloadMatrix();
            }
        )

        .catch(
            () => {
                setMatrixActionStatus("Ajout du local impossible.");
            }
        )

        .finally(
            () => {
                setIsMatrixActionLoading(false);
            }
        );

    }


    function addLine() {

        if (!matrixSummary)
            return;

        if (!selectedProduct) {
            setMatrixActionStatus("Sélectionner un produit.");
            return;
        }

        if (!selectedProduct.default_unit_id) {
            setMatrixActionStatus("Ce produit n'a pas d'unité par défaut.");
            return;
        }

        if (!surfaceTypes.length) {
            setMatrixActionStatus("Aucune surface active disponible.");
            return;
        }

        const line: EstimateLineInput = {
            estimate_id:
                matrixSummary.estimate.id,
            product_id:
                selectedProduct.id,
            surface_type_id:
                surfaceTypes[0].id,
            unit_id:
                selectedProduct.default_unit_id,
            grout_color:
                selectedProduct.default_grout_color,
            loss_percent:
                15,
            purchase_price:
                selectedProduct.default_purchase_price ?? 0,
            profit_percent:
                matrixSummary.rates.global_profit_percent ?? 20,
            installation_cost:
                0
        };

        setIsMatrixActionLoading(true);
        setMatrixActionStatus("");

        createEstimateLine(
            line
        )

        .then(
            () => {
                setMatrixActionStatus("Ligne ajoutée.");
                return reloadMatrix();
            }
        )

        .catch(
            () => {
                setMatrixActionStatus("Ajout de la ligne impossible.");
            }
        )

        .finally(
            () => {
                setIsMatrixActionLoading(false);
            }
        );

    }


    function supplierQuoteRows(
        summary: EstimateMatrixSummary
    ) {

        if (summary.supplier_quotes.length)
            return summary.supplier_quotes;

        return [
            {
                supplier_name: "",
                expires_on: null,
                quote_reference: null,
                notes: null
            },
            {
                supplier_name: "",
                expires_on: null,
                quote_reference: null,
                notes: null
            },
            {
                supplier_name: "",
                expires_on: null,
                quote_reference: null,
                notes: null
            }
        ];

    }


    function renderMatrixActions() {

        if (!matrixSummary)
            return null;

        return (
            <section className="matrix-action-bar">
                <div className="matrix-action-group">
                    <input
                        type="text"
                        value={newRoomName}
                        onChange={
                            event =>
                                setNewRoomName(event.target.value)
                        }
                        placeholder="Nom du local"
                    />
                    <button
                        type="button"
                        onClick={addRoom}
                        disabled={isMatrixActionLoading}
                    >
                        Ajouter local
                    </button>
                </div>

                <div className="matrix-action-group wide">
                    <input
                        type="search"
                        value={productSearch}
                        onChange={
                            event =>
                                setProductSearch(event.target.value)
                        }
                        onKeyDown={
                            event => {
                                if (event.key === "Enter")
                                    searchProductsForLine();
                            }
                        }
                        placeholder="Produit à ajouter"
                    />
                    <button
                        type="button"
                        onClick={searchProductsForLine}
                        disabled={isMatrixActionLoading}
                    >
                        Chercher
                    </button>
                    <select
                        value={selectedProductId}
                        onChange={
                            event =>
                                setSelectedProductId(event.target.value)
                        }
                    >
                        <option value="">Sélectionner un produit</option>
                        {productResults.map(
                            product => (
                                <option
                                    key={product.id}
                                    value={product.id}
                                >
                                    {[
                                        product.manufacturer_name,
                                        product.name,
                                        product.size_name,
                                        product.supplier_product_code
                                    ].filter(Boolean).join(" - ")}
                                </option>
                            )
                        )}
                    </select>
                    <button
                        type="button"
                        onClick={addLine}
                        disabled={isMatrixActionLoading}
                    >
                        Ajouter ligne
                    </button>
                </div>

                {matrixActionStatus && (
                    <span className="matrix-action-status">
                        {matrixActionStatus}
                    </span>
                )}
            </section>
        );

    }


    function renderMatrixSummary() {

        if (!matrixSummary)
            return null;

        return (
            <section className="estimate-summary-sheet">
                <div className="estimate-summary-layout">
                    <div className="estimate-summary-left">
                        <div className="estimate-summary-project">
                            <div className="summary-label strong">Projet:</div>
                            <div className="summary-value strong">
                                {matrixSummary.project.name}
                            </div>
                            <div className="summary-label"># de projet:</div>
                            <div className="summary-value">
                                {matrixSummary.project.number || ""}
                            </div>
                            <div className="summary-label">adresse:</div>
                            <div className="summary-value">
                                {matrixSummary.project.address}
                            </div>
                            <div className="summary-label">Dernière révision:</div>
                            <div className="summary-value revision-date">
                                {formatDate(matrixSummary.estimate.last_revision_at)}
                            </div>
                        </div>

                        <div className="estimate-summary-client">
                            <div className="summary-label strong">Client</div>
                            <div className="summary-value strong">
                                {matrixSummary.clients.map(
                                    client => client.name
                                ).join(", ")}
                            </div>
                            <div className="summary-label">type:</div>
                            <div className="summary-value">
                                {matrixSummary.clients.map(
                                    client => client.type
                                ).filter(Boolean).join(", ")}
                            </div>
                            <div className="summary-label">courriel:</div>
                            <div className="summary-value"></div>
                            <div className="summary-label">tél:</div>
                            <div className="summary-value"></div>
                        </div>

                        <div className="estimate-summary-suppliers">
                            <div className="summary-supplier-title">Fournisseur</div>
                            <div className="summary-expiration-title">EXPIRATION</div>
                            {supplierQuoteRows(matrixSummary).map(
                                (quote, index) => (
                                    <div
                                        key={index}
                                        className="summary-supplier-row"
                                    >
                                        <div className="summary-supplier-name">
                                            {quote.supplier_name}
                                        </div>
                                        <div className="summary-supplier-expiration">
                                            {formatDate(quote.expires_on)}
                                        </div>
                                    </div>
                                )
                            )}
                        </div>

                        <div className="estimate-summary-tiles">
                            <div className="summary-label strong">Tuiles à demander</div>
                            <div className="summary-value">
                                {matrixSummary.tile_requests.length ?
                                    matrixSummary.tile_requests.map(
                                        tile => [
                                            tile.manufacturer_name,
                                            tile.name,
                                            tile.size_name
                                        ].filter(Boolean).join(" - ")
                                    ).join(" | ") :
                                    "Aucune tuile dans la matrice."}
                            </div>
                        </div>
                    </div>

                    <div className="estimate-summary-rates">
                        <div className="rates-grid current-rates">
                            <div className="rates-label strong">Taux Courants :</div>
                            <div className="rates-value strong">
                                {matrixSummary.rates.current.date}
                            </div>
                            <div className="rates-label">jour</div>
                            <div className="rates-value green">
                                {formatRate(matrixSummary.rates.current.day)}
                            </div>
                            <div className="rates-label">soir</div>
                            <div className="rates-value yellow">
                                {formatRate(matrixSummary.rates.current.evening)}
                            </div>
                            <div className="rates-label">fds/nuit</div>
                            <div className="rates-value red">
                                {formatRate(matrixSummary.rates.current.night)}
                            </div>
                            <div className="rates-label">civil</div>
                            <div className="rates-value dark-red">
                                {formatRate(matrixSummary.rates.current.civil)}
                            </div>
                            <div className="rates-label">T/M</div>
                            <div className="rates-value">
                                {formatRate(matrixSummary.rates.current.tm)}
                            </div>
                        </div>

                        <div className="rates-grid used-rates">
                            <div className="rates-label used">Taux utilisé :</div>
                            <input
                                type="number"
                                step="0.01"
                                value={summaryForm.used_hourly_rate}
                                onChange={
                                    event =>
                                        updateSummaryForm(
                                            "used_hourly_rate",
                                            event.target.value
                                        )
                                }
                            />
                            <div className="rates-unit">$/h</div>

                            <div className="rates-label strong">Profit %</div>
                            <input
                                type="number"
                                step="0.01"
                                value={summaryForm.global_profit_percent}
                                onChange={
                                    event =>
                                        updateSummaryForm(
                                            "global_profit_percent",
                                            event.target.value
                                        )
                                }
                            />
                            <div className="rates-unit">%</div>
                        </div>

                        <div className="rates-grid project-settings">
                            <div className="rates-label">Échéancier probable</div>
                            <input
                                type="text"
                                value={summaryForm.probable_schedule}
                                onChange={
                                    event =>
                                        updateSummaryForm(
                                            "probable_schedule",
                                            event.target.value
                                        )
                                }
                            />

                            <div className="rates-label">Remise fin de projet</div>
                            <input
                                type="number"
                                step="0.01"
                                value={summaryForm.tile_holdback_percent}
                                onChange={
                                    event =>
                                        updateSummaryForm(
                                            "tile_holdback_percent",
                                            event.target.value
                                        )
                                }
                            />

                            <div className="rates-label">Période de garantie</div>
                            <input
                                type="number"
                                step="1"
                                value={summaryForm.warranty_years}
                                onChange={
                                    event =>
                                        updateSummaryForm(
                                            "warranty_years",
                                            event.target.value
                                        )
                                }
                            />
                        </div>

                        <div className="summary-rates-actions">
                            <button
                                type="button"
                                onClick={saveSummaryBlock}
                                disabled={isSummarySaving}
                            >
                                Sauvegarder
                            </button>
                            {summaryStatus && (
                                <span>{summaryStatus}</span>
                            )}
                        </div>
                    </div>
                </div>
            </section>
        );

    }


    function openFolderItem(
        item: EstimateFolderItem
    ) {

        if (!folderStatus)
            return;

        if (item.is_dir) {
            setFolderPath(item.relative_path);
            return;
        }

        window.open(
            estimateFileUrl(
                folderStatus,
                item.relative_path
            ),
            "_blank",
            "noopener,noreferrer"
        );

    }


    useEffect(

        () => {
            if (folderStatus)
                return;

            reloadMatrix();

        },

        [
            folderStatus
        ]

    );


    useEffect(
        () => {
            setFolderPath("");
            setFolderSearch("");
        },
        [
            estimateMenu
        ]
    );


    useEffect(
        () => {
            if (!folderStatus)
                return;

            setIsFolderLoading(true);
            setFolderError("");

            fetchEstimateFolders(
                folderStatus,
                folderPath
            )

            .then(
                response => {
                    setRootName(response.root_name);
                    setFolderItems(response.items);
                }
            )

            .catch(
                () => {
                    setFolderError(
                        "Impossible de charger le répertoire NAS."
                    );
                    setFolderItems([]);
                }
            )

            .finally(
                () => {
                    setIsFolderLoading(false);
                }
            );
        },
        [
            folderPath,
            folderStatus
        ]
    );


    if (folderStatus) {
        return (
            <div className="matrix-page estimate-folder-page">
                <div className="estimate-folder-toolbar">
                    <div className="estimate-folder-breadcrumbs">
                        {breadcrumbs.map(
                            (breadcrumb, index) => (
                                <button
                                    key={breadcrumb.path || "root"}
                                    type="button"
                                    onClick={
                                        () =>
                                            setFolderPath(breadcrumb.path)
                                    }
                                >
                                    {index > 0 && "/ "}
                                    {breadcrumb.label}
                                </button>
                            )
                        )}
                    </div>

                    <input
                        type="search"
                        value={folderSearch}
                        onChange={
                            event =>
                                setFolderSearch(event.target.value)
                        }
                        placeholder="Rechercher"
                    />
                </div>

                <div className="estimate-folder-content">
                    {folderPath && (
                        <button
                            type="button"
                            className="estimate-folder-back"
                            onClick={
                                () =>
                                    setFolderPath(parentFolderPath())
                            }
                        >
                            Remonter
                        </button>
                    )}

                    {folderError && (
                        <div className="estimate-folder-error">
                            {folderError}
                        </div>
                    )}

                    {isFolderLoading && (
                        <div className="estimate-folder-empty">
                            Chargement...
                        </div>
                    )}

                    {!isFolderLoading && !folderError && (
                        <div className="estimate-folder-list">
                            {filteredFolderItems.map(
                                item => (
                                    <button
                                        key={item.relative_path}
                                        type="button"
                                        className={
                                            item.is_dir ?
                                                "estimate-folder-item directory" :
                                                "estimate-folder-item file"
                                        }
                                        onClick={
                                            () =>
                                                openFolderItem(item)
                                        }
                                    >
                                        <span className="estimate-folder-icon">
                                            {item.is_dir ? "Dossier" : "Fichier"}
                                        </span>
                                        <span className="estimate-folder-name">
                                            {item.name}
                                        </span>
                                        <span className="estimate-folder-meta">
                                            {item.is_dir ?
                                                "" :
                                                formatFileSize(item.size)}
                                        </span>
                                        <span className="estimate-folder-date">
                                            {formatModifiedAt(item.modified_at)}
                                        </span>
                                    </button>
                                )
                            )}

                            {filteredFolderItems.length === 0 && (
                                <div className="estimate-folder-empty">
                                    Aucun élément à afficher.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }


    return (

        <div className="matrix-page">

            {renderMatrixSummary()}

            {renderMatrixActions()}

            <ZoomToolbar
                zoom={zoom}
                contextLabel={"Soumissions " + estimateMenu.toLowerCase()}
                onFitToScreen={fitToScreen}
                onZoomChange={applyZoom}
            />

            <MatrixGrid
                ref={gridRef}
                rowData={rowData}
                columnDefs={columnDefs}
                onCellValueChanged={onCellValueChanged}
                zoomScale={ZOOM_LEVELS[zoom] || 1}
                localeText={GRID_LOCALE_TEXT}
            />

        </div>

    );

}


export default MatrixView;
