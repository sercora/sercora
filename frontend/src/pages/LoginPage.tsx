import {
    useEffect,
    useRef,
    useState
} from "react";
import type { FormEvent } from "react";

import "../styles/auth.css";


type LoginPageProps = {
    onLogin: (
        username: string,
        password: string
    ) => Promise<void>;
};


type NodePoint = {
    x: number;
    z: number;
    speed: number;
    size: number;
    alpha: number;
};


type LightStreak = {
    x: number;
    z: number;
    speed: number;
    height: number;
    alpha: number;
};


const FLOOR_ROWS = 26;
const FLOOR_COLS = 12;


function projectFloorPoint(
    canvas: HTMLCanvasElement,
    x: number,
    z: number
) {

    const width = canvas.width;
    const height = canvas.height;
    const horizonY = height * 0.34;
    const depth = Math.max(
        0,
        Math.min(
            1,
            z
        )
    );
    const perspective = Math.pow(
        1 - depth,
        2.25
    );
    const y = horizonY + perspective * height * 0.78;
    const centerX = width * 0.5;
    const spread = width * (
        0.035 + perspective * 0.72
    );

    return {
        x: centerX + x * spread,
        y,
        perspective,
        depth
    };

}


function drawLoginWallpaper(
    canvas: HTMLCanvasElement,
    context: CanvasRenderingContext2D,
    time: number,
    nodes: NodePoint[],
    streaks: LightStreak[]
) {

    const width = canvas.width;
    const height = canvas.height;
    const tick = time * 0.00008;

    context.clearRect(
        0,
        0,
        width,
        height
    );

    const backgroundGradient = context.createRadialGradient(
        width * 0.5,
        height * 0.48,
        0,
        width * 0.5,
        height * 0.48,
        width * 0.82
    );
    backgroundGradient.addColorStop(
        0,
        "#0f1d0a"
    );
    backgroundGradient.addColorStop(
        0.38,
        "#050805"
    );
    backgroundGradient.addColorStop(
        1,
        "#050505"
    );
    context.fillStyle = backgroundGradient;
    context.fillRect(
        0,
        0,
        width,
        height
    );

    context.save();
    context.globalCompositeOperation = "lighter";

    const rowOffset = tick % 1;
    const colMin = -FLOOR_COLS;
    const colMax = FLOOR_COLS;

    for (let row = 0; row < FLOOR_ROWS; row += 1) {
        const zNear = row / FLOOR_ROWS;
        const zFar = (row + 1) / FLOOR_ROWS;
        const z0 = Math.max(
            0,
            Math.min(
                1,
                zNear + rowOffset / FLOOR_ROWS
            )
        );
        const z1 = Math.max(
            0,
            Math.min(
                1,
                zFar + rowOffset / FLOOR_ROWS
            )
        );
        const digitalBlend = Math.max(
            0,
            (z0 - 0.48) / 0.44
        );

        for (let col = colMin; col < colMax; col += 1) {
            const x0 = col / FLOOR_COLS;
            const x1 = (col + 1) / FLOOR_COLS;
            const p0 = projectFloorPoint(
                canvas,
                x0,
                z0
            );
            const p1 = projectFloorPoint(
                canvas,
                x1,
                z0
            );
            const p2 = projectFloorPoint(
                canvas,
                x1,
                z1
            );
            const p3 = projectFloorPoint(
                canvas,
                x0,
                z1
            );
            const isGreen = Math.abs(col + row) % 2 === 0;

            context.beginPath();
            context.moveTo(
                p0.x,
                p0.y
            );
            context.lineTo(
                p1.x,
                p1.y
            );
            context.lineTo(
                p2.x,
                p2.y
            );
            context.lineTo(
                p3.x,
                p3.y
            );
            context.closePath();
            context.fillStyle = isGreen ?
                `rgba(100,200,50,${0.44 * (1 - digitalBlend)})` :
                `rgba(246,255,241,${0.36 * (1 - digitalBlend)})`;
            context.fill();

            context.strokeStyle = `rgba(100,255,68,${0.2 + digitalBlend * 0.45})`;
            context.lineWidth = 1 + digitalBlend * 0.7;
            context.stroke();

            if (digitalBlend > 0.04) {
                const midX = (p0.x + p2.x) * 0.5;
                const midY = (p0.y + p2.y) * 0.5;
                context.beginPath();
                context.arc(
                    midX,
                    midY,
                    1.2 + digitalBlend * 1.8,
                    0,
                    Math.PI * 2
                );
                context.fillStyle = `rgba(124,255,68,${digitalBlend * 0.6})`;
                context.fill();
            }
        }
    }

    nodes.forEach(
        node => {
            node.z -= node.speed;

            if (node.z < 0.08) {
                node.z = 0.96;
                node.x = Math.random() * 1.9 - 0.95;
                node.alpha = 0.2 + Math.random() * 0.55;
            }

            const point = projectFloorPoint(
                canvas,
                node.x,
                node.z
            );
            const yLift = (1 - point.depth) * height * 0.09;

            context.beginPath();
            context.arc(
                point.x,
                point.y - yLift,
                node.size * (0.35 + point.perspective),
                0,
                Math.PI * 2
            );
            context.fillStyle = `rgba(124,255,68,${node.alpha * (0.35 + point.depth)})`;
            context.fill();
        }
    );

    streaks.forEach(
        streak => {
            streak.z -= streak.speed;

            if (streak.z < 0.1) {
                streak.z = 0.98;
                streak.x = Math.random() * 1.6 - 0.8;
            }

            const point = projectFloorPoint(
                canvas,
                streak.x,
                streak.z
            );
            const gradient = context.createLinearGradient(
                point.x,
                point.y - streak.height,
                point.x,
                point.y
            );
            gradient.addColorStop(
                0,
                "rgba(124,255,68,0)"
            );
            gradient.addColorStop(
                0.58,
                `rgba(124,255,68,${streak.alpha})`
            );
            gradient.addColorStop(
                1,
                "rgba(124,255,68,0)"
            );
            context.strokeStyle = gradient;
            context.lineWidth = 1.1;
            context.beginPath();
            context.moveTo(
                point.x,
                point.y - streak.height
            );
            context.lineTo(
                point.x,
                point.y
            );
            context.stroke();
        }
    );

    context.restore();

    const vignette = context.createRadialGradient(
        width * 0.5,
        height * 0.5,
        width * 0.18,
        width * 0.5,
        height * 0.5,
        width * 0.72
    );
    vignette.addColorStop(
        0,
        "rgba(0,0,0,0)"
    );
    vignette.addColorStop(
        1,
        "rgba(0,0,0,0.72)"
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

            const context = canvas.getContext("2d");

            if (!context)
                return;

            const activeCanvas = canvas;
            const activeContext = context;
            const nodes: NodePoint[] = Array.from(
                {
                    length: 70
                },
                () => ({
                    x: Math.random() * 1.9 - 0.95,
                    z: Math.random() * 0.85 + 0.1,
                    speed: 0.00025 + Math.random() * 0.00032,
                    size: 1 + Math.random() * 2.2,
                    alpha: 0.2 + Math.random() * 0.55
                })
            );
            const streaks: LightStreak[] = Array.from(
                {
                    length: 10
                },
                () => ({
                    x: Math.random() * 1.6 - 0.8,
                    z: Math.random() * 0.8 + 0.15,
                    speed: 0.00018 + Math.random() * 0.00018,
                    height: 80 + Math.random() * 190,
                    alpha: 0.08 + Math.random() * 0.17
                })
            );
            let frame = 0;

            function resize() {
                activeCanvas.width = window.innerWidth;
                activeCanvas.height = window.innerHeight;
                activeCanvas.style.width = window.innerWidth + "px";
                activeCanvas.style.height = window.innerHeight + "px";
                activeContext.setTransform(
                    1,
                    0,
                    0,
                    1,
                    0,
                    0
                );
            }

            function animate(
                time: number
            ) {
                drawLoginWallpaper(
                    activeCanvas,
                    activeContext,
                    time,
                    nodes,
                    streaks
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
            <strong>
                SERCOR<span>A</span>
            </strong>
            <small>
                CARRELAGES
                <i />
                ESTIMATION
                <i />
                CRM
            </small>
        </div>
    );

}


function LoginPage({
    onLogin
}: LoginPageProps) {

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);


    async function submit(
        event: FormEvent<HTMLFormElement>
    ) {

        event.preventDefault();
        setError(null);
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
                    "Connexion refusee"
            );

        } finally {
            setIsSubmitting(false);
        }

    }


    return (
        <main className="login-page">
            <LoginWallpaper />
            <div className="login-light-field" />
            <section className="login-experience">
                <SercoraWordmark />

                <form
                    className="login-panel"
                    onSubmit={submit}
                >
                    <div className="login-copy">
                        <span>Espace sécurisé</span>
                        <h1>Bon retour</h1>
                        <p>
                            Connectez-vous pour accéder à vos projets, soumissions et gestion client.
                        </p>
                    </div>

                    <label className="login-field">
                        <span>Courriel</span>
                        <div>
                            <i aria-hidden="true">@</i>
                            <input
                                value={username}
                                type="email"
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

                    {error && (
                        <div className="auth-error">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="login-submit"
                        disabled={
                            isSubmitting ||
                            !username.trim() ||
                            !password
                        }
                    >
                        {isSubmitting ? "Connexion..." : "Connexion"}
                    </button>

                    <div className="login-links">
                        <button type="button">
                            Mot de passe oublié
                        </button>
                        <button type="button">
                            Créer un compte
                        </button>
                    </div>
                </form>
            </section>
        </main>
    );

}


export default LoginPage;
