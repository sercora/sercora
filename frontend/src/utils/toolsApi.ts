import { API_URL } from "./matrixApi";

export { API_URL };


export type ToolAsset = {
    id: number;
    asset_tag: string;
    name: string;
    serial: string;
    model: string;
    model_number: string;
    category: string;
    manufacturer: string;
    status: string;
    status_type: string;
    image_url: string;
    image_proxy_path: string;
    assigned_to: string;
    location: string;
    last_checkout: string;
    updated_at: string;
};


export type ToolsResponse = {
    total: number;
    rows: ToolAsset[];
};


export type ToolScope = "all" | "available" | "deployed";
export type ToolSort =
    "asset_tag" |
    "name" |
    "model" |
    "serial" |
    "category" |
    "location" |
    "status" |
    "updated_at";
export type ToolSortOrder = "asc" | "desc";


export type ToolsRequest = {
    search?: string;
    limit?: number;
    offset?: number;
    sort?: ToolSort;
    order?: ToolSortOrder;
    scope?: ToolScope;
};


function parseResponse(response: Response) {

    if (!response.ok)
        throw new Error("Request failed");

    return response.json();

}


export function fetchTools(
    request: ToolsRequest = {}
): Promise<ToolsResponse> {

    const limit =
        request.limit || 20;
    const offset =
        request.offset || 0;
    const search =
        request.search || "";
    const sort =
        request.sort || "asset_tag";
    const order =
        request.order || "asc";
    const scope =
        request.scope || "all";

    const params = new URLSearchParams(
        {
            limit: String(limit),
            offset: String(offset),
            sort,
            order,
            scope
        }
    );

    if (search.trim())
        params.set(
            "search",
            search.trim()
        );

    return fetch(
        API_URL +
        "/tools?" +
        params.toString()
    )

    .then(parseResponse);

}
