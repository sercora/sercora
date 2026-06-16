export const API_URL =
    import.meta.env.VITE_API_URL ||
    "https://api.serco.pro";


export type EstimateFolderStatus = "in_progress" | "sent" | "rejected";


export type EstimateFolderItem = {
    name: string;
    relative_path: string;
    is_dir: boolean;
    size: number;
    modified_at: number;
};


export type EstimateFolderResponse = {
    status: EstimateFolderStatus;
    path: string;
    root_name: string;
    items: EstimateFolderItem[];
};


export type EstimateMatrixSummary = {
    project: {
        id: number;
        number: string | null;
        name: string;
        architect_name: string | null;
        plan_date: string | null;
        plan_pages: string | null;
        spec_sections: string | null;
        address: string;
    };
    estimate: {
        id: number;
        revision_number: number | null;
        type: string | null;
        used_hourly_rate: number | null;
        global_profit_percent: number | null;
        description: string | null;
        created_at: string | null;
        last_revision_at: string | null;
    };
    rates: {
        current: {
            date: string;
            day: number;
            evening: number;
            night: number;
            civil: number;
            tm: number;
        };
        used_hourly_rate: number | null;
        global_profit_percent: number | null;
        probable_schedule: string | null;
        probable_schedule_from: string | null;
        probable_schedule_to: string | null;
        tile_holdback_percent: number | null;
        warranty_years: number | null;
    };
    clients: Array<{
        name: string;
        type: string | null;
    }>;
    supplier_quotes: Array<{
        supplier_name: string;
        expires_on: string | null;
        quote_reference: string | null;
        notes: string | null;
    }>;
    tile_requests: Array<{
        name: string;
        manufacturer_name: string | null;
        size_name: string | null;
        supplier_names: string | null;
        supplier_product_code: string | null;
    }>;
};


export type EstimateMatrixSummaryInput = {
    used_hourly_rate: number | null;
    global_profit_percent: number | null;
    architect_name: string | null;
    plan_date: string | null;
    plan_pages: string | null;
    spec_sections: string | null;
    probable_schedule: string | null;
    probable_schedule_from: string | null;
    probable_schedule_to: string | null;
    tile_holdback_percent: number | null;
    warranty_years: number | null;
};


export type EstimateMatrixResponse = {
    summary: EstimateMatrixSummary;
    rooms: string[];
    room_columns?: EstimateRoomColumn[];
    lines: any[];
};


export type EstimateRoomColumn = {
    id: number;
    key: string;
    phase_name: string | null;
    phase_label: string | null;
    floor_name: string | null;
    floor_label: string | null;
    room_name: string;
};


export type SurfaceType = {
    id: number;
    name: string;
    category: string | null;
    sort_order: number;
    active: boolean;
};


export type EstimateRoomInput = {
    estimate_id: number;
    phase_name: string;
    phase_label?: string;
    floor_name: string;
    floor_label?: string;
    room_name: string;
};


export type EstimateRoomUpdateInput = {
    phase_name: string;
    phase_label?: string;
    floor_name: string;
    floor_label?: string;
    room_name: string;
};


export type EstimateLineInput = {
    estimate_id: number;
    product_id: number;
    surface_type_id: number;
    unit_id: number;
    insert_position?: number | null;
    plan_code?: string | null;
    grout_color: string | null;
    loss_percent: number;
    purchase_price: number;
    profit_percent: number;
    installation_cost: number;
};


export type EstimateLineProductUpdateInput = {
    product_id: number;
    surface_type_id: number;
    unit_id: number;
    grout_color: string | null;
    purchase_price: number;
    apply_matching_product: boolean;
};


export type EstimateLineUpdateInput = {
    surface_type_id: number;
    plan_code?: string | null;
    loss_percent: number;
    purchase_price: number;
    profit_percent: number;
    installation_cost: number;
    installation_link_source_line_id?: number | null;
    installation_link_multiplier?: number;
    quantity_link_source_line_ids?: number[];
    quantity_link_multiplier?: number;
    manpower_multiplier?: number;
};


function parseResponse(response: Response) {

    if (!response.ok)
        throw new Error("Request failed");

    return response.json();

}


export function estimateFileUrl(
    status: EstimateFolderStatus,
    path: string
) {

    const params = new URLSearchParams(
        {
            status,
            path
        }
    );

    return API_URL +
        "/estimate-files?" +
        params.toString();

}


export function fetchEstimateFolders(
    status: EstimateFolderStatus,
    path = ""
): Promise<EstimateFolderResponse> {

    const params = new URLSearchParams(
        {
            status,
            path
        }
    );

    return fetch(
        API_URL +
        "/estimate-folders?" +
        params.toString()
    )

    .then(parseResponse);

}


export function fetchEstimateMatrix(): Promise<EstimateMatrixResponse> {

    return fetch(
        API_URL +
        "/estimates/1/matrix"
    )

    .then(
        response => response.json()
    );

}


export function fetchSurfaceTypes(): Promise<SurfaceType[]> {

    return fetch(
        API_URL +
        "/surface-types"
    )

    .then(parseResponse);

}


export function createEstimateRoom(
    room: EstimateRoomInput
) {

    return fetch(
        API_URL +
        "/rooms",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(room)
        }
    )

    .then(parseResponse);

}


export function updateEstimateRoom(
    roomId: number,
    room: EstimateRoomUpdateInput
) {

    return fetch(
        API_URL +
        "/rooms/" +
        roomId,
        {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(room)
        }
    )

    .then(parseResponse);

}


export function deleteEstimateRoom(
    roomId: number
) {

    return fetch(
        API_URL +
        "/rooms/" +
        roomId,
        {
            method: "DELETE"
        }
    )

    .then(parseResponse);

}


export function createEstimateLine(
    line: EstimateLineInput
) {

    return fetch(
        API_URL +
        "/estimate-lines",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(line)
        }
    )

    .then(parseResponse);

}


export function deleteEstimateLine(
    lineId: number
) {

    return fetch(
        API_URL +
        "/estimate-lines/" +
        lineId,
        {
            method: "DELETE"
        }
    )

    .then(parseResponse);

}


export function updateEstimateMatrixSummary(
    estimateId: number,
    summary: EstimateMatrixSummaryInput
): Promise<{
    message: string;
    updated_lines: number;
    summary: EstimateMatrixSummary;
}> {

    return fetch(
        API_URL +
        "/estimates/" +
        estimateId +
        "/matrix-summary",
        {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(summary)
        }
    )

    .then(parseResponse);

}


export function updateEstimateQuantity(
    quantityId: any,
    quantity: number
) {

    if (!quantityId)
        return;

    return fetch(

        API_URL +
        "/estimate-quantities/" +
        quantityId,

        {

            method: "PUT",

            headers: {

                "Content-Type":
                    "application/json"

            },

            body: JSON.stringify(

                {

                    quantity:
                        quantity

                }

            )

        }

    );

}


export function updateEstimateLine(
    lineId: any,
    line: EstimateLineUpdateInput
) {

    return fetch(

        API_URL +
        "/estimate-lines/" +
        lineId,

        {

            method: "PUT",

            headers: {

                "Content-Type":
                    "application/json"

            },

            body: JSON.stringify(
                line
            )

        }

    );

}


export function updateEstimateLinePosition(
    lineId: number,
    position: number
) {

    return fetch(

        API_URL +
        "/estimate-lines/" +
        lineId +
        "/position",

        {

            method: "PUT",

            headers: {

                "Content-Type":
                    "application/json"

            },

            body: JSON.stringify(
                {
                    position
                }
            )

        }

    )

    .then(parseResponse);

}


export function updateEstimateLineProduct(
    lineId: number,
    update: EstimateLineProductUpdateInput
): Promise<{
    id: number;
    updated_lines: number;
    message: string;
}> {

    return fetch(

        API_URL +
        "/estimate-lines/" +
        lineId +
        "/product",

        {

            method: "PUT",

            headers: {

                "Content-Type":
                    "application/json"

            },

            body: JSON.stringify(
                update
            )

        }

    )

    .then(parseResponse);

}
