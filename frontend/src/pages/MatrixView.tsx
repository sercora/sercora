import { useEffect, useState } from "react";

import { AgGridReact, AgGridProvider } from "ag-grid-react";
import { AllCommunityModule } from "ag-grid-community";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";


function MatrixView() {

    const [columnDefs, setColumnDefs] = useState<any[]>([]);
    const [rowData, setRowData] = useState<any[]>([]);


    useEffect(() => {

        fetch(
            "https://api.serco.pro/estimates/1/matrix"
        )
        .then(
            response => response.json()
        )
        .then(
            matrix => {

                //
                // Colonnes fixes
                //
                const cols: any[] = [

                    {
                        field: "product_name",
                        headerName: "Product",
                        width: 300
                    },

                    {
                        field: "surface_name",
                        headerName: "Surface",
                        width: 120
                    },

                    {
                        field: "unit_name",
                        headerName: "Unit",
                        width: 120
                    },

                    {
                        field: "grout_color",
                        headerName: "Grout Color",
                        width: 150
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


                //
                // Colonnes locaux
                //
                matrix.rooms.forEach(
                    (room: string) => {

                        cols.push(
                            {
                                field: room,
                                headerName: room,
                                width: 100
                            }
                        );

                    }
                );

                setColumnDefs(cols);


                //
                // Lignes
                //
                const rows = matrix.lines.map(
                    (line: any) => {

                        const row: any = {

                            product_name: line.product_name,
                            surface_name: line.surface_name,
                            unit_name: line.unit_name,
                            grout_color: line.grout_color,
                            loss_percent: line.loss_percent,
                            purchase_price: line.purchase_price,
                            profit_percent: line.profit_percent,
                            installation_cost: line.installation_cost

                        };


                        matrix.rooms.forEach(
                            (room: string) => {

                                row[room] =
                                    line.quantities[room] ?? "";

                            }
                        );

                        return row;

                    }
                );

                setRowData(rows);

            }
        );

    }, []);


    return (

        <div
            className="ag-theme-alpine"
            style={{
                width: "100%",
                height: "900px"
            }}
        >

            <AgGridProvider modules={[AllCommunityModule]}>

                <AgGridReact
                    rowData={rowData}
                    columnDefs={columnDefs}
                />

            </AgGridProvider>

        </div>

    );

}


export default MatrixView;
