import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.mjs?url";

import CalibreCanvas from "../components/calibre/CalibreCanvas";
import CalibreAnnotationStylePanel from "../components/calibre/CalibreAnnotationStylePanel";
import CalibreLayersPanel from "../components/calibre/CalibreLayersPanel";
import CalibreResultsPanel from "../components/calibre/CalibreResultsPanel";
import CalibreToolbar from "../components/calibre/CalibreToolbar";
import {
    DEFAULT_CALIBRE_ANNOTATION_STYLE,
    DEFAULT_CALIBRE_CALIBRATION,
    DEFAULT_CALIBRE_SECTORS,
    DEFAULT_LAYER_VISIBILITY
} from "../types/calibre";
import type {
    CalibreAnnotationStyle,
    CalibreCalibration,
    CalibreLayerKind,
    CalibreLayerVisibility,
    CalibreMeasurement,
    CalibreOperation,
    CalibrePage,
    CalibrePageCalibrationMap,
    CalibreSector,
    CalibreTool,
    CalibreUnitSystem
} from "../types/calibre";

import "../styles/calibre.css";


pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const PDF_RESOURCE_BASE_URL = "/pdfjs";
const PDF_MAX_CANVAS_PIXELS = 25000000;
const PDF_MAX_CANVAS_SIDE = 6500;


type PendingPdf = {
    fileName: string;
    data: ArrayBuffer;
    pageCount: number;
    source: CalibreImportSource;
};


type CalibreImportSource =
    "projectPlans" |
    "legacyInProgress" |
    "local";


type PendingPlanFields = {
    pageNumber: number;
    planName: string;
    planDate: string;
    revisionNumber: string;
};


type CalibreHistoryEntry = {
    annotationStyle: CalibreAnnotationStyle;
    activeOperation: CalibreOperation;
    activePageId: string;
    calibrations: CalibrePageCalibrationMap;
    layerVisibility: CalibreLayerVisibility;
    lineWeight: number;
    measurements: CalibreMeasurement[];
    pages: CalibrePage[];
    sectors: CalibreSector[];
    snapRadius: number;
};


type StoredCalibreSession = {
    activeLayer?: CalibreLayerKind;
    activeOperation?: CalibreOperation;
    activeSectorId?: string;
    annotationStyle?: CalibreAnnotationStyle;
    calibrations?: CalibrePageCalibrationMap;
    layerVisibility?: CalibreLayerVisibility;
    lineWeight?: number;
    measurements?: CalibreMeasurement[];
    pageMetadata?: Array<Omit<CalibrePage, "imageUrl">>;
    sectors?: CalibreSector[];
    snapRadius?: number;
    unitSystem?: CalibreUnitSystem;
};


const CALIBRE_SESSION_STORAGE_KEY = "sercora.calibre.session.v2";
const CALIBRE_HISTORY_LIMIT = 100;


function createPageId() {

    return crypto.randomUUID();

}


function defaultPlanName(
    fileName: string,
    pageNumber: number
) {

    const baseName = fileName.replace(
        /\.[^.]+$/,
        ""
    );

    return pageNumber > 1 ?
        `${baseName}-${pageNumber}` :
        baseName;

}


function revokePageUrls(
    pages: CalibrePage[]
) {

    pages.forEach(
        page => URL.revokeObjectURL(page.imageUrl)
    );

}


function pdfDocumentOptions(
    data: ArrayBuffer
) {

    return {
        cMapPacked: true,
        cMapUrl: `${PDF_RESOURCE_BASE_URL}/cmaps/`,
        data,
        standardFontDataUrl: `${PDF_RESOURCE_BASE_URL}/standard_fonts/`,
        useSystemFonts: true,
        wasmUrl: `${PDF_RESOURCE_BASE_URL}/wasm/`
    };

}


function pdfErrorMessage(
    prefix: string,
    error: unknown
) {

    if (error instanceof Error && error.message)
        return `${prefix} ${error.message}`;

    if (typeof error === "string" && error)
        return `${prefix} ${error}`;

    return prefix;

}


function pdfPageRenderScale(
    width: number,
    height: number
) {

    const preferredScale = 3;
    const sideScale = Math.min(
        PDF_MAX_CANVAS_SIDE / width,
        PDF_MAX_CANVAS_SIDE / height
    );
    const pixelScale = Math.sqrt(
        PDF_MAX_CANVAS_PIXELS / (width * height)
    );

    return Math.max(
        0.35,
        Math.min(
            preferredScale,
            sideScale,
            pixelScale
        )
    );

}


function readStoredCalibreSession() {

    try {
        if (typeof window === "undefined")
            return null;

        const rawValue = localStorage.getItem(CALIBRE_SESSION_STORAGE_KEY);

        if (!rawValue)
            return null;

        return JSON.parse(rawValue) as StoredCalibreSession;
    }
    catch {
        return null;
    }

}


const INITIAL_STORED_CALIBRE_SESSION = readStoredCalibreSession();


function CalibreView() {

    const pageRef = useRef<HTMLElement | null>(null);
    const fitToScreenRef = useRef<() => void>(() => undefined);
    const pagesRef = useRef<CalibrePage[]>([]);
    const storedSession = INITIAL_STORED_CALIBRE_SESSION;
    const [pages, setPages] = useState<CalibrePage[]>([]);
    const [activePageId, setActivePageId] = useState("");
    const [pendingPdf, setPendingPdf] = useState<PendingPdf | null>(null);
    const [pendingPlanFields, setPendingPlanFields] = useState<PendingPlanFields>({
        pageNumber: 1,
        planName: "",
        planDate: "",
        revisionNumber: "0"
    });
    const [isImportingPdfPage, setIsImportingPdfPage] = useState(false);
    const [importError, setImportError] = useState("");
    const [activeTool, setActiveTool] = useState<CalibreTool>("select");
    const [activeLayer, setActiveLayer] = useState<CalibreLayerKind>(
        storedSession?.activeLayer || "floor"
    );
    const [activeSectorId, setActiveSectorId] = useState(
        storedSession?.activeSectorId || "main"
    );
    const [activeOperation, setActiveOperation] = useState<CalibreOperation>(
        storedSession?.activeOperation || "add"
    );
    const [unitSystem, setUnitSystem] = useState<CalibreUnitSystem>(
        storedSession?.unitSystem || "imperial"
    );
    const [sectors, setSectors] = useState<CalibreSector[]>(
        storedSession?.sectors?.length ?
            storedSession.sectors :
            DEFAULT_CALIBRE_SECTORS
    );
    const [layerVisibility, setLayerVisibility] =
        useState<CalibreLayerVisibility>({
            ...DEFAULT_LAYER_VISIBILITY,
            ...storedSession?.layerVisibility
        });
    const [measurements, setMeasurements] = useState<CalibreMeasurement[]>(
        storedSession?.measurements || []
    );
    const [calibrations, setCalibrations] = useState<CalibrePageCalibrationMap>(
        storedSession?.calibrations || {}
    );
    const [lineWeight, setLineWeight] = useState(storedSession?.lineWeight || 1);
    const [snapRadius, setSnapRadius] = useState(storedSession?.snapRadius || 14);
    const [annotationStyle, setAnnotationStyle] =
        useState<CalibreAnnotationStyle>({
            ...DEFAULT_CALIBRE_ANNOTATION_STYLE,
            ...storedSession?.annotationStyle
        });
    const [viewportScale, setViewportScale] = useState(1);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isLayersOpen, setIsLayersOpen] = useState(false);
    const [isStyleOpen, setIsStyleOpen] = useState(false);
    const [undoStack, setUndoStack] = useState<CalibreHistoryEntry[]>([]);
    const [redoStack, setRedoStack] = useState<CalibreHistoryEntry[]>([]);
    const [saveStatus, setSaveStatus] = useState(
        storedSession ?
            "Session locale restaurée" :
            "Session locale prête"
    );

    useEffect(
        () => {
            pagesRef.current = pages;
        },
        [
            pages
        ]
    );

    useEffect(
        () => () => {
            revokePageUrls(pagesRef.current);
        },
        []
    );

    useEffect(
        () => {
            const timeoutId = window.setTimeout(
                () => {
                    const session: StoredCalibreSession = {
                        activeLayer,
                        activeOperation,
                        activeSectorId,
                        annotationStyle,
                        calibrations,
                        layerVisibility,
                        lineWeight,
                        measurements,
                        pageMetadata: pages.map(
                            page => ({
                                id: page.id,
                                name: page.name,
                                pageNumber: page.pageNumber,
                                planDate: page.planDate,
                                planName: page.planName,
                                revisionNumber: page.revisionNumber,
                                sourceName: page.sourceName
                            })
                        ),
                        sectors,
                        snapRadius,
                        unitSystem
                    };

                    localStorage.setItem(
                        CALIBRE_SESSION_STORAGE_KEY,
                        JSON.stringify(session)
                    );
                    setSaveStatus("Session locale sauvegardée");
                },
                350
            );

            return () => {
                window.clearTimeout(timeoutId);
            };
        },
        [
            activeLayer,
            activeOperation,
            activeSectorId,
            annotationStyle,
            calibrations,
            layerVisibility,
            lineWeight,
            measurements,
            pages,
            sectors,
            snapRadius,
            unitSystem
        ]
    );

    useEffect(
        () => {
            function handleFullscreenChange() {

                setIsFullscreen(document.fullscreenElement === pageRef.current);

            }

            document.addEventListener(
                "fullscreenchange",
                handleFullscreenChange
            );

            return () => {
                document.removeEventListener(
                    "fullscreenchange",
                    handleFullscreenChange
                );
            };
        },
        []
    );

    function isEditableTarget(
        target: EventTarget | null
    ) {

        if (!(target instanceof HTMLElement))
            return false;

        return Boolean(
            target.closest("input, textarea, select, [contenteditable='true']")
        );

    }


    function historySnapshot(): CalibreHistoryEntry {

        return {
            annotationStyle,
            activeOperation,
            activePageId,
            calibrations,
            layerVisibility,
            lineWeight,
            measurements,
            pages,
            sectors,
            snapRadius
        };

    }


    function pushHistory() {

        const snapshot = historySnapshot();

        setUndoStack(
            currentStack => [
                ...currentStack,
                snapshot
            ].slice(-CALIBRE_HISTORY_LIMIT)
        );
        setRedoStack([]);

    }


    function restoreHistory(
        snapshot: CalibreHistoryEntry
    ) {

        setAnnotationStyle(snapshot.annotationStyle);
        setActiveOperation(snapshot.activeOperation);
        setActivePageId(snapshot.activePageId);
        setCalibrations(snapshot.calibrations);
        setLayerVisibility(snapshot.layerVisibility);
        setLineWeight(snapshot.lineWeight);
        setMeasurements(snapshot.measurements);
        setPages(snapshot.pages);
        setSectors(snapshot.sectors);
        setSnapRadius(snapshot.snapRadius);

    }


    function undo() {

        setUndoStack(
            currentStack => {
                const previousSnapshot = currentStack[currentStack.length - 1];

                if (!previousSnapshot)
                    return currentStack;

                setRedoStack(
                    currentRedoStack => [
                        ...currentRedoStack,
                        historySnapshot()
                    ].slice(-CALIBRE_HISTORY_LIMIT)
                );
                restoreHistory(previousSnapshot);

                return currentStack.slice(
                    0,
                    -1
                );
            }
        );

    }


    function redo() {

        setRedoStack(
            currentStack => {
                const nextSnapshot = currentStack[currentStack.length - 1];

                if (!nextSnapshot)
                    return currentStack;

                setUndoStack(
                    currentUndoStack => [
                        ...currentUndoStack,
                        historySnapshot()
                    ].slice(-CALIBRE_HISTORY_LIMIT)
                );
                restoreHistory(nextSnapshot);

                return currentStack.slice(
                    0,
                    -1
                );
            }
        );

    }


    useEffect(
        () => {
            function handleKeyDown(
                event: KeyboardEvent
            ) {

                if (isEditableTarget(event.target))
                    return;

                const isModifierPressed = event.ctrlKey || event.metaKey;
                const key = event.key.toLowerCase();

                if (isModifierPressed && key === "z" && !event.shiftKey) {
                    event.preventDefault();
                    undo();
                    return;
                }

                if (
                    isModifierPressed &&
                    (
                        key === "y" ||
                        (
                            key === "z" &&
                            event.shiftKey
                        )
                    )
                ) {
                    event.preventDefault();
                    redo();
                }

            }

            window.addEventListener(
                "keydown",
                handleKeyDown
            );

            return () => {
                window.removeEventListener(
                    "keydown",
                    handleKeyDown
                );
            };
        }
    );

    const activePage = useMemo(
        () => pages.find(
            page => page.id === activePageId
        ) || null,
        [
            activePageId,
            pages
        ]
    );

    const activeCalibration = calibrations[activePageId] || DEFAULT_CALIBRE_CALIBRATION;

    const activePageMeasurements = useMemo(
        () => measurements.filter(
            measurement => measurement.pageId === activePageId
        ),
        [
            activePageId,
            measurements
        ]
    );

    function addImportedPage(
        page: CalibrePage
    ) {

        pushHistory();
        setPages(
            currentPages => [
                ...currentPages,
                page
            ]
        );
        setActivePageId(page.id);
        setCalibrations(
            currentCalibrations => ({
                ...currentCalibrations,
                [page.id]: {
                    ...DEFAULT_CALIBRE_CALIBRATION,
                    unitSystem
                }
            })
        );
        setActiveTool("select");
        setViewportScale(1);

    }


    async function handlePlanSelected(
        file: File,
        source: CalibreImportSource = "local"
    ) {

        setImportError("");

        if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
            try {
                const data = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument(
                    pdfDocumentOptions(data.slice(0))
                ).promise;

                setPendingPdf({
                    fileName: file.name,
                    data,
                    pageCount: pdf.numPages,
                    source
                });
                setPendingPlanFields({
                    pageNumber: 1,
                    planName: defaultPlanName(
                        file.name,
                        1
                    ),
                    planDate: new Date().toISOString().slice(
                        0,
                        10
                    ),
                    revisionNumber: "0"
                });
            }
            catch (error) {
                setImportError(
                    pdfErrorMessage(
                        "Impossible de lire ce PDF.",
                        error
                    )
                );
            }

            return;
        }

        if (!file.type.startsWith("image/")) {
            setImportError("Format non supporté. Importez un PDF, JPG ou PNG.");
            return;
        }

        addImportedPage({
            id: createPageId(),
            name: defaultPlanName(
                file.name,
                1
            ),
            pageNumber: 1,
            planDate: new Date().toISOString().slice(
                0,
                10
            ),
            planName: defaultPlanName(
                file.name,
                1
            ),
            revisionNumber: "0",
            sourceName: file.name,
            imageUrl: URL.createObjectURL(file)
        });
        setPendingPdf(null);

    }


    async function handlePdfPageImport() {

        if (!pendingPdf)
            return;

        const pageNumber = Math.max(
            1,
            Math.min(
                pendingPdf.pageCount,
                pendingPlanFields.pageNumber
            )
        );
        const planName = pendingPlanFields.planName.trim() || defaultPlanName(
            pendingPdf.fileName,
            pageNumber
        );

        setIsImportingPdfPage(true);
        setImportError("");

        try {
            const pdf = await pdfjsLib.getDocument(
                pdfDocumentOptions(pendingPdf.data.slice(0))
            ).promise;
            const page = await pdf.getPage(pageNumber);
            const baseViewport = page.getViewport({
                scale: 1
            });
            const viewport = page.getViewport({
                scale: pdfPageRenderScale(
                    baseViewport.width,
                    baseViewport.height
                )
            });
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");

            if (!context)
                throw new Error("Canvas non disponible");

            canvas.width = Math.floor(viewport.width);
            canvas.height = Math.floor(viewport.height);

            await page.render({
                canvas,
                canvasContext: context,
                viewport
            }).promise;

            const blob = await new Promise<Blob | null>(
                resolve => canvas.toBlob(
                    resolve,
                    "image/png",
                    0.95
                )
            );

            if (!blob)
                throw new Error("Image PDF non générée");

            addImportedPage({
                id: createPageId(),
                name: planName,
                pageNumber,
                planDate: pendingPlanFields.planDate,
                planName,
                revisionNumber: pendingPlanFields.revisionNumber.trim() || "0",
                sourceName: pendingPdf.fileName,
                imageUrl: URL.createObjectURL(blob)
            });
            setPendingPlanFields(
                currentFields => ({
                    ...currentFields,
                    pageNumber: Math.min(
                        pendingPdf.pageCount,
                        pageNumber + 1
                    ),
                    planName: ""
                })
            );
        }
        catch (error) {
            setImportError(
                pdfErrorMessage(
                    "Impossible de convertir cette page PDF.",
                    error
                )
            );
        }
        finally {
            setIsImportingPdfPage(false);
        }

    }


    function updateLayerVisibility(
        layer: CalibreLayerKind,
        visible: boolean
    ) {

        pushHistory();
        setLayerVisibility(
            currentVisibility => ({
                ...currentVisibility,
                [layer]: visible
            })
        );

    }


    function updateActivePageCalibration(
        calibration: CalibreCalibration
    ) {

        if (!activePageId)
            return;

        pushHistory();
        setCalibrations(
            currentCalibrations => ({
                ...currentCalibrations,
                [activePageId]: calibration
            })
        );

    }


    function updateActivePageMeasurements(
        pageMeasurements: CalibreMeasurement[]
    ) {

        pushHistory();
        setMeasurements(
            currentMeasurements => [
                ...currentMeasurements.filter(
                    measurement => measurement.pageId !== activePageId
                ),
                ...pageMeasurements
            ]
        );

    }


    function handlePageChange(
        pageId: string
    ) {

        setActivePageId(pageId);
        setActiveTool("select");
        setViewportScale(1);

    }


    function handleUnitSystemChange(
        nextUnitSystem: CalibreUnitSystem
    ) {

        pushHistory();
        setUnitSystem(nextUnitSystem);

        if (!activePageId)
            return;

        setCalibrations(
            currentCalibrations => ({
                ...currentCalibrations,
                [activePageId]: {
                    ...(currentCalibrations[activePageId] || DEFAULT_CALIBRE_CALIBRATION),
                    unitSystem: nextUnitSystem
                }
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


    async function toggleFullscreen() {

        if (document.fullscreenElement) {
            await document.exitFullscreen();
            return;
        }

        await pageRef.current?.requestFullscreen();

    }


    function updateSectors(
        nextSectors: CalibreSector[]
    ) {

        pushHistory();
        setSectors(nextSectors);

    }


    function updateAnnotationStyle(
        nextStyle: CalibreAnnotationStyle
    ) {

        pushHistory();
        setAnnotationStyle(nextStyle);

    }


    function updateOperation(
        nextOperation: CalibreOperation
    ) {

        pushHistory();
        setActiveOperation(nextOperation);

    }


    function updateLineWeight(
        nextLineWeight: number
    ) {

        pushHistory();
        setLineWeight(nextLineWeight);

    }


    function updateSnapRadius(
        nextSnapRadius: number
    ) {

        pushHistory();
        setSnapRadius(nextSnapRadius);

    }


    return (
        <section
            ref={pageRef}
            className={
                [
                    "calibre-page",
                    isFullscreen ? "fullscreen" : "",
                    activeOperation === "subtract" ? "subtract-mode" : ""
                ].filter(Boolean).join(" ")
            }
        >
            <CalibreToolbar
                activeOperation={activeOperation}
                activePageId={activePageId}
                activeTool={activeTool}
                calibration={activeCalibration}
                importError={importError}
                isFullscreen={isFullscreen}
                isImportingPdfPage={isImportingPdfPage}
                isLayersOpen={isLayersOpen}
                isStyleOpen={isStyleOpen}
                lineWeight={lineWeight}
                pages={pages}
                pendingPdf={pendingPdf}
                pendingPlanFields={pendingPlanFields}
                redoAvailable={redoStack.length > 0}
                saveStatus={saveStatus}
                scalePercent={Math.round(viewportScale * 100)}
                unitSystem={unitSystem}
                undoAvailable={undoStack.length > 0}
                onFullscreenToggle={toggleFullscreen}
                onLayersToggle={
                    () => setIsLayersOpen(
                        currentValue => !currentValue
                    )
                }
                onLineWeightChange={updateLineWeight}
                onOperationChange={updateOperation}
                onPageChange={handlePageChange}
                onPendingPlanFieldsChange={setPendingPlanFields}
                onPdfPageImport={handlePdfPageImport}
                onPlanSelected={handlePlanSelected}
                onRedo={redo}
                onStyleToggle={
                    () => setIsStyleOpen(
                        currentValue => !currentValue
                    )
                }
                onToolChange={setActiveTool}
                onUndo={undo}
                onUnitSystemChange={handleUnitSystemChange}
            />

            <div className="calibre-workspace">
                <CalibreCanvas
                    key={activePageId || "empty"}
                    activeLayer={activeLayer}
                    activeOperation={activeOperation}
                    activePageId={activePageId}
                    activeSectorId={activeSectorId}
                    activeTool={activeTool}
                    annotationStyle={annotationStyle}
                    calibration={activeCalibration}
                    imageUrl={activePage?.imageUrl || ""}
                    layerVisibility={layerVisibility}
                    lineWeight={lineWeight}
                    measurements={activePageMeasurements}
                    snapRadius={snapRadius}
                    unitSystem={unitSystem}
                    viewportScale={viewportScale}
                    onCalibrationChange={updateActivePageCalibration}
                    onFitToScreenReady={registerFitToScreen}
                    onMeasurementsChange={updateActivePageMeasurements}
                    onViewportScaleChange={setViewportScale}
                />

                <CalibreResultsPanel
                    activeLayer={activeLayer}
                    activeSectorId={activeSectorId}
                    measurements={activePageMeasurements}
                    onActiveSectorChange={setActiveSectorId}
                    sectors={sectors}
                />

                {isLayersOpen && (
                    <div className="calibre-floating-panel">
                        <CalibreLayersPanel
                            activeLayer={activeLayer}
                            activeSectorId={activeSectorId}
                            measurements={activePageMeasurements}
                            sectors={sectors}
                            visibility={layerVisibility}
                            onActiveLayerChange={setActiveLayer}
                            onActiveSectorChange={setActiveSectorId}
                            onClose={
                                () => setIsLayersOpen(false)
                            }
                            onSectorsChange={updateSectors}
                            onVisibilityChange={updateLayerVisibility}
                        />
                    </div>
                )}

                {isStyleOpen && (
                    <div className="calibre-floating-panel style-panel">
                        <CalibreAnnotationStylePanel
                            snapRadius={snapRadius}
                            style={annotationStyle}
                            onClose={
                                () => setIsStyleOpen(false)
                            }
                            onSnapRadiusChange={updateSnapRadius}
                            onStyleChange={updateAnnotationStyle}
                        />
                    </div>
                )}
            </div>
        </section>
    );

}


export default CalibreView;
