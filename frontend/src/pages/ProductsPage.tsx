import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";
import type { ChangeEvent } from "react";

import {
    applySupplierDiscount,
    createProduct,
    disableProduct,
    fetchProductPage,
    fetchSupplierDiscounts,
    fetchProductTypes,
    fetchUnits,
    saveSupplierDiscount,
    updateProduct,
    uploadOlympiaPriceList,
    uploadSchluterPriceList
} from "../utils/productsApi";
import type {
    Product,
    ProductInput,
    SupplierDiscount,
    ProductType,
    Unit
} from "../utils/productsApi";
import {
    updateProsolPrices
} from "../utils/prosolApi";

import "../styles/products.css";


type ProductMenuKey = "Tous" | "Mapei" | "Prosol" | "Schluter" | "Tuile" | "Centura" | "Olympia";
type PageSize = 10 | 20 | 50 | "all";


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
    active: true
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
        active:
            product.active
    };

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
        active:
            form.active
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
    const [supplierDiscounts, setSupplierDiscounts] = useState<SupplierDiscount[]>([]);
    const [discountInputs, setDiscountInputs] = useState<Record<string, string>>({});
    const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
    const [form, setForm] = useState<ProductInput>(EMPTY_FORM);
    const [query, setQuery] = useState("");
    const [supplierFilter, setSupplierFilter] = useState("");
    const [showInactiveProducts, setShowInactiveProducts] = useState(false);
    const [pageSize, setPageSize] = useState<PageSize>(20);
    const [currentPage, setCurrentPage] = useState(1);
    const [isEditorVisible, setIsEditorVisible] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isUpdatingProsolPrices, setIsUpdatingProsolPrices] = useState(false);
    const [isUploadingSchluter, setIsUploadingSchluter] = useState(false);
    const [isUploadingOlympia, setIsUploadingOlympia] = useState(false);
    const [isSavingDiscount, setIsSavingDiscount] = useState(false);
    const [isApplyingDiscount, setIsApplyingDiscount] = useState(false);
    const [statusMessage, setStatusMessage] = useState("");
    const schluterFileInputRef = useRef<HTMLInputElement | null>(null);
    const olympiaFileInputRef = useRef<HTMLInputElement | null>(null);


    useEffect(

        () => {

            Promise.all(
                [
                    fetchProductTypes(),
                    fetchUnits(),
                    fetchSupplierDiscounts()
                ]
            )

            .then(
                ([
                    typeRows,
                    unitRows,
                    discountRows
                ]) => {

                    setProductTypes(typeRows);
                    setUnits(unitRows);
                    setSupplierDiscounts(discountRows);

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


    const discountSupplierName = useMemo(
        () => {
            if (
                productMenu === "Schluter" ||
                productMenu === "Centura" ||
                productMenu === "Olympia"
            )
                return productMenu;

            return null;
        },
        [
            productMenu
        ]
    );


    const activeSupplierDiscount = useMemo(
        () => supplierDiscounts.find(
            supplierDiscount =>
                supplierDiscount.supplier_name === discountSupplierName
        ) || null,
        [
            discountSupplierName,
            supplierDiscounts
        ]
    );


    const discountInput = useMemo(
        () => {
            if (!discountSupplierName)
                return "";

            if (discountInputs[discountSupplierName] !== undefined)
                return discountInputs[discountSupplierName];

            if (
                activeSupplierDiscount?.discount_percent === null ||
                activeSupplierDiscount?.discount_percent === undefined
            )
                return "";

            return String(activeSupplierDiscount.discount_percent);
        },
        [
            activeSupplierDiscount,
            discountInputs,
            discountSupplierName
        ]
    );


    const filteredProducts = useMemo(

        () => {

            const normalizedQuery =
                query.trim().toLowerCase();
            const normalizedSupplier =
                supplierFilter.trim().toLowerCase();

            return products.filter(
                product => {

                    if (
                        !matchesProductMenu(
                            product,
                            productMenu
                        )
                    )
                        return false;

                    if (
                        normalizedSupplier &&
                        ![
                            product.supplier_names,
                            product.manufacturer_name
                        ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase()
                        .includes(normalizedSupplier)
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
            query,
            supplierFilter
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
                        supplierFilter.trim(),
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
            supplierFilter,
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


    const supplierOptions = useMemo(

        () => {

            const supplierNames = new Set<string>();

            products.forEach(
                product => {

                    [
                        product.supplier_names,
                        product.manufacturer_name
                    ]
                    .filter(Boolean)
                    .join(",")
                    .split(",")
                    .map(
                        supplier =>
                            supplier.trim()
                    )
                    .filter(Boolean)
                    .forEach(
                        supplier =>
                            supplierNames.add(supplier)
                    );

                }
            );

            return Array.from(supplierNames)
            .sort(
                (left, right) =>
                    left.localeCompare(right)
            );

        },

        [
            products
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
        setIsEditorVisible(true);
        setStatusMessage("");
        setForm(
            toForm(product)
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
                }

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


    function refreshProsolPrices() {

        setIsUpdatingProsolPrices(true);
        setStatusMessage("");

        updateProsolPrices()

        .then(
            response => {

                setStatusMessage(
                    "Prix Prosol mis à jour: " +
                    response.updated +
                    (
                        response.failed ?
                            " / erreurs: " + response.failed :
                            ""
                    )
                );

                return loadProducts();

            }
        )

        .catch(
            () => {

                setStatusMessage(
                    "Mise à jour des prix Prosol impossible."
                );

            }
        )

        .finally(
            () => {

                setIsUpdatingProsolPrices(false);

            }
        );

    }


    function saveDiscount() {

        if (!discountSupplierName)
            return;

        const normalizedDiscount =
            discountInput.trim().replace(",", ".");
        const discountPercent =
            normalizedDiscount ?
                Number(normalizedDiscount) :
                null;

        if (
            discountPercent !== null &&
            (
                Number.isNaN(discountPercent) ||
                discountPercent < 0 ||
                discountPercent > 100
            )
        ) {
            setStatusMessage(
                "Rabais invalide."
            );
            return;
        }

        setIsSavingDiscount(true);
        setStatusMessage("");

        saveSupplierDiscount(
            discountSupplierName,
            {
                discount_percent: discountPercent,
                active: true
            }
        )

        .then(
            () =>
                fetchSupplierDiscounts()
        )

        .then(
            discountRows => {

                setSupplierDiscounts(discountRows);
                setStatusMessage(
                    "Rabais " + discountSupplierName + " sauvegardé."
                );

            }
        )

        .catch(
            () => {

                setStatusMessage(
                    "Sauvegarde du rabais impossible."
                );

            }
        )

        .finally(
            () => {

                setIsSavingDiscount(false);

            }
        );

    }


    function applyDiscount() {

        if (!discountSupplierName)
            return;

        setIsApplyingDiscount(true);
        setStatusMessage("");

        applySupplierDiscount(
            discountSupplierName
        )

        .then(
            response => {

                setStatusMessage(
                    "Rabais " +
                    response.supplier +
                    " appliqué: " +
                    response.updated +
                    " produits."
                );

                return loadProducts();

            }
        )

        .catch(
            () => {

                setStatusMessage(
                    "Application du rabais impossible."
                );

            }
        )

        .finally(
            () => {

                setIsApplyingDiscount(false);

            }
        );

    }


    function uploadSchluterFile(
        event: ChangeEvent<HTMLInputElement>
    ) {

        const file =
            event.target.files?.[0];

        if (!file)
            return;

        setIsUploadingSchluter(true);
        setStatusMessage("");

        uploadSchluterPriceList(file)

        .then(
            response => {

                setStatusMessage(
                    "Liste Schluter importée: " +
                    response.imported +
                    " produits, erreurs: " +
                    response.failed +
                    (
                        response.discount_percent !== null ?
                            ", rabais: " + response.discount_percent + "%" :
                            ""
                    )
                );
                setCurrentPage(1);

                return loadProducts();

            }
        )

        .catch(
            () => {

                setStatusMessage(
                    "Import de la liste Schluter impossible."
                );

            }
        )

        .finally(
            () => {

                setIsUploadingSchluter(false);
                event.target.value = "";

            }
        );

    }


    function uploadOlympiaFile(
        event: ChangeEvent<HTMLInputElement>
    ) {

        const file =
            event.target.files?.[0];

        if (!file)
            return;

        setIsUploadingOlympia(true);
        setStatusMessage("");

        uploadOlympiaPriceList(file)

        .then(
            response => {

                setStatusMessage(
                    "Liste Olympia importée: " +
                    response.imported +
                    " produits, erreurs: " +
                    response.failed +
                    (
                        response.discount_percent !== null ?
                            ", rabais: " + response.discount_percent + "%" :
                            ", rabais non configuré"
                    )
                );
                setCurrentPage(1);

                return loadProducts();

            }
        )

        .catch(
            () => {

                setStatusMessage(
                    "Import de la liste Olympia impossible."
                );

            }
        )

        .finally(
            () => {

                setIsUploadingOlympia(false);
                event.target.value = "";

            }
        );

    }


    return (

        <section
            className={
                isEditorVisible ?
                    "products-page" :
                    "products-page editor-hidden"
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

                    <select
                        className="supplier-filter"
                        value={supplierFilter}
                        onChange={
                            event => {
                                setCurrentPage(1);
                                setSupplierFilter(event.target.value);
                            }
                        }
                    >
                        <option value="">Fournisseurs</option>
                        {supplierOptions.map(
                            supplier => (
                                <option
                                    key={supplier}
                                    value={supplier}
                                >
                                    {supplier}
                                </option>
                            )
                        )}
                    </select>

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

                    {productMenu === "Prosol" && (
                        <button
                            type="button"
                            className="prosol-price-action"
                            onClick={refreshProsolPrices}
                            disabled={isUpdatingProsolPrices}
                        >
                            Prix Prosol
                        </button>
                    )}

                    {productMenu === "Schluter" && (
                        <>
                            <input
                                ref={schluterFileInputRef}
                                type="file"
                                className="price-list-input"
                                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                onChange={uploadSchluterFile}
                            />

                            <button
                                type="button"
                                className="schluter-upload-action"
                                onClick={
                                    () =>
                                        schluterFileInputRef.current?.click()
                                }
                                disabled={isUploadingSchluter}
                            >
                                Liste Schluter
                            </button>
                        </>
                    )}

                    {productMenu === "Olympia" && (
                        <>
                            <input
                                ref={olympiaFileInputRef}
                                type="file"
                                className="price-list-input"
                                accept=".pdf,application/pdf"
                                onChange={uploadOlympiaFile}
                            />

                            <button
                                type="button"
                                className="schluter-upload-action"
                                onClick={
                                    () =>
                                        olympiaFileInputRef.current?.click()
                                }
                                disabled={isUploadingOlympia}
                            >
                                Liste Olympia
                            </button>
                        </>
                    )}

                    {discountSupplierName && (
                        <div className="supplier-discount-controls">
                            <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={discountInput}
                                placeholder="%"
                                onChange={
                                    event =>
                                        discountSupplierName &&
                                        setDiscountInputs(
                                            previousInputs => ({
                                                ...previousInputs,
                                                [discountSupplierName]:
                                                    event.target.value
                                            })
                                        )
                                }
                            />
                            <button
                                type="button"
                                onClick={saveDiscount}
                                disabled={isSavingDiscount}
                            >
                                Sauver rabais
                            </button>
                            <button
                                type="button"
                                onClick={applyDiscount}
                                disabled={
                                    isApplyingDiscount ||
                                    !discountInput.trim()
                                }
                            >
                                Appliquer
                            </button>
                        </div>
                    )}

                </div>

                <div className="products-table-wrap">

                    <table className="products-table">
                        <thead>
                            <tr>
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
                                            product.id === selectedProductId ?
                                                "selected" :
                                                ""
                                        }
                                        onClick={
                                            () =>
                                                selectProduct(product)
                                        }
                                    >
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

            {isEditorVisible && (
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
