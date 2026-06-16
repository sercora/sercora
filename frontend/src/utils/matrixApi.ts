export const API_URL =
    import.meta.env.VITE_API_URL ||
    "https://api.serco.pro";


export type EstimateFolderStatus = "in_progress" | "sent";


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


export function fetchEstimateMatrix() {

    return fetch(
        API_URL +
        "/estimates/1/matrix"
    )

    .then(
        response => response.json()
    );

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
    line: {
        loss_percent: number;
        purchase_price: number;
        profit_percent: number;
        installation_cost: number;
    }
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
