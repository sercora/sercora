import { forwardRef } from "react";

import { AgGridReact } from "ag-grid-react";

import "ag-grid-enterprise";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";


type MatrixGridProps = {
    rowData: any[];
    pinnedBottomRowData?: any[];
    columnDefs: any[];
    onCellValueChanged: (params: any) => void;
    onCellClicked?: (params: any) => void;
    onSelectionChanged?: (params: any) => void;
    zoomScale: number;
    localeText: Record<string, string>;
};


const MatrixGrid = forwardRef<any, MatrixGridProps>(

    function MatrixGrid(
        {
            rowData,
            pinnedBottomRowData = [],
            columnDefs,
            onCellValueChanged,
            onCellClicked,
            onSelectionChanged,
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

                    pinnedBottomRowData={pinnedBottomRowData}

                    columnDefs={columnDefs}

                    onCellValueChanged={
                        onCellValueChanged
                    }

                    onCellClicked={
                        onCellClicked
                    }

                    onSelectionChanged={
                        onSelectionChanged
                    }

                    rowSelection="multiple"

                    groupDefaultExpanded={-1}

                    rowHeight={22}

                    headerHeight={34}

                    groupHeaderHeight={24}

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
