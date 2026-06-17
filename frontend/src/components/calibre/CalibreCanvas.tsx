import {
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";
import {
    Image as KonvaImage,
    Layer,
    Stage
} from "react-konva";


type CalibreCanvasProps = {
    imageUrl: string;
};


type CanvasSize = {
    width: number;
    height: number;
};


type LoadedImageState = {
    url: string;
    image: HTMLImageElement | null;
};


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


function CalibreCanvas({
    imageUrl
}: CalibreCanvasProps) {

    const shellRef = useRef<HTMLDivElement | null>(null);
    const [size, setSize] = useState<CanvasSize>({
        width: 900,
        height: 620
    });
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

            <Stage
                width={size.width}
                height={size.height}
                className="calibre-stage"
            >
                <Layer>
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
                </Layer>
            </Stage>
        </section>
    );

}


export default CalibreCanvas;
