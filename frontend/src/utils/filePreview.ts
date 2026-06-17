function appendElement<K extends keyof HTMLElementTagNameMap>(
    parent: HTMLElement,
    tagName: K
) {

    const element = parent.ownerDocument.createElement(tagName);
    parent.appendChild(element);
    return element;

}


export function openPdfPreviewWindow(
    pdfUrl: string,
    title: string
) {

    const width = window.screen.availWidth || 1400;
    const height = window.screen.availHeight || 900;
    const popup = window.open(
        "about:blank",
        "_blank",
        `popup=yes,width=${width},height=${height},left=0,top=0`
    );

    if (!popup) {
        window.open(
            pdfUrl,
            "_blank",
            "noopener,noreferrer"
        );
        return;
    }

    const doc = popup.document;
    const popupGlobal = popup as Window & typeof globalThis;

    doc.title = title || "PDF";
    doc.body.innerHTML = "";
    doc.documentElement.style.width = "100%";
    doc.documentElement.style.height = "100%";
    doc.documentElement.style.margin = "0";
    doc.body.style.width = "100%";
    doc.body.style.height = "100%";
    doc.body.style.margin = "0";
    doc.body.style.overflow = "hidden";
    doc.body.style.background = "#111827";
    doc.body.style.fontFamily = "Arial, sans-serif";

    const shell = appendElement(
        doc.body,
        "main"
    );
    shell.style.width = "100%";
    shell.style.height = "100%";
    shell.style.display = "grid";
    shell.style.gridTemplateRows = "44px minmax(0, 1fr)";

    const toolbar = appendElement(
        shell,
        "header"
    );
    toolbar.style.display = "flex";
    toolbar.style.alignItems = "center";
    toolbar.style.justifyContent = "space-between";
    toolbar.style.gap = "12px";
    toolbar.style.padding = "0 12px";
    toolbar.style.background = "#172016";
    toolbar.style.color = "#ffffff";

    const heading = appendElement(
        toolbar,
        "strong"
    );
    heading.textContent = title || "PDF";
    heading.style.overflow = "hidden";
    heading.style.textOverflow = "ellipsis";
    heading.style.whiteSpace = "nowrap";

    const actions = appendElement(
        toolbar,
        "div"
    );
    actions.style.display = "flex";
    actions.style.gap = "8px";
    actions.style.flex = "0 0 auto";

    const browserButton = appendElement(
        actions,
        "button"
    );
    browserButton.type = "button";
    browserButton.textContent = "Ouvrir";

    const fullscreenButton = appendElement(
        actions,
        "button"
    );
    fullscreenButton.type = "button";
    fullscreenButton.textContent = "Plein écran";

    const closeButton = appendElement(
        actions,
        "button"
    );
    closeButton.type = "button";
    closeButton.textContent = "Fermer";

    [browserButton, fullscreenButton, closeButton].forEach(
        button => {
            button.style.height = "30px";
            button.style.padding = "0 10px";
            button.style.border = "1px solid rgba(255,255,255,0.22)";
            button.style.borderRadius = "4px";
            button.style.background = "#ffffff";
            button.style.color = "#172016";
            button.style.fontWeight = "800";
            button.style.cursor = "pointer";
        }
    );

    const viewer = appendElement(
        shell,
        "object"
    );
    viewer.type = "application/pdf";
    viewer.style.width = "100%";
    viewer.style.height = "100%";
    viewer.style.border = "0";
    viewer.style.background = "#ffffff";

    const fallback = appendElement(
        viewer,
        "div"
    );
    fallback.textContent = "Le PDF ne peut pas être affiché dans cette fenêtre.";
    fallback.style.color = "#ffffff";
    fallback.style.padding = "24px";

    fetch(pdfUrl)
        .then(
            response => {
                if (!response.ok)
                    throw new Error("PDF preview failed");

                return response.blob();
            }
        )
        .then(
            blob => {
                const popupUrl = popupGlobal.URL.createObjectURL(
                    new popupGlobal.Blob(
                        [blob],
                        {
                            type: "application/pdf"
                        }
                    )
                );

                viewer.data = popupUrl;

                popup.addEventListener(
                    "beforeunload",
                    () => popupGlobal.URL.revokeObjectURL(popupUrl),
                    {
                        once: true
                    }
                );
            }
        )
        .catch(
            () => {
                fallback.textContent =
                    "Impossible de charger le PDF dans cette fenêtre.";
            }
        );

    browserButton.onclick = () => {
        popup.open(
            pdfUrl,
            "_blank",
            "noopener,noreferrer"
        );
    };
    fullscreenButton.onclick = () => {
        doc.documentElement.requestFullscreen?.();
    };
    closeButton.onclick = () => {
        popup.close();
    };

    popup.focus();

}
