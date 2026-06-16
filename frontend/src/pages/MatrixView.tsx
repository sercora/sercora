import {
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";

import MatrixGrid from "../components/MatrixGrid";
import ZoomToolbar from "../components/ZoomToolbar";

import {
    getAllocatedInstallHours,
    getInstallHours,
    getInstallTotal,
    getLossQuantity,
    getMaterialSellTotal,
    getProfit,
    getQtyTotal,
    getQtyWithLoss,
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
    EstimateLineUpdateInput,
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
    "plan_code",
    "loss_percent",
    "purchase_price",
    "profit_percent",
    "installation_cost",
    "manpower_multiplier"
];

const ZOOM_LEVELS: Record<string, number> = {
    "100": 1,
    "125": 1.25,
    "150": 1.5
};

const WORK_HOURS_PER_DAY = 8;

const NUMERIC_MATRIX_FIELDS = new Set(
    [
        "line_number",
        "loss_percent",
        "purchase_price",
        "profit_percent",
        "installation_cost",
        "manpower_multiplier"
    ]
);

type AddendaRow = {
    name: string;
    date: string;
    plans: boolean;
    specs: boolean;
    description: string;
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


type EstimateMenuKey = "En cours" | "Envoyées" | "Refusé" | "Template";


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
    const [pinnedBottomRows, setPinnedBottomRows] = useState<any[]>([]);

    const [zoom, setZoom] = useState("100");
    const [surfaceTypes, setSurfaceTypes] = useState<SurfaceType[]>([]);
    const [roomColumns, setRoomColumns] = useState<EstimateRoomColumn[]>([]);
    const [matrixSummary, setMatrixSummary] = useState<EstimateMatrixSummary | null>(null);
    const [summaryForm, setSummaryForm] = useState({
        used_hourly_rate: "",
        global_profit_percent: "",
        architect_name: "",
        plan_date: "",
        plan_pages: "",
        spec_sections: "",
        addenda: "",
        probable_schedule: "",
        probable_schedule_from: "",
        probable_schedule_to: "",
        tile_holdback_percent: "",
        warranty_years: ""
    });
    const [isSummarySaving, setIsSummarySaving] = useState(false);
    const [summaryStatus, setSummaryStatus] = useState("");
    const [newRoomPhase, setNewRoomPhase] = useState("");
    const [newRoomPhaseLabel, setNewRoomPhaseLabel] = useState("");
    const [newRoomFloor, setNewRoomFloor] = useState("");
    const [newRoomFloorLabel, setNewRoomFloorLabel] = useState("");
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
    const [linkLine, setLinkLine] = useState<any | null>(null);
    const [installationLinkSourceId, setInstallationLinkSourceId] = useState("");
    const [installationLinkMultiplier, setInstallationLinkMultiplier] = useState("1");
    const [quantityLinkSourceIds, setQuantityLinkSourceIds] = useState<number[]>([]);
    const [quantityLinkMultiplier, setQuantityLinkMultiplier] = useState("1");
    const [linkStatus, setLinkStatus] = useState("");
    const [isLinkSaving, setIsLinkSaving] = useState(false);
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
    const [rangeSubtotal, setRangeSubtotal] = useState<{
        count: number;
        sum: number;
        average: number;
    } | null>(null);
    const [editingRoom, setEditingRoom] = useState<EstimateRoomColumn | null>(null);
    const [roomEditForm, setRoomEditForm] = useState({
        phase_name: "",
        phase_label: "",
        floor_name: "",
        floor_label: "",
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

            if (estimateMenu === "Refusé")
                return "rejected";

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
                phase_label:
                    "",
                floor_name:
                    "",
                floor_label:
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


    function labelWithCode(
        label: string | null | undefined,
        code: string | null | undefined
    ) {

        const cleanLabel =
            String(label || "").trim();

        const cleanCode =
            String(code || "").trim();

        if (
            cleanLabel &&
            cleanCode &&
            cleanLabel !== cleanCode
        )
            return cleanLabel + " (" + cleanCode + ")";

        return cleanLabel || cleanCode;

    }


    function paletteClass(
        prefix: string,
        value: string | null | undefined
    ) {

        const text =
            String(value || "").trim();

        if (!text)
            return "";

        let hash = 0;

        for (let index = 0; index < text.length; index += 1)
            hash =
                (
                    hash +
                    text.charCodeAt(index)
                ) % 6;

        return prefix + "-color-" + hash;

    }


    function refreshGrid() {

        setRowData(
            previousRows =>
                applyLinkedRows(
                    previousRows,
                    roomColumns
                )
        );

        gridRef.current?.api?.refreshCells(
            {
                force: true
            }
        );

    }


    useEffect(
        () => {
            if (!matrixSummary) {
                setPinnedBottomRows([]);
                return;
            }

            setPinnedBottomRows(
                buildPinnedSummaryRows(
                    rowData,
                    roomColumns.map(
                        room =>
                            room.key
                    ),
                    matrixSummary
                )
            );
        },
        [
            rowData,
            roomColumns,
            matrixSummary
        ]
    );


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


    function getSampleSupplierClass(
        supplierNames: string | null
    ) {

        const supplier =
            String(
                supplierNames || ""
            ).toLowerCase();

        if (supplier.includes("olympia"))
            return "sample-olympia";

        if (supplier.includes("mapei"))
            return "sample-mapei";

        if (supplier.includes("schluter"))
            return "sample-schluter";

        if (supplier.includes("centura"))
            return "sample-centura";

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
            lineUpdatePayload(params.data)
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

        if (params.data?.is_summary_row)
            return;

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
                field === "plan_code" ?
                    String(params.newValue || "").trim() :
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


    function isNumericMatrixColumn(
        column: any
    ) {

        const columnDefinition =
            column?.getColDef?.() || {};

        const field =
            columnDefinition.field || "";
        const columnId =
            column?.getColId?.() || "";

        if (
            NUMERIC_MATRIX_FIELDS.has(columnId) ||
            NUMERIC_MATRIX_FIELDS.has(field) ||
            roomColumns.some(
                room =>
                    room.key === field ||
                    room.key === columnId
            )
        )
            return true;

        const cellClass =
            columnDefinition.cellClass;

        return Array.isArray(cellClass) &&
            cellClass.includes("numeric-cell");

    }


    function numericCellValue(
        value: any
    ) {

        if (typeof value === "number")
            return Number.isFinite(value) ?
                value :
                null;

        if (typeof value !== "string")
            return null;

        const normalizedValue =
            value
                .replace(/\s/g, "")
                .replace("$", "")
                .replace("%", "")
                .replace(",", ".");

        if (!normalizedValue)
            return null;

        const parsedValue =
            Number(normalizedValue);

        return Number.isFinite(parsedValue) ?
            parsedValue :
            null;

    }


    function matrixCellValue(
        column: any,
        row: any
    ) {

        const columnDefinition =
            column?.getColDef?.() || {};
        const columnId =
            column?.getColId?.() || "";
        const field =
            columnDefinition.field || columnId;
        const roomFields =
            roomColumns.map(
                room =>
                    room.key
            );
        const params =
            {
                data:
                    row
            };
        const hourlyRate =
            Number(
                matrixSummary?.rates.used_hourly_rate ||
                matrixSummary?.rates.current.civil ||
                matrixSummary?.rates.current.day ||
                0
            );

        if (
            roomColumns.some(
                room =>
                    room.key === field
            )
        )
            return numericCellValue(row[field]);

        switch (field) {
            case "line_number":
            case "loss_percent":
            case "purchase_price":
            case "profit_percent":
            case "installation_cost":
            case "manpower_multiplier":
                return numericCellValue(row[field]);

            case "quantity_total":
                return getQtyTotal(
                    params,
                    roomFields
                );

            case "loss_quantity":
                return getLossQuantity(
                    params,
                    roomFields
                );

            case "quantity_with_loss":
                return getQtyWithLoss(
                    params,
                    roomFields
                );

            case "profit_unit":
                return getUnitProfit(params);

            case "profit_total":
                return getProfit(
                    params,
                    roomFields
                );

            case "material_unit_sell":
                return getUnitSellPrice(params);

            case "material_sell_total":
                return getMaterialSellTotal(
                    params,
                    roomFields
                );

            case "installation_total":
                return getInstallTotal(
                    params,
                    roomFields
                );

            case "install_hours":
                return getInstallHours(
                    params,
                    roomFields,
                    hourlyRate
                );

            case "allocated_install_hours":
                return getAllocatedInstallHours(
                    params,
                    roomFields,
                    hourlyRate
                );

            default:
                return null;
        }

    }


    function onRangeSelectionChanged(
        params: any
    ) {

        if (!params.finished)
            return;

        const ranges =
            params.api?.getCellRanges?.() || [];

        if (!ranges.length) {
            setRangeSubtotal(null);
            return;
        }

        let sum = 0;
        let count = 0;
        const countedCells =
            new Set<string>();

        ranges.forEach(
            (range: any) => {
                const startIndex =
                    Number(range.startRow?.rowIndex ?? 0);
                const endIndex =
                    Number(range.endRow?.rowIndex ?? startIndex);
                const firstIndex =
                    Math.min(
                        startIndex,
                        endIndex
                    );
                const lastIndex =
                    Math.max(
                        startIndex,
                        endIndex
                    );

                range.columns.filter(
                    (column: any) =>
                        isNumericMatrixColumn(column)
                ).forEach(
                    (column: any) => {
                        const columnId =
                            column?.getColId?.() || "";

                        for (
                            let rowIndex = firstIndex;
                            rowIndex <= lastIndex;
                            rowIndex += 1
                        ) {
                            const rowNode =
                                params.api.getDisplayedRowAtIndex(rowIndex);

                            if (
                                !rowNode ||
                                rowNode.data?.is_summary_row
                            )
                                continue;

                            const cellKey =
                                rowNode.id + ":" + columnId;

                            if (countedCells.has(cellKey))
                                continue;

                            countedCells.add(cellKey);

                            const value =
                                matrixCellValue(
                                    column,
                                    rowNode.data
                                );

                            if (value === null)
                                continue;

                            sum += value;
                            count += 1;
                        }
                    }
                );
            }
        );

        setRangeSubtotal(
            count ?
                {
                    count,
                    sum,
                    average:
                        sum / count
                } :
                null
        );

    }


    function getMatrixRowClass(
        params: any
    ) {

        if (params.data?.is_summary_row)
            return [
                params.data?.is_grand_total_row ?
                    "matrix-grand-total-row" :
                    "matrix-summary-row",
                params.data?.summary_kind === "material" ?
                    "matrix-summary-material" :
                        params.data?.summary_kind === "installation" ?
                            "matrix-summary-installation" :
                        params.data?.summary_kind === "hours" ?
                            "matrix-summary-hours" :
                        params.data?.summary_kind === "days" ?
                            "matrix-summary-days" :
                            "matrix-summary-total-local",
                params.data?.surface_group === "CM" ?
                    "matrix-summary-cm" :
                    params.data?.surface_group === "CP" ?
                        "matrix-summary-cp" :
                        ""
            ].filter(Boolean);

        const rowIndex =
            Number(params.node?.rowIndex || 0);

        if (rowIndex <= 0)
            return "surface-group-start";

        const previousRow =
            rowData[rowIndex - 1];

        if (
            previousRow &&
            surfaceGroupKey(previousRow.surface_name) !==
                surfaceGroupKey(params.data?.surface_name)
        )
            return "surface-group-start";

        return "";

    }


    function surfaceGroupKey(
        surfaceName: string | null | undefined
    ) {

        const normalized =
            String(surfaceName || "").toLowerCase();

        if (
            normalized.includes("plancher") ||
            normalized.includes("plinthe")
        )
            return "CP";

        if (
            normalized.includes("mur") ||
            normalized.includes("colonne") ||
            normalized.includes("meuble") ||
            normalized.includes("vertical")
        )
            return "CM";

        return normalized || "AUTRE";

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

        if (field === "link_line") {
            openLineLinkDialog(params.data);
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


    function openLineLinkDialog(
        row: any
    ) {

        setLinkLine(row);
        setInstallationLinkSourceId(
            row.installation_link_source_line_id ?
                String(row.installation_link_source_line_id) :
                ""
        );
        setInstallationLinkMultiplier(
            String(row.installation_link_multiplier ?? 1)
        );
        setQuantityLinkSourceIds(
            linkedLineIds(row.quantity_link_source_line_ids)
        );
        setQuantityLinkMultiplier(
            String(row.quantity_link_multiplier ?? 1)
        );
        setLinkStatus("");

    }


    function toggleQuantityLinkSource(
        lineId: number,
        checked: boolean
    ) {

        setQuantityLinkSourceIds(
            previousIds => {
                if (checked)
                    return Array.from(
                        new Set([
                            ...previousIds,
                            lineId
                        ])
                    );

                return previousIds.filter(
                    previousId =>
                        previousId !== lineId
                );
            }
        );

    }


    function saveLineLinks() {

        if (!linkLine)
            return;

        const targetLineId =
            Number(linkLine.line_id);

        const installationSourceId =
            installationLinkSourceId ?
                Number(installationLinkSourceId) :
                null;

        if (installationSourceId === targetLineId) {
            setLinkStatus("La ligne ne peut pas se lier à elle-même.");
            return;
        }

        const quantitySourceIds =
            quantityLinkSourceIds.filter(
                lineId =>
                    lineId !== targetLineId
            );

        setIsLinkSaving(true);
        setLinkStatus("");

        saveEstimateLine(
            targetLineId,
            lineUpdatePayload(
                linkLine,
                {
                    installation_link_source_line_id:
                        installationSourceId,
                    installation_link_multiplier:
                        parseNumber(installationLinkMultiplier || 1),
                    quantity_link_source_line_ids:
                        quantitySourceIds,
                    quantity_link_multiplier:
                        parseNumber(quantityLinkMultiplier || 1)
                }
            )
        )

        .then(
            () => {
                setLinkStatus("Liens sauvegardés.");
                setLinkLine(null);
                return reloadMatrix();
            }
        )

        .catch(
            () => {
                setLinkStatus("Sauvegarde des liens impossible.");
            }
        )

        .finally(
            () => {
                setIsLinkSaving(false);
            }
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


    function linkedLineIds(value: any) {

        if (Array.isArray(value))
            return value.map(Number).filter(Boolean);

        if (typeof value === "string") {
            try {
                const parsed = JSON.parse(value);

                if (Array.isArray(parsed))
                    return parsed.map(Number).filter(Boolean);
            } catch {
                return [];
            }
        }

        return [];

    }


    function lineUpdatePayload(
        row: any,
        overrides: Partial<EstimateLineUpdateInput> = {}
    ): EstimateLineUpdateInput {

        return {
            surface_type_id:
                parseNumber(row.surface_type_id),
            plan_code:
                String(row.plan_code || "").trim() || null,
            loss_percent:
                parseNumber(row.loss_percent),
            purchase_price:
                parseNumber(row.purchase_price),
            profit_percent:
                parseNumber(row.profit_percent),
            installation_cost:
                parseNumber(row.installation_cost),
            installation_link_source_line_id:
                row.installation_link_source_line_id || null,
            installation_link_multiplier:
                parseNumber(row.installation_link_multiplier || 1),
            quantity_link_source_line_ids:
                linkedLineIds(row.quantity_link_source_line_ids),
            quantity_link_multiplier:
                parseNumber(row.quantity_link_multiplier || 1),
            manpower_multiplier:
                parseNumber(row.manpower_multiplier || 1),
            ...overrides
        };

    }


    function applyLinkedRows(
        rows: any[],
        rooms: EstimateRoomColumn[]
    ) {

        const nextRows =
            rows.map(
                row => ({
                    ...row,
                    installation_is_linked: false,
                    quantity_is_linked: false
                })
            );

        const rowsById =
            new Map<number, any>();

        nextRows.forEach(
            row => {
                rowsById.set(
                    Number(row.line_id),
                    row
                );
            }
        );

        nextRows.forEach(
            row => {
                const sourceId =
                    Number(row.installation_link_source_line_id || 0);

                const source =
                    rowsById.get(sourceId);

                if (
                    source &&
                    source.line_id !== row.line_id
                ) {
                    row.installation_cost =
                        Number(source.installation_cost || 0) *
                        Number(row.installation_link_multiplier || 1);

                    row.installation_is_linked = true;
                }

                const quantitySourceIds =
                    linkedLineIds(
                        row.quantity_link_source_line_ids
                    ).filter(
                        lineId =>
                            lineId !== Number(row.line_id)
                    );

                if (!quantitySourceIds.length)
                    return;

                rooms.forEach(
                    room => {
                        const quantity =
                            quantitySourceIds.reduce(
                                (total, lineId) => {
                                    const quantitySource =
                                        rowsById.get(lineId);

                                    return total +
                                        Number(
                                            quantitySource?.[room.key] || 0
                                        );
                                },
                                0
                            );

                        row[room.key] =
                            quantity *
                            Number(row.quantity_link_multiplier || 1);
                    }
                );

                row.quantity_is_linked = true;
            }
        );

        return nextRows;

    }


    function buildPinnedSummaryRows(
        rows: any[],
        roomFields: string[],
        summary: EstimateMatrixSummary
    ) {

        const hourlyRate =
            Number(
                summary.rates.used_hourly_rate ||
                summary.rates.current.civil ||
                summary.rates.current.day ||
                0
            );

        const bySurface =
            new Map<string, any>();

        rows.forEach(
            row => {
                const surfaceName =
                    row.surface_name || "Sans surface";

                const surfaceGroup =
                    surfaceGroupKey(surfaceName);

                if (!bySurface.has(surfaceGroup)) {
                    bySurface.set(
                        surfaceGroup,
                        {
                            is_summary_row: true,
                            surface_name:
                                surfaceGroup,
                            surface_group: surfaceGroup,
                            product_name: surfaceGroup,
                            material_sell_total: 0,
                            installation_total: 0,
                            install_hours: 0,
                            allocated_install_hours: 0
                        }
                    );
                }

                const summaryRow =
                    bySurface.get(surfaceGroup);

                const params =
                    {
                        data: row
                    };

                roomFields.forEach(
                    roomField => {
                        const roomParams = {
                            data: {
                                ...row,
                                [roomField]:
                                    row[roomField] || 0
                            }
                        };

                        summaryRow[roomField] =
                            Number(summaryRow[roomField] || 0) +
                            getMaterialSellTotal(
                                roomParams,
                                [
                                    roomField
                                ]
                            );

                        summaryRow[roomField + "_installation"] =
                            Number(
                                summaryRow[roomField + "_installation"] || 0
                            ) +
                            getInstallTotal(
                                roomParams,
                                [
                                    roomField
                                ]
                            );
                    }
                );

                const installationTotal =
                    getInstallTotal(
                        params,
                        roomFields
                    );

                summaryRow.material_sell_total +=
                    getMaterialSellTotal(
                        params,
                        roomFields
                    );

                summaryRow.installation_total +=
                    installationTotal;

                if (hourlyRate)
                    summaryRow.install_hours +=
                        installationTotal / hourlyRate;

                const manpowerMultiplier =
                    Number(row.manpower_multiplier || 1);

                if (hourlyRate)
                    summaryRow.allocated_install_hours +=
                        installationTotal /
                        hourlyRate /
                        (
                            manpowerMultiplier || 1
                        );
            }
        );

        const surfaceTotals =
            Array.from(
                bySurface.values()
            );

        const totalRow =
            surfaceTotals.reduce(
                (total, row) => ({
                    ...total,
                    material_sell_total:
                        total.material_sell_total +
                        Number(row.material_sell_total || 0),
                    installation_total:
                        total.installation_total +
                        Number(row.installation_total || 0),
                    install_hours:
                        total.install_hours +
                        Number(row.install_hours || 0),
                    allocated_install_hours:
                        total.allocated_install_hours +
                        Number(row.allocated_install_hours || 0),
                    ...Object.fromEntries(
                        roomFields.map(
                            roomField => [
                                roomField,
                                Number(total[roomField] || 0) +
                                Number(row[roomField] || 0)
                            ]
                        )
                    ),
                    ...Object.fromEntries(
                        roomFields.map(
                            roomField => [
                                roomField + "_installation",
                                Number(
                                    total[roomField + "_installation"] || 0
                                ) +
                                Number(
                                    row[roomField + "_installation"] || 0
                                )
                            ]
                        )
                    )
                }),
                {
                    is_summary_row: true,
                    is_grand_total_row: true,
                    surface_name: "TOTAL",
                    product_name: "TOTAL GÉNÉRAL",
                    material_sell_total: 0,
                    installation_total: 0,
                    install_hours: 0,
                    allocated_install_hours: 0,
                    ...Object.fromEntries(
                        roomFields.map(
                            roomField => [
                                roomField,
                                0
                            ]
                        )
                    ),
                    ...Object.fromEntries(
                        roomFields.map(
                            roomField => [
                                roomField + "_installation",
                                0
                            ]
                        )
                    )
                }
            );

        function summaryPairRows(
            row: any,
            isGrandTotal = false
        ) {

            const label =
                isGrandTotal ?
                    "TOTAL PAR LOCAL" :
                    row.surface_group;

            const materialRow =
                {
                    is_summary_row: true,
                    is_grand_total_row: isGrandTotal,
                    summary_kind: "material",
                    surface_name: row.surface_name,
                    surface_group:
                        row.surface_group,
                    product_name: isGrandTotal ?
                        label :
                        "TOTAL MATÉRIEL " + label,
                    material_sell_total:
                        Number(row.material_sell_total || 0).toFixed(2),
                    ...Object.fromEntries(
                        roomFields.map(
                            roomField => [
                                roomField,
                                Number(row[roomField] || 0).toFixed(2)
                            ]
                        )
                    )
                };

            const installationRow =
                {
                    is_summary_row: true,
                    is_grand_total_row: isGrandTotal,
                    summary_kind: "installation",
                    surface_name: row.surface_name,
                    surface_group:
                        row.surface_group,
                    product_name: isGrandTotal ?
                        label :
                        "TOTAL INSTALLATION " + label,
                    installation_total:
                        Number(row.installation_total || 0).toFixed(2),
                    install_hours:
                        Number(row.install_hours || 0).toFixed(2),
                    allocated_install_hours:
                        Number(row.allocated_install_hours || 0).toFixed(2),
                    ...Object.fromEntries(
                        roomFields.map(
                            roomField => [
                                roomField,
                                (
                                    isGrandTotal ?
                                        Number(row[roomField] || 0) +
                                        Number(
                                            row[roomField + "_installation"] ||
                                                0
                                        ) :
                                        Number(
                                            row[
                                                roomField +
                                                    "_installation"
                                            ] || 0
                                        )
                                ).toFixed(2)
                            ]
                        )
                    )
                };

            if (isGrandTotal)
                return [
                    {
                        ...installationRow,
                        summary_kind: "local_total",
                        material_sell_total:
                            Number(row.material_sell_total || 0).toFixed(2),
                        installation_total:
                            Number(row.installation_total || 0).toFixed(2)
                    }
                ];

            return [
                materialRow,
                installationRow
            ];

        }

        function hoursRow(
            row: any
        ) {

            const effectiveManpowerMultiplier =
                Number(row.allocated_install_hours || 0) ?
                    Number(row.install_hours || 0) /
                        Number(row.allocated_install_hours || 0) :
                    0;

            return {
                is_summary_row: true,
                summary_kind: "hours",
                surface_name:
                    row.surface_name,
                surface_group:
                    row.surface_group,
                product_name:
                    "Nbr d'heure_" + row.surface_group,
                manpower_multiplier:
                    effectiveManpowerMultiplier.toFixed(2),
                install_hours:
                    Number(row.install_hours || 0).toFixed(2),
                allocated_install_hours:
                    Number(row.allocated_install_hours || 0).toFixed(2),
                ...Object.fromEntries(
                    roomFields.map(
                        roomField => [
                            roomField,
                            (
                                hourlyRate ?
                                    Number(
                                        row[
                                            roomField +
                                                "_installation"
                                        ] || 0
                                    ) / hourlyRate :
                                    0
                            ).toFixed(2)
                        ]
                    )
                )
            };

        }

        function daysRow(
            row: any
        ) {

            const effectiveManpowerMultiplier =
                Number(row.allocated_install_hours || 0) ?
                    Number(row.install_hours || 0) /
                        Number(row.allocated_install_hours || 0) :
                    0;

            return {
                is_summary_row: true,
                summary_kind: "days",
                surface_name:
                    row.surface_name,
                surface_group:
                    row.surface_group,
                product_name:
                    "Nbr de jour_" + row.surface_group,
                manpower_multiplier:
                    effectiveManpowerMultiplier.toFixed(2),
                install_hours:
                    (
                        Number(row.install_hours || 0) /
                        WORK_HOURS_PER_DAY
                    ).toFixed(2),
                allocated_install_hours:
                    (
                        Number(row.allocated_install_hours || 0) /
                        WORK_HOURS_PER_DAY
                    ).toFixed(2),
                ...Object.fromEntries(
                    roomFields.map(
                        roomField => [
                            roomField,
                            (
                                hourlyRate ?
                                    (
                                        Number(
                                            row[
                                                roomField +
                                                    "_installation"
                                            ] || 0
                                        ) /
                                        hourlyRate /
                                        WORK_HOURS_PER_DAY
                                    ) :
                                    0
                            ).toFixed(2)
                        ]
                    )
                )
            };

        }


        const surfaceOrder = [
            "CM",
            "CP"
        ];

        const orderedSurfaceTotals =
            surfaceTotals.sort(
                (left, right) => {
                    const leftIndex =
                        surfaceOrder.indexOf(left.surface_group);

                    const rightIndex =
                        surfaceOrder.indexOf(right.surface_group);

                    return (
                        (
                            leftIndex === -1 ?
                                99 :
                                leftIndex
                        )
                        -
                        (
                            rightIndex === -1 ?
                                99 :
                                rightIndex
                        )
                    );
                }
            );

        return [
            ...orderedSurfaceTotals.map(
                row =>
                    summaryPairRows(row)[0]
            ),
            ...orderedSurfaceTotals.map(
                row =>
                    summaryPairRows(row)[1]
            ),
            ...summaryPairRows(
                totalRow,
                true
            ),
            ...orderedSurfaceTotals.flatMap(
                row => [
                    hoursRow(row),
                    daysRow(row)
                ]
            )
        ];

    }


    function summaryInputPayload(): EstimateMatrixSummaryInput {

        return {
            used_hourly_rate:
                nullableNumber(summaryForm.used_hourly_rate),
            global_profit_percent:
                nullableNumber(summaryForm.global_profit_percent),
            architect_name:
                summaryForm.architect_name.trim() || null,
            plan_date:
                summaryForm.plan_date || null,
            plan_pages:
                summaryForm.plan_pages.trim() || null,
            spec_sections:
                summaryForm.spec_sections.trim() || null,
            addenda:
                summaryForm.addenda.trim() || null,
            probable_schedule:
                [
                    summaryForm.probable_schedule_from,
                    summaryForm.probable_schedule_to
                ].filter(Boolean).join(" à ") ||
                summaryForm.probable_schedule.trim() ||
                null,
            probable_schedule_from:
                summaryForm.probable_schedule_from || null,
            probable_schedule_to:
                summaryForm.probable_schedule_to || null,
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
                architect_name:
                    summary.project.architect_name || "",
                plan_date:
                    summary.project.plan_date || "",
                plan_pages:
                    summary.project.plan_pages || "",
                spec_sections:
                    summary.project.spec_sections || "",
                addenda:
                    summary.project.addenda || "",
                probable_schedule:
                    summary.rates.probable_schedule || "",
                probable_schedule_from:
                    summary.rates.probable_schedule_from || "",
                probable_schedule_to:
                    summary.rates.probable_schedule_to || "",
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

                    plan_code:
                        line.plan_code || "",

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
                        line.installation_cost,

                    installation_link_source_line_id:
                        line.installation_link_source_line_id,

                    installation_link_multiplier:
                        line.installation_link_multiplier ?? 1,

                    quantity_link_source_line_ids:
                        linkedLineIds(line.quantity_link_source_line_ids),

                    quantity_link_multiplier:
                        line.quantity_link_multiplier ?? 1,

                    manpower_multiplier:
                        line.manpower_multiplier ?? 1

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

        const hourlyRate =
            Number(
                matrix.summary.rates.used_hourly_rate ||
                matrix.summary.rates.current.civil ||
                matrix.summary.rates.current.day ||
                0
            );

        const summaryValue =
            (
                params: any,
                field: string,
                fallback: () => any
            ) =>
                params.data?.is_summary_row ?
                    params.data[field] ?? "" :
                    fallback();

        const flatRoomColumns = matrixRoomColumns(
            matrix
        ).map(

            room => ({

                field: room.key,

                headerName: room.room_name,

                headerTooltip: [
                    room.floor_name ?
                        "Étage: " +
                            labelWithCode(
                                room.floor_label,
                                room.floor_name
                            ) :
                        "",
                    "Local: " + room.room_name
                ].filter(Boolean).join(" | "),

                width: 82,

                minWidth: 72,

                editable: (params: any) =>
                    !params.data?.is_summary_row &&
                    !params.data?.quantity_is_linked,

                valueParser: (params: any) =>
                    parseNumber(params.newValue),

                cellClass: (params: any) => [
                    ...numericEditableClass,
                    params.data?.quantity_is_linked ?
                        "linked-cell" :
                        ""
                ].filter(Boolean),

                headerClass: [
                    "takeoff-room-header",
                    paletteClass(
                        "floor",
                        room.floor_name
                    )
                ].filter(Boolean)

            })

        );

        const roomGroups = new Map<string, any>();

        matrixRoomColumns(
            matrix
        ).forEach(
            room => {
                const floorName =
                    room.floor_name?.trim() || "";

                if (!roomGroups.has(floorName))
                    roomGroups.set(
                        floorName,
                        {
                            label:
                                room.floor_label?.trim() || "",
                            columns:
                                []
                        }
                    );

                roomGroups.get(floorName)?.columns.push(
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
                floorName,
                floorGroup
            ]) => {
                const visibleColumns =
                    floorGroup.columns.filter(Boolean);

                if (!floorName)
                    return visibleColumns;

                return {
                    headerName:
                        "Étage " +
                            labelWithCode(
                                floorGroup.label,
                                floorName
                            ),
                    headerTooltip:
                        "Étage: " +
                            labelWithCode(
                                floorGroup.label,
                                floorName
                            ),
                    headerClass:
                        [
                            "takeoff-floor-header",
                            paletteClass(
                                "floor",
                                floorName
                            )
                        ],
                    marryChildren:
                        true,
                    children:
                        visibleColumns
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
                checkboxSelection: (params: any) =>
                    !params.data?.is_summary_row,
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
                editable: (params: any) =>
                    !params.data?.is_summary_row,
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
                        editable: (params: any) =>
                            !params.data?.is_summary_row,
                        cellEditor: "agSelectCellEditor",
                        cellEditorParams: {
                            values: surfaceNames
                        },
                        cellClass: "editable-cell"
                    },
                    {
                        field: "plan_code",
                        headerName: "CODE PLAN",
                        width: 96,
                        minWidth: 82,
                        pinned: "left",
                        editable: (params: any) =>
                            !params.data?.is_summary_row,
                        cellClass: "editable-cell"
                    },
                    {
                        field: "product_name",
                        headerName: "DESCRIPTION",
                        width: 300,
                        minWidth: 220,
                        pinned: "left",
                        cellClass: (params: any) => [
                            params.data?.is_summary_row ?
                                "summary-label-cell" :
                                getSupplierClass(params),
                            params.data?.is_summary_row ?
                                "" :
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
                        cellRenderer: (params: any) =>
                            params.data?.is_summary_row ?
                                "" :
                                "Changer",
                        cellClass: (params: any) =>
                            params.data?.is_summary_row ?
                                "" :
                                "replace-product-cell"
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
                headerTooltip: "Quantités par étage et local",
                headerClass: "takeoff-root-header",
                marryChildren: true,
                children: groupedRoomColumns
            },

            {
                headerName: "MATÉRIEL",
                marryChildren: true,
                children: [
                    {
                        colId: "quantity_total",
                        headerName: "TOTAL",
                        width: 82,
                        minWidth: 72,
                        cellClass: calculatedClass,
                        valueGetter:
                            (params: any) =>
                                summaryValue(
                                    params,
                                    "quantity_total",
                                    () =>
                                        getQtyTotal(
                                            params,
                                            roomFields
                                        )
                                )
                    },
                    {
                        field: "loss_percent",
                        headerName: "PERTE EN %",
                        width: 86,
                        minWidth: 74,
                        editable: (params: any) =>
                            !params.data?.is_summary_row,
                        valueParser: (params: any) =>
                            parseNumber(params.newValue),
                        cellClass: numericEditableClass
                    },
                    {
                        colId: "loss_quantity",
                        headerName: "PERTE EN UNITÉ",
                        width: 96,
                        minWidth: 84,
                        cellClass: calculatedClass,
                        valueGetter:
                            (params: any) =>
                                summaryValue(
                                    params,
                                    "loss_quantity",
                                    () =>
                                        getLossQuantity(
                                            params,
                                            roomFields
                                        ).toFixed(2)
                                )
                    },
                    {
                        colId: "quantity_with_loss",
                        headerName: "QUANTITÉ AVEC PERTE",
                        width: 112,
                        minWidth: 96,
                        cellClass: calculatedClass,
                        valueGetter:
                            (params: any) =>
                                summaryValue(
                                    params,
                                    "quantity_with_loss",
                                    () =>
                                        getQtyWithLoss(
                                            params,
                                            roomFields
                                        ).toFixed(2)
                                )
                    },
                    {
                        field: "purchase_price",
                        headerName: "COUTANT",
                        width: 86,
                        minWidth: 76,
                        editable: (params: any) =>
                            !params.data?.is_summary_row,
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
                        editable: (params: any) =>
                            !params.data?.is_summary_row,
                        valueParser: (params: any) =>
                            parseNumber(params.newValue),
                        cellClass: numericEditableClass
                    },
                    {
                        colId: "profit_unit",
                        headerName: "PROFIT UNITAIRE",
                        width: 94,
                        minWidth: 82,
                        cellClass: calculatedClass,
                        valueGetter:
                            (params: any) =>
                                getUnitProfit(params).toFixed(2)
                    },
                    {
                        colId: "profit_total",
                        headerName: "PROFIT TOTAL",
                        width: 94,
                        minWidth: 82,
                        cellClass: calculatedClass,
                        valueGetter:
                            (params: any) =>
                                summaryValue(
                                    params,
                                    "profit_total",
                                    () =>
                                        getProfit(
                                            params,
                                            roomFields
                                        ).toFixed(2)
                                )
                    },
                    {
                        colId: "material_unit_sell",
                        headerName: "VENDANT UNITAIRE",
                        width: 102,
                        minWidth: 90,
                        cellClass: calculatedClass,
                        valueGetter:
                            (params: any) =>
                                getUnitSellPrice(params).toFixed(2)
                    },
                    {
                        colId: "material_sell_total",
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
                                summaryValue(
                                    params,
                                    "material_sell_total",
                                    () =>
                                        getMaterialSellTotal(
                                            params,
                                            roomFields
                                        ).toFixed(2)
                                )
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
                        editable: (params: any) =>
                            !params.data?.is_summary_row &&
                            !params.data?.installation_is_linked,
                        valueParser: (params: any) =>
                            parseNumber(params.newValue),
                        valueFormatter: (params: any) =>
                            formatMoney(params.value),
                        cellClass: (params: any) => [
                            ...numericEditableClass,
                            params.data?.installation_is_linked ?
                                "linked-cell" :
                                ""
                        ].filter(Boolean)
                    },
                    {
                        field: "link_line",
                        headerName: "",
                        width: 52,
                        minWidth: 48,
                        maxWidth: 58,
                        sortable: false,
                        filter: false,
                        resizable: false,
                        suppressMovable: true,
                        cellRenderer: (params: any) =>
                            params.data?.is_summary_row ?
                                "" :
                                "Lier",
                        cellClass: (params: any) => [
                            params.data?.is_summary_row ?
                                "" :
                                "replace-product-cell",
                            (
                                params.data?.installation_is_linked ||
                                params.data?.quantity_is_linked
                            ) ?
                                "linked-line-cell" :
                                ""
                        ].filter(Boolean)
                    },
                    {
                        colId: "installation_total",
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
                                summaryValue(
                                    params,
                                    "installation_total",
                                    () =>
                                        getInstallTotal(
                                            params,
                                            roomFields
                                        ).toFixed(2)
                                )
                    },
                    {
                        field: "manpower_multiplier",
                        headerName: "HOMMES",
                        width: 78,
                        minWidth: 70,
                        editable: (params: any) =>
                            !params.data?.is_summary_row,
                        valueParser: (params: any) =>
                            parseNumber(params.newValue),
                        cellClass: numericEditableClass
                    },
                    {
                        colId: "install_hours",
                        headerName: "HEURES",
                        width: 82,
                        minWidth: 74,
                        cellClass: calculatedClass,
                        valueGetter:
                            (params: any) =>
                                summaryValue(
                                    params,
                                    "install_hours",
                                    () =>
                                        getInstallHours(
                                            params,
                                            roomFields,
                                            hourlyRate
                                        ).toFixed(2)
                                )
                    },
                    {
                        colId: "allocated_install_hours",
                        headerName: "HRS ALLOUÉES",
                        width: 98,
                        minWidth: 88,
                        cellClass: [
                            "calculated-cell",
                            "numeric-cell",
                            "total-cell"
                        ],
                        valueGetter:
                            (params: any) =>
                                summaryValue(
                                    params,
                                    "allocated_install_hours",
                                    () =>
                                        getAllocatedInstallHours(
                                            params,
                                            roomFields,
                                            hourlyRate
                                        ).toFixed(2)
                                )
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

        const rows =
            applyLinkedRows(
                buildMatrixRows(
                    matrix
                ),
                matrixRoomColumns(
                    matrix
                )
            );

        setRowData(
            rows
        );

        setPinnedBottomRows(
            buildPinnedSummaryRows(
                rows,
                matrixRoomKeys(
                    matrix
                ),
                matrix.summary
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


    function splitStructuredRow(
        value: string,
        columnCount: number
    ) {

        const columns =
            value.split("|").map(
                column =>
                    column.trim()
            );

        return Array.from(
            {
                length: columnCount
            },
            (_item, index) =>
                columns[index] || ""
        );

    }


    function planPageRows() {

        const rows =
            summaryForm.plan_pages ?
                summaryForm.plan_pages.split("\n").map(
                    row =>
                        splitStructuredRow(
                            row,
                            3
                        )
                ) :
                [];

        while (rows.length < 3)
            rows.push([
                "",
                "",
                ""
            ]);

        return rows;

    }


    function serializeStructuredRows(
        rows: string[][]
    ) {

        return rows.map(
            row =>
                row.map(
                    column =>
                        column.trim()
                ).join(" | ")
        ).join("\n");

    }


    function updatePlanPageCell(
        rowIndex: number,
        columnIndex: number,
        value: string
    ) {

        const rows =
            planPageRows();

        rows[rowIndex][columnIndex] =
            value;

        updateSummaryForm(
            "plan_pages",
            serializeStructuredRows(rows)
        );

    }


    function addPlanPageRow() {

        updateSummaryForm(
            "plan_pages",
            serializeStructuredRows(
                [
                    ...planPageRows(),
                    [
                        "",
                        "",
                        ""
                    ]
                ]
            )
        );

    }


    function specRow() {

        return splitStructuredRow(
            summaryForm.spec_sections,
            2
        );

    }


    function updateSpecCell(
        columnIndex: number,
        value: string
    ) {

        const row =
            specRow();

        row[columnIndex] =
            value;

        updateSummaryForm(
            "spec_sections",
            row.map(
                column =>
                    column.trim()
            ).join(" | ")
        );

    }


    function emptyAddendaRow(): AddendaRow {

        return {
            name: "",
            date: "",
            plans: false,
            specs: false,
            description: ""
        };

    }


    function addendaRows() {

        if (!summaryForm.addenda)
            return [
                emptyAddendaRow()
            ];

        try {
            const parsedRows =
                JSON.parse(summaryForm.addenda);

            if (Array.isArray(parsedRows) && parsedRows.length)
                return parsedRows.map(
                    row => ({
                        ...emptyAddendaRow(),
                        name:
                            String(row.name || ""),
                        date:
                            String(row.date || ""),
                        plans:
                            Boolean(row.plans),
                        specs:
                            Boolean(row.specs),
                        description:
                            String(row.description || "")
                    })
                );
        } catch {
            return [
                {
                    ...emptyAddendaRow(),
                    description:
                        summaryForm.addenda
                }
            ];
        }

        return [
            emptyAddendaRow()
        ];

    }


    function serializeAddendaRows(
        rows: AddendaRow[]
    ) {

        return JSON.stringify(
            rows.map(
                row => ({
                    name:
                        row.name.trim(),
                    date:
                        row.date,
                    plans:
                        row.plans,
                    specs:
                        row.specs,
                    description:
                        row.description.trim()
                })
            )
        );

    }


    function updateAddendaRow(
        rowIndex: number,
        field: keyof AddendaRow,
        value: string | boolean
    ) {

        const rows =
            addendaRows();

        rows[rowIndex] = {
            ...rows[rowIndex],
            [field]:
                value
        };

        updateSummaryForm(
            "addenda",
            serializeAddendaRows(rows)
        );

    }


    function addAddendaRow() {

        updateSummaryForm(
            "addenda",
            serializeAddendaRows(
                [
                    ...addendaRows(),
                    emptyAddendaRow()
                ]
            )
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
                    lineUpdatePayload(
                        replaceLine,
                        {
                        surface_type_id:
                            surfaceTypeId
                        }
                    )
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
                phase_label:
                    newRoomPhaseLabel.trim(),
                floor_name:
                    newRoomFloor.trim(),
                floor_label:
                    newRoomFloorLabel.trim(),
                room_name:
                    roomName
            }
        )

        .then(
            () => {
                setNewRoomName("");
                setNewRoomPhaseLabel("");
                setNewRoomFloorLabel("");
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
                phase_label:
                    room.phase_label || "",
                floor_name:
                    room.floor_name || "",
                floor_label:
                    room.floor_label || "",
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
                phase_label:
                    roomEditForm.phase_label.trim(),
                floor_name:
                    roomEditForm.floor_name.trim(),
                floor_label:
                    roomEditForm.floor_label.trim(),
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
                    plan_code:
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
                        value={newRoomPhaseLabel}
                        onChange={
                            event =>
                                setNewRoomPhaseLabel(event.target.value)
                        }
                        placeholder="Nom phase"
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
                        value={newRoomFloorLabel}
                        onChange={
                            event =>
                                setNewRoomFloorLabel(event.target.value)
                        }
                        placeholder="Nom étage"
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


    function renderLineLinkDialog() {

        if (!linkLine)
            return null;

        const availableLines =
            rowData.filter(
                row =>
                    Number(row.line_id) !== Number(linkLine.line_id)
            );

        return (
            <div className="matrix-modal-backdrop">
                <section className="matrix-product-modal line-link-modal">
                    <header>
                        <h2>Lier la ligne</h2>
                        <button
                            type="button"
                            onClick={
                                () => {
                                    setLinkLine(null);
                                    setLinkStatus("");
                                }
                            }
                        >
                            Fermer
                        </button>
                    </header>

                    <div className="line-link-content">
                        <div className="replace-product-current">
                            <span>Ligne {linkLine.line_number}</span>
                            <strong>{linkLine.product_name}</strong>
                            <span>{linkLine.surface_name}</span>
                        </div>

                        <section className="line-link-section">
                            <h3>Installation unitaire</h3>
                            <label>
                                Source
                                <select
                                    value={installationLinkSourceId}
                                    onChange={
                                        event =>
                                            setInstallationLinkSourceId(
                                                event.target.value
                                            )
                                    }
                                >
                                    <option value="">Aucun lien</option>
                                    {availableLines.map(
                                        row => (
                                            <option
                                                key={row.line_id}
                                                value={row.line_id}
                                            >
                                                {[
                                                    "#" + row.line_number,
                                                    row.surface_name,
                                                    row.product_name
                                                ].filter(Boolean).join(" - ")}
                                            </option>
                                        )
                                    )}
                                </select>
                            </label>

                            <label>
                                Multiplicateur
                                <input
                                    type="number"
                                    step="0.01"
                                    value={installationLinkMultiplier}
                                    onChange={
                                        event =>
                                            setInstallationLinkMultiplier(
                                                event.target.value
                                            )
                                    }
                                />
                            </label>
                        </section>

                        <section className="line-link-section">
                            <h3>Quantités</h3>
                            <label>
                                Multiplicateur
                                <input
                                    type="number"
                                    step="0.01"
                                    value={quantityLinkMultiplier}
                                    onChange={
                                        event =>
                                            setQuantityLinkMultiplier(
                                                event.target.value
                                            )
                                    }
                                />
                            </label>

                            <div className="line-link-source-list">
                                {availableLines.map(
                                    row => (
                                        <label key={row.line_id}>
                                            <input
                                                type="checkbox"
                                                checked={
                                                    quantityLinkSourceIds.includes(
                                                        Number(row.line_id)
                                                    )
                                                }
                                                onChange={
                                                    event =>
                                                        toggleQuantityLinkSource(
                                                            Number(row.line_id),
                                                            event.target.checked
                                                        )
                                                }
                                            />
                                            <span>
                                                {[
                                                    "#" + row.line_number,
                                                    row.surface_name,
                                                    row.product_name
                                                ].filter(Boolean).join(" - ")}
                                            </span>
                                        </label>
                                    )
                                )}

                                {availableLines.length === 0 && (
                                    <div>Aucune autre ligne disponible.</div>
                                )}
                            </div>
                        </section>
                    </div>

                    <footer>
                        {linkStatus && (
                            <span>{linkStatus}</span>
                        )}
                        <button
                            type="button"
                            onClick={
                                () => {
                                    setLinkLine(null);
                                    setLinkStatus("");
                                }
                            }
                            disabled={isLinkSaving}
                        >
                            Annuler
                        </button>
                        <button
                            type="button"
                            onClick={saveLineLinks}
                            disabled={isLinkSaving}
                        >
                            Sauvegarder
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
                                                    "Phase " +
                                                        labelWithCode(
                                                            room.phase_label,
                                                            room.phase_name
                                                        ) :
                                                    "",
                                                room.floor_name ?
                                                    "Étage " +
                                                        labelWithCode(
                                                            room.floor_label,
                                                            room.floor_name
                                                        ) :
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
                                Nom phase
                                <input
                                    type="text"
                                    value={roomEditForm.phase_label}
                                    onChange={
                                        event =>
                                            setRoomEditForm(
                                                previousForm => ({
                                                    ...previousForm,
                                                    phase_label:
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
                                Nom étage
                                <input
                                    type="text"
                                    value={roomEditForm.floor_label}
                                    onChange={
                                        event =>
                                            setRoomEditForm(
                                                previousForm => ({
                                                    ...previousForm,
                                                    floor_label:
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
                        <div className="estimate-summary-project-row">
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

                            <div className="estimate-summary-plan-details">
                                <label>
                                    <span>Architecte:</span>
                                    <input
                                        type="text"
                                        value={summaryForm.architect_name}
                                        onChange={
                                            event =>
                                                updateSummaryForm(
                                                    "architect_name",
                                                    event.target.value
                                                )
                                        }
                                    />
                                </label>

                                <label>
                                    <span>Date plans:</span>
                                    <input
                                        type="date"
                                        value={summaryForm.plan_date}
                                        onChange={
                                            event =>
                                                updateSummaryForm(
                                                    "plan_date",
                                                    event.target.value
                                                )
                                        }
                                    />
                                </label>

                                <div className="plan-pages-block">
                                    <div className="plan-pages-title">
                                        Pages de plans:
                                    </div>
                                    <div className="plan-pages-grid">
                                        <div className="plan-pages-header">Page</div>
                                        <div className="plan-pages-header">Nom</div>
                                        <div className="plan-pages-header">Description</div>
                                        {planPageRows().map(
                                            (row, rowIndex) =>
                                                row.map(
                                                    (value, columnIndex) => (
                                                        <input
                                                            key={
                                                                rowIndex +
                                                                "-" +
                                                                columnIndex
                                                            }
                                                            type="text"
                                                            value={value}
                                                            onChange={
                                                                event =>
                                                                    updatePlanPageCell(
                                                                        rowIndex,
                                                                        columnIndex,
                                                                        event.target.value
                                                                    )
                                                            }
                                                        />
                                                    )
                                                )
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        className="plan-pages-add"
                                        onClick={addPlanPageRow}
                                    >
                                        Ajouter
                                    </button>
                                </div>

                                <div className="spec-line-block">
                                    <div className="spec-line-title">
                                        Devis:
                                    </div>
                                    <div className="spec-line-grid">
                                        <div className="plan-pages-header">Pages</div>
                                        <div className="plan-pages-header">Section</div>
                                        {specRow().map(
                                            (value, columnIndex) => (
                                                <input
                                                    key={columnIndex}
                                                    type="text"
                                                    value={value}
                                                    onChange={
                                                        event =>
                                                            updateSpecCell(
                                                                columnIndex,
                                                                event.target.value
                                                            )
                                                    }
                                                />
                                            )
                                        )}
                                    </div>
                                </div>

                                <div className="addenda-block">
                                    <div className="addenda-title">
                                        Addenda:
                                    </div>
                                    <div className="addenda-grid">
                                        <div className="plan-pages-header">Nom</div>
                                        <div className="plan-pages-header">Date</div>
                                        <div className="plan-pages-header">Plans</div>
                                        <div className="plan-pages-header">Devis</div>
                                        <div className="plan-pages-header">Description</div>
                                        {addendaRows().map(
                                            (row, rowIndex) => (
                                                <div
                                                    key={rowIndex}
                                                    className="addenda-row"
                                                >
                                                    <input
                                                        type="text"
                                                        value={row.name}
                                                        onChange={
                                                            event =>
                                                                updateAddendaRow(
                                                                    rowIndex,
                                                                    "name",
                                                                    event.target.value
                                                                )
                                                        }
                                                    />
                                                    <input
                                                        type="date"
                                                        value={row.date}
                                                        onChange={
                                                            event =>
                                                                updateAddendaRow(
                                                                    rowIndex,
                                                                    "date",
                                                                    event.target.value
                                                                )
                                                        }
                                                    />
                                                    <label className="addenda-checkbox">
                                                        <input
                                                            type="checkbox"
                                                            checked={row.plans}
                                                            onChange={
                                                                event =>
                                                                    updateAddendaRow(
                                                                        rowIndex,
                                                                        "plans",
                                                                        event.target.checked
                                                                    )
                                                            }
                                                        />
                                                    </label>
                                                    <label className="addenda-checkbox">
                                                        <input
                                                            type="checkbox"
                                                            checked={row.specs}
                                                            onChange={
                                                                event =>
                                                                    updateAddendaRow(
                                                                        rowIndex,
                                                                        "specs",
                                                                        event.target.checked
                                                                    )
                                                            }
                                                        />
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={row.description}
                                                        onChange={
                                                            event =>
                                                                updateAddendaRow(
                                                                    rowIndex,
                                                                    "description",
                                                                    event.target.value
                                                                )
                                                        }
                                                    />
                                                </div>
                                            )
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        className="plan-pages-add"
                                        onClick={addAddendaRow}
                                    >
                                        Ajouter
                                    </button>
                                </div>
                            </div>
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
                                                className={
                                                    getSampleSupplierClass(
                                                        tile.supplier_names
                                                    )
                                                }
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
                            <div className="schedule-range">
                                <label>
                                    De:
                                    <input
                                        type="date"
                                        value={summaryForm.probable_schedule_from}
                                        onChange={
                                            event =>
                                                updateSummaryForm(
                                                    "probable_schedule_from",
                                                    event.target.value
                                                )
                                        }
                                    />
                                </label>
                                <label>
                                    À:
                                    <input
                                        type="date"
                                        value={summaryForm.probable_schedule_to}
                                        onChange={
                                            event =>
                                                updateSummaryForm(
                                                    "probable_schedule_to",
                                                    event.target.value
                                                )
                                        }
                                    />
                                </label>
                            </div>

                            <div className="rates-label">Remise fin de projet</div>
                            <input
                                className="short-number"
                                type="number"
                                step="0.01"
                                maxLength={2}
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
                                className="short-number"
                                type="number"
                                step="1"
                                maxLength={2}
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

            {renderLineLinkDialog()}

            {renderTileSurfaceSelector()}

            {renderRoomEditor()}

            {renderProductEditor()}

            <ZoomToolbar
                zoom={zoom}
                contextLabel={"Soumissions " + estimateMenu.toLowerCase()}
                rangeSubtotal={rangeSubtotal}
                selectedLineCount={selectedLineIds.length}
                onDeleteSelectedLines={deleteSelectedLines}
                onFitToScreen={fitToScreen}
                onZoomChange={applyZoom}
            />

            <MatrixGrid
                ref={gridRef}
                rowData={rowData}
                pinnedBottomRowData={pinnedBottomRows}
                columnDefs={columnDefs}
                getRowClass={getMatrixRowClass}
                onCellValueChanged={onCellValueChanged}
                onCellClicked={onCellClicked}
                onRangeSelectionChanged={onRangeSelectionChanged}
                onSelectionChanged={onSelectionChanged}
                zoomScale={ZOOM_LEVELS[zoom] || 1}
                localeText={GRID_LOCALE_TEXT}
            />

        </div>

    );

}


export default MatrixView;
