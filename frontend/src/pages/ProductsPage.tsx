import {
    useEffect,
    useMemo,
    useState
} from "react";
import type { ChangeEvent } from "react";

import {
    createProduct,
    disableProduct,
    fetchProducts,
    fetchProductTypes,
    fetchUnits,
    updateProduct
} from "../utils/productsApi";
import type {
    Product,
    ProductInput,
    ProductType,
    Unit
} from "../utils/productsApi";
import {
    searchProsolProducts
} from "../utils/prosolApi";
import type {
    ProsolProduct
} from "../utils/prosolApi";

import "../styles/products.css";


type FilterState = "active" | "inactive" | "all";


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
        supplier_name:
            textValue(form.supplier_name),
        supplier_product_code:
            textValue(form.supplier_product_code),
        active:
            form.active
    };

}


function ProductsPage() {

    const [products, setProducts] = useState<Product[]>([]);
    const [productTypes, setProductTypes] = useState<ProductType[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
    const [form, setForm] = useState<ProductInput>(EMPTY_FORM);
    const [query, setQuery] = useState("");
    const [supplierFilter, setSupplierFilter] = useState("");
    const [filter, setFilter] = useState<FilterState>("active");
    const [isSaving, setIsSaving] = useState(false);
    const [showProsolImport, setShowProsolImport] = useState(false);
    const [prosolQuery, setProsolQuery] = useState("");
    const [prosolProducts, setProsolProducts] = useState<ProsolProduct[]>([]);
    const [isSearchingProsol, setIsSearchingProsol] = useState(false);
    const [statusMessage, setStatusMessage] = useState("");


    function loadProducts() {

        return fetchProducts()

        .then(
            setProducts
        );

    }


    useEffect(

        () => {

            Promise.all(
                [
                    fetchProducts(),
                    fetchProductTypes(),
                    fetchUnits()
                ]
            )

            .then(
                ([
                    productRows,
                    typeRows,
                    unitRows
                ]) => {

                    setProducts(productRows);
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
            const normalizedSupplier =
                supplierFilter.trim().toLowerCase();

            return products.filter(
                product => {

                    if (
                        filter === "active" &&
                        !product.active
                    )
                        return false;

                    if (
                        filter === "inactive" &&
                        product.active
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
                        product.collection_name,
                        product.color_name,
                        product.size_name
                    ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase()
                    .includes(normalizedQuery);

                }
            );

        },

        [
            filter,
            products,
            query,
            supplierFilter
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


    function startNewProduct() {

        setSelectedProductId(null);
        setStatusMessage("");
        setForm(
            {
                ...EMPTY_FORM,
                product_type_id:
                    productTypes[0]?.id || 0
            }
        );

    }


    function selectProduct(
        product: Product
    ) {

        setSelectedProductId(product.id);
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


    function searchProsol() {

        const trimmedQuery =
            prosolQuery.trim();

        if (trimmedQuery.length < 3) {
            setStatusMessage(
                "Recherche Prosol: minimum 3 caractères."
            );
            return;
        }

        setIsSearchingProsol(true);
        setStatusMessage("");

        searchProsolProducts(trimmedQuery)

        .then(
            response => {

                setProsolProducts(response.rows);
                setStatusMessage(
                    response.rows.length ?
                        "Produits Prosol chargés." :
                        "Aucun produit Prosol trouvé."
                );

            }
        )

        .catch(
            () => {

                setStatusMessage(
                    "Recherche Prosol impossible."
                );

            }
        )

        .finally(
            () => {

                setIsSearchingProsol(false);

            }
        );

    }


    function importProsolProduct(
        product: ProsolProduct
    ) {

        setSelectedProductId(null);
        setForm(
            {
                ...EMPTY_FORM,
                product_type_id:
                    productTypes[0]?.id || 0,
                name:
                    product.name,
                manufacturer_name:
                    product.manufacturer_name || "",
                collection_name:
                    product.collection_name || "",
                size_name:
                    product.size_name || "",
                supplier_name:
                    "Prosol",
                supplier_product_code:
                    product.supplier_product_code || "",
                active:
                    true
            }
        );
        setStatusMessage(
            "Produit Prosol prêt à enregistrer."
        );

    }


    return (

        <section className="products-page">

            <div className="products-list-panel">

                <div className="products-toolbar">

                    <input
                        type="search"
                        value={query}
                        onChange={
                            event =>
                                setQuery(event.target.value)
                        }
                        placeholder="Rechercher"
                    />

                    <select
                        className="supplier-filter"
                        value={supplierFilter}
                        onChange={
                            event =>
                                setSupplierFilter(event.target.value)
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

                    <select
                        value={filter}
                        onChange={
                            event =>
                                setFilter(event.target.value as FilterState)
                        }
                    >
                        <option value="active">Actifs</option>
                        <option value="inactive">Inactifs</option>
                        <option value="all">Tous</option>
                    </select>

                    <button
                        type="button"
                        onClick={startNewProduct}
                    >
                        Nouveau
                    </button>

                    <button
                        type="button"
                        className="prosol-toggle"
                        onClick={
                            () =>
                                setShowProsolImport(
                                    previousValue =>
                                        !previousValue
                                )
                        }
                    >
                        Prosol
                    </button>

                </div>

                {showProsolImport && (
                    <div className="prosol-import-panel">

                        <div className="prosol-search">
                            <input
                                type="search"
                                value={prosolQuery}
                                onChange={
                                    event =>
                                        setProsolQuery(event.target.value)
                                }
                                onKeyDown={
                                    event => {

                                        if (event.key === "Enter")
                                            searchProsol();

                                    }
                                }
                                placeholder="Rechercher Prosol"
                            />

                            <button
                                type="button"
                                onClick={searchProsol}
                                disabled={isSearchingProsol}
                            >
                                Rechercher
                            </button>
                        </div>

                        <div className="prosol-results">
                            {prosolProducts.map(
                                product => (
                                    <button
                                        key={
                                            product.uuid ||
                                            product.supplier_product_code ||
                                            product.name
                                        }
                                        type="button"
                                        className="prosol-result"
                                        onClick={
                                            () =>
                                                importProsolProduct(product)
                                        }
                                    >
                                        {product.image_url && (
                                            <img
                                                src={product.image_url}
                                                alt=""
                                            />
                                        )}
                                        <span>
                                            <strong>{product.name}</strong>
                                            <small>
                                                {product.supplier_product_code || "Sans SKU"}
                                                {product.manufacturer_name && (
                                                    " - " + product.manufacturer_name
                                                )}
                                            </small>
                                        </span>
                                    </button>
                                )
                            )}
                        </div>

                    </div>
                )}

                <div className="products-table-wrap">

                    <table className="products-table">
                        <thead>
                            <tr>
                                <th>Produit</th>
                                <th>Type</th>
                                <th>Manufacturier</th>
                                <th>Fournisseur</th>
                                <th>Code fournisseur</th>
                                <th>Format</th>
                                <th>Unité</th>
                                <th>État</th>
                            </tr>
                        </thead>

                        <tbody>
                            {filteredProducts.map(
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
                                        <td>{product.size_name || ""}</td>
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

            </div>

            <aside className="product-editor">

                <div className="editor-header">
                    <h2>
                        {selectedProduct ? "Modifier produit" : "Nouveau produit"}
                    </h2>
                    <span>{filteredProducts.length} produits</span>
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
                        Enregistrer
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

        </section>

    );

}


export default ProductsPage;
