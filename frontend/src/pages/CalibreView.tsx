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
import CalibreLayersPanel from "../components/calibre/CalibreLayersPanel";
import CalibreToolbar from "../components/calibre/CalibreToolbar";
import {
    CALIBRE_MAX_ZOOM,
    CALIBRE_MIN_ZOOM,
    DEFAULT_CALIBRE_CALIBRATION,
    DEFAULT_CALIBRE_SECTORS,
    DEFAULT_LAYER_VISIBILITY
} from "../types/calibre";
import type {
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
};


function createPageId() {

    return crypto.randomUUID();

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


function CalibreView() {

    const pageRef = useRef<HTMLElement | null>(null);
    const fitToScreenRef = useRef<() => void>(() => undefined);
    const pagesRef = useRef<CalibrePage[]>([]);
    const [pages, setPages] = useState<CalibrePage[]>([]);
    const [activePageId, setActivePageId] = useState("");
    const [pendingPdf, setPendingPdf] = useState<PendingPdf | null>(null);
    const [isImportingPdfPage, setIsImportingPdfPage] = useState(false);
    const [importError, setImportError] = useState("");
    const [activeTool, setActiveTool] = useState<CalibreTool>("select");
    const [activeLayer, setActiveLayer] = useState<CalibreLayerKind>("floor");
    const [activeSectorId, setActiveSectorId] = useState("main");
    const [activeOperation, setActiveOperation] = useState<CalibreOperation>("add");
    const [unitSystem, setUnitSystem] = useState<CalibreUnitSystem>("imperial");
    const [sectors, setSectors] = useState<CalibreSector[]>(DEFAULT_CALIBRE_SECTORS);
    const [layerVisibility, setLayerVisibility] =
        useState<CalibreLayerVisibility>(DEFAULT_LAYER_VISIBILITY);
    const [measurements, setMeasurements] = useState<CalibreMeasurement[]>([]);
    const [calibrations, setCalibrations] = useState<CalibrePageCalibrationMap>({});
    const [lineWeight, setLineWeight] = useState(1);
    const [viewportScale, setViewportScale] = useState(1);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isLayersOpen, setIsLayersOpen] = useState(false);

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

    function resetViewport() {

        setViewportScale(1);
        fitToScreenRef.current();

    }


    function addImportedPage(
        page: CalibrePage
    ) {

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
        file: File
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
                    pageCount: pdf.numPages
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
            name: file.name,
            sourceName: file.name,
            pageNumber: 1,
            imageUrl: URL.createObjectURL(file)
        });
        setPendingPdf(null);

    }


    async function handlePdfPageImport(
        pageNumber: number
    ) {

        if (!pendingPdf)
            return;

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
                name: `${pendingPdf.fileName} - page ${pageNumber}`,
                sourceName: pendingPdf.fileName,
                pageNumber,
                imageUrl: URL.createObjectURL(blob)
            });
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


    function zoomBy(
        factor: number
    ) {

        setViewportScale(
            currentScale => Math.max(
                CALIBRE_MIN_ZOOM,
                Math.min(
                    CALIBRE_MAX_ZOOM,
                    currentScale * factor
                )
            )
        );

    }


    async function toggleFullscreen() {

        if (document.fullscreenElement) {
            await document.exitFullscreen();
            return;
        }

        await pageRef.current?.requestFullscreen();

    }


    return (
        <section
            ref={pageRef}
            className={
                isFullscreen ?
                    "calibre-page fullscreen" :
                    "calibre-page"
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
                lineWeight={lineWeight}
                pages={pages}
                pendingPdf={pendingPdf}
                scalePercent={Math.round(viewportScale * 100)}
                unitSystem={unitSystem}
                onFitToScreen={resetViewport}
                onFullscreenToggle={toggleFullscreen}
                onLayersToggle={
                    () => setIsLayersOpen(
                        currentValue => !currentValue
                    )
                }
                onLineWeightChange={setLineWeight}
                onOperationChange={setActiveOperation}
                onPageChange={handlePageChange}
                onPdfPageImport={handlePdfPageImport}
                onPlanSelected={handlePlanSelected}
                onToolChange={setActiveTool}
                onUnitSystemChange={handleUnitSystemChange}
                onZoomIn={
                    () => zoomBy(1.15)
                }
                onZoomOut={
                    () => zoomBy(0.85)
                }
            />

            <div className="calibre-workspace">
                <CalibreCanvas
                    key={activePageId || "empty"}
                    activeLayer={activeLayer}
                    activeOperation={activeOperation}
                    activePageId={activePageId}
                    activeSectorId={activeSectorId}
                    activeTool={activeTool}
                    calibration={activeCalibration}
                    imageUrl={activePage?.imageUrl || ""}
                    layerVisibility={layerVisibility}
                    lineWeight={lineWeight}
                    measurements={activePageMeasurements}
                    unitSystem={unitSystem}
                    viewportScale={viewportScale}
                    onCalibrationChange={updateActivePageCalibration}
                    onFitToScreenReady={registerFitToScreen}
                    onMeasurementsChange={updateActivePageMeasurements}
                    onViewportScaleChange={setViewportScale}
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
                            onSectorsChange={setSectors}
                            onVisibilityChange={updateLayerVisibility}
                        />
                    </div>
                )}
            </div>
        </section>
    );

}


export default CalibreView;
