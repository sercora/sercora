import { API_URL } from "./matrixApi";

export { API_URL };


export type ToolAsset = {
    id: number;
    asset_tag: string;
    name: string;
    serial: string;
    notes: string;
    model: string;
    model_number: string;
    category: string;
    manufacturer: string;
    status: string;
    status_type: string;
    image_url: string;
    image_proxy_path: string;
    qr_proxy_path: string;
    asset_url: string;
    assigned_to: string;
    location: string;
    last_checkout: string;
    updated_at: string;
};


export type ToolInput = {
    asset_tag: string;
    name: string;
    serial: string;
    notes?: string;
};


export type ToolCheckoutInput = {
    location_id: number;
    status_id: number;
    note: string;
};


export type StatusLabel = {
    id: number;
    name: string;
    type: string;
    deployable: boolean;
    pending: boolean;
    archived: boolean;
};


export type SnipeLocation = {
    id: number;
    name: string;
    address: string;
    address2: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
    manager: string;
    parent: string;
    active: boolean;
    assets_count: number;
    updated_at: string;
};


export type SnipeLocationInput = {
    name: string;
    address: string;
    address2: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
};


export type ToolsResponse = {
    total: number;
    rows: ToolAsset[];
};


export type LocationsResponse = {
    total: number;
    rows: SnipeLocation[];
};


export type StatusLabelsResponse = {
    total: number;
    rows: StatusLabel[];
};


export type ToolScope = "all" | "available" | "deployed";
export type LocationSort =
    "name" |
    "address" |
    "city" |
    "state" |
    "country" |
    "active" |
    "assets_count" |
    "updated_at";
export type LocationSortOrder = "asc" | "desc";
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


export type LocationsRequest = {
    search?: string;
    limit?: number;
    offset?: number;
    sort?: LocationSort;
    order?: LocationSortOrder;
    minTools?: number | null;
    maxTools?: number | null;
};


async function parseResponse(response: Response) {

    if (!response.ok) {
        let message = "Request failed";

        try {
            const payload = await response.json();
            const detail = payload.detail || payload.message || payload.messages;

            if (typeof detail === "string")
                message = detail;
            else if (detail)
                message = JSON.stringify(detail);
        } catch {
            message = await response.text();
        }

        throw new Error(message || "Request failed");
    }

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


export function updateTool(
    toolId: number,
    tool: ToolInput
): Promise<ToolAsset> {

    return fetch(
        API_URL + "/tools/" + toolId,
        {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(tool)
        }
    )

    .then(parseResponse);

}


export function checkoutTool(
    toolId: number,
    checkout: ToolCheckoutInput
): Promise<ToolAsset> {

    return fetch(
        API_URL + "/tools/" + toolId + "/checkout",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(checkout)
        }
    )

    .then(parseResponse);

}


export function fetchStatusLabels(): Promise<StatusLabelsResponse> {

    return fetch(
        API_URL + "/status-labels?limit=10000"
    )

    .then(parseResponse);

}


export function fetchLocations(
    request: LocationsRequest = {}
): Promise<LocationsResponse> {

    const limit =
        request.limit || 20;
    const offset =
        request.offset || 0;
    const search =
        request.search || "";
    const sort =
        request.sort || "name";
    const order =
        request.order || "asc";
    const minTools =
        request.minTools;
    const maxTools =
        request.maxTools;

    const params = new URLSearchParams(
        {
            limit: String(limit),
            offset: String(offset),
            sort,
            order
        }
    );

    if (search.trim())
        params.set(
            "search",
            search.trim()
        );

    if (minTools !== null && minTools !== undefined)
        params.set(
            "min_tools",
            String(minTools)
        );

    if (maxTools !== null && maxTools !== undefined)
        params.set(
            "max_tools",
            String(maxTools)
        );

    return fetch(
        API_URL +
        "/locations?" +
        params.toString()
    )

    .then(parseResponse);

}


export function fetchLocationTools(
    locationId: number,
    request: ToolsRequest = {}
): Promise<ToolsResponse> {

    const limit =
        request.limit || 100;
    const offset =
        request.offset || 0;
    const search =
        request.search || "";
    const sort =
        request.sort || "asset_tag";
    const order =
        request.order || "asc";

    const params = new URLSearchParams(
        {
            limit: String(limit),
            offset: String(offset),
            sort,
            order
        }
    );

    if (search.trim())
        params.set(
            "search",
            search.trim()
        );

    return fetch(
        API_URL +
        "/locations/" +
        locationId +
        "/tools?" +
        params.toString()
    )

    .then(parseResponse);

}


export function createLocation(
    location: SnipeLocationInput
): Promise<SnipeLocation> {

    return fetch(
        API_URL + "/locations",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(location)
        }
    )

    .then(parseResponse);

}


export function updateLocation(
    locationId: number,
    location: SnipeLocationInput
): Promise<SnipeLocation> {

    return fetch(
        API_URL + "/locations/" + locationId,
        {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(location)
        }
    )

    .then(parseResponse);

}
