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
    source: string;
};


type PendingPlanFields = {
    pageNumber: number;
    planName: string;
    planDate: string;
    revisionNumber: string;
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
    isStyleOpen: boolean;
    lineWeight: number;
    pages: CalibrePage[];
    pendingPdf: PendingPdfToolbarState | null;
    pendingPlanFields: PendingPlanFields;
    redoAvailable: boolean;
    saveStatus: string;
    scalePercent: number;
    unitSystem: CalibreUnitSystem;
    undoAvailable: boolean;
    onFullscreenToggle: () => void;
    onLayersToggle: () => void;
    onLineWeightChange: (lineWeight: number) => void;
    onOperationChange: (operation: CalibreOperation) => void;
    onPageChange: (pageId: string) => void;
    onPendingPlanFieldsChange: (fields: PendingPlanFields) => void;
    onPdfPageImport: () => void;
    onPlanSelected: (
        file: File,
        source?: "projectPlans" | "legacyInProgress" | "local"
    ) => void;
    onRedo: () => void;
    onStyleToggle: () => void;
    onToolChange: (tool: CalibreTool) => void;
    onUndo: () => void;
    onUnitSystemChange: (unitSystem: CalibreUnitSystem) => void;
};


function CalibreToolbar({
    activeOperation,
    activePageId,
    activeTool,
    calibration,
    importError,
    isFullscreen,
    isImportingPdfPage,
    isLayersOpen,
    isStyleOpen,
    lineWeight,
    pages,
    pendingPdf,
    pendingPlanFields,
    redoAvailable,
    saveStatus,
    scalePercent,
    unitSystem,
    undoAvailable,
    onFullscreenToggle,
    onLayersToggle,
    onLineWeightChange,
    onOperationChange,
    onPageChange,
    onPendingPlanFieldsChange,
    onPdfPageImport,
    onPlanSelected,
    onRedo,
    onStyleToggle,
    onToolChange,
    onUndo,
    onUnitSystemChange
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
                                    onPlanSelected(
                                        file,
                                        "projectPlans"
                                    );

                                event.currentTarget.value = "";
                            }
                        }
                    />
                    Projet / plans
                </label>

                <label className="calibre-upload-button secondary">
                    <input
                        type="file"
                        accept="application/pdf,image/png,image/jpeg"
                        onChange={
                            event => {
                                const file = event.target.files?.[0];

                                if (file)
                                    onPlanSelected(
                                        file,
                                        "legacyInProgress"
                                    );

                                event.currentTarget.value = "";
                            }
                        }
                    />
                    Legacy / en cours
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
                    <span>
                        {pendingPdf.fileName}
                        <small>{pendingPdf.pageCount} page(s)</small>
                    </span>
                    <div className="calibre-plan-import-fields">
                        <label>
                            Page
                            <input
                                type="number"
                                min={1}
                                max={pendingPdf.pageCount}
                                value={pendingPlanFields.pageNumber}
                                onChange={
                                    event => onPendingPlanFieldsChange({
                                        ...pendingPlanFields,
                                        pageNumber: Number(event.target.value)
                                    })
                                }
                            />
                        </label>
                        <label>
                            Nom du plan
                            <input
                                type="text"
                                value={pendingPlanFields.planName}
                                placeholder="A-100"
                                onChange={
                                    event => onPendingPlanFieldsChange({
                                        ...pendingPlanFields,
                                        planName: event.target.value
                                    })
                                }
                            />
                        </label>
                        <label>
                            Date
                            <input
                                type="date"
                                value={pendingPlanFields.planDate}
                                onChange={
                                    event => onPendingPlanFieldsChange({
                                        ...pendingPlanFields,
                                        planDate: event.target.value
                                    })
                                }
                            />
                        </label>
                        <label>
                            Rév.
                            <input
                                type="text"
                                value={pendingPlanFields.revisionNumber}
                                onChange={
                                    event => onPendingPlanFieldsChange({
                                        ...pendingPlanFields,
                                        revisionNumber: event.target.value
                                    })
                                }
                            />
                        </label>
                        <button
                            type="button"
                            className="calibre-tool-button active"
                            disabled={isImportingPdfPage}
                            onClick={onPdfPageImport}
                        >
                            Importer
                        </button>
                    </div>
                </div>
            )}

            {importError && (
                <div className="calibre-import-error">
                    {importError}
                </div>
            )}

            <div className="calibre-toolbar-controls">
                <div className="calibre-history-group">
                    <button
                        type="button"
                        className="calibre-tool-button"
                        disabled={!undoAvailable}
                        onClick={onUndo}
                    >
                        Annuler
                    </button>
                    <button
                        type="button"
                        className="calibre-tool-button"
                        disabled={!redoAvailable}
                        onClick={onRedo}
                    >
                        Rétablir
                    </button>
                </div>

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

                <div
                    className={
                        activeOperation === "subtract" ?
                            "calibre-operation-switch subtract" :
                            "calibre-operation-switch add"
                    }
                    aria-label="Opération de mesure"
                >
                    <button
                        type="button"
                        className={activeOperation === "add" ? "active" : ""}
                        onClick={
                            () => onOperationChange("add")
                        }
                        title="Addition"
                    >
                        +
                    </button>
                    <button
                        type="button"
                        className={activeOperation === "subtract" ? "active" : ""}
                        onClick={
                            () => onOperationChange("subtract")
                        }
                        title="Soustraction"
                    >
                        -
                    </button>
                </div>

                <div className="calibre-inline-field">
                    <label htmlFor="calibre-line-weight">Trait</label>
                    <select
                        id="calibre-line-weight"
                        value={lineWeight}
                        onChange={
                            event => onLineWeightChange(
                                Number(event.target.value)
                            )
                        }
                    >
                        <option value={0.5}>Très fin</option>
                        <option value={1}>Fin</option>
                        <option value={1.5}>Moyen</option>
                        <option value={2}>Gras</option>
                        <option value={3}>Très gras</option>
                    </select>
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
                            isStyleOpen ?
                                "calibre-tool-button active" :
                                "calibre-tool-button"
                        }
                        onClick={onStyleToggle}
                    >
                        Styles
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
                    <span>{scalePercent}%</span>
                </div>
            </div>

            <div
                className={
                    activeOperation === "subtract" ?
                        "calibre-save-status subtract" :
                        "calibre-save-status"
                }
            >
                <strong>{activeOperation === "subtract" ? "MODE - RETRAIT" : "MODE + AJOUT"}</strong>
                {saveStatus}
            </div>
        </header>
    );

}


export default CalibreToolbar;
