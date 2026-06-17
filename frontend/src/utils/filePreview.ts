export function openPdfPreviewWindow(
    pdfUrl: string,
    title: string
) {

    const width = window.screen.availWidth || 1400;
    const height = window.screen.availHeight || 900;
    const popup = window.open(
        pdfUrl,
        "_blank",
        `popup=yes,width=${width},height=${height},left=0,top=0`
    );

    if (!popup)
        window.open(
            pdfUrl,
            "_blank",
            "noopener,noreferrer"
        );
    else
        try {
            popup.document.title = title || "PDF";
            popup.focus();
            popup.opener = null;
        }
        catch {
            popup.focus();
        }

}
