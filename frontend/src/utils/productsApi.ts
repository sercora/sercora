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
    prosol_product_id: number | null;
    prosol_uuid: string | null;
    prosol_sku: string | null;
    manufacturer_sku: string | null;
    category_name: string | null;
    image_url: string | null;
    source_url: string | null;
    default_purchase_price: number | null;
    msrp_price: number | null;
    price_updated_at: string | null;
    supplier_names: string | null;
    supplier_product_code: string | null;
    technical_documents?: ProductDocument[];
    coverage_options?: ProductCoverageOption[];
    active: boolean;
};


export type ProductDocument = {
    id: number;
    product_id: number;
    source: string;
    source_document_id: number | null;
    source_uuid: string | null;
    document_type: string;
    title: string;
    url: string;
    language: string | null;
    active: boolean;
    synced_at: string | null;
};


export type ProductCoverageOption = {
    id?: number;
    product_id?: number;
    coverage_type: "thickness" | "tile_size";
    label: string | null;
    thickness_mm: number | string | null;
    tile_size_label: string | null;
    coverage_value: number | string | null;
    coverage_unit: string;
    sort_order: number;
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
    prosol_product_id: number | null;
    prosol_uuid: string | null;
    prosol_sku: string | null;
    manufacturer_sku: string | null;
    category_name: string | null;
    image_url: string | null;
    source_url: string | null;
    default_purchase_price: number | string | null;
    msrp_price: number | string | null;
    supplier_name: string | null;
    supplier_product_code: string | null;
    technical_documents?: ProductDocument[];
    coverage_options: ProductCoverageOption[];
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


export type ProductListResponse = {
    total: number;
    rows: Product[];
};


export type ProductListParams = {
    limit: number | null;
    offset: number;
    search: string;
    supplier: string;
    status: "active" | "inactive" | "all";
    productMenu: "Tous" | "Mapei" | "Prosol" | "Schluter" | "Tuile" | "Centura" | "Olympia";
};


export type SupplierDiscount = {
    supplier_name: string;
    discount_percent: number | null;
    active: boolean;
};


export type SupplierDiscountInput = {
    discount_percent: number | null;
    active: boolean;
};


export type SupplierDiscountApplyResponse = {
    supplier: string;
    discount_percent: number;
    updated: number;
};


export type PriceListImportResponse = {
    rows: number;
    imported: number;
    failed: number;
    supplier: string;
    discount_percent: number | null;
};


export type ProductBulkUpdateInput = {
    product_ids: number[];
    product_type_id?: number;
    manufacturer_name?: string;
    category_name?: string;
    default_unit_id?: number;
    default_purchase_price?: number;
    msrp_price?: number;
    supplier_name?: string;
    supplier_product_code?: string;
    active?: boolean;
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


export function fetchProduct(
    productId: number
): Promise<Product> {

    return fetch(
        API_URL +
        "/products/" +
        productId
    )

    .then(parseResponse);

}


export function fetchProductPage(
    params: ProductListParams
): Promise<ProductListResponse> {

    const searchParams = new URLSearchParams(
        {
            offset: String(params.offset),
            search: params.search,
            supplier: params.supplier,
            status: params.status,
            product_menu: params.productMenu,
            paged: "1"
        }
    );

    if (params.limit !== null)
        searchParams.set(
            "limit",
            String(params.limit)
        );

    return fetch(
        API_URL +
        "/products?" +
        searchParams.toString()
    )

    .then(parseResponse);

}


export function uploadSchluterPriceList(
    file: File
): Promise<PriceListImportResponse> {

    return fetch(
        API_URL +
        "/products/schluter/price-list",
        {
            method: "POST",
            headers: {
                "Content-Type": (
                    file.type ||
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                )
            },
            body: file
        }
    )

    .then(parseResponse);

}


export function uploadCenturaPriceList(
    file: File
): Promise<PriceListImportResponse> {

    return fetch(
        API_URL +
        "/products/centura/price-list",
        {
            method: "POST",
            headers: {
                "Content-Type": (
                    file.type ||
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                )
            },
            body: file
        }
    )

    .then(parseResponse);

}


export function uploadOlympiaPriceList(
    file: File
): Promise<PriceListImportResponse> {

    return fetch(
        API_URL +
        "/products/olympia/price-list",
        {
            method: "POST",
            headers: {
                "Content-Type": (
                    file.type ||
                    "application/pdf"
                )
            },
            body: file
        }
    )

    .then(parseResponse);

}


export function fetchSupplierDiscounts(): Promise<SupplierDiscount[]> {

    return fetch(
        API_URL +
        "/supplier-discounts"
    )

    .then(parseResponse);

}


export function saveSupplierDiscount(
    supplierName: string,
    discount: SupplierDiscountInput
) {

    return fetch(
        API_URL +
        "/supplier-discounts/" +
        encodeURIComponent(supplierName),
        {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(discount)
        }
    )

    .then(parseResponse);

}


export function applySupplierDiscount(
    supplierName: string
): Promise<SupplierDiscountApplyResponse> {

    return fetch(
        API_URL +
        "/supplier-discounts/" +
        encodeURIComponent(supplierName) +
        "/apply",
        {
            method: "POST"
        }
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


export function updateProductsBulk(
    update: ProductBulkUpdateInput
): Promise<{
    updated: number;
}> {

    return fetch(
        API_URL +
        "/products/bulk",
        {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(update)
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
