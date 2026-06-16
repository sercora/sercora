type ZoomToolbarProps = {
    zoom: string;
    contextLabel?: string;
    rangeSubtotal?: {
        count: number;
        sum: number;
        average: number;
    } | null;
    selectedLineCount?: number;
    onDeleteSelectedLines?: () => void;
    onFitToScreen: () => void;
    onZoomChange: (zoom: string) => void;
};


function ZoomToolbar({
    zoom,
    contextLabel,
    rangeSubtotal,
    selectedLineCount = 0,
    onDeleteSelectedLines,
    onFitToScreen,
    onZoomChange
}: ZoomToolbarProps) {

    return (

        <div className="matrix-toolbar">

            <button
                type="button"
                className={zoom === "fit" ? "active" : ""}
                onClick={onFitToScreen}
            >
                Ajuster à l'écran
            </button>

            {onDeleteSelectedLines && (
                <button
                    type="button"
                    className="danger"
                    onClick={onDeleteSelectedLines}
                    disabled={!selectedLineCount}
                >
                    Supprimer lignes
                </button>
            )}

            <button
                type="button"
                className={zoom === "100" ? "active" : ""}
                onClick={() => onZoomChange("100")}
            >
                100%
            </button>

            <button
                type="button"
                className={zoom === "125" ? "active" : ""}
                onClick={() => onZoomChange("125")}
            >
                125%
            </button>

            <button
                type="button"
                className={zoom === "150" ? "active" : ""}
                onClick={() => onZoomChange("150")}
            >
                150%
            </button>

            {rangeSubtotal && rangeSubtotal.count > 0 && (
                <span className="matrix-toolbar-subtotal">
                    Sous-total {rangeSubtotal.sum.toFixed(2)}
                    <span>
                        Nb {rangeSubtotal.count}
                    </span>
                    <span>
                        Moy. {rangeSubtotal.average.toFixed(2)}
                    </span>
                </span>
            )}

            {contextLabel && (
                <span className="matrix-toolbar-context">
                    {contextLabel}
                </span>
            )}

        </div>

    );

}


export default ZoomToolbar;
