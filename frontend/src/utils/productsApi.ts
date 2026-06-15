import { API_URL } from "./matrixApi";


export type Product = {
    id: number;
    product_type_id: number;
    product_type_name: string | null;
    name: string;
    manufacturer_name: string | null;
    collection_name: string | null;
    color_name: string | null;
    finish_name: string | null;
    size_name: string | null;
    default_unit_id: number | null;
    default_unit_name: string | null;
    default_unit_symbol: string | null;
    default_grout_color: string | null;
    active: boolean;
};


export type ProductInput = {
    product_type_id: number;
    name: string;
    manufacturer_name: string | null;
    collection_name: string | null;
    color_name: string | null;
    finish_name: string | null;
    size_name: string | null;
    default_unit_id: number | null;
    default_grout_color: string | null;
    active: boolean;
};


export type ProductType = {
    id: number;
    name: string;
    active: boolean;
};


export type Unit = {
    id: number;
    name: string;
    symbol: string;
};


function parseResponse(response: Response) {

    if (!response.ok)
        throw new Error("Request failed");

    return response.json();

}


export function fetchProducts(): Promise<Product[]> {

    return fetch(
        API_URL +
        "/products"
    )

    .then(parseResponse);

}


export function fetchProductTypes(): Promise<ProductType[]> {

    return fetch(
        API_URL +
        "/product-types"
    )

    .then(parseResponse);

}


export function fetchUnits(): Promise<Unit[]> {

    return fetch(
        API_URL +
        "/units"
    )

    .then(parseResponse);

}


export function createProduct(
    product: ProductInput
) {

    return fetch(
        API_URL +
        "/products",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(product)
        }
    )

    .then(parseResponse);

}


export function updateProduct(
    productId: number,
    product: ProductInput
) {

    return fetch(
        API_URL +
        "/products/" +
        productId,
        {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(product)
        }
    )

    .then(parseResponse);

}


export function disableProduct(
    productId: number
) {

    return fetch(
        API_URL +
        "/products/" +
        productId,
        {
            method: "DELETE"
        }
    )

    .then(parseResponse);

}
