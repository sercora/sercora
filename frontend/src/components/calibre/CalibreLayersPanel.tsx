import {
    CALIBRE_LAYERS
} from "../../types/calibre";
import type {
    CalibreLayerKind,
    CalibreLayerVisibility,
    CalibreMeasurement
} from "../../types/calibre";


type CalibreLayersPanelProps = {
    activeLayer: CalibreLayerKind;
    measurements: CalibreMeasurement[];
    visibility: CalibreLayerVisibility;
    onActiveLayerChange: (layer: CalibreLayerKind) => void;
    onVisibilityChange: (
        layer: CalibreLayerKind,
        visible: boolean
    ) => void;
};


function CalibreLayersPanel({
    activeLayer,
    measurements,
    visibility,
    onActiveLayerChange,
    onVisibilityChange
}: CalibreLayersPanelProps) {

    return (
        <aside className="calibre-layers-panel">
            <div className="calibre-panel-heading">
                <span>Calques</span>
                <strong>Types de travaux</strong>
            </div>

            <div className="calibre-layer-list">
                {CALIBRE_LAYERS.map(
                    layer => {
                        const layerCount = measurements.filter(
                            measurement => measurement.layer === layer.key
                        ).length;

                        return (
                            <div
                                key={layer.key}
                                className={
                                    activeLayer === layer.key ?
                                        "calibre-layer-row active" :
                                        "calibre-layer-row"
                                }
                            >
                                <button
                                    type="button"
                                    onClick={
                                        () => onActiveLayerChange(layer.key)
                                    }
                                >
                                    <i
                                        style={{
                                            background: layer.color
                                        }}
                                    />
                                    <span>{layer.label}</span>
                                    <small>{layerCount}</small>
                                </button>

                                <label>
                                    <input
                                        type="checkbox"
                                        checked={visibility[layer.key]}
                                        onChange={
                                            event => onVisibilityChange(
                                                layer.key,
                                                event.target.checked
                                            )
                                        }
                                    />
                                    Visible
                                </label>
                            </div>
                        );
                    }
                )}
            </div>
        </aside>
    );

}


export default CalibreLayersPanel;
