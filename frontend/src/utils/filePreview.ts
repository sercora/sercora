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

    popup.document.title = title || "PDF";
    popup.document.body.style.margin = "0";
    popup.document.body.style.background = "#111827";
    popup.document.body.style.color = "#ffffff";
    popup.document.body.style.fontFamily = "Arial, sans-serif";
    popup.document.body.style.display = "grid";
    popup.document.body.style.placeItems = "center";
    popup.document.body.textContent = "Ouverture du PDF...";
    popup.focus();

    window.setTimeout(
        () => {
            popup.location.replace(pdfUrl);
        },
        25
    );

}
