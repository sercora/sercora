import {
    useEffect,
    useRef,
    useState
} from "react";
import type { FormEvent } from "react";

import sercoraLoginLogo from "../assets/sercora-login-logo.png";
import {
    requestPasswordReset
} from "../utils/authApi";

import "../styles/auth.css";


type LoginPageProps = {
    onLogin: (
        username: string,
        password: string
    ) => Promise<void>;
};


type Viewport = {
    width: number;
    height: number;
};


type FloorPoint = {
    x: number;
    y: number;
    perspective: number;
    depth: number;
};


type TileCell = {
    col: number;
    row: number;
    delay: number;
    tone: number;
};


const TILE_CELLS: TileCell[] = Array.from(
    {
        length: 24
    },
    (_, index) => {
        const col = index % 6;
        const row = Math.floor(index / 6);

        return {
            col: col - 3,
            row,
            delay: (3 - row) * 0.08 + Math.abs(col - 2.5) * 0.035,
            tone: (row + col) % 2
        };
    }
);


function clamp(
    value: number,
    min: number,
    max: number
) {

    return Math.max(
        min,
        Math.min(
            max,
            value
        )
    );

}


function easeOutCubic(
    value: number
) {

    const clamped = clamp(
        value,
        0,
        1
    );

    return 1 - Math.pow(
        1 - clamped,
        3
    );

}


function projectFloorPoint(
    viewport: Viewport,
    x: number,
    z: number
): FloorPoint {

    const {
        width,
        height
    } = viewport;
    const depth = clamp(
        z,
        0,
        1
    );
    const horizonY = height * 0.35;
    const perspective = Math.pow(
        1 - depth,
        2.2
    );
    const y = horizonY + perspective * height * 0.78;
    const spread = width * (
        0.045 + perspective * 0.69
    );

    return {
        x: width * 0.5 + x * spread,
        y,
        perspective,
        depth
    };

}


function drawQuad(
    context: CanvasRenderingContext2D,
    points: FloorPoint[]
) {

    context.beginPath();
    context.moveTo(
        points[0].x,
        points[0].y
    );
    context.lineTo(
        points[1].x,
        points[1].y
    );
    context.lineTo(
        points[2].x,
        points[2].y
    );
    context.lineTo(
        points[3].x,
        points[3].y
    );
    context.closePath();

}


function drawBackground(
    context: CanvasRenderingContext2D,
    viewport: Viewport
) {

    const {
        width,
        height
    } = viewport;
    const gradient = context.createRadialGradient(
        width * 0.5,
        height * 0.43,
        0,
        width * 0.5,
        height * 0.43,
        width * 0.72
    );
    gradient.addColorStop(
        0,
        "#11220b"
    );
    gradient.addColorStop(
        0.42,
        "#050805"
    );
    gradient.addColorStop(
        1,
        "#050505"
    );

    context.fillStyle = gradient;
    context.fillRect(
        0,
        0,
        width,
        height
    );

}


function drawAdhesive(
    context: CanvasRenderingContext2D,
    viewport: Viewport,
    adhesiveProgress: number
) {

    const {
        width,
        height
    } = viewport;
    const adhesiveFar = 0.13 + adhesiveProgress * 0.76;
    const adhesive = [
        projectFloorPoint(
            viewport,
            -0.92,
            0.03
        ),
        projectFloorPoint(
            viewport,
            0.92,
            0.03
        ),
        projectFloorPoint(
            viewport,
            0.43,
            adhesiveFar
        ),
        projectFloorPoint(
            viewport,
            -0.43,
            adhesiveFar
        )
    ];
    const gradient = context.createLinearGradient(
        width * 0.5,
        height,
        width * 0.5,
        height * 0.35
    );
    gradient.addColorStop(
        0,
        "rgba(226,228,216,0.94)"
    );
    gradient.addColorStop(
        1,
        "rgba(148,157,141,0.62)"
    );

    drawQuad(
        context,
        adhesive
    );
    context.fillStyle = gradient;
    context.fill();

    context.save();
    drawQuad(
        context,
        adhesive
    );
    context.clip();

    for (let groove = -12; groove <= 12; groove += 1) {
        const x = groove / 12;
        const near = projectFloorPoint(
            viewport,
            x,
            0.035
        );
        const far = projectFloorPoint(
            viewport,
            x * 0.44,
            adhesiveFar
        );

        context.beginPath();
        context.moveTo(
            near.x,
            near.y
        );
        context.quadraticCurveTo(
            width * 0.5 + x * width * 0.2,
            height * 0.66,
            far.x,
            far.y
        );
        context.strokeStyle = "rgba(68,73,64,0.48)";
        context.lineWidth = 3.3;
        context.stroke();

        context.beginPath();
        context.moveTo(
            near.x + 3,
            near.y
        );
        context.quadraticCurveTo(
            width * 0.5 + x * width * 0.2 + 2,
            height * 0.66,
            far.x + 1,
            far.y
        );
        context.strokeStyle = "rgba(255,255,246,0.34)";
        context.lineWidth = 1.1;
        context.stroke();
    }

    context.restore();

}


function drawTrowel(
    context: CanvasRenderingContext2D,
    viewport: Viewport,
    progress: number
) {

    const trowelAlpha = clamp(
        1 - (progress - 0.42) / 0.16,
        0,
        1
    );

    if (trowelAlpha <= 0)
        return;

    const trowelProgress = easeOutCubic(
        progress / 0.42
    );
    const point = projectFloorPoint(
        viewport,
        -0.52 + trowelProgress * 0.98,
        0.17 + trowelProgress * 0.54
    );
    const scale = 0.7 + point.perspective * 0.42;

    context.save();
    context.translate(
        point.x,
        point.y - 22 * scale
    );
    context.rotate(-0.12);
    context.scale(
        scale,
        scale
    );
    context.globalAlpha = trowelAlpha;
    context.shadowColor = "rgba(0,0,0,0.42)";
    context.shadowBlur = 20;
    context.shadowOffsetY = 8;
    context.fillStyle = "rgba(174,186,171,0.9)";
    context.fillRect(
        -64,
        -18,
        128,
        42
    );
    context.fillStyle = "rgba(21,24,21,0.8)";
    context.fillRect(
        -42,
        20,
        84,
        13
    );
    context.shadowBlur = 0;
    context.fillStyle = "rgba(100,200,50,0.86)";

    for (let tooth = -52; tooth <= 52; tooth += 13) {
        context.fillRect(
            tooth,
            18,
            7,
            15
        );
    }

    context.restore();

}


function drawTiles(
    context: CanvasRenderingContext2D,
    viewport: Viewport,
    tileProgress: number
) {

    const {
        height
    } = viewport;

    TILE_CELLS.forEach(
        tile => {
            const tileReveal = easeOutCubic(
                (tileProgress - tile.delay) / 0.2
            );

            if (tileReveal <= 0)
                return;

            const colWidth = 0.28;
            const rowHeight = 0.16;
            const x0 = tile.col * colWidth;
            const x1 = x0 + colWidth * 0.94;
            const z0 = 0.06 + tile.row * rowHeight;
            const z1 = z0 + rowHeight * 0.9;
            const lift = (1 - tileReveal) * height * 0.11;
            const points = [
                projectFloorPoint(
                    viewport,
                    x0,
                    z0
                ),
                projectFloorPoint(
                    viewport,
                    x1,
                    z0
                ),
                projectFloorPoint(
                    viewport,
                    x1 * 0.98,
                    z1
                ),
                projectFloorPoint(
                    viewport,
                    x0 * 0.98,
                    z1
                )
            ].map(
                point => ({
                    ...point,
                    y: point.y - lift
                })
            );

            context.save();
            context.globalAlpha = tileReveal;
            context.shadowColor = "rgba(0,0,0,0.48)";
            context.shadowBlur = 18;
            context.shadowOffsetY = 10;
            drawQuad(
                context,
                points
            );
            context.fillStyle = tile.tone === 0 ?
                "rgba(246,251,242,0.97)" :
                "rgba(91,185,46,0.96)";
            context.fill();
            context.shadowBlur = 0;
            context.strokeStyle = tile.tone === 0 ?
                "rgba(255,255,255,0.56)" :
                "rgba(173,255,125,0.34)";
            context.lineWidth = 1.1;
            context.stroke();
            context.restore();
        }
    );

}


function drawLoginWallpaper(
    context: CanvasRenderingContext2D,
    viewport: Viewport,
    time: number
) {

    const {
        width,
        height
    } = viewport;
    const cycle = 9200;
    const progress = (time % cycle) / cycle;
    const adhesiveProgress = easeOutCubic(
        progress / 0.38
    );
    const tileProgress = easeOutCubic(
        (progress - 0.34) / 0.54
    );

    context.clearRect(
        0,
        0,
        width,
        height
    );
    drawBackground(
        context,
        viewport
    );

    const slab = [
        projectFloorPoint(
            viewport,
            -1.08,
            0.02
        ),
        projectFloorPoint(
            viewport,
            1.08,
            0.02
        ),
        projectFloorPoint(
            viewport,
            0.52,
            0.96
        ),
        projectFloorPoint(
            viewport,
            -0.52,
            0.96
        )
    ];

    drawQuad(
        context,
        slab
    );
    context.fillStyle = "rgba(15,20,14,0.82)";
    context.fill();

    drawAdhesive(
        context,
        viewport,
        adhesiveProgress
    );
    drawTrowel(
        context,
        viewport,
        progress
    );
    drawTiles(
        context,
        viewport,
        tileProgress
    );

    context.save();
    context.globalCompositeOperation = "lighter";
    const glow = context.createRadialGradient(
        width * 0.5,
        height * 0.78,
        0,
        width * 0.5,
        height * 0.78,
        width * 0.45
    );
    glow.addColorStop(
        0,
        "rgba(124,255,68,0.22)"
    );
    glow.addColorStop(
        1,
        "rgba(124,255,68,0)"
    );
    context.fillStyle = glow;
    context.fillRect(
        0,
        0,
        width,
        height
    );
    context.restore();

    const vignette = context.createRadialGradient(
        width * 0.5,
        height * 0.5,
        width * 0.18,
        width * 0.5,
        height * 0.5,
        width * 0.75
    );
    vignette.addColorStop(
        0,
        "rgba(0,0,0,0)"
    );
    vignette.addColorStop(
        1,
        "rgba(0,0,0,0.74)"
    );
    context.fillStyle = vignette;
    context.fillRect(
        0,
        0,
        width,
        height
    );

}


function LoginWallpaper() {

    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(
        () => {
            const canvas = canvasRef.current;

            if (!canvas)
                return;

            const context = canvas.getContext("2d", {
                alpha: false
            });

            if (!context)
                return;

            const activeCanvas = canvas;
            const activeContext = context;
            const viewport: Viewport = {
                width: window.innerWidth,
                height: window.innerHeight
            };
            let frame = 0;

            function resize() {
                const renderScale = Math.min(
                    window.devicePixelRatio || 1,
                    1.1
                );
                viewport.width = window.innerWidth;
                viewport.height = window.innerHeight;
                activeCanvas.width = Math.floor(viewport.width * renderScale);
                activeCanvas.height = Math.floor(viewport.height * renderScale);
                activeCanvas.style.width = viewport.width + "px";
                activeCanvas.style.height = viewport.height + "px";
                activeContext.setTransform(
                    renderScale,
                    0,
                    0,
                    renderScale,
                    0,
                    0
                );
            }

            function animate(
                time: number
            ) {
                drawLoginWallpaper(
                    activeContext,
                    viewport,
                    time
                );
                frame = requestAnimationFrame(animate);
            }

            resize();
            window.addEventListener(
                "resize",
                resize
            );
            frame = requestAnimationFrame(animate);

            return () => {
                cancelAnimationFrame(frame);
                window.removeEventListener(
                    "resize",
                    resize
                );
            };
        },
        []
    );

    return (
        <canvas
            ref={canvasRef}
            className="login-wallpaper"
            aria-hidden="true"
        />
    );

}


function SercoraWordmark() {

    return (
        <div className="login-wordmark">
            <div className="login-wordmark-glow" />
            <img
                src={sercoraLoginLogo}
                alt="Sercora"
                className="login-brand-image"
            />
        </div>
    );

}


function LoginPage({
    onLogin
}: LoginPageProps) {

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [resetEmail, setResetEmail] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isResetMode, setIsResetMode] = useState(false);


    async function submit(
        event: FormEvent<HTMLFormElement>
    ) {

        event.preventDefault();
        setError(null);
        setStatus(null);
        setIsSubmitting(true);

        try {
            await onLogin(
                username,
                password
            );

        } catch (loginError) {
            setError(
                loginError instanceof Error ?
                    loginError.message :
                    "Connexion refusée"
            );

        } finally {
            setIsSubmitting(false);
        }

    }


    async function submitPasswordReset(
        event: FormEvent<HTMLFormElement>
    ) {

        event.preventDefault();
        setError(null);
        setStatus(null);
        setIsSubmitting(true);

        try {
            const response = await requestPasswordReset(
                resetEmail
            );
            setStatus(
                response.message ||
                "Si un compte actif utilise ce courriel, un lien de modification sera envoyé."
            );

        } catch (resetError) {
            setError(
                resetError instanceof Error ?
                    resetError.message :
                    "Impossible d'envoyer le lien de modification"
            );

        } finally {
            setIsSubmitting(false);
        }

    }


    function showResetMode() {

        setError(null);
        setStatus(null);
        setResetEmail("");
        setIsResetMode(true);

    }


    function showLoginMode() {

        setError(null);
        setStatus(null);
        setIsResetMode(false);

    }


    return (
        <main className="login-page">
            <LoginWallpaper />
            <div className="login-light-field" />
            <section className="login-experience">
                <SercoraWordmark />

                <form
                    className="login-panel"
                    onSubmit={
                        isResetMode ?
                            submitPasswordReset :
                            submit
                    }
                >
                    <div className="login-copy">
                        <span>Espace sécurisé</span>
                        <h1>
                            {isResetMode ? "Mot de passe oublié" : "Bon retour"}
                        </h1>
                        <p>
                            {isResetMode ?
                                "Entrez le courriel lié à votre compte pour recevoir un lien de modification." :
                                "Connectez-vous pour accéder à vos projets, soumissions et gestion client."}
                        </p>
                    </div>

                    {isResetMode ? (
                        <label className="login-field">
                            <span>Courriel</span>
                            <div>
                                <i aria-hidden="true">@</i>
                                <input
                                    value={resetEmail}
                                    type="email"
                                    autoComplete="email"
                                    onChange={
                                        event => setResetEmail(event.target.value)
                                    }
                                />
                            </div>
                        </label>
                    ) : (
                        <>
                            <label className="login-field">
                                <span>Usager</span>
                                <div>
                                    <i aria-hidden="true">U</i>
                                    <input
                                        value={username}
                                        type="text"
                                        autoComplete="username"
                                        onChange={
                                            event => setUsername(event.target.value)
                                        }
                                    />
                                </div>
                            </label>

                            <label className="login-field">
                                <span>Mot de passe</span>
                                <div>
                                    <i aria-hidden="true">*</i>
                                    <input
                                        value={password}
                                        type="password"
                                        autoComplete="current-password"
                                        onChange={
                                            event => setPassword(event.target.value)
                                        }
                                    />
                                </div>
                            </label>
                        </>
                    )}

                    {error && (
                        <div className="auth-error">
                            {error}
                        </div>
                    )}

                    {status && (
                        <div className="auth-success">
                            {status}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="login-submit"
                        disabled={
                            isSubmitting ||
                            (
                                isResetMode ?
                                    !resetEmail.trim() :
                                    (!username.trim() || !password)
                            )
                        }
                    >
                        {isSubmitting ?
                            (isResetMode ? "Envoi..." : "Connexion...") :
                            (isResetMode ? "Envoyer le lien" : "Connexion")}
                    </button>

                    <div className="login-links">
                        <button
                            type="button"
                            onClick={
                                isResetMode ?
                                    showLoginMode :
                                    showResetMode
                            }
                        >
                            {isResetMode ? "Retour à la connexion" : "Mot de passe oublié"}
                        </button>
                    </div>
                </form>
            </section>
        </main>
    );

}


export default LoginPage;
