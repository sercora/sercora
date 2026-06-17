import {
    useEffect,
    useMemo,
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
    CALIBRE_LAYERS
} from "../../types/calibre";
import type {
    CalibreCalibration,
    CalibreLayerKind,
    CalibreLayerVisibility,
    CalibreMeasurement,
    CalibrePoint,
    CalibreTool
} from "../../types/calibre";


type CalibreCanvasProps = {
    activeLayer: CalibreLayerKind;
    activeTool: CalibreTool;
    calibration: CalibreCalibration;
    imageUrl: string;
    layerVisibility: CalibreLayerVisibility;
    measurements: CalibreMeasurement[];
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


function parseFeet(
    value: string | null
) {

    if (!value)
        return null;

    const normalized = value
        .replace(",", ".")
        .replace(/[^0-9.]/g, "");
    const parsed = Number(normalized);

    return Number.isFinite(parsed) && parsed > 0 ?
        parsed :
        null;

}


function feetLabel(
    value: number | null
) {

    return value === null ?
        "Non calibré" :
        `${value.toFixed(2)} pi`;

}


function areaLabel(
    value: number | null
) {

    return value === null ?
        "Non calibré" :
        `${value.toFixed(2)} pi²`;

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


function CalibreCanvas({
    activeLayer,
    activeTool,
    calibration,
    imageUrl,
    layerVisibility,
    measurements,
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

    const imageLayout = useMemo(
        () => {
            if (!image)
                return null;

            const scale = Math.min(
                size.width / image.width,
                size.height / image.height
            ) * 0.94;
            const width = image.width * scale;
            const height = image.height * scale;

            return {
                x: (size.width - width) / 2,
                y: (size.height - height) / 2,
                width,
                height
            };
        },
        [
            image,
            size
        ]
    );

    useEffect(
        () => {
            onFitToScreenReady(
                () => {
                    onViewportScaleChange(1);
                    setViewport({
                        x: 0,
                        y: 0
                    });
                }
            );
        },
        [
            onFitToScreenReady,
            onViewportScaleChange
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


    function handleStageMouseDown(
        event: KonvaEventObject<MouseEvent>
    ) {

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
            const feet = parseFeet(
                window.prompt(
                    "Distance réelle en pieds",
                    "10"
                )
            );

            if (feet) {
                onCalibrationChange({
                    pixelsPerFoot: pixelDistance / feet,
                    referenceFeet: feet
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
                type: "line",
                layer: activeLayer,
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
                type: "rectangle",
                layer: activeLayer,
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
            type: "polygon",
            layer: activeLayer,
            points: draft.points,
            lengthFeet: null,
            areaSquareFeet: null
        });
        setDraft(null);

    }


    function handleMouseMove() {

        setPointerPoint(pointerToWorld());

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
            0.25,
            Math.min(
                4,
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

        if (measurement.type === "line") {
            return (
                <Group key={measurement.id}>
                    <Line
                        points={pointsToArray(measurement.points)}
                        stroke={layer.color}
                        strokeWidth={3}
                        lineCap="round"
                    />
                    <Label
                        x={(measurement.points[0].x + measurement.points[1].x) / 2}
                        y={(measurement.points[0].y + measurement.points[1].y) / 2}
                    >
                        <Tag
                            fill="#ffffff"
                            stroke={layer.color}
                            cornerRadius={4}
                        />
                        <Text
                            text={feetLabel(measurement.lengthFeet)}
                            padding={5}
                            fill="#172016"
                            fontSize={12}
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
                        fill={layer.fill}
                        stroke={layer.color}
                        strokeWidth={2}
                    />
                    <Label
                        x={Math.min(first.x, second.x) + 8}
                        y={Math.min(first.y, second.y) + 8}
                    >
                        <Tag
                            fill="#ffffff"
                            stroke={layer.color}
                            cornerRadius={4}
                        />
                        <Text
                            text={areaLabel(measurement.areaSquareFeet)}
                            padding={5}
                            fill="#172016"
                            fontSize={12}
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
                    fill={layer.fill}
                    stroke={layer.color}
                    strokeWidth={2}
                />
                <Label
                    x={labelPoint.x + 8}
                    y={labelPoint.y + 8}
                >
                    <Tag
                        fill="#ffffff"
                        stroke={layer.color}
                        cornerRadius={4}
                    />
                    <Text
                        text={areaLabel(measurement.areaSquareFeet)}
                        padding={5}
                        fill="#172016"
                        fontSize={12}
                        fontStyle="bold"
                    />
                </Label>
            </Group>
        );

    }


    function renderDraft() {

        if (!draft || !pointerPoint)
            return null;

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
                    strokeWidth={2}
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
                    strokeWidth={2}
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
                strokeWidth={2}
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
        >
            {!image && (
                <div className="calibre-empty-state">
                    <strong>Importer un plan</strong>
                    <span>
                        Sélectionnez une image JPG ou PNG pour commencer le relevé.
                    </span>
                </div>
            )}

            {image && activeTool === "polygon" && draft?.type === "polygon" && (
                <div className="calibre-canvas-hint">
                    Double-cliquez pour terminer le polygone.
                </div>
            )}

            <Stage
                ref={stageRef}
                width={size.width}
                height={size.height}
                className="calibre-stage"
                onMouseDown={handleStageMouseDown}
                onMouseMove={handleMouseMove}
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
                        {image && imageLayout && (
                            <KonvaImage
                                image={image}
                                x={imageLayout.x}
                                y={imageLayout.y}
                                width={imageLayout.width}
                                height={imageLayout.height}
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
                                    radius={4}
                                    fill="#ffffff"
                                    stroke="#101611"
                                    strokeWidth={2}
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
