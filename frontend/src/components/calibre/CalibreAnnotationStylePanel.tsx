import {
    CALIBRE_ANNOTATION_PRESETS
} from "../../types/calibre";
import type {
    CalibreAnnotationPosition,
    CalibreAnnotationStyle
} from "../../types/calibre";


type CalibreAnnotationStylePanelProps = {
    snapRadius: number;
    style: CalibreAnnotationStyle;
    onClose: () => void;
    onSnapRadiusChange: (radius: number) => void;
    onStyleChange: (style: CalibreAnnotationStyle) => void;
};


const FONT_FAMILIES = [
    "Arial",
    "Calibri",
    "Inter",
    "Roboto Condensed"
];


function presetLabel(
    preset: string
) {

    if (preset === "compact")
        return "Compact";

    if (preset === "presentation")
        return "Présentation";

    if (preset === "print")
        return "Impression grand format";

    return "Normal";

}


function CalibreAnnotationStylePanel({
    snapRadius,
    style,
    onClose,
    onSnapRadiusChange,
    onStyleChange
}: CalibreAnnotationStylePanelProps) {

    function updateStyle(
        values: Partial<CalibreAnnotationStyle>
    ) {

        onStyleChange({
            ...style,
            ...values,
            preset: values.preset || "custom"
        });

    }

    function updatePosition(
        position: CalibreAnnotationPosition
    ) {

        updateStyle({
            position
        });

    }

    return (
        <aside className="calibre-style-panel">
            <div className="calibre-popup-heading-row">
                <div className="calibre-panel-heading">
                    <span>Annotations</span>
                    <strong>Style d'affichage</strong>
                </div>

                <button
                    type="button"
                    className="calibre-popup-close"
                    onClick={onClose}
                >
                    Fermer
                </button>
            </div>

            <div className="calibre-style-presets">
                {CALIBRE_ANNOTATION_PRESETS.map(
                    preset => (
                        <button
                            key={preset.preset}
                            type="button"
                            className={
                                style.preset === preset.preset ?
                                    "active" :
                                    ""
                            }
                            onClick={
                                () => onStyleChange(preset)
                            }
                        >
                            {presetLabel(preset.preset)}
                        </button>
                    )
                )}
            </div>

            <label className="calibre-style-field">
                <span>Taille</span>
                <input
                    type="range"
                    min={6}
                    max={22}
                    step={1}
                    value={style.fontSize}
                    onChange={
                        event => updateStyle({
                            fontSize: Number(event.target.value)
                        })
                    }
                />
                <strong>{style.fontSize}px</strong>
            </label>

            <label className="calibre-style-field">
                <span>Police</span>
                <select
                    value={style.fontFamily}
                    onChange={
                        event => updateStyle({
                            fontFamily: event.target.value
                        })
                    }
                >
                    {FONT_FAMILIES.map(
                        fontFamily => (
                            <option
                                key={fontFamily}
                                value={fontFamily}
                            >
                                {fontFamily}
                            </option>
                        )
                    )}
                </select>
            </label>

            <div className="calibre-style-row">
                <label>
                    <input
                        type="checkbox"
                        checked={style.bold}
                        onChange={
                            event => updateStyle({
                                bold: event.target.checked
                            })
                        }
                    />
                    Gras
                </label>
                <label>
                    <input
                        type="checkbox"
                        checked={style.halo}
                        onChange={
                            event => updateStyle({
                                halo: event.target.checked
                            })
                        }
                    />
                    Halo
                </label>
                <label>
                    <input
                        type="checkbox"
                        checked={style.showUnits}
                        onChange={
                            event => updateStyle({
                                showUnits: event.target.checked
                            })
                        }
                    />
                    Unités
                </label>
            </div>

            <div className="calibre-style-colors">
                <label>
                    <span>Texte</span>
                    <input
                        type="color"
                        value={style.color}
                        onChange={
                            event => updateStyle({
                                color: event.target.value
                            })
                        }
                    />
                </label>
                <label>
                    <span>Halo</span>
                    <input
                        type="color"
                        value={style.haloColor}
                        onChange={
                            event => updateStyle({
                                haloColor: event.target.value
                            })
                        }
                    />
                </label>
            </div>

            <label className="calibre-style-field">
                <span>Transparence</span>
                <input
                    type="range"
                    min={0.25}
                    max={1}
                    step={0.05}
                    value={style.opacity}
                    onChange={
                        event => updateStyle({
                            opacity: Number(event.target.value)
                        })
                    }
                />
                <strong>{Math.round(style.opacity * 100)}%</strong>
            </label>

            <label className="calibre-style-field">
                <span>Rotation</span>
                <input
                    type="range"
                    min={-90}
                    max={90}
                    step={5}
                    value={style.rotation}
                    onChange={
                        event => updateStyle({
                            rotation: Number(event.target.value)
                        })
                    }
                />
                <strong>{style.rotation}°</strong>
            </label>

            <div className="calibre-segmented-control">
                <button
                    type="button"
                    className={style.position === "inside" ? "active" : ""}
                    onClick={
                        () => updatePosition("inside")
                    }
                >
                    Dans la surface
                </button>
                <button
                    type="button"
                    className={style.position === "above" ? "active" : ""}
                    onClick={
                        () => updatePosition("above")
                    }
                >
                    Au-dessus
                </button>
            </div>

            <label className="calibre-style-field">
                <span>Snap polygone</span>
                <input
                    type="range"
                    min={10}
                    max={20}
                    step={1}
                    value={snapRadius}
                    onChange={
                        event => onSnapRadiusChange(
                            Number(event.target.value)
                        )
                    }
                />
                <strong>{snapRadius}px</strong>
            </label>
        </aside>
    );

}


export default CalibreAnnotationStylePanel;
