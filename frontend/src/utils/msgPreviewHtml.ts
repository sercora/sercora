export function clickableMsgHtml(
    html: string
) {

    if (!html)
        return "";

    const parser = new DOMParser();
    const documentValue = parser.parseFromString(
        html,
        "text/html"
    );

    documentValue
        .querySelectorAll("base[target]")
        .forEach(
            element =>
                element.remove()
        );

    const baseElement = documentValue.createElement("base");
    baseElement.setAttribute(
        "target",
        "_blank"
    );
    documentValue.head.prepend(baseElement);

    documentValue
        .querySelectorAll("a[href]")
        .forEach(
            link => {
                link.setAttribute(
                    "target",
                    "_blank"
                );
                link.setAttribute(
                    "rel",
                    "noopener noreferrer"
                );
            }
        );

    return "<!doctype html>\n" + documentValue.documentElement.outerHTML;

}
