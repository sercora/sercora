import { useState } from "react";

import MatrixView from "./pages/MatrixView";
import ProductsPage from "./pages/ProductsPage";
import ToolsPage from "./pages/ToolsPage";
import sercoraLogo from "./assets/sercora-logo.png";

import "./App.css";


type PageKey = "Clients" | "Projets" | "Produits" | "Outils" | "Soumissions";
type ProductMenuKey = "Tous" | "Mapei" | "Prosol" | "Schluter" | "Tuile";
type EstimateMenuKey = "En cours" | "Envoyées" | "Refusées";


const NAV_ITEMS: PageKey[] = [
    "Clients",
    "Projets",
    "Produits",
    "Outils",
    "Soumissions"
];


const PRODUCT_MENU_ITEMS: ProductMenuKey[] = [
    "Mapei",
    "Prosol",
    "Schluter",
    "Tuile"
];


const ESTIMATE_MENU_ITEMS: EstimateMenuKey[] = [
    "En cours",
    "Envoyées",
    "Refusées"
];


const PAGE_CONTEXT: Record<PageKey, string> = {
    Clients: "Relations et comptes",
    Projets: "Chantiers et suivis",
    Produits: "Catalogue, prix et fournisseurs",
    Outils: "Inventaire Snipe-IT",
    Soumissions: "Estimations et quantités"
};


function App() {

    const [activePage, setActivePage] = useState<PageKey>("Soumissions");
    const [activeProductMenu, setActiveProductMenu] = useState<ProductMenuKey>("Tous");
    const [activeEstimateMenu, setActiveEstimateMenu] = useState<EstimateMenuKey>("En cours");


    return (

        <div className="app-shell">

            <header className="app-header">

                <div className="brand-lockup">
                    <img
                        src={sercoraLogo}
                        alt="Sercora"
                        className="brand-logo"
                    />
                </div>

                <div className="header-context">
                    <span className="workspace-label">
                        {PAGE_CONTEXT[activePage]}
                    </span>
                    <h1>
                        {activePage}
                        {activePage === "Produits" && activeProductMenu !== "Tous" && (
                            " - " + activeProductMenu
                        )}
                        {activePage === "Soumissions" && (
                            " - " + activeEstimateMenu
                        )}
                    </h1>
                </div>

                <div className="header-meta">
                    <span className="environment-pill">Production</span>
                    <span className="build-pill">
                        Build {__SERCORA_BUILD_NUMBER__}
                    </span>
                </div>

            </header>

            <div className="app-body">

                <nav
                    className="main-nav"
                    aria-label="Navigation principale"
                >

                    {NAV_ITEMS.map(
                        item => (
                            <div
                                key={item}
                                className="nav-group"
                            >
                                <button
                                    type="button"
                                    className={
                                        item === activePage ?
                                            "nav-item active" :
                                            "nav-item"
                                    }
                                    aria-current={
                                        item === activePage ?
                                            "page" :
                                            undefined
                                    }
                                    disabled={
                                        item === "Clients" ||
                                        item === "Projets"
                                    }
                                    onClick={
                                        () => {
                                            setActivePage(item);

                                            if (item === "Produits")
                                                setActiveProductMenu("Tous");

                                            if (item === "Soumissions")
                                                setActiveEstimateMenu("En cours");
                                        }
                                    }
                                >
                                    {item}
                                </button>

                                {item === "Produits" && (
                                    <div className="nav-submenu">
                                        {PRODUCT_MENU_ITEMS.map(
                                            productMenuItem => (
                                                <button
                                                    key={productMenuItem}
                                                    type="button"
                                                    className={
                                                        (
                                                            activePage === "Produits" &&
                                                            activeProductMenu === productMenuItem
                                                        ) ?
                                                            "nav-subitem active" :
                                                            "nav-subitem"
                                                    }
                                                    onClick={
                                                        () => {
                                                            setActiveProductMenu(productMenuItem);
                                                            setActivePage("Produits");
                                                        }
                                                    }
                                                >
                                                    {productMenuItem}
                                                </button>
                                            )
                                        )}
                                    </div>
                                )}

                                {item === "Soumissions" && (
                                    <div className="nav-submenu">
                                        {ESTIMATE_MENU_ITEMS.map(
                                            estimateMenuItem => (
                                                <button
                                                    key={estimateMenuItem}
                                                    type="button"
                                                    className={
                                                        (
                                                            activePage === "Soumissions" &&
                                                            activeEstimateMenu === estimateMenuItem
                                                        ) ?
                                                            "nav-subitem active" :
                                                            "nav-subitem"
                                                    }
                                                    onClick={
                                                        () => {
                                                            setActiveEstimateMenu(estimateMenuItem);
                                                            setActivePage("Soumissions");
                                                        }
                                                    }
                                                >
                                                    {estimateMenuItem}
                                                </button>
                                            )
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    )}

                </nav>

                <main className="app-content">
                    {activePage === "Produits" && (
                        <ProductsPage
                            key={activeProductMenu}
                            productMenu={activeProductMenu}
                        />
                    )}

                    {activePage === "Outils" && (
                        <ToolsPage />
                    )}

                    {activePage === "Soumissions" && (
                        <MatrixView
                            key={activeEstimateMenu}
                            estimateMenu={activeEstimateMenu}
                        />
                    )}
                </main>

            </div>

            <footer className="build-footer">
                {__SERCORA_BUILD_DATE__}
            </footer>

        </div>

    );

}


export default App;
