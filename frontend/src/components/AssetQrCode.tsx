import {
    createQrMatrix
} from "../utils/qrCode";


type AssetQrCodeProps = {
    value: string;
    label: string;
};


function AssetQrCode({
    value,
    label
}: AssetQrCodeProps) {

    if (!value)
        return <span>QR non disponible</span>;

    try {
        const matrix = createQrMatrix(value);
        const quietZone = 4;
        const size = matrix.length + quietZone * 2;

        return (
            <svg
                viewBox={`0 0 ${size} ${size}`}
                role="img"
                aria-label={label}
                shapeRendering="crispEdges"
            >
                <rect
                    width={size}
                    height={size}
                    fill="#ffffff"
                />
                {matrix.map(
                    (row, y) =>
                        row.map(
                            (isDark, x) =>
                                isDark ? (
                                    <rect
                                        key={x + "-" + y}
                                        x={x + quietZone}
                                        y={y + quietZone}
                                        width="1"
                                        height="1"
                                        fill="#111827"
                                    />
                                ) : null
                        )
                )}
            </svg>
        );
    } catch {
        return <span>QR trop long à générer</span>;
    }

}


export default AssetQrCode;
