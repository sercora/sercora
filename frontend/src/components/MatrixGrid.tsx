import { forwardRef } from "react";

import { AgGridReact } from "ag-grid-react";

import "ag-grid-enterprise";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";


type MatrixGridProps = {
    rowData: any[];
    columnDefs: any[];
    onCellValueChanged: (params: any) => void;
    zoomScale: number;
    localeText: Record<string, string>;
};


const MatrixGrid = forwardRef<any, MatrixGridProps>(

    function MatrixGrid(
        {
            rowData,
            columnDefs,
            onCellValueChanged,
            zoomScale,
            localeText
        },
        gridRef
    ) {

        return (

            <div
                className="ag-theme-alpine sercora-grid"
                style={{
                    width: "100%",
                    ["--sercora-zoom" as any]:
                        zoomScale
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

                    localeText={localeText}

                    autoGroupColumnDef={{
                        headerName: "Surface",
                        minWidth: 180
                    }}

                />

            </div>

        );

    }

);


export default MatrixGrid;
