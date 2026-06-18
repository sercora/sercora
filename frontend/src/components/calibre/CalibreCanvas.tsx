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
    CalibreAnnotationStyle,
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
    annotationStyle: CalibreAnnotationStyle;
    calibration: CalibreCalibration;
    imageUrl: string;
    layerVisibility: CalibreLayerVisibility;
    lineWeight: number;
    measurements: CalibreMeasurement[];
    snapRadius: number;
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


type CalibrationDialogState = {
    pixelDistance: number;
    metricAmount: string;
    metricUnit: "mm" | "cm" | "m";
    feet: string;
    inches: string;
    fraction: string;
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


function feetLabel(
    value: number | null,
    operation: CalibreOperation = "add",
    showUnits = true
) {

    if (value === null)
        return "Non calibré";

    const prefix = operation === "subtract" ? "-" : "";
    const suffix = showUnits ? " pi" : "";

    return `${prefix}${value.toFixed(2)}${suffix}`;

}


function areaLabel(
    value: number | null,
    operation: CalibreOperation = "add",
    showUnits = true
) {

    if (value === null)
        return "Non calibré";

    const prefix = operation === "subtract" ? "-" : "";
    const suffix = showUnits ? " pi²" : "";

    return `${prefix}${value.toFixed(2)}${suffix}`;

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
    annotationStyle,
    calibration,
    imageUrl,
    layerVisibility,
    lineWeight,
    measurements,
    snapRadius,
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
    const [calibrationDialog, setCalibrationDialog] =
        useState<CalibrationDialogState>(null);
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


    function isNearPolygonStart(
        point: CalibrePoint,
        points: CalibrePoint[]
    ) {

        if (points.length < 3)
            return false;

        return distance(
            point,
            points[0]
        ) * viewportScale <= snapRadius;

    }


    function snapPolygonPoint(
        point: CalibrePoint
    ) {

        if (
            draft?.type !== "polygon" ||
            !isNearPolygonStart(
                point,
                draft.points
            )
        )
            return point;

        return draft.points[0];

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
            setCalibrationDialog({
                pixelDistance,
                metricAmount: "2500",
                metricUnit: "mm",
                feet: "8",
                inches: "0",
                fraction: ""
            });
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
            if (
                draft?.type === "polygon" &&
                isNearPolygonStart(
                    point,
                    draft.points
                )
            ) {
                finishPolygon();
                return;
            }

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

        const point = pointerToWorld();

        setPointerPoint(
            point ?
                snapPolygonPoint(point) :
                null
        );

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


    function metricFeetFromDialog(
        dialog: NonNullable<CalibrationDialogState>
    ) {

        const amount = parsePositiveNumber(dialog.metricAmount);

        if (!amount)
            return null;

        if (dialog.metricUnit === "m")
            return amount * 3.280839895;

        if (dialog.metricUnit === "cm")
            return amount / 30.48;

        return amount / 304.8;

    }


    function imperialFeetFromDialog(
        dialog: NonNullable<CalibrationDialogState>
    ) {

        const feet = parsePositiveNumber(dialog.feet) || 0;
        const inches = parsePositiveNumber(dialog.inches) || 0;
        const fraction = dialog.fraction.trim() ?
            parseFraction(dialog.fraction.trim()) || 0 :
            0;

        return feet + (inches + fraction) / 12;

    }


    function submitCalibration() {

        if (!calibrationDialog)
            return;

        const referenceFeet = unitSystem === "metric" ?
            metricFeetFromDialog(calibrationDialog) :
            imperialFeetFromDialog(calibrationDialog);

        if (!referenceFeet)
            return;

        const referenceLabel = unitSystem === "metric" ?
            `${calibrationDialog.metricAmount}${calibrationDialog.metricUnit}` :
            `${calibrationDialog.feet || "0"}'-${calibrationDialog.inches || "0"}${calibrationDialog.fraction ? ` ${calibrationDialog.fraction}` : ""}"`;

        onCalibrationChange({
            pixelsPerFoot: calibrationDialog.pixelDistance / referenceFeet,
            referenceFeet,
            referenceLabel,
            unitSystem
        });
        setCalibrationDialog(null);

    }


    function renderMeasurement(
        measurement: CalibreMeasurement
    ) {

        if (!layerVisibility[measurement.layer])
            return null;

        const layer = layerDefinition(measurement.layer);
        const labelPoint = measurement.points[0];
        const isSubtract = measurement.operation === "subtract";
        const operationFill = isSubtract ?
            "rgba(204,55,47,0.28)" :
            "rgba(47,147,40,0.24)";
        const strokeWidth = isSubtract ?
            Math.max(0.5, lineWeight * 0.8) :
            lineWeight;
        const labelScale = 1 / viewportScale;
        const labelOffset = annotationStyle.position === "above" ?
            -(annotationStyle.fontSize + 12) / viewportScale :
            8;
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
                        rotation={annotationStyle.rotation}
                        opacity={annotationStyle.opacity}
                    >
                        <Tag
                            fill={
                                annotationStyle.halo ?
                                    annotationStyle.haloColor :
                                    "transparent"
                            }
                            stroke={layer.color}
                            strokeWidth={0.75}
                            strokeScaleEnabled={false}
                            cornerRadius={4}
                        />
                        <Text
                            text={feetLabel(
                                measurement.lengthFeet,
                                measurement.operation,
                                annotationStyle.showUnits
                            )}
                            padding={3}
                            fill={annotationStyle.color}
                            fontFamily={annotationStyle.fontFamily}
                            fontSize={annotationStyle.fontSize}
                            fontStyle={annotationStyle.bold ? "bold" : "normal"}
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
                        fill={operationFill}
                        stroke={layer.color}
                        strokeWidth={strokeWidth}
                        strokeScaleEnabled={false}
                        dash={dash}
                    />
                    <Label
                        x={Math.min(first.x, second.x) + 8}
                        y={Math.min(first.y, second.y) + labelOffset}
                        scaleX={labelScale}
                        scaleY={labelScale}
                        rotation={annotationStyle.rotation}
                        opacity={annotationStyle.opacity}
                    >
                        <Tag
                            fill={
                                annotationStyle.halo ?
                                    annotationStyle.haloColor :
                                    "transparent"
                            }
                            stroke={layer.color}
                            strokeWidth={0.75}
                            strokeScaleEnabled={false}
                            cornerRadius={4}
                        />
                        <Text
                            text={areaLabel(
                                measurement.areaSquareFeet,
                                measurement.operation,
                                annotationStyle.showUnits
                            )}
                            padding={3}
                            fill={annotationStyle.color}
                            fontFamily={annotationStyle.fontFamily}
                            fontSize={annotationStyle.fontSize}
                            fontStyle={annotationStyle.bold ? "bold" : "normal"}
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
                    fill={operationFill}
                    stroke={layer.color}
                    strokeWidth={strokeWidth}
                    strokeScaleEnabled={false}
                    dash={dash}
                />
                <Label
                    x={labelPoint.x + 8}
                    y={labelPoint.y + labelOffset}
                    scaleX={labelScale}
                    scaleY={labelScale}
                    rotation={annotationStyle.rotation}
                    opacity={annotationStyle.opacity}
                >
                    <Tag
                        fill={
                            annotationStyle.halo ?
                                annotationStyle.haloColor :
                                "transparent"
                        }
                        stroke={layer.color}
                        strokeWidth={0.75}
                        strokeScaleEnabled={false}
                        cornerRadius={4}
                    />
                    <Text
                        text={areaLabel(
                            measurement.areaSquareFeet,
                            measurement.operation,
                            annotationStyle.showUnits
                        )}
                        padding={3}
                        fill={annotationStyle.color}
                        fontFamily={annotationStyle.fontFamily}
                        fontSize={annotationStyle.fontSize}
                        fontStyle={annotationStyle.bold ? "bold" : "normal"}
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

        const snapActive = pointerPoint &&
            draft.points.length >= 3 &&
            distance(
                pointerPoint,
                draft.points[0]
            ) * viewportScale <= snapRadius;
        const firstPoint = draft.points[0];

        return (
            <Group>
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

                {snapActive && (
                    <>
                        <Circle
                            x={firstPoint.x}
                            y={firstPoint.y}
                            radius={snapRadius / viewportScale}
                            fill="rgba(47,147,40,0.14)"
                            stroke="#2f9328"
                            strokeWidth={1.5}
                            strokeScaleEnabled={false}
                        />
                        <Label
                            x={firstPoint.x + 12 / viewportScale}
                            y={firstPoint.y - 30 / viewportScale}
                            scaleX={1 / viewportScale}
                            scaleY={1 / viewportScale}
                        >
                            <Tag
                                fill="#172016"
                                cornerRadius={4}
                            />
                            <Text
                                text="Fermer le polygone"
                                padding={5}
                                fill="#ffffff"
                                fontSize={11}
                                fontStyle="bold"
                            />
                        </Label>
                    </>
                )}
            </Group>
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

            {calibrationDialog && (
                <div className="calibre-calibration-dialog">
                    <header>
                        <strong>Calibration</strong>
                        <span>
                            {Math.round(calibrationDialog.pixelDistance)} px
                        </span>
                    </header>

                    {unitSystem === "metric" ? (
                        <div className="calibre-calibration-grid metric">
                            <label>
                                Distance
                                <input
                                    type="number"
                                    min={0}
                                    value={calibrationDialog.metricAmount}
                                    onChange={
                                        event => setCalibrationDialog({
                                            ...calibrationDialog,
                                            metricAmount: event.target.value
                                        })
                                    }
                                />
                            </label>
                            <label>
                                Unité
                                <select
                                    value={calibrationDialog.metricUnit}
                                    onChange={
                                        event => setCalibrationDialog({
                                            ...calibrationDialog,
                                            metricUnit: event.target.value as "mm" | "cm" | "m"
                                        })
                                    }
                                >
                                    <option value="mm">mm</option>
                                    <option value="cm">cm</option>
                                    <option value="m">m</option>
                                </select>
                            </label>
                        </div>
                    ) : (
                        <div className="calibre-calibration-grid imperial">
                            <label>
                                Pieds
                                <input
                                    type="number"
                                    min={0}
                                    value={calibrationDialog.feet}
                                    onChange={
                                        event => setCalibrationDialog({
                                            ...calibrationDialog,
                                            feet: event.target.value
                                        })
                                    }
                                />
                            </label>
                            <label>
                                Pouces
                                <input
                                    type="number"
                                    min={0}
                                    max={11}
                                    value={calibrationDialog.inches}
                                    onChange={
                                        event => setCalibrationDialog({
                                            ...calibrationDialog,
                                            inches: event.target.value
                                        })
                                    }
                                />
                            </label>
                            <label>
                                Fraction
                                <input
                                    type="text"
                                    placeholder="1/2"
                                    value={calibrationDialog.fraction}
                                    onChange={
                                        event => setCalibrationDialog({
                                            ...calibrationDialog,
                                            fraction: event.target.value
                                        })
                                    }
                                />
                            </label>
                        </div>
                    )}

                    <footer>
                        <button
                            type="button"
                            onClick={
                                () => setCalibrationDialog(null)
                            }
                        >
                            Annuler
                        </button>
                        <button
                            type="button"
                            className="primary"
                            onClick={submitCalibration}
                        >
                            Appliquer
                        </button>
                    </footer>
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
                            (
                                point,
                                index
                            ) => (
                                <Circle
                                    key={`${point.x}-${point.y}`}
                                    x={point.x}
                                    y={point.y}
                                    radius={
                                        index === 0 &&
                                        draft.type === "polygon" ?
                                            5 / viewportScale :
                                            4 / viewportScale
                                    }
                                    fill={
                                        index === 0 &&
                                        draft.type === "polygon" ?
                                            "#7cff44" :
                                            "#ffffff"
                                    }
                                    stroke={
                                        index === 0 &&
                                        draft.type === "polygon" ?
                                            "#1f6f18" :
                                            "#101611"
                                    }
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
