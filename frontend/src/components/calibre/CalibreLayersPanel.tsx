import {
    CALIBRE_LAYERS
} from "../../types/calibre";
import type {
    CalibreLayerKind,
    CalibreLayerVisibility,
    CalibreMeasurement,
    CalibreSector
} from "../../types/calibre";


type CalibreLayersPanelProps = {
    activeLayer: CalibreLayerKind;
    activeSectorId: string;
    measurements: CalibreMeasurement[];
    sectors: CalibreSector[];
    visibility: CalibreLayerVisibility;
    onActiveLayerChange: (layer: CalibreLayerKind) => void;
    onActiveSectorChange: (sectorId: string) => void;
    onSectorsChange: (sectors: CalibreSector[]) => void;
    onVisibilityChange: (
        layer: CalibreLayerKind,
        visible: boolean
    ) => void;
};


function signedValue(
    measurement: CalibreMeasurement,
    value: number | null
) {

    if (!value)
        return 0;

    return measurement.operation === "subtract" ?
        -value :
        value;

}


function layerTotals(
    layer: CalibreLayerKind,
    measurements: CalibreMeasurement[]
) {

    return measurements
        .filter(
            measurement => measurement.layer === layer
        )
        .reduce(
            (
                totals,
                measurement
            ) => ({
                count: totals.count + 1,
                lengthFeet: totals.lengthFeet + signedValue(
                    measurement,
                    measurement.lengthFeet
                ),
                areaSquareFeet: totals.areaSquareFeet + signedValue(
                    measurement,
                    measurement.areaSquareFeet
                )
            }),
            {
                count: 0,
                lengthFeet: 0,
                areaSquareFeet: 0
            }
        );

}


function sectorCount(
    sectorId: string,
    measurements: CalibreMeasurement[]
) {

    return measurements.filter(
        measurement => measurement.sectorId === sectorId
    ).length;

}


function CalibreLayersPanel({
    activeLayer,
    activeSectorId,
    measurements,
    sectors,
    visibility,
    onActiveLayerChange,
    onActiveSectorChange,
    onSectorsChange,
    onVisibilityChange
}: CalibreLayersPanelProps) {

    function handleAddSector() {

        const room = window.prompt(
            "Nom de la pièce",
            "Pièce"
        );

        if (!room)
            return;

        const name = window.prompt(
            "Nom du secteur",
            "Secteur 1"
        );

        if (!name)
            return;

        const sector = {
            id: crypto.randomUUID(),
            room,
            name
        };

        onSectorsChange([
            ...sectors,
            sector
        ]);
        onActiveSectorChange(sector.id);

    }

    return (
        <aside className="calibre-layers-panel">
            <div className="calibre-panel-heading">
                <span>Calques</span>
                <strong>Types de travaux</strong>
            </div>

            <div className="calibre-layer-list">
                {CALIBRE_LAYERS.map(
                    layer => {
                        const totals = layerTotals(
                            layer.key,
                            measurements
                        );

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
                                    <small>{totals.count}</small>
                                </button>

                                <div className="calibre-layer-totals">
                                    <span>{totals.areaSquareFeet.toFixed(2)} pi²</span>
                                    <span>{totals.lengthFeet.toFixed(2)} pi lin.</span>
                                </div>

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

            <div className="calibre-panel-heading">
                <span>Pièces</span>
                <strong>Secteurs de takeoff</strong>
            </div>

            <div className="calibre-sector-list">
                {sectors.map(
                    sector => (
                        <button
                            key={sector.id}
                            type="button"
                            className={
                                activeSectorId === sector.id ?
                                    "calibre-sector-row active" :
                                    "calibre-sector-row"
                            }
                            onClick={
                                () => onActiveSectorChange(sector.id)
                            }
                        >
                            <span>{sector.room}</span>
                            <strong>{sector.name}</strong>
                            <small>{sectorCount(sector.id, measurements)} mesure(s)</small>
                        </button>
                    )
                )}
            </div>

            <button
                type="button"
                className="calibre-secondary-button"
                onClick={handleAddSector}
            >
                Ajouter un secteur
            </button>
        </aside>
    );

}


export default CalibreLayersPanel;
