import { API_URL } from "./matrixApi";


export type ProsolProduct = {
    id: number | null;
    uuid: string;
    name: string;
    sku: string;
    prosol_sku: string;
    supplier_product_code: string;
    manufacturer_name: string;
    collection_name: string;
    category_name: string;
    size_name: string;
    image_url: string;
    source_url: string;
};


export type ProsolProductsResponse = {
    total: number;
    rows: ProsolProduct[];
};


function parseResponse(response: Response) {

    if (!response.ok)
        throw new Error("Request failed");

    return response.json();

}


export function searchProsolProducts(
    query: string
): Promise<ProsolProductsResponse> {

    const params = new URLSearchParams(
        {
            query,
            limit: "20"
        }
    );

    return fetch(
        API_URL +
        "/prosol/products/search?" +
        params.toString()
    )

    .then(parseResponse);

}
