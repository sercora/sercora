import type {
    CalibreCalibration,
    CalibreTool
} from "../../types/calibre";


type CalibreToolbarProps = {
    activeTool: CalibreTool;
    calibration: CalibreCalibration;
    imageName: string;
    scalePercent: number;
    onFitToScreen: () => void;
    onImageSelected: (file: File) => void;
    onToolChange: (tool: CalibreTool) => void;
    onZoomIn: () => void;
    onZoomOut: () => void;
};


function CalibreToolbar({
    activeTool,
    calibration,
    imageName,
    scalePercent,
    onFitToScreen,
    onImageSelected,
    onToolChange,
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
            <div className="calibre-toolbar-title">
                <span>Sercora Calibre</span>
                <strong>Relevé de quantités</strong>
            </div>

            <label className="calibre-upload-button">
                <input
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={
                        event => {
                            const file = event.target.files?.[0];

                            if (file)
                                onImageSelected(file);

                            event.currentTarget.value = "";
                        }
                    }
                />
                Importer JPG/PNG
            </label>

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

            <div className="calibre-zoom-group">
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
                    Fit
                </button>
            </div>

            <div className="calibre-file-status">
                <span>{imageName || "Aucun plan chargé"}</span>
                <strong>
                    {calibration.pixelsPerFoot ?
                        `${calibration.pixelsPerFoot.toFixed(2)} px/pi` :
                        "Non calibré"}
                </strong>
            </div>
        </header>
    );

}


export default CalibreToolbar;
