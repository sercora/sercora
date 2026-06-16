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
    deleteEstimateLine,
    deleteEstimateRoom,
    estimateFileUrl,
    fetchEstimateMatrix,
    fetchEstimateFolders,
    fetchSurfaceTypes,
    updateEstimateMatrixSummary,
    updateEstimateRoom,
    updateEstimateLineProduct,
    updateEstimateLinePosition,
    updateEstimateLine as saveEstimateLine,
    updateEstimateQuantity as saveEstimateQuantity
} from "../utils/matrixApi";
import type {
    EstimateFolderItem,
    EstimateLineInput,
    EstimateMatrixResponse,
    EstimateMatrixSummary,
    EstimateMatrixSummaryInput,
    EstimateRoomColumn,
    SurfaceType
} from "../utils/matrixApi";
import {
    fetchProduct,
    fetchProductPage,
    fetchUnits,
    updateProduct
} from "../utils/productsApi";
import type {
    Product,
    ProductInput,
    Unit
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


function textValue(
    value: string | null
) {

    const trimmedValue =
        String(value || "").trim();

    if (!trimmedValue)
        return null;

    return trimmedValue;

}


function numberValue(
    value: string | number | null
) {

    if (value === null)
        return null;

    const normalizedValue =
        String(value).replace(",", ".").trim();

    if (!normalizedValue)
        return null;

    const parsedValue =
        Number(normalizedValue);

    if (Number.isNaN(parsedValue))
        return null;

    return parsedValue;

}


function productToForm(
    product: Product
): ProductInput {

    return {
        product_type_id:
            product.product_type_id,
        name:
            product.name || "",
        manufacturer_name:
            product.manufacturer_name || "",
        collection_name:
            product.collection_name || "",
        color_name:
            product.color_name || "",
        finish_name:
            product.finish_name || "",
        size_name:
            product.size_name || "",
        default_unit_id:
            product.default_unit_id,
        default_grout_color:
            product.default_grout_color || "",
        prosol_product_id:
            product.prosol_product_id,
        prosol_uuid:
            product.prosol_uuid,
        prosol_sku:
            product.prosol_sku,
        manufacturer_sku:
            product.manufacturer_sku,
        category_name:
            product.category_name,
        image_url:
            product.image_url,
        source_url:
            product.source_url,
        default_purchase_price:
            product.default_purchase_price,
        msrp_price:
            product.msrp_price,
        supplier_name:
            product.supplier_names || "",
        supplier_product_code:
            product.supplier_product_code || "",
        technical_documents:
            product.technical_documents || [],
        coverage_options:
            product.coverage_options || [],
        active:
            product.active
    };

}


function normalizeProductForm(
    form: ProductInput
): ProductInput {

    return {
        ...form,
        name:
            String(form.name || "").trim(),
        manufacturer_name:
            textValue(form.manufacturer_name),
        collection_name:
            textValue(form.collection_name),
        color_name:
            textValue(form.color_name),
        finish_name:
            textValue(form.finish_name),
        size_name:
            textValue(form.size_name),
        default_grout_color:
            textValue(form.default_grout_color),
        prosol_uuid:
            textValue(form.prosol_uuid),
        prosol_sku:
            textValue(form.prosol_sku),
        manufacturer_sku:
            textValue(form.manufacturer_sku),
        category_name:
            textValue(form.category_name),
        image_url:
            textValue(form.image_url),
        source_url:
            textValue(form.source_url),
        default_purchase_price:
            numberValue(form.default_purchase_price),
        msrp_price:
            numberValue(form.msrp_price),
        supplier_name:
            textValue(form.supplier_name),
        supplier_product_code:
            textValue(form.supplier_product_code),
        coverage_options:
            form.coverage_options || [],
        active:
            form.active
    };

}


function MatrixView({
    estimateMenu
}: MatrixViewProps) {

    const gridRef = useRef<any>(null);

    const [columnDefs, setColumnDefs] = useState<any[]>([]);

    const [rowData, setRowData] = useState<any[]>([]);

    const [zoom, setZoom] = useState("100");
    const [surfaceTypes, setSurfaceTypes] = useState<SurfaceType[]>([]);
    const [roomColumns, setRoomColumns] = useState<EstimateRoomColumn[]>([]);
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
    const [newRoomPhase, setNewRoomPhase] = useState("");
    const [newRoomFloor, setNewRoomFloor] = useState("");
    const [newRoomName, setNewRoomName] = useState("");
    const [productSearch, setProductSearch] = useState("");
    const [newLinePosition, setNewLinePosition] = useState("");
    const [productResults, setProductResults] = useState<Product[]>([]);
    const [selectedProductId, setSelectedProductId] = useState("");
    const [replaceLine, setReplaceLine] = useState<any | null>(null);
    const [replaceProductSearch, setReplaceProductSearch] = useState("");
    const [replaceProductResults, setReplaceProductResults] = useState<Product[]>([]);
    const [selectedReplaceProductId, setSelectedReplaceProductId] = useState("");
    const [replaceSurfaceTypeId, setReplaceSurfaceTypeId] = useState("");
    const [replaceLinePosition, setReplaceLinePosition] = useState("");
    const [replaceMatchingProduct, setReplaceMatchingProduct] = useState(false);
    const [replaceProductStatus, setReplaceProductStatus] = useState("");
    const [isReplaceProductLoading, setIsReplaceProductLoading] = useState(false);
    const [matrixActionStatus, setMatrixActionStatus] = useState("");
    const [isMatrixActionLoading, setIsMatrixActionLoading] = useState(false);
    const [units, setUnits] = useState<Unit[]>([]);
    const [editingProductId, setEditingProductId] = useState<number | null>(null);
    const [productForm, setProductForm] = useState<ProductInput | null>(null);
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [isProductSaving, setIsProductSaving] = useState(false);
    const [productEditStatus, setProductEditStatus] = useState("");
    const [tileSurfaceProduct, setTileSurfaceProduct] = useState<Product | null>(null);
    const [selectedTileSurfaceIds, setSelectedTileSurfaceIds] = useState<number[]>([]);
    const [tileSurfaceStatus, setTileSurfaceStatus] = useState("");
    const [selectedLineIds, setSelectedLineIds] = useState<number[]>([]);
    const [editingRoom, setEditingRoom] = useState<EstimateRoomColumn | null>(null);
    const [roomEditForm, setRoomEditForm] = useState({
        phase_name: "",
        floor_name: "",
        room_name: ""
    });
    const [roomEditStatus, setRoomEditStatus] = useState("");
    const [isRoomSaving, setIsRoomSaving] = useState(false);
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


    const selectedReplaceProduct = useMemo(
        () =>
            replaceProductResults.find(
                product =>
                    String(product.id) === selectedReplaceProductId
            ) || null,
        [
            replaceProductResults,
            selectedReplaceProductId
        ]
    );


    function matrixRoomColumns(
        matrix: EstimateMatrixResponse
    ): EstimateRoomColumn[] {

        if (matrix.room_columns?.length)
            return matrix.room_columns;

        return matrix.rooms.map(
            room => ({
                id:
                    0,
                key:
                    room,
                phase_name:
                    "",
                floor_name:
                    "",
                room_name:
                    room
            })
        );

    }


    function matrixRoomKeys(
        matrix: EstimateMatrixResponse
    ) {

        return matrixRoomColumns(
            matrix
        ).map(
            room =>
                room.key
        );

    }


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
                [
                    params.data?.supplier_names,
                    params.data?.manufacturer_name,
                    params.data?.product_name
                ].filter(Boolean).join(" ")
            ).toLowerCase();

        if (supplier.includes("olympia"))
            return "supplier-olympia";

        if (supplier.includes("mapei"))
            return "supplier-mapei";

        if (supplier.includes("schluter"))
            return "supplier-schluter";

        if (supplier.includes("centura"))
            return "supplier-centura";

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

        if (field === "line_number") {

            const nextPosition =
                parseNumber(
                    params.newValue
                );

            if (nextPosition <= 0) {
                refreshGrid();
                return;
            }

            setIsMatrixActionLoading(true);
            setMatrixActionStatus("");

            updateEstimateLinePosition(
                params.data.line_id,
                nextPosition
            )

            .then(
                () => {
                    setMatrixActionStatus("Ligne déplacée.");
                    return reloadMatrix();
                }
            )

            .catch(
                () => {
                    setMatrixActionStatus("Déplacement de ligne impossible.");
                    refreshGrid();
                }
            )

            .finally(
                () => {
                    setIsMatrixActionLoading(false);
                }
            );

            return;

        }

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


    function onSelectionChanged(
        params: any
    ) {

        const rows =
            params.api.getSelectedRows();

        setSelectedLineIds(
            rows.map(
                (row: any) =>
                    Number(row.line_id)
            ).filter(Boolean)
        );

    }


    function onCellClicked(
        params: any
    ) {

        const field =
            params.column.getColId();

        if (field === "replace_product") {
            openReplaceProductDialog(params.data);
            return;
        }

        if (
            field !== "product_name" ||
            !params.data?.product_id
        )
            return;

        openProductEditor(
            Number(params.data.product_id)
        );

    }


    function deleteSelectedLines() {

        if (!selectedLineIds.length) {
            setMatrixActionStatus("Sélectionner au moins une ligne.");
            return;
        }

        setIsMatrixActionLoading(true);
        setMatrixActionStatus("");

        Promise.all(
            selectedLineIds.map(
                lineId =>
                    deleteEstimateLine(lineId)
            )
        )

        .then(
            () => {
                setMatrixActionStatus(
                    selectedLineIds.length > 1 ?
                        selectedLineIds.length + " lignes supprimées." :
                        "Ligne supprimée."
                );
                return reloadMatrix();
            }
        )

        .catch(
            () => {
                setMatrixActionStatus("Suppression des lignes impossible.");
            }
        )

        .finally(
            () => {
                setIsMatrixActionLoading(false);
            }
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

                    line_number:
                        line.line_number,

                    sort_order:
                        line.sort_order,

                    surface_type_id:
                        line.surface_type_id,

                    product_id:
                        line.product_id,

                    surface_name:
                        line.surface_name,

                    product_name:
                        line.product_name,

                    manufacturer_name:
                        line.manufacturer_name,

                    supplier_names:
                        line.supplier_names,

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

                matrixRoomColumns(
                    matrix
                ).forEach(

                    room => {

                        row[room.key] =
                            line.quantities[room.key]?.quantity ?? 0;

                        row[
                            room.key + "_id"
                        ] =
                            line.quantities[room.key]?.id;

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

        const roomFields =
            matrixRoomKeys(
                matrix
            );

        const flatRoomColumns = matrixRoomColumns(
            matrix
        ).map(

            room => ({

                field: room.key,

                headerName: room.room_name,

                headerTooltip: [
                    room.phase_name ?
                        "Phase: " + room.phase_name :
                        "",
                    room.floor_name ?
                        "Étage: " + room.floor_name :
                        "",
                    "Local: " + room.room_name
                ].filter(Boolean).join(" | "),

                width: 82,

                minWidth: 72,

                editable: true,

                valueParser: (params: any) =>
                    parseNumber(params.newValue),

                cellClass: numericEditableClass,

                headerClass: "takeoff-room-header"

            })

        );

        const roomGroups = new Map<string, Map<string, any[]>>();

        matrixRoomColumns(
            matrix
        ).forEach(
            room => {
                const phaseName =
                    room.phase_name?.trim() || "";

                const floorName =
                    room.floor_name?.trim() || "";

                if (!roomGroups.has(phaseName))
                    roomGroups.set(
                        phaseName,
                        new Map()
                    );

                const phaseGroup =
                    roomGroups.get(phaseName);

                if (!phaseGroup)
                    return;

                if (!phaseGroup.has(floorName))
                    phaseGroup.set(
                        floorName,
                        []
                    );

                phaseGroup.get(floorName)?.push(
                    flatRoomColumns.find(
                        column =>
                            column.field === room.key
                    )
                );
            }
        );

        const groupedRoomColumns = Array.from(
            roomGroups.entries()
        ).map(
            ([
                phaseName,
                floorGroups
            ]) => {
                const floorChildren =
                    Array.from(
                        floorGroups.entries()
                    ).map(
                        ([
                            floorName,
                            columns
                        ]) => {
                            const visibleColumns =
                                columns.filter(Boolean);

                            if (!floorName)
                                return visibleColumns;

                            return {
                                headerName:
                                    floorName,
                                headerTooltip:
                                    "Étage: " + floorName,
                                headerClass:
                                    "takeoff-floor-header",
                                marryChildren:
                                    true,
                                children:
                                    visibleColumns
                            };
                        }
                    ).flat();

                if (!phaseName)
                    return floorChildren;

                return {
                    headerName:
                        phaseName,
                    headerTooltip:
                        "Phase: " + phaseName,
                    headerClass:
                        "takeoff-phase-header",
                    marryChildren:
                        true,
                    children:
                        floorChildren
                };
            }
        ).flat();

        return [

            {
                headerName: "",
                field: "select_line",
                width: 42,
                minWidth: 42,
                maxWidth: 42,
                pinned: "left",
                checkboxSelection: true,
                headerCheckboxSelection: true,
                sortable: false,
                filter: false,
                resizable: false,
                suppressMovable: true,
                cellClass: "line-select-cell"
            },

            {
                headerName: "#",
                field: "line_number",
                width: 54,
                minWidth: 48,
                maxWidth: 64,
                pinned: "left",
                editable: true,
                valueParser: (params: any) =>
                    parseNumber(params.newValue),
                cellClass: [
                    "editable-cell",
                    "numeric-cell",
                    "line-number-cell"
                ]
            },

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
                        cellClass: (params: any) => [
                            getSupplierClass(params),
                            "product-link-cell"
                        ].filter(Boolean)
                    },
                    {
                        field: "replace_product",
                        headerName: "",
                        width: 74,
                        minWidth: 68,
                        maxWidth: 82,
                        pinned: "left",
                        sortable: false,
                        filter: false,
                        resizable: false,
                        suppressMovable: true,
                        cellRenderer: () => "Changer",
                        cellClass: "replace-product-cell"
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
                headerTooltip: "Quantités par phase, étage et local",
                headerClass: "takeoff-root-header",
                marryChildren: true,
                children: groupedRoomColumns
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
                                    roomFields
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
                                    roomFields
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
                                    roomFields
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
                                    roomFields
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
                                    roomFields
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
                                    roomFields
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

        setRoomColumns(
            matrixRoomColumns(
                matrix
            )
        );

        syncSummaryForm(
            matrix.summary
        );

        setRowData(
            buildMatrixRows(
                matrix
            )
        );

        setSelectedLineIds([]);

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
                limit: null,
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
                        response.total + " produit(s) trouvé(s)." :
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


    function openReplaceProductDialog(
        row: any
    ) {

        setReplaceLine(row);
        setReplaceProductSearch("");
        setReplaceProductResults([]);
        setSelectedReplaceProductId("");
        setReplaceSurfaceTypeId(String(row.surface_type_id || ""));
        setReplaceLinePosition(String(row.line_number || ""));
        setReplaceMatchingProduct(false);
        setReplaceProductStatus("");

    }


    function searchReplacementProducts() {

        setIsReplaceProductLoading(true);
        setReplaceProductStatus("");

        fetchProductPage(
            {
                limit: null,
                offset: 0,
                search: replaceProductSearch.trim(),
                supplier: "",
                status: "active",
                productMenu: "Tous"
            }
        )

        .then(
            response => {
                setReplaceProductResults(response.rows);
                setSelectedReplaceProductId(
                    response.rows[0] ?
                        String(response.rows[0].id) :
                        ""
                );
                setReplaceProductStatus(
                    response.rows.length ?
                        response.total + " produit(s) trouvé(s)." :
                        "Aucun produit trouvé."
                );
            }
        )

        .catch(
            () => {
                setReplaceProductResults([]);
                setSelectedReplaceProductId("");
                setReplaceProductStatus("Recherche de produit impossible.");
            }
        )

        .finally(
            () => {
                setIsReplaceProductLoading(false);
            }
        );

    }


    function applyReplaceLineChanges() {

        if (!replaceLine)
            return;

        const surfaceTypeId =
            Number(replaceSurfaceTypeId);

        if (!surfaceTypeId) {
            setReplaceProductStatus("Sélectionner une surface.");
            return;
        }

        const nextPosition =
            Number(replaceLinePosition);

        if (
            replaceLinePosition.trim() &&
            (
                Number.isNaN(nextPosition) ||
                nextPosition <= 0
            )
        ) {
            setReplaceProductStatus("Position invalide.");
            return;
        }

        if (
            selectedReplaceProduct &&
            !selectedReplaceProduct.default_unit_id
        ) {
            setReplaceProductStatus("Ce produit n'a pas d'unité par défaut.");
            return;
        }

        setIsReplaceProductLoading(true);
        setReplaceProductStatus("");

        const updates: Promise<any>[] = [];

        if (selectedReplaceProduct) {

            const replaceUnitId =
                selectedReplaceProduct.default_unit_id;

            if (!replaceUnitId) {
                setReplaceProductStatus("Ce produit n'a pas d'unité par défaut.");
                setIsReplaceProductLoading(false);
                return;
            }

            updates.push(
                updateEstimateLineProduct(
                    replaceLine.line_id,
                    {
                        product_id:
                            selectedReplaceProduct.id,
                        surface_type_id:
                            surfaceTypeId,
                        unit_id:
                            replaceUnitId,
                        grout_color:
                            selectedReplaceProduct.default_grout_color,
                        purchase_price:
                            selectedReplaceProduct.default_purchase_price ?? 0,
                        apply_matching_product:
                            replaceMatchingProduct
                    }
                )
            );

        } else {

            updates.push(
                saveEstimateLine(
                    replaceLine.line_id,
                    {
                        surface_type_id:
                            surfaceTypeId,
                        loss_percent:
                            parseNumber(replaceLine.loss_percent),
                        purchase_price:
                            parseNumber(replaceLine.purchase_price),
                        profit_percent:
                            parseNumber(replaceLine.profit_percent),
                        installation_cost:
                            parseNumber(replaceLine.installation_cost)
                    }
                )
            );

        }

        if (
            replaceLinePosition.trim() &&
            nextPosition !== Number(replaceLine.line_number)
        ) {
            updates.push(
                updateEstimateLinePosition(
                    replaceLine.line_id,
                    nextPosition
                )
            );
        }

        Promise.all(updates)

        .then(
            responses => {
                const productResponse =
                    responses.find(
                        response =>
                            response?.updated_lines
                    );

                setReplaceLine(null);
                setMatrixActionStatus(
                    productResponse?.updated_lines > 1 ?
                        productResponse.updated_lines + " lignes remplacées." :
                        selectedReplaceProduct ?
                            "Produit remplacé." :
                            "Ligne mise à jour."
                );
                return reloadMatrix();
            }
        )

        .catch(
            () => {
                setReplaceProductStatus("Remplacement du produit impossible.");
            }
        )

        .finally(
            () => {
                setIsReplaceProductLoading(false);
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
                    newRoomPhase.trim(),
                floor_name:
                    newRoomFloor.trim(),
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


    function openRoomEditor(
        room: EstimateRoomColumn
    ) {

        setEditingRoom(room);
        setRoomEditForm(
            {
                phase_name:
                    room.phase_name || "",
                floor_name:
                    room.floor_name || "",
                room_name:
                    room.room_name || ""
            }
        );
        setRoomEditStatus("");

    }


    function saveRoomEdit() {

        if (!editingRoom)
            return;

        if (!roomEditForm.room_name.trim()) {
            setRoomEditStatus("Nom du local requis.");
            return;
        }

        setIsRoomSaving(true);
        setRoomEditStatus("");

        updateEstimateRoom(
            editingRoom.id,
            {
                phase_name:
                    roomEditForm.phase_name.trim(),
                floor_name:
                    roomEditForm.floor_name.trim(),
                room_name:
                    roomEditForm.room_name.trim()
            }
        )

        .then(
            () => {
                setEditingRoom(null);
                setMatrixActionStatus("Local sauvegardé.");
                return reloadMatrix();
            }
        )

        .catch(
            () => {
                setRoomEditStatus("Sauvegarde du local impossible.");
            }
        )

        .finally(
            () => {
                setIsRoomSaving(false);
            }
        );

    }


    function deleteRoomEdit() {

        if (!editingRoom)
            return;

        const shouldDelete =
            window.confirm(
                "Supprimer le local \"" +
                editingRoom.room_name +
                "\" et toutes ses quantités?"
            );

        if (!shouldDelete)
            return;

        setIsRoomSaving(true);
        setRoomEditStatus("");

        const deletedRoomId =
            editingRoom.id;

        deleteEstimateRoom(
            deletedRoomId
        )

        .then(
            () => {
                const nextRoom =
                    roomColumns.find(
                        room =>
                            room.id !== deletedRoomId
                    ) || null;

                if (nextRoom)
                    openRoomEditor(nextRoom);
                else
                    setEditingRoom(null);

                setMatrixActionStatus("Local supprimé.");

                return reloadMatrix();
            }
        )

        .catch(
            () => {
                setRoomEditStatus("Suppression du local impossible.");
            }
        )

        .finally(
            () => {
                setIsRoomSaving(false);
            }
        );

    }


    function loadUnitsIfNeeded() {

        if (units.length)
            return Promise.resolve(units);

        return fetchUnits()

        .then(
            response => {
                setUnits(response);
                return response;
            }
        );

    }


    function openProductEditor(
        productId: number,
        message = ""
    ) {

        setIsMatrixActionLoading(true);
        setProductEditStatus(message);

        Promise.all(
            [
                fetchProduct(productId),
                loadUnitsIfNeeded()
            ]
        )

        .then(
            ([
                product
            ]) => {
                setEditingProductId(product.id);
                setProductForm(productToForm(product));
                setIsProductModalOpen(true);
            }
        )

        .catch(
            () => {
                setMatrixActionStatus("Impossible de charger le produit.");
            }
        )

        .finally(
            () => {
                setIsMatrixActionLoading(false);
            }
        );

    }


    function updateProductForm(
        field: keyof ProductInput,
        value: string | number | boolean | null
    ) {

        setProductForm(
            previousForm => {
                if (!previousForm)
                    return previousForm;

                return {
                    ...previousForm,
                    [field]:
                        value
                };
            }
        );

    }


    function isTileProduct(
        product: Product
    ) {

        return String(
            product.product_type_name || ""
        ).trim().toLowerCase() === "tuile";

    }


    function openTileSurfaceSelector(
        product: Product
    ) {

        setTileSurfaceProduct(product);
        setSelectedTileSurfaceIds([]);
        setTileSurfaceStatus("");

    }


    function toggleTileSurface(
        surfaceId: number,
        checked: boolean
    ) {

        setSelectedTileSurfaceIds(
            previousSurfaceIds => {
                if (checked)
                    return Array.from(
                        new Set(
                            [
                                ...previousSurfaceIds,
                                surfaceId
                            ]
                        )
                    );

                return previousSurfaceIds.filter(
                    previousSurfaceId =>
                        previousSurfaceId !== surfaceId
                );
            }
        );

    }


    function createLineForProduct(
        product: Product,
        surfaceTypeIds?: number[]
    ) {

        if (!matrixSummary)
            return;

        if (!product.default_unit_id) {
            openProductEditor(
                product.id,
                "Choisir une unité par défaut pour ajouter ce produit à la matrice."
            );
            return;
        }

        const unitId =
            product.default_unit_id;

        if (!surfaceTypes.length) {
            setMatrixActionStatus("Aucune surface active disponible.");
            return;
        }

        if (
            !surfaceTypeIds &&
            isTileProduct(product)
        ) {
            openTileSurfaceSelector(product);
            return;
        }

        const targetSurfaceTypeIds =
            surfaceTypeIds?.length ?
                surfaceTypeIds :
                [
                    surfaceTypes[0].id
                ];

        const insertPosition =
            nullableNumber(
                newLinePosition
            );

        const lines: EstimateLineInput[] =
            targetSurfaceTypeIds.map(
                (surfaceTypeId, index) => ({
                    estimate_id:
                        matrixSummary.estimate.id,
                    product_id:
                        product.id,
                    surface_type_id:
                        surfaceTypeId,
                    unit_id:
                        unitId,
                    insert_position:
                        insertPosition ?
                            insertPosition + index :
                            null,
                    grout_color:
                        product.default_grout_color,
                    loss_percent:
                        15,
                    purchase_price:
                        product.default_purchase_price ?? 0,
                    profit_percent:
                        matrixSummary.rates.global_profit_percent ?? 20,
                    installation_cost:
                        0
                })
            );

        setIsMatrixActionLoading(true);
        setMatrixActionStatus("");

        Promise.all(
            lines.map(
                line =>
                    createEstimateLine(line)
            )
        )

        .then(
            () => {
                setTileSurfaceProduct(null);
                setSelectedTileSurfaceIds([]);
                setTileSurfaceStatus("");
                setMatrixActionStatus(
                    lines.length > 1 ?
                        lines.length + " lignes ajoutées." :
                        "Ligne ajoutée."
                );
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


    function confirmTileSurfaces() {

        if (!tileSurfaceProduct)
            return;

        if (!selectedTileSurfaceIds.length) {
            setTileSurfaceStatus("Sélectionner au moins une surface.");
            return;
        }

        createLineForProduct(
            tileSurfaceProduct,
            selectedTileSurfaceIds
        );

    }


    function addLine() {

        if (!selectedProduct) {
            setMatrixActionStatus("Sélectionner un produit.");
            return;
        }

        createLineForProduct(
            selectedProduct
        );

    }


    function saveProductAndAddLine() {

        if (!editingProductId || !productForm)
            return;

        const payload =
            normalizeProductForm(productForm);

        if (!payload.name || !payload.product_type_id) {
            setProductEditStatus("Nom et type requis.");
            return;
        }

        if (!payload.default_unit_id) {
            setProductEditStatus("Choisir une unité par défaut.");
            return;
        }

        setIsProductSaving(true);
        setProductEditStatus("");

        updateProduct(
            editingProductId,
            payload
        )

        .then(
            () =>
                fetchProduct(editingProductId)
        )

        .then(
            product => {
                setProductResults(
                    previousProducts =>
                        previousProducts.map(
                            previousProduct =>
                                previousProduct.id === product.id ?
                                    product :
                                    previousProduct
                        )
                );
                setSelectedProductId(String(product.id));
                setIsProductModalOpen(false);
                setEditingProductId(null);
                setProductForm(null);
                setMatrixActionStatus("Produit sauvegardé.");
                createLineForProduct(product);
            }
        )

        .catch(
            () => {
                setProductEditStatus("Sauvegarde du produit impossible.");
            }
        )

        .finally(
            () => {
                setIsProductSaving(false);
            }
        );

    }


    function supplierQuoteRows(
        summary: EstimateMatrixSummary
    ) {

        if (summary.supplier_quotes.length)
            return summary.supplier_quotes;

        return [];

    }


    function renderMatrixActions() {

        if (!matrixSummary)
            return null;

        return (
            <section className="matrix-action-bar">
                <div className="matrix-action-row product-row">
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
                    <input
                        type="number"
                        min="1"
                        step="1"
                        value={newLinePosition}
                        onChange={
                            event =>
                                setNewLinePosition(event.target.value)
                        }
                        placeholder="Position"
                        className="line-position-input"
                    />
                    <div className="matrix-product-results">
                        {productResults.map(
                            product => (
                                <button
                                    key={product.id}
                                    type="button"
                                    className={
                                        String(product.id) === selectedProductId ?
                                            "selected" :
                                            ""
                                    }
                                    onClick={
                                        () =>
                                            setSelectedProductId(
                                                String(product.id)
                                            )
                                    }
                                >
                                    {[
                                        product.manufacturer_name,
                                        product.name,
                                        product.size_name,
                                        product.supplier_product_code
                                    ].filter(Boolean).join(" - ")}
                                </button>
                            )
                        )}
                        {productResults.length === 0 && (
                            <div>Aucun produit sélectionné.</div>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={addLine}
                        disabled={isMatrixActionLoading}
                    >
                        Ajouter ligne
                    </button>
                    <button
                        type="button"
                        className="secondary"
                        onClick={
                            () => {
                                if (selectedProduct)
                                    openProductEditor(selectedProduct.id);
                            }
                        }
                        disabled={
                            isMatrixActionLoading ||
                            !selectedProduct
                        }
                    >
                        Éditer produit
                    </button>
                    <button
                        type="button"
                        className="danger"
                        onClick={deleteSelectedLines}
                        disabled={
                            isMatrixActionLoading ||
                            !selectedLineIds.length
                        }
                    >
                        Supprimer lignes
                    </button>
                </div>

                <div className="matrix-action-row room-row">
                    <input
                        type="text"
                        value={newRoomPhase}
                        onChange={
                            event =>
                                setNewRoomPhase(event.target.value)
                        }
                        placeholder="Phase"
                    />
                    <input
                        type="text"
                        value={newRoomFloor}
                        onChange={
                            event =>
                                setNewRoomFloor(event.target.value)
                        }
                        placeholder="Étage"
                    />
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
                    <button
                        type="button"
                        className="secondary"
                        onClick={
                            () => {
                                if (roomColumns[0])
                                    openRoomEditor(roomColumns[0]);
                            }
                        }
                        disabled={!roomColumns.length}
                    >
                        Modifier locaux
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


    function renderProductEditor() {

        if (!isProductModalOpen || !productForm)
            return null;

        return (
            <div className="matrix-modal-backdrop">
                <section className="matrix-product-modal">
                    <header>
                        <h2>Modifier produit</h2>
                        <button
                            type="button"
                            onClick={
                                () => {
                                    setIsProductModalOpen(false);
                                    setEditingProductId(null);
                                    setProductForm(null);
                                }
                            }
                        >
                            Fermer
                        </button>
                    </header>

                    <div className="matrix-product-form">
                        <label>
                            Nom
                            <input
                                type="text"
                                value={productForm.name}
                                onChange={
                                    event =>
                                        updateProductForm(
                                            "name",
                                            event.target.value
                                        )
                                }
                            />
                        </label>

                        <label>
                            Manufacturier
                            <input
                                type="text"
                                value={productForm.manufacturer_name || ""}
                                onChange={
                                    event =>
                                        updateProductForm(
                                            "manufacturer_name",
                                            event.target.value
                                        )
                                }
                            />
                        </label>

                        <label>
                            Format
                            <input
                                type="text"
                                value={productForm.size_name || ""}
                                onChange={
                                    event =>
                                        updateProductForm(
                                            "size_name",
                                            event.target.value
                                        )
                                }
                            />
                        </label>

                        <label>
                            Code fournisseur
                            <input
                                type="text"
                                value={productForm.supplier_product_code || ""}
                                onChange={
                                    event =>
                                        updateProductForm(
                                            "supplier_product_code",
                                            event.target.value
                                        )
                                }
                            />
                        </label>

                        <label>
                            Unité
                            <select
                                value={productForm.default_unit_id || ""}
                                onChange={
                                    event =>
                                        updateProductForm(
                                            "default_unit_id",
                                            event.target.value ?
                                                Number(event.target.value) :
                                                null
                                        )
                                }
                            >
                                <option value="">Aucune</option>
                                {units.map(
                                    unit => (
                                        <option
                                            key={unit.id}
                                            value={unit.id}
                                        >
                                            {unit.name} ({unit.symbol})
                                        </option>
                                    )
                                )}
                            </select>
                        </label>

                        <label>
                            Prix achat
                            <input
                                type="number"
                                step="0.01"
                                value={productForm.default_purchase_price ?? ""}
                                onChange={
                                    event =>
                                        updateProductForm(
                                            "default_purchase_price",
                                            event.target.value
                                        )
                                }
                            />
                        </label>

                        <label>
                            MSRP
                            <input
                                type="number"
                                step="0.01"
                                value={productForm.msrp_price ?? ""}
                                onChange={
                                    event =>
                                        updateProductForm(
                                            "msrp_price",
                                            event.target.value
                                        )
                                }
                            />
                        </label>

                        <label>
                            Coulis par défaut
                            <input
                                type="text"
                                value={productForm.default_grout_color || ""}
                                onChange={
                                    event =>
                                        updateProductForm(
                                            "default_grout_color",
                                            event.target.value
                                        )
                                }
                            />
                        </label>
                    </div>

                    <footer>
                        {productEditStatus && (
                            <span>{productEditStatus}</span>
                        )}
                        <button
                            type="button"
                            onClick={
                                () => {
                                    setIsProductModalOpen(false);
                                    setEditingProductId(null);
                                    setProductForm(null);
                                }
                            }
                            disabled={isProductSaving}
                        >
                            Annuler
                        </button>
                        <button
                            type="button"
                            onClick={saveProductAndAddLine}
                            disabled={isProductSaving}
                        >
                            Sauvegarder et ajouter ligne
                        </button>
                    </footer>
                </section>
            </div>
        );

    }


    function renderReplaceProductDialog() {

        if (!replaceLine)
            return null;

        return (
            <div className="matrix-modal-backdrop">
                <section className="matrix-product-modal replace-product-modal">
                    <header>
                        <h2>Changer ligne</h2>
                        <button
                            type="button"
                            onClick={
                                () => {
                                    setReplaceLine(null);
                                    setReplaceProductStatus("");
                                }
                            }
                        >
                            Fermer
                        </button>
                    </header>

                    <div className="replace-product-content">
                        <div className="replace-product-current">
                            <span>Ligne {replaceLine.line_number}</span>
                            <strong>{replaceLine.product_name}</strong>
                            <span>{replaceLine.surface_name}</span>
                        </div>

                        <div className="replace-product-search">
                            <input
                                type="search"
                                value={replaceProductSearch}
                                onChange={
                                    event =>
                                        setReplaceProductSearch(
                                            event.target.value
                                        )
                                }
                                onKeyDown={
                                    event => {
                                        if (event.key === "Enter")
                                            searchReplacementProducts();
                                    }
                                }
                                placeholder="Rechercher un nouveau produit"
                            />
                            <button
                                type="button"
                                onClick={searchReplacementProducts}
                                disabled={isReplaceProductLoading}
                            >
                                Chercher
                            </button>
                        </div>

                        <div className="replace-product-results">
                            {replaceProductResults.map(
                                product => (
                                    <button
                                        key={product.id}
                                        type="button"
                                        className={
                                            String(product.id) === selectedReplaceProductId ?
                                                "selected" :
                                                ""
                                        }
                                        onClick={
                                            () =>
                                                setSelectedReplaceProductId(
                                                    String(product.id)
                                                )
                                        }
                                    >
                                        {[
                                            product.manufacturer_name,
                                            product.name,
                                            product.size_name,
                                            product.supplier_product_code
                                        ].filter(Boolean).join(" - ")}
                                    </button>
                                )
                            )}
                            {replaceProductResults.length === 0 && (
                                <div>Aucun produit sélectionné.</div>
                            )}
                        </div>

                        <label className="replace-product-surface">
                            Nouvelle surface de cette ligne
                            <select
                                value={replaceSurfaceTypeId}
                                onChange={
                                    event =>
                                        setReplaceSurfaceTypeId(
                                            event.target.value
                                        )
                                }
                            >
                                <option value="">Sélectionner une surface</option>
                                {surfaceTypes.map(
                                    surface => (
                                        <option
                                            key={surface.id}
                                            value={surface.id}
                                        >
                                            {surface.name}
                                        </option>
                                    )
                                )}
                            </select>
                        </label>

                        <label className="replace-product-position">
                            Position de ligne
                            <input
                                type="number"
                                min="1"
                                step="1"
                                value={replaceLinePosition}
                                onChange={
                                    event =>
                                        setReplaceLinePosition(
                                            event.target.value
                                        )
                                }
                            />
                        </label>

                        <label className="replace-product-apply-all">
                            <input
                                type="checkbox"
                                checked={replaceMatchingProduct}
                                onChange={
                                    event =>
                                        setReplaceMatchingProduct(
                                            event.target.checked
                                        )
                                }
                            />
                            Si un nouveau produit est sélectionné, remplacer aussi les autres lignes de ce produit dans les autres surfaces
                        </label>
                    </div>

                    <footer>
                        {replaceProductStatus && (
                            <span>{replaceProductStatus}</span>
                        )}
                        <button
                            type="button"
                            onClick={
                                () => {
                                    setReplaceLine(null);
                                    setReplaceProductStatus("");
                                }
                            }
                            disabled={isReplaceProductLoading}
                        >
                            Annuler
                        </button>
                        <button
                            type="button"
                            onClick={applyReplaceLineChanges}
                            disabled={isReplaceProductLoading}
                        >
                            Appliquer
                        </button>
                    </footer>
                </section>
            </div>
        );

    }


    function renderTileSurfaceSelector() {

        if (!tileSurfaceProduct)
            return null;

        return (
            <div className="matrix-modal-backdrop">
                <section className="matrix-product-modal tile-surface-modal">
                    <header>
                        <h2>Surfaces pour la tuile</h2>
                        <button
                            type="button"
                            onClick={
                                () => {
                                    setTileSurfaceProduct(null);
                                    setSelectedTileSurfaceIds([]);
                                    setTileSurfaceStatus("");
                                }
                            }
                        >
                            Fermer
                        </button>
                    </header>

                    <div className="tile-surface-content">
                        <div className="tile-surface-product">
                            {[
                                tileSurfaceProduct.manufacturer_name,
                                tileSurfaceProduct.name,
                                tileSurfaceProduct.size_name
                            ].filter(Boolean).join(" - ")}
                        </div>

                        <div className="tile-surface-options">
                            {surfaceTypes.map(
                                surface => (
                                    <label key={surface.id}>
                                        <input
                                            type="checkbox"
                                            checked={
                                                selectedTileSurfaceIds.includes(
                                                    surface.id
                                                )
                                            }
                                            onChange={
                                                event =>
                                                    toggleTileSurface(
                                                        surface.id,
                                                        event.target.checked
                                                    )
                                            }
                                        />
                                        <span>{surface.name}</span>
                                    </label>
                                )
                            )}
                        </div>
                    </div>

                    <footer>
                        {tileSurfaceStatus && (
                            <span>{tileSurfaceStatus}</span>
                        )}
                        <button
                            type="button"
                            onClick={
                                () => {
                                    setTileSurfaceProduct(null);
                                    setSelectedTileSurfaceIds([]);
                                    setTileSurfaceStatus("");
                                }
                            }
                            disabled={isMatrixActionLoading}
                        >
                            Annuler
                        </button>
                        <button
                            type="button"
                            onClick={confirmTileSurfaces}
                            disabled={isMatrixActionLoading}
                        >
                            Ajouter les lignes
                        </button>
                    </footer>
                </section>
            </div>
        );

    }


    function renderRoomEditor() {

        if (!editingRoom)
            return null;

        return (
            <div className="matrix-modal-backdrop">
                <section className="matrix-product-modal room-editor-modal">
                    <header>
                        <h2>Modifier locaux</h2>
                        <button
                            type="button"
                            onClick={
                                () => {
                                    setEditingRoom(null);
                                    setRoomEditStatus("");
                                }
                            }
                        >
                            Fermer
                        </button>
                    </header>

                    <div className="room-editor-content">
                        <div className="room-editor-list">
                            {roomColumns.map(
                                room => (
                                    <button
                                        key={room.key}
                                        type="button"
                                        className={
                                            room.id === editingRoom.id ?
                                                "selected" :
                                                ""
                                        }
                                        onClick={
                                            () =>
                                                openRoomEditor(room)
                                        }
                                    >
                                        <strong>{room.room_name}</strong>
                                        <span>
                                            {[
                                                room.phase_name ?
                                                    "Phase " + room.phase_name :
                                                    "",
                                                room.floor_name ?
                                                    "Étage " + room.floor_name :
                                                    ""
                                            ].filter(Boolean).join(" | ") ||
                                                "Sans phase / étage"}
                                        </span>
                                    </button>
                                )
                            )}
                        </div>

                        <div className="room-editor-form">
                            <label>
                                Phase
                                <input
                                    type="text"
                                    value={roomEditForm.phase_name}
                                    onChange={
                                        event =>
                                            setRoomEditForm(
                                                previousForm => ({
                                                    ...previousForm,
                                                    phase_name:
                                                        event.target.value
                                                })
                                            )
                                    }
                                />
                            </label>

                            <label>
                                Étage
                                <input
                                    type="text"
                                    value={roomEditForm.floor_name}
                                    onChange={
                                        event =>
                                            setRoomEditForm(
                                                previousForm => ({
                                                    ...previousForm,
                                                    floor_name:
                                                        event.target.value
                                                })
                                            )
                                    }
                                />
                            </label>

                            <label>
                                Nom du local
                                <input
                                    type="text"
                                    value={roomEditForm.room_name}
                                    onChange={
                                        event =>
                                            setRoomEditForm(
                                                previousForm => ({
                                                    ...previousForm,
                                                    room_name:
                                                        event.target.value
                                                })
                                            )
                                    }
                                />
                            </label>
                        </div>
                    </div>

                    <footer>
                        {roomEditStatus && (
                            <span>{roomEditStatus}</span>
                        )}
                        <button
                            type="button"
                            className="danger"
                            onClick={deleteRoomEdit}
                            disabled={isRoomSaving}
                        >
                            Supprimer
                        </button>
                        <button
                            type="button"
                            onClick={
                                () => {
                                    setEditingRoom(null);
                                    setRoomEditStatus("");
                                }
                            }
                            disabled={isRoomSaving}
                        >
                            Annuler
                        </button>
                        <button
                            type="button"
                            onClick={saveRoomEdit}
                            disabled={isRoomSaving}
                        >
                            Sauvegarder
                        </button>
                    </footer>
                </section>
            </div>
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
                            <div className="summary-label strong">Échantillons</div>
                            <div className="summary-value samples-list">
                                {matrixSummary.tile_requests.length ?
                                    matrixSummary.tile_requests.map(
                                        (tile, index) => (
                                            <div
                                                key={[
                                                    tile.supplier_names,
                                                    tile.manufacturer_name,
                                                    tile.name,
                                                    tile.size_name,
                                                    tile.supplier_product_code,
                                                    index
                                                ].filter(Boolean).join("-")}
                                            >
                                                {[
                                                    tile.supplier_names,
                                                    tile.manufacturer_name,
                                                    tile.name,
                                                    tile.size_name,
                                                    tile.supplier_product_code
                                                ].filter(Boolean).join(" - ")}
                                            </div>
                                        )
                                    ) :
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

            {renderReplaceProductDialog()}

            {renderTileSurfaceSelector()}

            {renderRoomEditor()}

            {renderProductEditor()}

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
                onCellClicked={onCellClicked}
                onSelectionChanged={onSelectionChanged}
                zoomScale={ZOOM_LEVELS[zoom] || 1}
                localeText={GRID_LOCALE_TEXT}
            />

        </div>

    );

}


export default MatrixView;
