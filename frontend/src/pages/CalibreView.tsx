import {
    useCallback,
    useEffect,
    useRef,
    useState
} from "react";

import CalibreCanvas from "../components/calibre/CalibreCanvas";
import CalibreLayersPanel from "../components/calibre/CalibreLayersPanel";
import CalibreToolbar from "../components/calibre/CalibreToolbar";
import {
    DEFAULT_LAYER_VISIBILITY
} from "../types/calibre";
import type {
    CalibreCalibration,
    CalibreLayerKind,
    CalibreLayerVisibility,
    CalibreMeasurement,
    CalibreTool
} from "../types/calibre";

import "../styles/calibre.css";


function CalibreView() {

    const fitToScreenRef = useRef<() => void>(() => undefined);
    const [imageUrl, setImageUrl] = useState("");
    const [imageName, setImageName] = useState("");
    const [activeTool, setActiveTool] = useState<CalibreTool>("select");
    const [activeLayer, setActiveLayer] = useState<CalibreLayerKind>("floor");
    const [layerVisibility, setLayerVisibility] =
        useState<CalibreLayerVisibility>(DEFAULT_LAYER_VISIBILITY);
    const [measurements, setMeasurements] = useState<CalibreMeasurement[]>([]);
    const [calibration, setCalibration] = useState<CalibreCalibration>({
        pixelsPerFoot: null,
        referenceFeet: null
    });
    const [viewportScale, setViewportScale] = useState(1);

    useEffect(
        () => () => {
            if (imageUrl)
                URL.revokeObjectURL(imageUrl);
        },
        [
            imageUrl
        ]
    );

    function handleImageSelected(
        file: File
    ) {

        if (imageUrl)
            URL.revokeObjectURL(imageUrl);

        setImageName(file.name);
        setImageUrl(
            URL.createObjectURL(file)
        );
        setMeasurements([]);
        setCalibration({
            pixelsPerFoot: null,
            referenceFeet: null
        });
        setActiveTool("select");
        setViewportScale(1);

    }


    function updateLayerVisibility(
        layer: CalibreLayerKind,
        visible: boolean
    ) {

        setLayerVisibility(
            currentVisibility => ({
                ...currentVisibility,
                [layer]: visible
            })
        );

    }


    const registerFitToScreen = useCallback(
        (
            handler: () => void
        ) => {
            fitToScreenRef.current = handler;
        },
        []
    );


    function zoomBy(
        factor: number
    ) {

        setViewportScale(
            currentScale => Math.max(
                0.25,
                Math.min(
                    4,
                    currentScale * factor
                )
            )
        );

    }


    return (
        <section className="calibre-page">
            <CalibreToolbar
                activeTool={activeTool}
                calibration={calibration}
                imageName={imageName}
                scalePercent={Math.round(viewportScale * 100)}
                onFitToScreen={
                    () => fitToScreenRef.current()
                }
                onImageSelected={handleImageSelected}
                onToolChange={setActiveTool}
                onZoomIn={
                    () => zoomBy(1.15)
                }
                onZoomOut={
                    () => zoomBy(0.85)
                }
            />

            <div className="calibre-workspace">
                <CalibreCanvas
                    activeLayer={activeLayer}
                    activeTool={activeTool}
                    calibration={calibration}
                    imageUrl={imageUrl}
                    layerVisibility={layerVisibility}
                    measurements={measurements}
                    viewportScale={viewportScale}
                    onCalibrationChange={setCalibration}
                    onFitToScreenReady={registerFitToScreen}
                    onMeasurementsChange={setMeasurements}
                    onViewportScaleChange={setViewportScale}
                />

                <CalibreLayersPanel
                    activeLayer={activeLayer}
                    measurements={measurements}
                    visibility={layerVisibility}
                    onActiveLayerChange={setActiveLayer}
                    onVisibilityChange={updateLayerVisibility}
                />
            </div>
        </section>
    );

}


export default CalibreView;
