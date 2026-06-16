import {
    useCallback,
    useEffect,
    useMemo,
    useState
} from "react";
import type { ChangeEvent } from "react";

import {
    createProduct,
    disableProduct,
    fetchProduct,
    fetchProductPage,
    fetchProductTypes,
    fetchUnits,
    updateProduct,
    updateProductsBulk
} from "../utils/productsApi";
import type {
    Product,
    ProductBulkUpdateInput,
    ProductCoverageOption,
    ProductInput,
    ProductType,
    Unit
} from "../utils/productsApi";

import "../styles/products.css";


type ProductMenuKey = "Tous" | "Mapei" | "Prosol" | "Schluter" | "Tuile" | "Centura" | "Olympia";
type PageSize = 10 | 20 | 50 | "all";
type BulkFieldKey = keyof Omit<ProductBulkUpdateInput, "product_ids">;


type ProductsPageProps = {
    productMenu: ProductMenuKey;
};


const EMPTY_FORM: ProductInput = {
    product_type_id: 0,
    name: "",
    manufacturer_name: "",
    collection_name: "",
    color_name: "",
    finish_name: "",
    size_name: "",
    default_unit_id: null,
    default_grout_color: "",
    prosol_product_id: null,
    prosol_uuid: null,
    prosol_sku: null,
    manufacturer_sku: null,
    category_name: null,
    image_url: null,
    source_url: null,
    default_purchase_price: null,
    msrp_price: null,
    supplier_name: "",
    supplier_product_code: "",
    technical_documents: [],
    coverage_options: [],
    active: true
};


const EMPTY_BULK_FORM: Record<BulkFieldKey, string> = {
    product_type_id: "",
    manufacturer_name: "",
    category_name: "",
    default_unit_id: "",
    default_purchase_price: "",
    msrp_price: "",
    supplier_name: "",
    supplier_product_code: "",
    active: "true"
};


function textValue(
    value: string | null
) {

    const trimmedValue =
        String(value || "").trim();

    if (!trimmedValue)
        return null;

    return trimmedValue;

}


function numberValue(
    value: string | number | null
) {

    if (value === null)
        return null;

    const normalizedValue =
        String(value).replace(",", ".").trim();

    if (!normalizedValue)
        return null;

    const parsedValue =
        Number(normalizedValue);

    if (Number.isNaN(parsedValue))
        return null;

    return parsedValue;

}


function moneyValue(
    value: number | null
) {

    if (value === null)
        return "";

    return value.toLocaleString(
        "fr-CA",
        {
            style: "currency",
            currency: "CAD"
        }
    );

}


function dateValue(
    value: string | null
) {

    if (!value)
        return "";

    return new Date(value).toLocaleDateString("fr-CA");

}


function toForm(
    product: Product
): ProductInput {

    return {
        product_type_id:
            product.product_type_id,
        name:
            product.name || "",
        manufacturer_name:
            product.manufacturer_name || "",
        collection_name:
            product.collection_name || "",
        color_name:
            product.color_name || "",
        finish_name:
            product.finish_name || "",
        size_name:
            product.size_name || "",
        default_unit_id:
            product.default_unit_id,
        default_grout_color:
            product.default_grout_color || "",
        prosol_product_id:
            product.prosol_product_id,
        prosol_uuid:
            product.prosol_uuid,
        prosol_sku:
            product.prosol_sku,
        manufacturer_sku:
            product.manufacturer_sku,
        category_name:
            product.category_name,
        image_url:
            product.image_url,
        source_url:
            product.source_url,
        default_purchase_price:
            product.default_purchase_price,
        msrp_price:
            product.msrp_price,
        supplier_name:
            product.supplier_names || "",
        supplier_product_code:
            product.supplier_product_code || "",
        technical_documents:
            product.technical_documents || [],
        coverage_options:
            product.coverage_options || [],
        active:
            product.active
    };

}


function coverageNumberValue(
    value: string | number | null
) {

    return numberValue(value);

}


function normalizeForm(
    form: ProductInput
): ProductInput {

    return {
        product_type_id:
            form.product_type_id,
        name:
            String(form.name || "").trim(),
        manufacturer_name:
            textValue(form.manufacturer_name),
        collection_name:
            textValue(form.collection_name),
        color_name:
            textValue(form.color_name),
        finish_name:
            textValue(form.finish_name),
        size_name:
            textValue(form.size_name),
        default_unit_id:
            form.default_unit_id,
        default_grout_color:
            textValue(form.default_grout_color),
        prosol_product_id:
            form.prosol_product_id,
        prosol_uuid:
            textValue(form.prosol_uuid),
        prosol_sku:
            textValue(form.prosol_sku),
        manufacturer_sku:
            textValue(form.manufacturer_sku),
        category_name:
            textValue(form.category_name),
        image_url:
            textValue(form.image_url),
        source_url:
            textValue(form.source_url),
        default_purchase_price:
            numberValue(form.default_purchase_price),
        msrp_price:
            numberValue(form.msrp_price),
        supplier_name:
            textValue(form.supplier_name),
        supplier_product_code:
            textValue(form.supplier_product_code),
        technical_documents:
            form.technical_documents || [],
        coverage_options:
            (form.coverage_options || [])
            .map(
                (coverageOption, index) => ({
                    ...coverageOption,
                    label:
                        textValue(coverageOption.label),
                    thickness_mm:
                        coverageOption.coverage_type === "thickness" ?
                            coverageNumberValue(coverageOption.thickness_mm) :
                            null,
                    tile_size_label:
                        coverageOption.coverage_type === "tile_size" ?
                            textValue(coverageOption.tile_size_label) :
                            null,
                    coverage_value:
                        coverageNumberValue(coverageOption.coverage_value),
                    coverage_unit:
                        String(coverageOption.coverage_unit || "").trim(),
                    sort_order:
                        index,
                    active:
                        coverageOption.active
                })
            )
            .filter(
                coverageOption =>
                    coverageOption.coverage_value !== null &&
                    coverageOption.coverage_unit
            ),
        active:
            form.active
    };

}


function emptyCoverageOption(): ProductCoverageOption {

    return {
        coverage_type: "thickness",
        label: "",
        thickness_mm: "",
        tile_size_label: "",
        coverage_value: "",
        coverage_unit: "pi2/sac",
        sort_order: 0,
        active: true
    };

}


function matchesProductMenu(
    product: Product,
    productMenu: ProductMenuKey
) {

    if (productMenu === "Tous")
        return true;

    const searchableText = [
        product.name,
        product.product_type_name,
        product.manufacturer_name,
        product.supplier_names,
        product.supplier_product_code,
        product.manufacturer_sku,
        product.prosol_sku,
        product.category_name
    ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

    if (productMenu === "Prosol")
        return Boolean(product.prosol_product_id) ||
            searchableText.includes("prosol");

    if (productMenu === "Mapei")
        return searchableText.includes("mapei");

    if (productMenu === "Schluter")
        return searchableText.includes("schluter");

    if (productMenu === "Tuile")
        return (product.product_type_name || "").toLowerCase() === "tuile";

    if (productMenu === "Centura")
        return searchableText.includes("centura") &&
            (product.product_type_name || "").toLowerCase() === "tuile";

    if (productMenu === "Olympia")
        return searchableText.includes("olympia") &&
            (product.product_type_name || "").toLowerCase() === "tuile";

    return true;

}


function ProductsPage({
    productMenu
}: ProductsPageProps) {

    const [products, setProducts] = useState<Product[]>([]);
    const [totalProductCount, setTotalProductCount] = useState(0);
    const [productTypes, setProductTypes] = useState<ProductType[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
    const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
    const [form, setForm] = useState<ProductInput>(EMPTY_FORM);
    const [bulkForm, setBulkForm] = useState<Record<BulkFieldKey, string>>(EMPTY_BULK_FORM);
    const [bulkFields, setBulkFields] = useState<Record<BulkFieldKey, boolean>>({
        product_type_id: false,
        manufacturer_name: false,
        category_name: false,
        default_unit_id: false,
        default_purchase_price: false,
        msrp_price: false,
        supplier_name: false,
        supplier_product_code: false,
        active: false
    });
    const [query, setQuery] = useState("");
    const [showInactiveProducts, setShowInactiveProducts] = useState(false);
    const [pageSize, setPageSize] = useState<PageSize>(20);
    const [currentPage, setCurrentPage] = useState(1);
    const [isEditorVisible, setIsEditorVisible] = useState(true);
    const [isCreatingProduct, setIsCreatingProduct] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [statusMessage, setStatusMessage] = useState("");


    useEffect(

        () => {

            Promise.all(
                [
                    fetchProductTypes(),
                    fetchUnits()
                ]
            )

            .then(
                ([
                    typeRows,
                    unitRows
                ]) => {

                    setProductTypes(typeRows);
                    setUnits(unitRows);

                    if (typeRows.length > 0) {
                        setForm(
                            {
                                ...EMPTY_FORM,
                                product_type_id:
                                    typeRows[0].id
                            }
                        );
                    }

                }
            )

            .catch(
                () => {

                    setStatusMessage(
                        "Impossible de charger les produits."
                    );

                }
            );

        },

        []

    );


    const filteredProducts = useMemo(

        () => {

            const normalizedQuery =
                query.trim().toLowerCase();

            return products.filter(
                product => {

                    if (
                        !matchesProductMenu(
                            product,
                            productMenu
                        )
                    )
                        return false;

                    if (!normalizedQuery)
                        return true;

                    return [
                        product.name,
                        product.product_type_name,
                        product.manufacturer_name,
                        product.supplier_names,
                        product.supplier_product_code,
                        product.manufacturer_sku,
                        product.prosol_sku,
                        product.collection_name,
                        product.color_name,
                        product.size_name,
                        product.category_name
                    ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase()
                    .includes(normalizedQuery);

                }
            );

        },

        [
            productMenu,
            products,
            query
        ]

    );


    const totalPages = useMemo(

        () => {

            if (pageSize === "all")
                return 1;

            return Math.max(
                1,
                Math.ceil(totalProductCount / pageSize)
            );

        },

        [
            totalProductCount,
            pageSize
        ]

    );


    const visiblePage =
        Math.min(
            currentPage,
            totalPages
        );


    const loadProducts = useCallback(

        () =>
            fetchProductPage(
                {
                    limit:
                        pageSize === "all" ?
                            null :
                            pageSize,
                    offset:
                        pageSize === "all" ?
                            0 :
                            (visiblePage - 1) * pageSize,
                    search:
                        query.trim(),
                    supplier:
                        "",
                    status:
                        showInactiveProducts ?
                            "all" :
                            "active",
                    productMenu
                }
            )

            .then(
                response => {

                    setProducts(response.rows);
                    setTotalProductCount(response.total);

                }
            ),

        [
            pageSize,
            productMenu,
            query,
            showInactiveProducts,
            visiblePage
        ]

    );


    useEffect(

        () => {

            loadProducts()

            .catch(
                () => {

                    setStatusMessage(
                        "Impossible de charger les produits."
                    );

                }
            );

        },

        [
            loadProducts
        ]

    );


    const paginatedProducts = useMemo(

        () => {

            return filteredProducts;

        },

        [
            filteredProducts
        ]

    );


    const selectedProduct = useMemo(

        () =>
            products.find(
                product =>
                    product.id === selectedProductId
            ) || null,

        [
            products,
            selectedProductId
        ]

    );


    function selectProduct(
        product: Product
    ) {

        setSelectedProductId(product.id);
        setSelectedProductIds([product.id]);
        setIsCreatingProduct(false);
        setIsEditorVisible(true);
        setStatusMessage("");
        setForm(
            toForm(product)
        );

        fetchProduct(product.id)

        .then(
            detailedProduct => {
                setForm(
                    toForm(detailedProduct)
                );
            }
        )

        .catch(
            () => {
                setStatusMessage(
                    "Impossible de charger les détails du produit."
                );
            }
        );

    }


    function toggleProductSelection(
        product: Product,
        event: ChangeEvent<HTMLInputElement>
    ) {

        event.stopPropagation();

        setIsCreatingProduct(false);
        setStatusMessage("");

        setSelectedProductIds(
            previousIds => {
                const nextIds = event.target.checked ?
                    Array.from(
                        new Set([
                            ...previousIds,
                            product.id
                        ])
                    ) :
                    previousIds.filter(
                        productId =>
                            productId !== product.id
                    );

                if (nextIds.length === 1) {
                    setSelectedProductId(nextIds[0]);
                    const nextProduct = products.find(
                        candidate =>
                            candidate.id === nextIds[0]
                    );

                    if (nextProduct) {
                        setForm(
                            toForm(nextProduct)
                        );
                        fetchProduct(nextProduct.id)

                        .then(
                            detailedProduct => {
                                setForm(
                                    toForm(detailedProduct)
                                );
                            }
                        )

                        .catch(
                            () => {
                                setStatusMessage(
                                    "Impossible de charger les détails du produit."
                                );
                            }
                        );
                    }
                }

                if (nextIds.length !== 1)
                    setSelectedProductId(null);

                return nextIds;
            }
        );

    }


    function startProductCreation() {

        setIsCreatingProduct(true);
        setSelectedProductId(null);
        setSelectedProductIds([]);
        setIsEditorVisible(true);
        setStatusMessage("");
        setForm(
            {
                ...EMPTY_FORM,
                product_type_id:
                    productTypes[0]?.id || 0
            }
        );

    }


    function handleTextChange(
        field: keyof ProductInput
    ) {

        return (
            event: ChangeEvent<HTMLInputElement>
        ) => {

            setForm(
                previousForm => ({
                    ...previousForm,
                    [field]:
                        event.target.value
                })
            );

        };

    }


    function handleNumberChange(
        field: "default_purchase_price" | "msrp_price"
    ) {

        return (
            event: ChangeEvent<HTMLInputElement>
        ) => {

            setForm(
                previousForm => ({
                    ...previousForm,
                    [field]:
                        event.target.value
                })
            );

        };

    }


    function handleSelectChange(
        field: "product_type_id" | "default_unit_id"
    ) {

        return (
            event: ChangeEvent<HTMLSelectElement>
        ) => {

            const value =
                event.target.value;

            setForm(
                previousForm => ({
                    ...previousForm,
                    [field]:
                        value ?
                            Number(value) :
                            null
                })
            );

        };

    }


    function handleActiveChange(
        event: ChangeEvent<HTMLInputElement>
    ) {

        setForm(
            previousForm => ({
                ...previousForm,
                active:
                    event.target.checked
            })
        );

    }


    function addCoverageOption() {

        setForm(
            previousForm => ({
                ...previousForm,
                coverage_options: [
                    ...(previousForm.coverage_options || []),
                    {
                        ...emptyCoverageOption(),
                        sort_order:
                            previousForm.coverage_options?.length || 0
                    }
                ]
            })
        );

    }


    function updateCoverageOption(
        index: number,
        field: keyof ProductCoverageOption,
        value: string
    ) {

        setForm(
            previousForm => ({
                ...previousForm,
                coverage_options:
                    (previousForm.coverage_options || []).map(
                        (coverageOption, coverageIndex) => {
                            if (coverageIndex !== index)
                                return coverageOption;

                            return {
                                ...coverageOption,
                                [field]:
                                    value
                            };
                        }
                    )
            })
        );

    }


    function removeCoverageOption(
        index: number
    ) {

        setForm(
            previousForm => ({
                ...previousForm,
                coverage_options:
                    (previousForm.coverage_options || []).filter(
                        (_coverageOption, coverageIndex) =>
                            coverageIndex !== index
                    )
            })
        );

    }


    function buildBulkPayload() {

        const payload: ProductBulkUpdateInput = {
            product_ids: selectedProductIds
        };

        if (bulkFields.product_type_id && bulkForm.product_type_id)
            payload.product_type_id = Number(bulkForm.product_type_id);

        if (bulkFields.manufacturer_name)
            payload.manufacturer_name = bulkForm.manufacturer_name.trim();

        if (bulkFields.category_name)
            payload.category_name = bulkForm.category_name.trim();

        if (bulkFields.default_unit_id && bulkForm.default_unit_id)
            payload.default_unit_id = Number(bulkForm.default_unit_id);

        if (
            bulkFields.default_purchase_price &&
            bulkForm.default_purchase_price
        )
            payload.default_purchase_price = Number(
                bulkForm.default_purchase_price
            );

        if (bulkFields.msrp_price && bulkForm.msrp_price)
            payload.msrp_price = Number(bulkForm.msrp_price);

        if (bulkFields.supplier_name)
            payload.supplier_name = bulkForm.supplier_name.trim();

        if (bulkFields.supplier_product_code)
            payload.supplier_product_code = bulkForm.supplier_product_code.trim();

        if (bulkFields.active)
            payload.active = bulkForm.active === "true";

        return payload;

    }


    function saveBulkProducts() {

        if (selectedProductIds.length < 2)
            return;

        const payload =
            buildBulkPayload();

        if (Object.keys(payload).length <= 1) {
            setStatusMessage(
                "Choisir au moins une propriété à modifier."
            );
            return;
        }

        setIsSaving(true);
        setStatusMessage("");

        updateProductsBulk(payload)

        .then(
            response => {
                setStatusMessage(
                    response.updated +
                    " produits mis à jour."
                );

                return loadProducts();
            }
        )

        .catch(
            () => {
                setStatusMessage(
                    "Mise à jour groupée impossible."
                );
            }
        )

        .finally(
            () => {
                setIsSaving(false);
            }
        );

    }


    function updateBulkField(
        field: BulkFieldKey,
        value: string
    ) {

        setBulkForm(
            previousForm => ({
                ...previousForm,
                [field]:
                    value
            })
        );

    }


    function toggleBulkField(
        field: BulkFieldKey,
        enabled: boolean
    ) {

        setBulkFields(
            previousFields => ({
                ...previousFields,
                [field]:
                    enabled
            })
        );

    }


    function saveProduct() {

        const payload =
            normalizeForm(form);

        if (
            !payload.name ||
            !payload.product_type_id
        ) {
            setStatusMessage(
                "Nom et type requis."
            );
            return;
        }

        setIsSaving(true);
        setStatusMessage("");

        const request =
            selectedProductId ?
                updateProduct(
                    selectedProductId,
                    payload
                ) :
                createProduct(
                    payload
                );

        request

        .then(
            result => {

                setStatusMessage(
                    "Produit enregistré."
                );

                if (
                    result.id &&
                    !selectedProductId
                ) {
                    setSelectedProductId(
                        result.id
                    );
                    setSelectedProductIds([result.id]);
                }
                setIsCreatingProduct(false);

                return loadProducts();

            }
        )

        .catch(
            () => {

                setStatusMessage(
                    "Enregistrement impossible."
                );

            }
        )

        .finally(
            () => {

                setIsSaving(false);

            }
        );

    }


    function cancelProductEdit() {

        setStatusMessage("");

        if (isCreatingProduct) {
            setIsCreatingProduct(false);
            setForm(
                {
                    ...EMPTY_FORM,
                    product_type_id:
                        productTypes[0]?.id || 0
                }
            );
            return;
        }

        if (selectedProduct) {
            setForm(
                toForm(selectedProduct)
            );
            return;
        }

        setForm(
            {
                ...EMPTY_FORM,
                product_type_id:
                    productTypes[0]?.id || 0
            }
        );

    }


    function deactivateProduct() {

        if (!selectedProductId)
            return;

        setIsSaving(true);
        setStatusMessage("");

        disableProduct(
            selectedProductId
        )

        .then(
            () => {

                setStatusMessage(
                    "Produit désactivé."
                );

                setForm(
                    previousForm => ({
                        ...previousForm,
                        active: false
                    })
                );

                return loadProducts();

            }
        )

        .catch(
            () => {

                setStatusMessage(
                    "Désactivation impossible."
                );

            }
        )

        .finally(
            () => {

                setIsSaving(false);

            }
        );

    }


    return (

        <section
            className={
                [
                    "products-page",
                    isEditorVisible ? "" : "editor-hidden",
                    isCreatingProduct ? "creating-product" : ""
                ]
                .filter(Boolean)
                .join(" ")
            }
        >

            <div className="products-list-panel">

                <div className="products-toolbar">

                    <input
                        type="search"
                        value={query}
                        onChange={
                            event => {
                                setCurrentPage(1);
                                setQuery(event.target.value);
                            }
                        }
                        placeholder="Rechercher"
                    />

                    <label className="inactive-products-toggle">
                        <input
                            type="checkbox"
                            checked={showInactiveProducts}
                            onChange={
                                event => {
                                    setCurrentPage(1);
                                    setShowInactiveProducts(event.target.checked);
                                }
                            }
                        />
                        Inactifs
                    </label>

                    <button
                        type="button"
                        className="editor-toggle"
                        onClick={startProductCreation}
                    >
                        Nouveau
                    </button>

                    <button
                        type="button"
                        className="editor-toggle"
                        onClick={
                            () =>
                                setIsEditorVisible(
                                    previousValue =>
                                        !previousValue
                                )
                        }
                    >
                        {isEditorVisible ? "Cacher" : "Afficher"}
                    </button>

                </div>

                <div className="products-table-wrap">

                    <table className="products-table">
                        <thead>
                            <tr>
                                <th className="selection-column"></th>
                                <th>Produit</th>
                                <th>Type</th>
                                <th>Manufacturier</th>
                                <th>Fournisseur</th>
                                <th>Code fournisseur</th>
                                <th>Code fabricant</th>
                                <th>Format</th>
                                <th>Prix</th>
                                <th>MSRP</th>
                                <th>Maj prix</th>
                                <th>Unité</th>
                                <th>État</th>
                            </tr>
                        </thead>

                        <tbody>
                            {paginatedProducts.map(
                                product => (
                                    <tr
                                        key={product.id}
                                        className={
                                            selectedProductIds.includes(product.id) ?
                                                "selected" :
                                                ""
                                        }
                                        onClick={
                                            () =>
                                                selectProduct(product)
                                        }
                                    >
                                        <td className="selection-column">
                                            <input
                                                type="checkbox"
                                                checked={
                                                    selectedProductIds.includes(product.id)
                                                }
                                                onChange={
                                                    event =>
                                                        toggleProductSelection(
                                                            product,
                                                            event
                                                        )
                                                }
                                                onClick={
                                                    event =>
                                                        event.stopPropagation()
                                                }
                                            />
                                        </td>
                                        <td>{product.name}</td>
                                        <td>{product.product_type_name || ""}</td>
                                        <td>{product.manufacturer_name || ""}</td>
                                        <td>{product.supplier_names || ""}</td>
                                        <td>{product.supplier_product_code || ""}</td>
                                        <td>{product.manufacturer_sku || product.prosol_sku || ""}</td>
                                        <td>{product.size_name || ""}</td>
                                        <td>{moneyValue(product.default_purchase_price)}</td>
                                        <td>{moneyValue(product.msrp_price)}</td>
                                        <td>{dateValue(product.price_updated_at)}</td>
                                        <td>{product.default_unit_symbol || ""}</td>
                                        <td>
                                            <span
                                                className={
                                                    product.active ?
                                                        "status-pill active" :
                                                        "status-pill inactive"
                                                }
                                            >
                                                {product.active ? "Actif" : "Inactif"}
                                            </span>
                                        </td>
                                    </tr>
                                )
                            )}
                        </tbody>
                    </table>

                </div>

                <div className="products-pagination">
                    <span>
                        {totalProductCount ?
                            (
                                (visiblePage - 1) *
                                (
                                    pageSize === "all" ?
                                        totalProductCount :
                                        pageSize
                                ) +
                                1
                            ) :
                            0}
                        -
                        {pageSize === "all" ?
                            totalProductCount :
                            Math.min(
                                visiblePage * pageSize,
                                totalProductCount
                            )}
                        {" / "}
                        {totalProductCount}
                    </span>

                    <select
                        value={String(pageSize)}
                        onChange={
                            event => {
                                setCurrentPage(1);
                                setPageSize(
                                    event.target.value === "all" ?
                                        "all" :
                                        Number(event.target.value) as PageSize
                                );
                            }
                        }
                    >
                        <option value="10">10</option>
                        <option value="20">20</option>
                        <option value="50">50</option>
                        <option value="all">Tous</option>
                    </select>

                    <button
                        type="button"
                        onClick={
                            () =>
                                setCurrentPage(
                                    previousPage =>
                                        Math.max(
                                            1,
                                            previousPage - 1
                                        )
                                )
                        }
                        disabled={
                            pageSize === "all" ||
                            visiblePage <= 1
                        }
                    >
                        Précédent
                    </button>

                    <span>
                        Page {visiblePage} / {totalPages}
                    </span>

                    <button
                        type="button"
                        onClick={
                            () =>
                                setCurrentPage(
                                    previousPage =>
                                        Math.min(
                                            totalPages,
                                            previousPage + 1
                                        )
                                )
                        }
                        disabled={
                            pageSize === "all" ||
                            visiblePage >= totalPages
                        }
                    >
                        Suivant
                    </button>
                </div>

                {statusMessage && (
                    <p className="products-status">
                        {statusMessage}
                    </p>
                )}

            </div>

            {isEditorVisible && selectedProductIds.length > 1 && !isCreatingProduct && (
                <aside className="product-editor bulk-editor">

                <div className="editor-header">
                    <h2>Modifier groupe</h2>
                    <span>{selectedProductIds.length} produits</span>
                </div>

                <div className="bulk-editor-grid">
                    <label>
                        <span>
                            <input
                                type="checkbox"
                                checked={bulkFields.product_type_id}
                                onChange={
                                    event =>
                                        toggleBulkField(
                                            "product_type_id",
                                            event.target.checked
                                        )
                                }
                            />
                            Type
                        </span>
                        <select
                            value={bulkForm.product_type_id}
                            onChange={
                                event =>
                                    updateBulkField(
                                        "product_type_id",
                                        event.target.value
                                    )
                            }
                            disabled={!bulkFields.product_type_id}
                        >
                            <option value="">Choisir</option>
                            {productTypes.map(
                                productType => (
                                    <option
                                        key={productType.id}
                                        value={productType.id}
                                    >
                                        {productType.name}
                                    </option>
                                )
                            )}
                        </select>
                    </label>

                    <label>
                        <span>
                            <input
                                type="checkbox"
                                checked={bulkFields.manufacturer_name}
                                onChange={
                                    event =>
                                        toggleBulkField(
                                            "manufacturer_name",
                                            event.target.checked
                                        )
                                }
                            />
                            Manufacturier
                        </span>
                        <input
                            type="text"
                            value={bulkForm.manufacturer_name}
                            onChange={
                                event =>
                                    updateBulkField(
                                        "manufacturer_name",
                                        event.target.value
                                    )
                            }
                            disabled={!bulkFields.manufacturer_name}
                        />
                    </label>

                    <label>
                        <span>
                            <input
                                type="checkbox"
                                checked={bulkFields.category_name}
                                onChange={
                                    event =>
                                        toggleBulkField(
                                            "category_name",
                                            event.target.checked
                                        )
                                }
                            />
                            Catégorie
                        </span>
                        <input
                            type="text"
                            value={bulkForm.category_name}
                            onChange={
                                event =>
                                    updateBulkField(
                                        "category_name",
                                        event.target.value
                                    )
                            }
                            disabled={!bulkFields.category_name}
                        />
                    </label>

                    <label>
                        <span>
                            <input
                                type="checkbox"
                                checked={bulkFields.default_unit_id}
                                onChange={
                                    event =>
                                        toggleBulkField(
                                            "default_unit_id",
                                            event.target.checked
                                        )
                                }
                            />
                            Unité
                        </span>
                        <select
                            value={bulkForm.default_unit_id}
                            onChange={
                                event =>
                                    updateBulkField(
                                        "default_unit_id",
                                        event.target.value
                                    )
                            }
                            disabled={!bulkFields.default_unit_id}
                        >
                            <option value="">Choisir</option>
                            {units.map(
                                unit => (
                                    <option
                                        key={unit.id}
                                        value={unit.id}
                                    >
                                        {unit.name} ({unit.symbol})
                                    </option>
                                )
                            )}
                        </select>
                    </label>

                    <label>
                        <span>
                            <input
                                type="checkbox"
                                checked={bulkFields.default_purchase_price}
                                onChange={
                                    event =>
                                        toggleBulkField(
                                            "default_purchase_price",
                                            event.target.checked
                                        )
                                }
                            />
                            Prix achat
                        </span>
                        <input
                            type="number"
                            step="0.01"
                            value={bulkForm.default_purchase_price}
                            onChange={
                                event =>
                                    updateBulkField(
                                        "default_purchase_price",
                                        event.target.value
                                    )
                            }
                            disabled={!bulkFields.default_purchase_price}
                        />
                    </label>

                    <label>
                        <span>
                            <input
                                type="checkbox"
                                checked={bulkFields.msrp_price}
                                onChange={
                                    event =>
                                        toggleBulkField(
                                            "msrp_price",
                                            event.target.checked
                                        )
                                }
                            />
                            MSRP
                        </span>
                        <input
                            type="number"
                            step="0.01"
                            value={bulkForm.msrp_price}
                            onChange={
                                event =>
                                    updateBulkField(
                                        "msrp_price",
                                        event.target.value
                                    )
                            }
                            disabled={!bulkFields.msrp_price}
                        />
                    </label>

                    <label>
                        <span>
                            <input
                                type="checkbox"
                                checked={bulkFields.active}
                                onChange={
                                    event =>
                                        toggleBulkField(
                                            "active",
                                            event.target.checked
                                        )
                                }
                            />
                            État
                        </span>
                        <select
                            value={bulkForm.active}
                            onChange={
                                event =>
                                    updateBulkField(
                                        "active",
                                        event.target.value
                                    )
                            }
                            disabled={!bulkFields.active}
                        >
                            <option value="true">Actif</option>
                            <option value="false">Inactif</option>
                        </select>
                    </label>
                </div>

                <div className="editor-actions">
                    <button
                        type="button"
                        className="primary-action"
                        onClick={saveBulkProducts}
                        disabled={isSaving}
                    >
                        Sauvegarder
                    </button>

                    <button
                        type="button"
                        onClick={
                            () => {
                                setSelectedProductIds([]);
                                setSelectedProductId(null);
                            }
                        }
                        disabled={isSaving}
                    >
                        Annuler
                    </button>
                </div>

                {statusMessage && (
                    <p className="editor-status">
                        {statusMessage}
                    </p>
                )}

                </aside>
            )}

            {isEditorVisible && (isCreatingProduct || selectedProductId !== null) && (
                <aside className="product-editor">

                <div className="editor-header">
                    <h2>
                        {selectedProduct ? "Modifier produit" : "Nouveau produit"}
                    </h2>
                    <span>{totalProductCount} produits</span>
                </div>

                <div className="editor-grid">

                    <label>
                        Nom
                        <input
                            type="text"
                            value={form.name}
                            onChange={handleTextChange("name")}
                        />
                    </label>

                    <label>
                        Type
                        <select
                            value={form.product_type_id || ""}
                            onChange={handleSelectChange("product_type_id")}
                        >
                            {productTypes.map(
                                productType => (
                                    <option
                                        key={productType.id}
                                        value={productType.id}
                                    >
                                        {productType.name}
                                    </option>
                                )
                            )}
                        </select>
                    </label>

                    <label>
                        Fournisseur
                        <input
                            type="text"
                            value={form.supplier_name || ""}
                            onChange={handleTextChange("supplier_name")}
                        />
                    </label>

                    <label>
                        Code fournisseur
                        <input
                            type="text"
                            value={form.supplier_product_code || ""}
                            onChange={handleTextChange("supplier_product_code")}
                        />
                    </label>

                    <label>
                        Code fabricant
                        <input
                            type="text"
                            value={form.manufacturer_sku || ""}
                            onChange={handleTextChange("manufacturer_sku")}
                        />
                    </label>

                    <label>
                        SKU Prosol
                        <input
                            type="text"
                            value={form.prosol_sku || ""}
                            onChange={handleTextChange("prosol_sku")}
                        />
                    </label>

                    <label>
                        Manufacturier
                        <input
                            type="text"
                            value={form.manufacturer_name || ""}
                            onChange={handleTextChange("manufacturer_name")}
                        />
                    </label>

                    <label>
                        Collection
                        <input
                            type="text"
                            value={form.collection_name || ""}
                            onChange={handleTextChange("collection_name")}
                        />
                    </label>

                    <label>
                        Couleur
                        <input
                            type="text"
                            value={form.color_name || ""}
                            onChange={handleTextChange("color_name")}
                        />
                    </label>

                    <label>
                        Fini
                        <input
                            type="text"
                            value={form.finish_name || ""}
                            onChange={handleTextChange("finish_name")}
                        />
                    </label>

                    <label>
                        Format
                        <input
                            type="text"
                            value={form.size_name || ""}
                            onChange={handleTextChange("size_name")}
                        />
                    </label>

                    <label>
                        Catégorie
                        <input
                            type="text"
                            value={form.category_name || ""}
                            onChange={handleTextChange("category_name")}
                        />
                    </label>

                    <label>
                        Prix achat
                        <input
                            type="number"
                            step="0.01"
                            value={form.default_purchase_price ?? ""}
                            onChange={handleNumberChange("default_purchase_price")}
                        />
                    </label>

                    <label>
                        MSRP
                        <input
                            type="number"
                            step="0.01"
                            value={form.msrp_price ?? ""}
                            onChange={handleNumberChange("msrp_price")}
                        />
                    </label>

                    <label>
                        Unité
                        <select
                            value={form.default_unit_id || ""}
                            onChange={handleSelectChange("default_unit_id")}
                        >
                            <option value="">Aucune</option>
                            {units.map(
                                unit => (
                                    <option
                                        key={unit.id}
                                        value={unit.id}
                                    >
                                        {unit.name} ({unit.symbol})
                                    </option>
                                )
                            )}
                        </select>
                    </label>

                    <label>
                        Coulis par défaut
                        <input
                            type="text"
                            value={form.default_grout_color || ""}
                            onChange={handleTextChange("default_grout_color")}
                        />
                    </label>

                    <label className="active-toggle">
                        <input
                            type="checkbox"
                            checked={form.active}
                            onChange={handleActiveChange}
                        />
                        Actif
                    </label>

                </div>

                <div className="product-editor-section">
                    <div className="product-editor-section-heading">
                        <h3>Fiches techniques</h3>
                    </div>

                    {(form.technical_documents || []).length > 0 ? (
                        <div className="technical-document-list">
                            {(form.technical_documents || []).map(
                                document => (
                                    <a
                                        key={document.id}
                                        href={document.url}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        <span>{document.title}</span>
                                        <small>{document.language || document.source}</small>
                                    </a>
                                )
                            )}
                        </div>
                    ) : (
                        <p className="empty-editor-note">
                            Aucune fiche technique synchronisée.
                        </p>
                    )}
                </div>

                <div className="product-editor-section">
                    <div className="product-editor-section-heading">
                        <h3>Pouvoir couvrant</h3>
                        <button
                            type="button"
                            onClick={addCoverageOption}
                        >
                            Ajouter
                        </button>
                    </div>

                    <div className="coverage-option-list">
                        {(form.coverage_options || []).map(
                            (coverageOption, index) => (
                                <div
                                    key={index}
                                    className="coverage-option-row"
                                >
                                    <select
                                        value={coverageOption.coverage_type}
                                        onChange={
                                            event =>
                                                updateCoverageOption(
                                                    index,
                                                    "coverage_type",
                                                    event.target.value
                                                )
                                        }
                                    >
                                        <option value="thickness">Épaisseur</option>
                                        <option value="tile_size">Format tuile</option>
                                    </select>

                                    <input
                                        type="text"
                                        value={
                                            coverageOption.coverage_type === "thickness" ?
                                                coverageOption.thickness_mm ?? "" :
                                                coverageOption.tile_size_label || ""
                                        }
                                        placeholder={
                                            coverageOption.coverage_type === "thickness" ?
                                                "mm" :
                                                "ex: 12x24"
                                        }
                                        onChange={
                                            event =>
                                                updateCoverageOption(
                                                    index,
                                                    coverageOption.coverage_type === "thickness" ?
                                                        "thickness_mm" :
                                                        "tile_size_label",
                                                    event.target.value
                                                )
                                        }
                                    />

                                    <input
                                        type="number"
                                        step="0.01"
                                        value={coverageOption.coverage_value ?? ""}
                                        placeholder="Couvrant"
                                        onChange={
                                            event =>
                                                updateCoverageOption(
                                                    index,
                                                    "coverage_value",
                                                    event.target.value
                                                )
                                        }
                                    />

                                    <input
                                        type="text"
                                        value={coverageOption.coverage_unit}
                                        placeholder="Unité"
                                        onChange={
                                            event =>
                                                updateCoverageOption(
                                                    index,
                                                    "coverage_unit",
                                                    event.target.value
                                                )
                                        }
                                    />

                                    <button
                                        type="button"
                                        onClick={
                                            () =>
                                                removeCoverageOption(index)
                                        }
                                    >
                                        Retirer
                                    </button>
                                </div>
                            )
                        )}

                        {(form.coverage_options || []).length === 0 && (
                            <p className="empty-editor-note">
                                Aucune option de couverture configurée.
                            </p>
                        )}
                    </div>
                </div>

                <div className="editor-actions">

                    <button
                        type="button"
                        className="primary-action"
                        onClick={saveProduct}
                        disabled={isSaving}
                    >
                        Sauvegarder
                    </button>

                    <button
                        type="button"
                        onClick={cancelProductEdit}
                        disabled={isSaving}
                    >
                        Annuler
                    </button>

                    <button
                        type="button"
                        onClick={deactivateProduct}
                        disabled={
                            isSaving ||
                            !selectedProductId ||
                            !form.active
                        }
                    >
                        Désactiver
                    </button>

                </div>

                {statusMessage && (
                    <p className="editor-status">
                        {statusMessage}
                    </p>
                )}

                </aside>
            )}

        </section>

    );

}


export default ProductsPage;
