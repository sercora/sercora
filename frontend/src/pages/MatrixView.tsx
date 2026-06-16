import {
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";

import MatrixGrid from "../components/MatrixGrid";
import ZoomToolbar from "../components/ZoomToolbar";

import {
    getInstallTotal,
    getMaterialCost,
    getProfit,
    getQtyTotal,
    getQtyWithLoss,
    getSellPrice
} from "../utils/matrixCalculations";

import {
    estimateFileUrl,
    fetchEstimateMatrix,
    fetchEstimateFolders,
    updateEstimateLine as saveEstimateLine,
    updateEstimateQuantity as saveEstimateQuantity
} from "../utils/matrixApi";
import type {
    EstimateFolderItem
} from "../utils/matrixApi";

import "../styles/grid.css";


const LINE_EDITABLE_FIELDS = [
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

        params.data[field] =
            parseNumber(
                params.newValue
            );

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
            Math.round(25 * scale)
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

            fetchEstimateMatrix()

            .then(

                matrix => {

                    const numericEditableClass = [
                        "editable-cell",
                        "numeric-cell"
                    ];

                    const calculatedClass = [
                        "calculated-cell",
                        "numeric-cell"
                    ];

                    const cols: any[] = [

                        {
                            field: "surface_name",
                            rowGroup: true,
                            hide: true
                        },

                        {
                            field: "product_name",
                            headerName: "DESCRIPTION",
                            width: 280,
                            minWidth: 220,
                            pinned: "left",
                            cellClass: getSupplierClass
                        },

                        {
                            field: "unit_name",
                            headerName: "UNITÉ DE MESURE",
                            width: 70,
                            minWidth: 60,
                            cellClass: "calculated-cell"
                        },

                        {
                            field: "grout_color",
                            headerName: "COULIS",
                            width: 90,
                            minWidth: 80,
                            cellClass: "calculated-cell"
                        },

                        {
                            field: "loss_percent",
                            headerName: "PERTE EN %",
                            width: 78,
                            minWidth: 70,
                            editable: true,
                            valueParser: (params: any) =>
                                parseNumber(params.newValue),
                            cellClass: numericEditableClass
                        },

                        {
                            field: "purchase_price",
                            headerName: "COST",
                            width: 95,
                            minWidth: 82,
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
                            field: "installation_cost",
                            headerName: "PRIX UNITAIRES",
                            width: 85,
                            minWidth: 78,
                            editable: true,
                            valueParser: (params: any) =>
                                parseNumber(params.newValue),
                            valueFormatter: (params: any) =>
                                formatMoney(params.value),
                            cellClass: numericEditableClass
                        }

                    ];


                    matrix.rooms.forEach(

                        (room: string) => {

                            cols.push(

                                {

                                    field: room,

                                    headerName: room,

                                    width: 82,

                                    minWidth: 72,

                                    editable: true,

                                    valueParser: (params: any) =>
                                        parseNumber(params.newValue),

                                    cellClass: numericEditableClass

                                }

                            );

                        }

                    );


                    cols.push(

                        {

                            headerName: "QTÉ",

                            width: 88,

                            minWidth: 78,

                            cellClass: calculatedClass,

                            valueGetter:

                                (params: any) =>

                                    getQtyTotal(
                                        params,
                                        matrix.rooms
                                    )

                        },

                        {

                            headerName: "QTÉS TOTALES",

                            width: 88,

                            minWidth: 78,

                            cellClass: calculatedClass,

                            valueGetter:

                                (params: any) =>

                                    getQtyWithLoss(
                                        params,
                                        matrix.rooms
                                    ).toFixed(2)

                        },

                        {

                            headerName: "TOTAL MATÉRIEL",

                            width: 108,

                            minWidth: 96,

                            cellClass: calculatedClass,

                            valueGetter:

                                (params: any) =>

                                    getMaterialCost(
                                        params,
                                        matrix.rooms
                                    ).toFixed(2)

                        },

                        {

                            headerName: "PROFIT TOTAL",

                            width: 86,

                            minWidth: 78,

                            cellClass: calculatedClass,

                            valueGetter:

                                (params: any) =>

                                    getProfit(
                                        params,
                                        matrix.rooms
                                    ).toFixed(2)

                        },

                        {

                            headerName: "TOTAL INSTALLATION",

                            width: 104,

                            minWidth: 94,

                            cellClass: calculatedClass,

                            valueGetter:

                                (params: any) =>

                                    getInstallTotal(
                                        params,
                                        matrix.rooms
                                    ).toFixed(2)

                        },

                        {

                            headerName: "TOTAL VENDANT",

                            width: 96,

                            minWidth: 86,

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

                    );


                    setColumnDefs(
                        cols
                    );


                    const rows = matrix.lines.map(

                        (line: any) => {

                            const row: any = {

                                line_id:
                                    line.line_id,

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


                    setRowData(
                        rows
                    );

                }

            );

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
