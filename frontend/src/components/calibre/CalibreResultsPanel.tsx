import {
    useEffect,
    useMemo,
    useState
} from "react";

import {
    CALIBRE_LAYERS
} from "../../types/calibre";
import type {
    CalibreLayerKind,
    CalibreMeasurement,
    CalibreSector
} from "../../types/calibre";


type CalibreResultsPanelProps = {
    activeLayer: CalibreLayerKind;
    activeSectorId: string;
    measurements: CalibreMeasurement[];
    sectors: CalibreSector[];
};


type PanelPosition = {
    dock: "free" | "left" | "right";
    x: number;
    y: number;
    collapsed: boolean;
};


type DragState = {
    pointerId: number;
    startX: number;
    startY: number;
    panelX: number;
    panelY: number;
} | null;


const STORAGE_KEY = "sercora.calibre.resultsPanel";

const DEFAULT_POSITION: PanelPosition = {
    dock: "right",
    x: 0,
    y: 16,
    collapsed: false
};


function storedPosition() {

    try {
        const rawValue = localStorage.getItem(STORAGE_KEY);

        if (!rawValue)
            return DEFAULT_POSITION;

        return {
            ...DEFAULT_POSITION,
            ...JSON.parse(rawValue)
        } as PanelPosition;
    }
    catch {
        return DEFAULT_POSITION;
    }

}


function signedArea(
    measurement: CalibreMeasurement
) {

    const value = measurement.areaSquareFeet || 0;

    return measurement.operation === "subtract" ?
        -value :
        value;

}


function signedLength(
    measurement: CalibreMeasurement
) {

    const value = measurement.lengthFeet || 0;

    return measurement.operation === "subtract" ?
        -value :
        value;

}


function formatArea(
    value: number
) {

    return `${value.toFixed(1)} pi²`;

}


function formatLength(
    value: number
) {

    return `${value.toFixed(1)} pi lin.`;

}


function CalibreResultsPanel({
    activeLayer,
    activeSectorId,
    measurements,
    sectors
}: CalibreResultsPanelProps) {

    const [position, setPosition] = useState(storedPosition);
    const [drag, setDrag] = useState<DragState>(null);

    const activeLayerDefinition = CALIBRE_LAYERS.find(
        layer => layer.key === activeLayer
    ) || CALIBRE_LAYERS[0];
    const activeSector = sectors.find(
        sector => sector.id === activeSectorId
    );

    const totals = useMemo(
        () => {
            const scopedMeasurements = measurements.filter(
                measurement => measurement.layer === activeLayer
            );

            return scopedMeasurements.reduce(
                (
                    result,
                    measurement
                ) => {
                    const area = measurement.areaSquareFeet || 0;
                    return {
                        additions: result.additions + (
                            measurement.operation === "add" ?
                                area :
                                0
                        ),
                        count: result.count + 1,
                        netArea: result.netArea + signedArea(measurement),
                        perimeter: result.perimeter + Math.abs(
                            signedLength(measurement)
                        ),
                        removals: result.removals + (
                            measurement.operation === "subtract" ?
                                area :
                                0
                        )
                    };
                },
                {
                    additions: 0,
                    count: 0,
                    netArea: 0,
                    perimeter: 0,
                    removals: 0
                }
            );
        },
        [
            activeLayer,
            measurements
        ]
    );

    useEffect(
        () => {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(position)
            );
        },
        [
            position
        ]
    );

    useEffect(
        () => {
            if (!drag)
                return;

            const activeDrag = drag;

            function handlePointerMove(
                event: PointerEvent
            ) {

                setPosition(
                    currentPosition => ({
                        ...currentPosition,
                        dock: "free",
                        x: Math.max(
                            8,
                            activeDrag.panelX + event.clientX - activeDrag.startX
                        ),
                        y: Math.max(
                            8,
                            activeDrag.panelY + event.clientY - activeDrag.startY
                        )
                    })
                );

            }

            function handlePointerUp() {

                setDrag(null);

            }

            window.addEventListener(
                "pointermove",
                handlePointerMove
            );
            window.addEventListener(
                "pointerup",
                handlePointerUp,
                {
                    once: true
                }
            );

            return () => {
                window.removeEventListener(
                    "pointermove",
                    handlePointerMove
                );
                window.removeEventListener(
                    "pointerup",
                    handlePointerUp
                );
            };
        },
        [
            drag
        ]
    );

    const panelStyle =
        position.dock === "left" ?
            {
                left: 16,
                top: position.y
            } :
            position.dock === "right" ?
                {
                    right: 16,
                    top: position.y
                } :
                {
                    left: position.x,
                    top: position.y
                };

    return (
        <aside
            className={
                position.collapsed ?
                    "calibre-results-panel collapsed" :
                    "calibre-results-panel"
            }
            style={panelStyle}
        >
            <header
                onPointerDown={
                    event => {
                        if ((event.target as HTMLElement).closest("button"))
                            return;

                        setDrag({
                            pointerId: event.pointerId,
                            startX: event.clientX,
                            startY: event.clientY,
                            panelX: position.x || 16,
                            panelY: position.y || 16
                        });
                    }
                }
            >
                <div>
                    <span>Résultats</span>
                    <strong>{activeLayerDefinition.label}</strong>
                </div>
                <div className="calibre-panel-actions">
                    <button
                        type="button"
                        onClick={
                            () => setPosition(
                                currentPosition => ({
                                    ...currentPosition,
                                    dock: "left",
                                    y: 16
                                })
                            )
                        }
                    >
                        Gauche
                    </button>
                    <button
                        type="button"
                        onClick={
                            () => setPosition(
                                currentPosition => ({
                                    ...currentPosition,
                                    dock: "right",
                                    y: 16
                                })
                            )
                        }
                    >
                        Droite
                    </button>
                    <button
                        type="button"
                        onClick={
                            () => setPosition(
                                currentPosition => ({
                                    ...currentPosition,
                                    collapsed: !currentPosition.collapsed
                                })
                            )
                        }
                    >
                        {position.collapsed ? "Ouvrir" : "Réduire"}
                    </button>
                </div>
            </header>

            {!position.collapsed && (
                <div className="calibre-results-body">
                    <div className="calibre-results-context">
                        <span>{activeSector?.room || "Pièce non assignée"}</span>
                        <strong>{activeSector?.name || "Secteur principal"}</strong>
                    </div>

                    <div className="calibre-results-total">
                        <span>Surface totale</span>
                        <strong>{formatArea(totals.netArea)}</strong>
                    </div>

                    <div className="calibre-results-grid">
                        <span>Ajouts</span>
                        <strong className="positive">+{formatArea(totals.additions)}</strong>
                        <span>Retraits</span>
                        <strong className="negative">-{formatArea(totals.removals)}</strong>
                        <span>Périmètre</span>
                        <strong>{formatLength(totals.perimeter)}</strong>
                        <span>Objets</span>
                        <strong>{totals.count}</strong>
                    </div>
                </div>
            )}
        </aside>
    );

}


export default CalibreResultsPanel;
