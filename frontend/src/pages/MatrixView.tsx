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
            "http://10.0.25.14:8000/estimates/1/matrix"
        )
        .then(
            response => response.json()
        )
        .then(
            matrix => {

                //
                // Colonnes
                //
                const cols: any[] = [
                    {
                        field: "product_name",
                        headerName: "Product"
                    }
                ];

                matrix.rooms.forEach(
                    (room: string) => {

                        cols.push(
                            {
                                field: room,
                                headerName: room
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
                            product_name: line.product_name
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
                height: "800px"
            }}
        >

            <AgGridProvider
                modules={[AllCommunityModule]}
            >

                <AgGridReact
                    rowData={rowData}
                    columnDefs={columnDefs}
                />

            </AgGridProvider>

        </div>

    );

}


export default MatrixView;
