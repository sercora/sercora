import { useEffect, useRef, useState } from "react";

import { AgGridReact } from "ag-grid-react";

import "ag-grid-enterprise";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

import "../styles/grid.css";


function MatrixView() {

    const gridRef = useRef<any>(null);

    const [columnDefs, setColumnDefs] = useState<any[]>([]);

    const [rowData, setRowData] = useState<any[]>([]);


    function refreshGrid() {

        setRowData(
            previousRows => [
                ...previousRows
            ]
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
                params.data.loss_percent / 100
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

            params.data.purchase_price
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

            params.data.profit_percent

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

            params.data.installation_cost

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


    function onCellValueChanged(
        params: any
    ) {

        const room =
            params.column.getColId();

        const quantityId =
            params.data[
                room + "_id"
            ];

        fetch(

            "https://api.serco.pro/estimate-quantities/" +
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
                            Number(
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


    useEffect(

        () => {

            fetch(
                "https://api.serco.pro/estimates/1/matrix"
            )

            .then(
                response => response.json()
            )

            .then(

                matrix => {

                    const cols: any[] = [

                        {
                            field: "surface_name",
                            rowGroup: true,
                            hide: true
                        },

                        {
                            field: "product_name",
                            headerName: "Product",
                            width: 350,
                            pinned: "left"
                        },

                        {
                            field: "unit_name",
                            headerName: "Unit",
                            width: 120
                        },

                        {
                            field: "grout_color",
                            headerName: "Grout",
                            width: 120
                        },

                        {
                            field: "loss_percent",
                            headerName: "Loss %",
                            width: 100
                        },

                        {
                            field: "purchase_price",
                            headerName: "Purchase $",
                            width: 120
                        },

                        {
                            field: "profit_percent",
                            headerName: "Profit %",
                            width: 100
                        },

                        {
                            field: "installation_cost",
                            headerName: "Install $",
                            width: 120
                        }

                    ];


                    matrix.rooms.forEach(

                        (room: string) => {

                            cols.push(

                                {

                                    field: room,

                                    headerName: room,

                                    editable: true

                                }

                            );

                        }

                    );


                    cols.push(

                        {

                            headerName: "Qty Total",

                            valueGetter:

                                (params: any) =>

                                    getQtyTotal(
                                        params,
                                        matrix.rooms
                                    )

                        },

                        {

                            headerName: "Qty+Loss",

                            valueGetter:

                                (params: any) =>

                                    getQtyWithLoss(
                                        params,
                                        matrix.rooms
                                    ).toFixed(2)

                        },

                        {

                            headerName: "Material Cost",

                            valueGetter:

                                (params: any) =>

                                    getMaterialCost(
                                        params,
                                        matrix.rooms
                                    ).toFixed(2)

                        },

                        {

                            headerName: "Profit $",

                            valueGetter:

                                (params: any) =>

                                    getProfit(
                                        params,
                                        matrix.rooms
                                    ).toFixed(2)

                        },

                        {

                            headerName: "Install Total",

                            valueGetter:

                                (params: any) =>

                                    getInstallTotal(
                                        params,
                                        matrix.rooms
                                    ).toFixed(2)

                        },

                        {

                            headerName: "Sell Price",

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
                                        line.quantities[room].quantity;

                                    row[
                                        room + "_id"
                                    ] =
                                        line.quantities[room].id;

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

        <div
            className="ag-theme-alpine sercora-grid"
            style={{
                width: "100%",
                height: "900px"
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

            />

        </div>

    );

}


export default MatrixView;
