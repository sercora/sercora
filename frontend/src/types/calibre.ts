export type CalibreTool =
    "select" |
    "calibrate" |
    "line" |
    "rectangle" |
    "polygon" |
    "pan";


export type CalibreUnitSystem =
    "imperial" |
    "metric";


export type CalibreOperation =
    "add" |
    "subtract";


export type CalibreSector = {
    id: string;
    name: string;
    room: string;
};


export type CalibrePage = {
    id: string;
    name: string;
    sourceName: string;
    pageNumber: number;
    imageUrl: string;
};


export type CalibreLayerKind =
    "floor" |
    "wall" |
    "membrane" |
    "demolition";


export type CalibreMeasurementType =
    "line" |
    "rectangle" |
    "polygon";


export type CalibrePoint = {
    x: number;
    y: number;
};


export type CalibreLayerDefinition = {
    key: CalibreLayerKind;
    label: string;
    color: string;
    fill: string;
};


export type CalibreLayerVisibility = Record<CalibreLayerKind, boolean>;


export type CalibreMeasurement = {
    id: string;
    pageId: string;
    type: CalibreMeasurementType;
    layer: CalibreLayerKind;
    sectorId: string;
    operation: CalibreOperation;
    points: CalibrePoint[];
    lengthFeet: number | null;
    areaSquareFeet: number | null;
};


export type CalibreCalibration = {
    pixelsPerFoot: number | null;
    referenceFeet: number | null;
    unitSystem: CalibreUnitSystem;
    referenceLabel: string;
};


export type CalibrePageCalibrationMap = Record<string, CalibreCalibration>;


export const DEFAULT_CALIBRE_CALIBRATION: CalibreCalibration = {
    pixelsPerFoot: null,
    referenceFeet: null,
    unitSystem: "imperial",
    referenceLabel: ""
};


export const DEFAULT_CALIBRE_SECTORS: CalibreSector[] = [
    {
        id: "main",
        name: "Secteur principal",
        room: "Pièce non assignée"
    }
];


export const CALIBRE_MIN_ZOOM = 0.25;
export const CALIBRE_MAX_ZOOM = 8;


export const CALIBRE_LAYERS: CalibreLayerDefinition[] = [
    {
        key: "floor",
        label: "Plancher",
        color: "#1f66d1",
        fill: "rgba(31,102,209,0.24)"
    },
    {
        key: "wall",
        label: "Mur",
        color: "#2f9328",
        fill: "rgba(47,147,40,0.24)"
    },
    {
        key: "membrane",
        label: "Membrane",
        color: "#e07b20",
        fill: "rgba(224,123,32,0.26)"
    },
    {
        key: "demolition",
        label: "Démolition",
        color: "#cc372f",
        fill: "rgba(204,55,47,0.24)"
    }
];


export const DEFAULT_LAYER_VISIBILITY: CalibreLayerVisibility = {
    floor: true,
    wall: true,
    membrane: true,
    demolition: true
};
