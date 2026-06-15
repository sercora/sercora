type ZoomToolbarProps = {
    zoom: string;
    onFitToScreen: () => void;
    onZoomChange: (zoom: string) => void;
};


function ZoomToolbar({
    zoom,
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

        </div>

    );

}


export default ZoomToolbar;
