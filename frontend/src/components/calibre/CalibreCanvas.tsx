import {
    useEffect,
    useRef,
    useState
} from "react";
import type Konva from "konva";
import type {
    KonvaEventObject
} from "konva/lib/Node";
import {
    Circle,
    Group,
    Image as KonvaImage,
    Label,
    Layer,
    Line,
    Rect,
    Stage,
    Tag,
    Text
} from "react-konva";

import {
    CALIBRE_MAX_ZOOM,
    CALIBRE_MIN_ZOOM,
    CALIBRE_LAYERS
} from "../../types/calibre";
import type {
    CalibreCalibration,
    CalibreLayerKind,
    CalibreLayerVisibility,
    CalibreMeasurement,
    CalibreOperation,
    CalibrePoint,
    CalibreTool,
    CalibreUnitSystem
} from "../../types/calibre";


type CalibreCanvasProps = {
    activeLayer: CalibreLayerKind;
    activeOperation: CalibreOperation;
    activePageId: string;
    activeSectorId: string;
    activeTool: CalibreTool;
    calibration: CalibreCalibration;
    imageUrl: string;
    layerVisibility: CalibreLayerVisibility;
    lineWeight: number;
    measurements: CalibreMeasurement[];
    unitSystem: CalibreUnitSystem;
    viewportScale: number;
    onCalibrationChange: (calibration: CalibreCalibration) => void;
    onFitToScreenReady: (handler: () => void) => void;
    onMeasurementsChange: (measurements: CalibreMeasurement[]) => void;
    onViewportScaleChange: (scale: number) => void;
};


type CanvasSize = {
    width: number;
    height: number;
};


type LoadedImageState = {
    url: string;
    image: HTMLImageElement | null;
};


type DraftShape = {
    type: "calibrate" | "line" | "rectangle" | "polygon";
    points: CalibrePoint[];
};


type Viewport = {
    x: number;
    y: number;
};


type RightPanState = {
    x: number;
    y: number;
} | null;


function distance(
    first: CalibrePoint,
    second: CalibrePoint
) {

    return Math.hypot(
        second.x - first.x,
        second.y - first.y
    );

}


function polygonArea(
    points: CalibrePoint[]
) {

    if (points.length < 3)
        return 0;

    const signedArea = points.reduce(
        (
            sum,
            point,
            index
        ) => {
            const nextPoint = points[(index + 1) % points.length];

            return sum + point.x * nextPoint.y - nextPoint.x * point.y;
        },
        0
    );

    return Math.abs(signedArea) / 2;

}


function parsePositiveNumber(
    value: string
) {

    const parsed = Number(value.replace(",", "."));

    return Number.isFinite(parsed) && parsed > 0 ?
        parsed :
        null;

}


function parseFraction(
    value: string
) {

    const parts = value.split("/");

    if (parts.length !== 2)
        return null;

    const numerator = parsePositiveNumber(parts[0]);
    const denominator = parsePositiveNumber(parts[1]);

    if (!numerator || !denominator)
        return null;

    return numerator / denominator;

}


function parseInchesToken(
    value: string
) {

    const normalized = value.trim();

    if (!normalized)
        return 0;

    if (normalized.includes("/"))
        return parseFraction(normalized) || 0;

    return parsePositiveNumber(normalized) || 0;

}


function parseMetricFeet(
    value: string
) {

    const normalized = value.trim().toLowerCase().replace(",", ".");
    const match = normalized.match(/^([0-9.]+)\s*(mm|millimetres|millimètres|cm|m|metres|mètres)?$/u);

    if (!match)
        return null;

    const amount = parsePositiveNumber(match[1]);
    const unit = match[2] || "mm";

    if (!amount)
        return null;

    if (unit === "m" || unit === "metres" || unit === "mètres")
        return amount * 3.280839895;

    if (unit === "cm")
        return amount / 30.48;

    return amount / 304.8;

}


function parseImperialFeet(
    value: string
) {

    const normalized = value
        .trim()
        .toLowerCase()
        .replace(/,/g, ".")
        .replace(/′/g, "'")
        .replace(/″/g, "\"")
        .replace(/pouces|pouce|po/g, "\"")
        .replace(/pieds|pied|pi|ft/g, "'")
        .replace(/\s+/g, " ");

    if (!normalized)
        return null;

    const feetMatch = normalized.match(/([0-9.]+)\s*'/);
    const inchMatch = normalized.match(/([0-9.]+)\s*"/);
    const fractionMatch = normalized.match(/([0-9]+\s*\/\s*[0-9]+)/);

    if (feetMatch || inchMatch || fractionMatch) {
        const feet = feetMatch ? parsePositiveNumber(feetMatch[1]) || 0 : 0;
        const inches = inchMatch ? parsePositiveNumber(inchMatch[1]) || 0 : 0;
        const fraction = fractionMatch ? parseFraction(fractionMatch[1].replace(/\s/g, "")) || 0 : 0;

        return feet + (inches + fraction) / 12;
    }

    const parts = normalized.split(" ").filter(Boolean);

    if (parts.length >= 2) {
        const feet = parsePositiveNumber(parts[0]);
        const inches = parseInchesToken(parts[1]);
        const fraction = parts[2] ? parseInchesToken(parts[2]) : 0;

        if (feet)
            return feet + (inches + fraction) / 12;
    }

    return parsePositiveNumber(normalized);

}


function parseDistanceFeet(
    value: string | null,
    unitSystem: CalibreUnitSystem
) {

    if (!value)
        return null;

    return unitSystem === "metric" ?
        parseMetricFeet(value) :
        parseImperialFeet(value);

}


function feetLabel(
    value: number | null,
    operation: CalibreOperation = "add"
) {

    if (value === null)
        return "Non calibré";

    const prefix = operation === "subtract" ? "-" : "";

    return `${prefix}${value.toFixed(2)} pi`;

}


function areaLabel(
    value: number | null,
    operation: CalibreOperation = "add"
) {

    if (value === null)
        return "Non calibré";

    const prefix = operation === "subtract" ? "-" : "";

    return `${prefix}${value.toFixed(2)} pi²`;

}


function layerDefinition(
    layer: CalibreLayerKind
) {

    return CALIBRE_LAYERS.find(
        item => item.key === layer
    ) || CALIBRE_LAYERS[0];

}


function pointsToArray(
    points: CalibrePoint[]
) {

    return points.flatMap(
        point => [
            point.x,
            point.y
        ]
    );

}


function useLoadedImage(
    imageUrl: string
) {

    const [loadedImage, setLoadedImage] = useState<LoadedImageState>({
        url: "",
        image: null
    });

    useEffect(
        () => {
            if (!imageUrl)
                return;

            const nextImage = new window.Image();

            nextImage.onload = () => {
                setLoadedImage({
                    url: imageUrl,
                    image: nextImage
                });
            };
            nextImage.src = imageUrl;

            return () => {
                nextImage.onload = null;
            };
        },
        [
            imageUrl
        ]
    );

    return loadedImage.url === imageUrl ?
        loadedImage.image :
        null;

}


function measurementTotals(
    measurement: CalibreMeasurement,
    pixelsPerFoot: number | null
) {

    if (!pixelsPerFoot)
        return {
            lengthFeet: null,
            areaSquareFeet: null
        };

    if (measurement.type === "line") {
        return {
            lengthFeet: distance(
                measurement.points[0],
                measurement.points[1]
            ) / pixelsPerFoot,
            areaSquareFeet: null
        };
    }

    if (measurement.type === "rectangle") {
        const first = measurement.points[0];
        const second = measurement.points[1];

        return {
            lengthFeet: null,
            areaSquareFeet: Math.abs(
                (second.x - first.x) * (second.y - first.y)
            ) / Math.pow(
                pixelsPerFoot,
                2
            )
        };
    }

    return {
        lengthFeet: null,
        areaSquareFeet: polygonArea(measurement.points) / Math.pow(
            pixelsPerFoot,
            2
        )
    };

}


function fitViewportForImage(
    image: HTMLImageElement,
    size: CanvasSize
) {

    const scale = Math.max(
        CALIBRE_MIN_ZOOM,
        Math.min(
            CALIBRE_MAX_ZOOM,
            Math.min(
                size.width / image.width,
                size.height / image.height
            ) * 0.94
        )
    );

    return {
        scale,
        viewport: {
            x: (size.width - image.width * scale) / 2,
            y: (size.height - image.height * scale) / 2
        }
    };

}


function CalibreCanvas({
    activeLayer,
    activeOperation,
    activePageId,
    activeSectorId,
    activeTool,
    calibration,
    imageUrl,
    layerVisibility,
    lineWeight,
    measurements,
    unitSystem,
    viewportScale,
    onCalibrationChange,
    onFitToScreenReady,
    onMeasurementsChange,
    onViewportScaleChange
}: CalibreCanvasProps) {

    const shellRef = useRef<HTMLDivElement | null>(null);
    const stageRef = useRef<Konva.Stage | null>(null);
    const [size, setSize] = useState<CanvasSize>({
        width: 900,
        height: 620
    });
    const [viewport, setViewport] = useState<Viewport>({
        x: 0,
        y: 0
    });
    const [draft, setDraft] = useState<DraftShape | null>(null);
    const [pointerPoint, setPointerPoint] = useState<CalibrePoint | null>(null);
    const [rightPan, setRightPan] = useState<RightPanState>(null);
    const image = useLoadedImage(imageUrl);

    useEffect(
        () => {
            const shell = shellRef.current;

            if (!shell)
                return;

            const observer = new ResizeObserver(
                entries => {
                    const entry = entries[0];

                    if (!entry)
                        return;

                    setSize({
                        width: Math.max(
                            320,
                            Math.floor(entry.contentRect.width)
                        ),
                        height: Math.max(
                            320,
                            Math.floor(entry.contentRect.height)
                        )
                    });
                }
            );

            observer.observe(shell);

            return () => {
                observer.disconnect();
            };
        },
        []
    );

    useEffect(
        () => {
            const stage = stageRef.current;
            const container = stage?.container();

            if (!container)
                return;

            function preventContextMenu(
                event: MouseEvent
            ) {

                event.preventDefault();

            }

            container.addEventListener(
                "contextmenu",
                preventContextMenu
            );

            return () => {
                container.removeEventListener(
                    "contextmenu",
                    preventContextMenu
                );
            };
        },
        [
            imageUrl
        ]
    );

    useEffect(
        () => {
            onFitToScreenReady(
                () => {
                    if (!image) {
                        onViewportScaleChange(1);
                        setViewport({
                            x: 0,
                            y: 0
                        });
                        return;
                    }

                    const nextFit = fitViewportForImage(
                        image,
                        size
                    );

                    onViewportScaleChange(nextFit.scale);
                    setViewport(nextFit.viewport);
                }
            );
        },
        [
            image,
            onFitToScreenReady,
            onViewportScaleChange,
            size
        ]
    );

    useEffect(
        () => {
            if (!image)
                return;

            const frameId = window.requestAnimationFrame(
                () => {
                    const nextFit = fitViewportForImage(
                        image,
                        size
                    );

                    onViewportScaleChange(nextFit.scale);
                    setViewport(nextFit.viewport);
                }
            );

            return () => {
                window.cancelAnimationFrame(frameId);
            };
        },
        [
            image,
            onViewportScaleChange,
            size
        ]
    );

    function pointerToWorld() {

        const stage = stageRef.current;
        const pointer = stage?.getPointerPosition();

        if (!pointer)
            return null;

        return {
            x: (pointer.x - viewport.x) / viewportScale,
            y: (pointer.y - viewport.y) / viewportScale
        };

    }


    function addMeasurement(
        measurement: CalibreMeasurement
    ) {

        const totals = measurementTotals(
            measurement,
            calibration.pixelsPerFoot
        );

        onMeasurementsChange([
            ...measurements,
            {
                ...measurement,
                ...totals
            }
        ]);

    }


    function handleRightPanMove(
        event: KonvaEventObject<MouseEvent>
    ) {

        if (!rightPan)
            return false;

        event.evt.preventDefault();

        const nextX = event.evt.clientX;
        const nextY = event.evt.clientY;

        setViewport(
            currentViewport => ({
                x: currentViewport.x + nextX - rightPan.x,
                y: currentViewport.y + nextY - rightPan.y
            })
        );
        setRightPan({
            x: nextX,
            y: nextY
        });

        return true;

    }


    function handleStageMouseDown(
        event: KonvaEventObject<MouseEvent>
    ) {

        if (event.evt.button === 2) {
            event.evt.preventDefault();
            setRightPan({
                x: event.evt.clientX,
                y: event.evt.clientY
            });
            return;
        }

        if (!image || activeTool === "select" || activeTool === "pan")
            return;

        if (event.evt.detail > 1)
            return;

        const point = pointerToWorld();

        if (!point)
            return;

        if (activeTool === "calibrate") {
            if (!draft || draft.type !== "calibrate") {
                setDraft({
                    type: "calibrate",
                    points: [
                        point
                    ]
                });
                return;
            }

            const firstPoint = draft.points[0];
            const pixelDistance = distance(
                firstPoint,
                point
            );
            const promptLabel = unitSystem === "metric" ?
                "Distance réelle (ex: 2500mm, 2.5m)" :
                "Distance réelle (ex: 10, 8' 2\" 7/16)";
            const enteredValue = window.prompt(
                promptLabel,
                unitSystem === "metric" ? "2500mm" : "10"
            );
            const feet = parseDistanceFeet(
                enteredValue,
                unitSystem
            );

            if (feet) {
                onCalibrationChange({
                    pixelsPerFoot: pixelDistance / feet,
                    referenceFeet: feet,
                    unitSystem,
                    referenceLabel: enteredValue || ""
                });
            }

            setDraft(null);
            return;
        }

        if (activeTool === "line") {
            if (!draft || draft.type !== "line") {
                setDraft({
                    type: "line",
                    points: [
                        point
                    ]
                });
                return;
            }

            addMeasurement({
                id: crypto.randomUUID(),
                pageId: activePageId,
                type: "line",
                layer: activeLayer,
                sectorId: activeSectorId,
                operation: activeOperation,
                points: [
                    draft.points[0],
                    point
                ],
                lengthFeet: null,
                areaSquareFeet: null
            });
            setDraft(null);
            return;
        }

        if (activeTool === "rectangle") {
            if (!draft || draft.type !== "rectangle") {
                setDraft({
                    type: "rectangle",
                    points: [
                        point
                    ]
                });
                return;
            }

            addMeasurement({
                id: crypto.randomUUID(),
                pageId: activePageId,
                type: "rectangle",
                layer: activeLayer,
                sectorId: activeSectorId,
                operation: activeOperation,
                points: [
                    draft.points[0],
                    point
                ],
                lengthFeet: null,
                areaSquareFeet: null
            });
            setDraft(null);
            return;
        }

        if (activeTool === "polygon") {
            setDraft(
                currentDraft => {
                    if (!currentDraft || currentDraft.type !== "polygon") {
                        return {
                            type: "polygon",
                            points: [
                                point
                            ]
                        };
                    }

                    return {
                        type: "polygon",
                        points: [
                            ...currentDraft.points,
                            point
                        ]
                    };
                }
            );
        }

    }


    function finishPolygon() {

        if (!draft || draft.type !== "polygon" || draft.points.length < 3)
            return;

        addMeasurement({
            id: crypto.randomUUID(),
            pageId: activePageId,
            type: "polygon",
            layer: activeLayer,
            sectorId: activeSectorId,
            operation: activeOperation,
            points: draft.points,
            lengthFeet: null,
            areaSquareFeet: null
        });
        setDraft(null);

    }


    function handleMouseMove(
        event: KonvaEventObject<MouseEvent>
    ) {

        if (handleRightPanMove(event))
            return;

        setPointerPoint(pointerToWorld());

    }


    function handleMouseUp(
        event: KonvaEventObject<MouseEvent>
    ) {

        if (event.evt.button === 2)
            setRightPan(null);

    }


    function handleWheel(
        event: KonvaEventObject<WheelEvent>
    ) {

        event.evt.preventDefault();

        const stage = stageRef.current;
        const pointer = stage?.getPointerPosition();

        if (!pointer)
            return;

        const scaleFactor = event.evt.deltaY > 0 ?
            0.9 :
            1.1;
        const nextScale = Math.max(
            CALIBRE_MIN_ZOOM,
            Math.min(
                CALIBRE_MAX_ZOOM,
                viewportScale * scaleFactor
            )
        );
        const worldPoint = {
            x: (pointer.x - viewport.x) / viewportScale,
            y: (pointer.y - viewport.y) / viewportScale
        };

        onViewportScaleChange(nextScale);
        setViewport({
            x: pointer.x - worldPoint.x * nextScale,
            y: pointer.y - worldPoint.y * nextScale
        });

    }


    function handleDragEnd(
        event: KonvaEventObject<DragEvent>
    ) {

        setViewport({
            x: event.target.x(),
            y: event.target.y()
        });

    }


    function renderMeasurement(
        measurement: CalibreMeasurement
    ) {

        if (!layerVisibility[measurement.layer])
            return null;

        const layer = layerDefinition(measurement.layer);
        const labelPoint = measurement.points[0];
        const isSubtract = measurement.operation === "subtract";
        const strokeWidth = isSubtract ?
            Math.max(0.5, lineWeight * 0.8) :
            lineWeight;
        const labelScale = 1 / viewportScale;
        const dash = isSubtract ? [
            7,
            5
        ] : undefined;

        if (measurement.type === "line") {
            return (
                <Group key={measurement.id}>
                    <Line
                        points={pointsToArray(measurement.points)}
                        stroke={layer.color}
                        strokeWidth={strokeWidth}
                        strokeScaleEnabled={false}
                        dash={dash}
                        lineCap="round"
                    />
                    <Label
                        x={(measurement.points[0].x + measurement.points[1].x) / 2}
                        y={(measurement.points[0].y + measurement.points[1].y) / 2}
                        scaleX={labelScale}
                        scaleY={labelScale}
                    >
                        <Tag
                            fill="#ffffff"
                            stroke={layer.color}
                            strokeWidth={0.75}
                            strokeScaleEnabled={false}
                            cornerRadius={4}
                        />
                        <Text
                            text={feetLabel(
                                measurement.lengthFeet,
                                measurement.operation
                            )}
                            padding={3}
                            fill="#172016"
                            fontSize={10}
                            fontStyle="bold"
                        />
                    </Label>
                </Group>
            );
        }

        if (measurement.type === "rectangle") {
            const first = measurement.points[0];
            const second = measurement.points[1];

            return (
                <Group key={measurement.id}>
                    <Rect
                        x={Math.min(first.x, second.x)}
                        y={Math.min(first.y, second.y)}
                        width={Math.abs(second.x - first.x)}
                        height={Math.abs(second.y - first.y)}
                        fill={isSubtract ? "rgba(255,255,255,0.24)" : layer.fill}
                        stroke={layer.color}
                        strokeWidth={strokeWidth}
                        strokeScaleEnabled={false}
                        dash={dash}
                    />
                    <Label
                        x={Math.min(first.x, second.x) + 8}
                        y={Math.min(first.y, second.y) + 8}
                        scaleX={labelScale}
                        scaleY={labelScale}
                    >
                        <Tag
                            fill="#ffffff"
                            stroke={layer.color}
                            strokeWidth={0.75}
                            strokeScaleEnabled={false}
                            cornerRadius={4}
                        />
                        <Text
                            text={areaLabel(
                                measurement.areaSquareFeet,
                                measurement.operation
                            )}
                            padding={3}
                            fill="#172016"
                            fontSize={10}
                            fontStyle="bold"
                        />
                    </Label>
                </Group>
            );
        }

        return (
            <Group key={measurement.id}>
                <Line
                    points={pointsToArray(measurement.points)}
                    closed
                    fill={isSubtract ? "rgba(255,255,255,0.24)" : layer.fill}
                    stroke={layer.color}
                    strokeWidth={strokeWidth}
                    strokeScaleEnabled={false}
                    dash={dash}
                />
                <Label
                    x={labelPoint.x + 8}
                    y={labelPoint.y + 8}
                    scaleX={labelScale}
                    scaleY={labelScale}
                >
                    <Tag
                        fill="#ffffff"
                        stroke={layer.color}
                        strokeWidth={0.75}
                        strokeScaleEnabled={false}
                        cornerRadius={4}
                    />
                    <Text
                        text={areaLabel(
                            measurement.areaSquareFeet,
                            measurement.operation
                        )}
                        padding={3}
                        fill="#172016"
                        fontSize={10}
                        fontStyle="bold"
                    />
                </Label>
            </Group>
        );

    }


    function renderDraft() {

        if (!draft || !pointerPoint)
            return null;

        const draftStrokeWidth = Math.max(0.5, lineWeight);
        const layer = activeTool === "calibrate" ?
            {
                color: "#101611",
                fill: "rgba(16,22,17,0.12)"
            } :
            layerDefinition(activeLayer);

        if (
            draft.type === "line" ||
            draft.type === "calibrate"
        ) {
            return (
                <Line
                    points={pointsToArray([
                        draft.points[0],
                        pointerPoint
                    ])}
                    stroke={layer.color}
                    strokeWidth={draftStrokeWidth}
                    strokeScaleEnabled={false}
                    dash={[
                        8,
                        6
                    ]}
                />
            );
        }

        if (draft.type === "rectangle") {
            const first = draft.points[0];

            return (
                <Rect
                    x={Math.min(first.x, pointerPoint.x)}
                    y={Math.min(first.y, pointerPoint.y)}
                    width={Math.abs(pointerPoint.x - first.x)}
                    height={Math.abs(pointerPoint.y - first.y)}
                    fill={layer.fill}
                    stroke={layer.color}
                    strokeWidth={draftStrokeWidth}
                    strokeScaleEnabled={false}
                    dash={[
                        8,
                        6
                    ]}
                />
            );
        }

        return (
            <Line
                points={pointsToArray([
                    ...draft.points,
                    pointerPoint
                ])}
                stroke={layer.color}
                strokeWidth={draftStrokeWidth}
                strokeScaleEnabled={false}
                dash={[
                    8,
                    6
                ]}
            />
        );

    }


    return (
        <section
            ref={shellRef}
            className="calibre-canvas-shell"
            onContextMenu={
                event => event.preventDefault()
            }
        >
            {!image && (
                <div className="calibre-empty-state">
                    <strong>Importer un plan</strong>
                    <span>
                        Sélectionnez une image ou une page PDF pour commencer le relevé.
                    </span>
                </div>
            )}

            {image && activeTool === "polygon" && draft?.type === "polygon" && (
                <div className="calibre-canvas-hint">
                    Double-cliquez pour terminer le polygone.
                </div>
            )}

            {image && rightPan && (
                <div className="calibre-canvas-hint calibre-pan-hint">
                    Déplacement du fond de plan
                </div>
            )}

            <Stage
                ref={stageRef}
                width={size.width}
                height={size.height}
                className="calibre-stage"
                onMouseDown={handleStageMouseDown}
                onMouseMove={handleMouseMove}
                onMouseLeave={
                    () => setRightPan(null)
                }
                onMouseUp={handleMouseUp}
                onDblClick={finishPolygon}
                onWheel={handleWheel}
            >
                <Layer>
                    <Group
                        x={viewport.x}
                        y={viewport.y}
                        scaleX={viewportScale}
                        scaleY={viewportScale}
                        draggable={activeTool === "pan"}
                        onDragEnd={handleDragEnd}
                    >
                        {image && (
                            <KonvaImage
                                image={image}
                                x={0}
                                y={0}
                                width={image.width}
                                height={image.height}
                                listening={false}
                            />
                        )}

                        {measurements.map(renderMeasurement)}
                        {renderDraft()}

                        {draft?.points.map(
                            point => (
                                <Circle
                                    key={`${point.x}-${point.y}`}
                                    x={point.x}
                                    y={point.y}
                                    radius={4 / viewportScale}
                                    fill="#ffffff"
                                    stroke="#101611"
                                    strokeWidth={1}
                                    strokeScaleEnabled={false}
                                />
                            )
                        )}
                    </Group>
                </Layer>
            </Stage>
        </section>
    );

}


export default CalibreCanvas;
