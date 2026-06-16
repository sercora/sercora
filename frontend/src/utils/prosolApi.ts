import { API_URL } from "./matrixApi";
import type { Product } from "./productsApi";


export type ProsolProduct = {
    id: number | null;
    uuid: string;
    name: string;
    sku: string;
    prosol_sku: string;
    supplier_product_code: string;
    manufacturer_sku: string;
    manufacturer_name: string;
    collection_name: string;
    category_name: string;
    size_name: string;
    image_url: string;
    source_url: string;
    default_purchase_price: number | null;
    msrp_price: number | null;
    price_by_measure: string;
    price_unit: string;
};


export type ProsolProductsResponse = {
    total: number;
    rows: ProsolProduct[];
};


export type ProsolPriceUpdateResponse = {
    updated: number;
    failed: number;
    errors: Array<{
        product_id: number;
        prosol_product_id: number;
        error: string;
    }>;
};


export type ProsolTechnicalSheetSyncResponse = {
    manufacturer: string;
    checked: number;
    updated: number;
    documents: number;
    failed: number;
    errors: Array<{
        product_id: number;
        name: string;
        error: string;
    }>;
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
            limit: "50"
        }
    );

    return fetch(
        API_URL +
        "/prosol/products/search?" +
        params.toString()
    )

    .then(parseResponse);

}


export function importProsolProduct(
    product: ProsolProduct
): Promise<Product> {

    return fetch(
        API_URL +
        "/prosol/products/import",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(
                {
                    prosol_product_id: product.id,
                    prosol_uuid: product.uuid || null
                }
            )
        }
    )

    .then(parseResponse);

}


export function updateProsolPrices(): Promise<ProsolPriceUpdateResponse> {

    return fetch(
        API_URL +
        "/prosol/products/update-prices",
        {
            method: "POST"
        }
    )

    .then(parseResponse);

}


export function syncProsolTechnicalSheets(
    manufacturer = "Mapei"
): Promise<ProsolTechnicalSheetSyncResponse> {

    const params = new URLSearchParams(
        {
            manufacturer
        }
    );

    return fetch(
        API_URL +
        "/prosol/products/sync-technical-sheets?" +
        params.toString(),
        {
            method: "POST"
        }
    )

    .then(parseResponse);

}
