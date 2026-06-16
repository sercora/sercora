import {
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";
import type { ChangeEvent } from "react";

import {
    applySupplierDiscount,
    fetchSupplierDiscounts,
    saveSupplierDiscount,
    uploadCenturaPriceList,
    uploadOlympiaPriceList,
    uploadSchluterPriceList
} from "../utils/productsApi";
import type {
    SupplierDiscount
} from "../utils/productsApi";
import {
    syncProsolTechnicalSheets,
    updateProsolPrices
} from "../utils/prosolApi";

import "../styles/products.css";


type ImportSupplierName = "Schluter" | "Centura" | "Olympia";


const SUPPLIER_ROWS: Array<{
    supplier: ImportSupplierName;
    uploadLabel: string;
    accept: string;
    fileType: "xlsx" | "pdf";
}> = [
    {
        supplier: "Schluter",
        uploadLabel: "Téléversement liste Schluter",
        accept: ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        fileType: "xlsx"
    },
    {
        supplier: "Centura",
        uploadLabel: "Téléversement liste Centura",
        accept: ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        fileType: "xlsx"
    },
    {
        supplier: "Olympia",
        uploadLabel: "Téléversement du Catalogue PDF",
        accept: ".pdf,application/pdf",
        fileType: "pdf"
    }
];


function ImportationPage() {

    const [supplierDiscounts, setSupplierDiscounts] = useState<SupplierDiscount[]>([]);
    const [discountInputs, setDiscountInputs] = useState<Record<string, string>>({});
    const [isUpdatingProsolPrices, setIsUpdatingProsolPrices] = useState(false);
    const [isSyncingTechnicalSheets, setIsSyncingTechnicalSheets] = useState(false);
    const [activeUploadSupplier, setActiveUploadSupplier] = useState<string | null>(null);
    const [activeSavingSupplier, setActiveSavingSupplier] = useState<string | null>(null);
    const [activeApplyingSupplier, setActiveApplyingSupplier] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const fileInputs = {
        Schluter: useRef<HTMLInputElement | null>(null),
        Centura: useRef<HTMLInputElement | null>(null),
        Olympia: useRef<HTMLInputElement | null>(null)
    };


    useEffect(
        () => {
            let isMounted = true;

            fetchSupplierDiscounts()

            .then(
                discountRows => {
                    if (isMounted)
                        setSupplierDiscounts(discountRows);
                }
            )

            .catch(
                () => {
                    if (isMounted)
                        setErrorMessage("Impossible de charger les rabais fournisseurs.");
                }
            );

            return () => {
                isMounted = false;
            };
        },
        []
    );


    const discountBySupplier = useMemo(
        () => {
            const discounts = new Map<string, SupplierDiscount>();

            supplierDiscounts.forEach(
                discount =>
                    discounts.set(
                        discount.supplier_name,
                        discount
                    )
            );

            return discounts;
        },
        [
            supplierDiscounts
        ]
    );


    function discountValue(
        supplier: ImportSupplierName
    ) {

        if (discountInputs[supplier] !== undefined)
            return discountInputs[supplier];

        const discount =
            discountBySupplier.get(supplier)?.discount_percent;

        return discount === null || discount === undefined ?
            "" :
            String(discount);

    }


    function refreshDiscounts() {

        return fetchSupplierDiscounts()
            .then(
                discountRows => {
                    setSupplierDiscounts(discountRows);
                }
            );

    }


    function updateProsol() {

        setIsUpdatingProsolPrices(true);
        setStatusMessage("");
        setErrorMessage("");

        updateProsolPrices()

        .then(
            response => {
                setStatusMessage(
                    "Mise à jour web Prosol: " +
                    response.updated +
                    " produits" +
                    (
                        response.failed ?
                            " / erreurs: " + response.failed :
                            ""
                    )
                );
            }
        )

        .catch(
            () => {
                setErrorMessage("Mise à jour web Prosol impossible.");
            }
        )

        .finally(
            () => {
                setIsUpdatingProsolPrices(false);
            }
        );

    }


    function syncMapeiTechnicalSheets() {

        setIsSyncingTechnicalSheets(true);
        setStatusMessage("");
        setErrorMessage("");

        syncProsolTechnicalSheets("Mapei")

        .then(
            response => {
                setStatusMessage(
                    "Fiches techniques Mapei: " +
                    response.documents +
                    " fiches synchronisées sur " +
                    response.checked +
                    " produits" +
                    (
                        response.failed ?
                            " / erreurs: " + response.failed :
                            ""
                    )
                );
            }
        )

        .catch(
            () => {
                setErrorMessage("Synchronisation des fiches techniques Mapei impossible.");
            }
        )

        .finally(
            () => {
                setIsSyncingTechnicalSheets(false);
            }
        );

    }


    function saveDiscount(
        supplier: ImportSupplierName
    ) {

        const rawDiscount =
            discountValue(supplier).trim().replace(",", ".");
        const discountPercent =
            rawDiscount ?
                Number(rawDiscount) :
                null;

        if (
            discountPercent !== null &&
            (
                Number.isNaN(discountPercent) ||
                discountPercent < 0 ||
                discountPercent > 100
            )
        ) {
            setErrorMessage("Rabais invalide pour " + supplier + ".");
            return;
        }

        setActiveSavingSupplier(supplier);
        setStatusMessage("");
        setErrorMessage("");

        saveSupplierDiscount(
            supplier,
            {
                discount_percent: discountPercent,
                active: true
            }
        )

        .then(refreshDiscounts)

        .then(
            () => {
                setStatusMessage("Rabais " + supplier + " sauvegardé.");
            }
        )

        .catch(
            () => {
                setErrorMessage("Sauvegarde du rabais " + supplier + " impossible.");
            }
        )

        .finally(
            () => {
                setActiveSavingSupplier(null);
            }
        );

    }


    function applyDiscount(
        supplier: ImportSupplierName
    ) {

        setActiveApplyingSupplier(supplier);
        setStatusMessage("");
        setErrorMessage("");

        applySupplierDiscount(supplier)

        .then(
            response => {
                setStatusMessage(
                    "Rabais " +
                    response.supplier +
                    " appliqué: " +
                    response.updated +
                    " produits."
                );
            }
        )

        .catch(
            () => {
                setErrorMessage("Application du rabais " + supplier + " impossible.");
            }
        )

        .finally(
            () => {
                setActiveApplyingSupplier(null);
            }
        );

    }


    function uploadFile(
        supplier: ImportSupplierName,
        event: ChangeEvent<HTMLInputElement>
    ) {

        const file =
            event.target.files?.[0];

        if (!file)
            return;

        const uploadRequest =
            supplier === "Schluter" ?
                uploadSchluterPriceList(file) :
                supplier === "Centura" ?
                    uploadCenturaPriceList(file) :
                    uploadOlympiaPriceList(file);

        setActiveUploadSupplier(supplier);
        setStatusMessage("");
        setErrorMessage("");

        uploadRequest

        .then(
            response => {
                setStatusMessage(
                    response.supplier +
                    ": " +
                    response.imported +
                    " produits importés, erreurs: " +
                    response.failed +
                    (
                        response.discount_percent !== null ?
                            ", rabais: " + response.discount_percent + "%" :
                            ", rabais non configuré"
                    )
                );

                return refreshDiscounts();
            }
        )

        .catch(
            () => {
                setErrorMessage("Téléversement " + supplier + " impossible.");
            }
        )

        .finally(
            () => {
                setActiveUploadSupplier(null);
                event.target.value = "";
            }
        );

    }


    return (
        <section className="importation-page">
            <div className="importation-panel">
                <div className="auth-section-heading">
                    <div>
                        <span className="eyebrow">Importation</span>
                        <h2>Mises à jour de prix</h2>
                    </div>
                </div>

                <div className="importation-row">
                    <div>
                        <h3>Prosol</h3>
                        <p>Mise à jour des prix et fiches techniques depuis l'API web Prosol.</p>
                    </div>
                    <div className="importation-actions">
                        <button
                            type="button"
                            className="primary-auth-button"
                            onClick={updateProsol}
                            disabled={isUpdatingProsolPrices}
                        >
                            Mise à Jour web Prosol
                        </button>

                        <button
                            type="button"
                            className="secondary-auth-button"
                            onClick={syncMapeiTechnicalSheets}
                            disabled={isSyncingTechnicalSheets}
                        >
                            Fiches techniques Mapei
                        </button>
                    </div>
                </div>

                {SUPPLIER_ROWS.map(
                    row => (
                        <div
                            key={row.supplier}
                            className="importation-row"
                        >
                            <div>
                                <h3>{row.supplier}</h3>
                                <p>
                                    Rabais fournisseur et import du catalogue de prix.
                                </p>
                            </div>

                            <div className="importation-actions">
                                <label className="discount-field">
                                    <span>Rabais %</span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.01"
                                        value={discountValue(row.supplier)}
                                        onChange={
                                            event =>
                                                setDiscountInputs(
                                                    previousInputs => ({
                                                        ...previousInputs,
                                                        [row.supplier]:
                                                            event.target.value
                                                    })
                                                )
                                        }
                                    />
                                </label>

                                <button
                                    type="button"
                                    className="secondary-auth-button"
                                    onClick={
                                        () => saveDiscount(row.supplier)
                                    }
                                    disabled={
                                        activeSavingSupplier === row.supplier
                                    }
                                >
                                    Sauvegarder rabais
                                </button>

                                <button
                                    type="button"
                                    className="secondary-auth-button"
                                    onClick={
                                        () => applyDiscount(row.supplier)
                                    }
                                    disabled={
                                        activeApplyingSupplier === row.supplier ||
                                        !discountValue(row.supplier).trim()
                                    }
                                >
                                    Appliquer rabais
                                </button>

                                <input
                                    ref={fileInputs[row.supplier]}
                                    type="file"
                                    className="price-list-input"
                                    accept={row.accept}
                                    onChange={
                                        event => uploadFile(
                                            row.supplier,
                                            event
                                        )
                                    }
                                />

                                <button
                                    type="button"
                                    className="primary-auth-button"
                                    onClick={
                                        () =>
                                            fileInputs[row.supplier].current?.click()
                                    }
                                    disabled={
                                        activeUploadSupplier === row.supplier
                                    }
                                >
                                    {row.uploadLabel}
                                </button>
                            </div>
                        </div>
                    )
                )}

                {errorMessage && (
                    <div className="auth-error">
                        {errorMessage}
                    </div>
                )}

                {statusMessage && (
                    <div className="auth-success">
                        {statusMessage}
                    </div>
                )}
            </div>
        </section>
    );

}


export default ImportationPage;
