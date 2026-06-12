import { useEffect, useRef, useState } from "react";

import { AgGridReact } from "ag-grid-react";

import "ag-grid-enterprise";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

import "../styles/grid.css";


const API_URL = "https://api.serco.pro";

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


function MatrixView() {

    const gridRef = useRef<any>(null);

    const [columnDefs, setColumnDefs] = useState<any[]>([]);

    const [rowData, setRowData] = useState<any[]>([]);

    const [zoom, setZoom] = useState("100");


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


    function getQtyTotal(
        params: any,
        rooms: string[]
    ) {

        if (!params.data)
            return 0;

        let total = 0;

        rooms.forEach(
            room => {

                total += Number(
                    params.data[room] ?? 0
                );

            }
        );

        return total;

    }


    function getQtyWithLoss(
        params: any,
        rooms: string[]
    ) {

        if (!params.data)
            return 0;

        return (
            getQtyTotal(
                params,
                rooms
            )

            *

            (
                1 +
                Number(params.data.loss_percent || 0) / 100
            )
        );

    }


    function getMaterialCost(
        params: any,
        rooms: string[]
    ) {

        if (!params.data)
            return 0;

        return (
            getQtyWithLoss(
                params,
                rooms
            )

            *

            Number(params.data.purchase_price || 0)
        );

    }


    function getProfit(
        params: any,
        rooms: string[]
    ) {

        if (!params.data)
            return 0;

        return (

            getMaterialCost(
                params,
                rooms
            )

            *

            Number(params.data.profit_percent || 0)

            / 100

        );

    }


    function getInstallTotal(
        params: any,
        rooms: string[]
    ) {

        if (!params.data)
            return 0;

        return (

            getQtyWithLoss(
                params,
                rooms
            )

            *

            Number(params.data.installation_cost || 0)

        );

    }


    function getSellPrice(
        params: any,
        rooms: string[]
    ) {

        if (!params.data)
            return 0;

        return (

            getMaterialCost(
                params,
                rooms
            )

            +

            getProfit(
                params,
                rooms
            )

            +

            getInstallTotal(
                params,
                rooms
            )

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

        if (!quantityId)
            return;

        fetch(

            API_URL +
            "/estimate-quantities/" +
            quantityId,

            {

                method: "PUT",

                headers: {

                    "Content-Type":
                        "application/json"

                },

                body: JSON.stringify(

                    {

                        quantity:
                            parseNumber(
                                params.newValue
                            )

                    }

                )

            }

        )

        .then(
            () => {

                refreshGrid();

            }
        );

    }


    function updateEstimateLine(
        params: any
    ) {

        fetch(

            API_URL +
            "/estimate-lines/" +
            params.data.line_id,

            {

                method: "PUT",

                headers: {

                    "Content-Type":
                        "application/json"

                },

                body: JSON.stringify(

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


    useEffect(

        () => {

            fetch(
                API_URL +
                "/estimates/1/matrix"
            )

            .then(
                response => response.json()
            )

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

        []

    );


    return (

        <div className="matrix-page">

            <div className="matrix-toolbar">

                <button
                    type="button"
                    className={zoom === "fit" ? "active" : ""}
                    onClick={fitToScreen}
                >
                    Ajuster à l'écran
                </button>

                <button
                    type="button"
                    className={zoom === "100" ? "active" : ""}
                    onClick={() => applyZoom("100")}
                >
                    100%
                </button>

                <button
                    type="button"
                    className={zoom === "125" ? "active" : ""}
                    onClick={() => applyZoom("125")}
                >
                    125%
                </button>

                <button
                    type="button"
                    className={zoom === "150" ? "active" : ""}
                    onClick={() => applyZoom("150")}
                >
                    150%
                </button>

            </div>

            <div
                className="ag-theme-alpine sercora-grid"
                style={{
                    width: "100%",
                    height: "calc(100vh - 46px)",
                    ["--sercora-zoom" as any]:
                        ZOOM_LEVELS[zoom] || 1
                }}
            >

                <AgGridReact

                    ref={gridRef}

                    rowData={rowData}

                    columnDefs={columnDefs}

                    onCellValueChanged={
                        onCellValueChanged
                    }

                    groupDefaultExpanded={-1}

                    rowHeight={22}

                    headerHeight={25}

                    suppressRowClickSelection={true}

                    enableRangeSelection={true}

                    animateRows={false}

                    localeText={GRID_LOCALE_TEXT}

                    autoGroupColumnDef={{
                        headerName: "Surface",
                        minWidth: 180
                    }}

                />

            </div>

        </div>

    );

}


export default MatrixView;
