function appendChild<K extends keyof HTMLElementTagNameMap>(
    parent: HTMLElement,
    tagName: K,
    className?: string
) {

    const element = parent.ownerDocument.createElement(tagName);

    if (className)
        element.className = className;

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
        "",
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

    doc.title = title || "PDF";
    doc.body.innerHTML = "";
    doc.documentElement.style.margin = "0";
    doc.documentElement.style.width = "100%";
    doc.documentElement.style.height = "100%";
    doc.body.style.margin = "0";
    doc.body.style.width = "100%";
    doc.body.style.height = "100%";
    doc.body.style.overflow = "hidden";
    doc.body.style.background = "#111827";
    doc.body.style.fontFamily = "Calibri, Arial, sans-serif";

    const shell = appendChild(
        doc.body,
        "main"
    );
    shell.style.display = "grid";
    shell.style.gridTemplateRows = "42px minmax(0, 1fr)";
    shell.style.width = "100%";
    shell.style.height = "100%";

    const toolbar = appendChild(
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

    const heading = appendChild(
        toolbar,
        "strong"
    );
    heading.textContent = title || "PDF";
    heading.style.overflow = "hidden";
    heading.style.textOverflow = "ellipsis";
    heading.style.whiteSpace = "nowrap";

    const actions = appendChild(
        toolbar,
        "div"
    );
    actions.style.display = "flex";
    actions.style.gap = "8px";

    const fullscreenButton = appendChild(
        actions,
        "button"
    );
    fullscreenButton.type = "button";
    fullscreenButton.textContent = "Plein écran";

    const closeButton = appendChild(
        actions,
        "button"
    );
    closeButton.type = "button";
    closeButton.textContent = "Fermer";

    [fullscreenButton, closeButton].forEach(
        button => {
            button.style.height = "28px";
            button.style.padding = "0 10px";
            button.style.border = "1px solid rgba(255,255,255,0.22)";
            button.style.borderRadius = "4px";
            button.style.background = "#ffffff";
            button.style.color = "#172016";
            button.style.fontWeight = "800";
            button.style.cursor = "pointer";
        }
    );

    fullscreenButton.onclick = () => {
        doc.documentElement.requestFullscreen?.();
    };
    closeButton.onclick = () => {
        popup.close();
    };

    const viewer = appendChild(
        shell,
        "iframe"
    );
    viewer.title = title || "PDF";
    viewer.src = pdfUrl;
    viewer.style.width = "100%";
    viewer.style.height = "100%";
    viewer.style.border = "0";
    viewer.style.background = "#ffffff";

    popup.focus();
    popup.opener = null;

}
