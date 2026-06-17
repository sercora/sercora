import type {
    CalibreCalibration,
    CalibreOperation,
    CalibrePage,
    CalibreTool,
    CalibreUnitSystem
} from "../../types/calibre";


type PendingPdfToolbarState = {
    fileName: string;
    pageCount: number;
};


type CalibreToolbarProps = {
    activeOperation: CalibreOperation;
    activePageId: string;
    activeTool: CalibreTool;
    calibration: CalibreCalibration;
    importError: string;
    isFullscreen: boolean;
    isImportingPdfPage: boolean;
    isLayersOpen: boolean;
    pages: CalibrePage[];
    pendingPdf: PendingPdfToolbarState | null;
    scalePercent: number;
    unitSystem: CalibreUnitSystem;
    onFitToScreen: () => void;
    onFullscreenToggle: () => void;
    onLayersToggle: () => void;
    onOperationChange: (operation: CalibreOperation) => void;
    onPageChange: (pageId: string) => void;
    onPdfPageImport: (pageNumber: number) => void;
    onPlanSelected: (file: File) => void;
    onToolChange: (tool: CalibreTool) => void;
    onUnitSystemChange: (unitSystem: CalibreUnitSystem) => void;
    onZoomIn: () => void;
    onZoomOut: () => void;
};


function pageNumbers(
    pageCount: number
) {

    return Array.from(
        {
            length: pageCount
        },
        (
            _,
            index
        ) => index + 1
    );

}


function CalibreToolbar({
    activeOperation,
    activePageId,
    activeTool,
    calibration,
    importError,
    isFullscreen,
    isImportingPdfPage,
    isLayersOpen,
    pages,
    pendingPdf,
    scalePercent,
    unitSystem,
    onFitToScreen,
    onFullscreenToggle,
    onLayersToggle,
    onOperationChange,
    onPageChange,
    onPdfPageImport,
    onPlanSelected,
    onToolChange,
    onUnitSystemChange,
    onZoomIn,
    onZoomOut
}: CalibreToolbarProps) {

    const toolItems: {
        key: CalibreTool;
        label: string;
    }[] = [
        {
            key: "select",
            label: "Sélection"
        },
        {
            key: "calibrate",
            label: "Calibration"
        },
        {
            key: "line",
            label: "Ligne"
        },
        {
            key: "rectangle",
            label: "Rectangle"
        },
        {
            key: "polygon",
            label: "Polygone"
        },
        {
            key: "pan",
            label: "Pan"
        }
    ];

    return (
        <header className="calibre-toolbar">
            <div className="calibre-toolbar-main">
                <div className="calibre-toolbar-title">
                    <span>Sercora Calibre</span>
                    <strong>Relevé de quantités</strong>
                </div>

                <label className="calibre-upload-button">
                    <input
                        type="file"
                        accept="application/pdf,image/png,image/jpeg"
                        onChange={
                            event => {
                                const file = event.target.files?.[0];

                                if (file)
                                    onPlanSelected(file);

                                event.currentTarget.value = "";
                            }
                        }
                    />
                    Importer PDF/JPG/PNG
                </label>

                <div className="calibre-field-group">
                    <label htmlFor="calibre-active-page">Fond de plan</label>
                    <select
                        id="calibre-active-page"
                        value={activePageId}
                        onChange={
                            event => onPageChange(event.target.value)
                        }
                    >
                        <option value="">Aucune page</option>
                        {pages.map(
                            page => (
                                <option
                                    key={page.id}
                                    value={page.id}
                                >
                                    {page.name}
                                </option>
                            )
                        )}
                    </select>
                </div>

                <div className="calibre-file-status">
                    <span>{pages.length} page{pages.length > 1 ? "s" : ""} importée{pages.length > 1 ? "s" : ""}</span>
                    <strong>
                        {calibration.pixelsPerFoot ?
                            `${calibration.pixelsPerFoot.toFixed(2)} px/pi` :
                            "Non calibré"}
                    </strong>
                </div>
            </div>

            {pendingPdf && (
                <div className="calibre-pdf-strip">
                    <span>{pendingPdf.fileName}</span>
                    <div>
                        {pageNumbers(pendingPdf.pageCount).map(
                            pageNumber => (
                                <button
                                    key={pageNumber}
                                    type="button"
                                    className="calibre-tool-button"
                                    disabled={isImportingPdfPage}
                                    onClick={
                                        () => onPdfPageImport(pageNumber)
                                    }
                                >
                                    Page {pageNumber}
                                </button>
                            )
                        )}
                    </div>
                </div>
            )}

            {importError && (
                <div className="calibre-import-error">
                    {importError}
                </div>
            )}

            <div className="calibre-toolbar-controls">
                <div className="calibre-tool-group">
                    {toolItems.map(
                        tool => (
                            <button
                                key={tool.key}
                                type="button"
                                className={
                                    activeTool === tool.key ?
                                        "calibre-tool-button active" :
                                        "calibre-tool-button"
                                }
                                onClick={
                                    () => onToolChange(tool.key)
                                }
                            >
                                {tool.label}
                            </button>
                        )
                    )}
                </div>

                <div className="calibre-segmented-control" aria-label="Système d'unités">
                    <button
                        type="button"
                        className={unitSystem === "imperial" ? "active" : ""}
                        onClick={
                            () => onUnitSystemChange("imperial")
                        }
                    >
                        Impérial
                    </button>
                    <button
                        type="button"
                        className={unitSystem === "metric" ? "active" : ""}
                        onClick={
                            () => onUnitSystemChange("metric")
                        }
                    >
                        Métrique
                    </button>
                </div>

                <div className="calibre-segmented-control" aria-label="Opération de mesure">
                    <button
                        type="button"
                        className={activeOperation === "add" ? "active" : ""}
                        onClick={
                            () => onOperationChange("add")
                        }
                    >
                        Addition
                    </button>
                    <button
                        type="button"
                        className={activeOperation === "subtract" ? "active" : ""}
                        onClick={
                            () => onOperationChange("subtract")
                        }
                    >
                        Soustraction
                    </button>
                </div>

                <div className="calibre-zoom-group">
                    <button
                        type="button"
                        className={
                            isLayersOpen ?
                                "calibre-tool-button active" :
                                "calibre-tool-button"
                        }
                        onClick={onLayersToggle}
                    >
                        Calques
                    </button>
                    <button
                        type="button"
                        className={
                            isFullscreen ?
                                "calibre-tool-button active" :
                                "calibre-tool-button"
                        }
                        onClick={onFullscreenToggle}
                    >
                        {isFullscreen ? "Quitter plein écran" : "Plein écran"}
                    </button>
                    <button
                        type="button"
                        className="calibre-tool-button"
                        onClick={onZoomOut}
                    >
                        Zoom -
                    </button>
                    <span>{scalePercent}%</span>
                    <button
                        type="button"
                        className="calibre-tool-button"
                        onClick={onZoomIn}
                    >
                        Zoom +
                    </button>
                    <button
                        type="button"
                        className="calibre-tool-button"
                        onClick={onFitToScreen}
                    >
                        Ajuster
                    </button>
                </div>
            </div>
        </header>
    );

}


export default CalibreToolbar;
