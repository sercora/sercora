import { API_URL } from "./matrixApi";


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
    assigned_to: string;
    location: string;
    last_checkout: string;
    updated_at: string;
};


export type ToolsResponse = {
    total: number;
    rows: ToolAsset[];
};


function parseResponse(response: Response) {

    if (!response.ok)
        throw new Error("Request failed");

    return response.json();

}


export function fetchTools(
    search = ""
): Promise<ToolsResponse> {

    const params = new URLSearchParams(
        {
            limit: "250",
            sort: "asset_tag",
            order: "asc"
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
