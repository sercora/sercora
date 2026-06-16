import { useState } from "react";

import MatrixView from "./pages/MatrixView";
import ProductsPage from "./pages/ProductsPage";
import ToolsPage from "./pages/ToolsPage";
import sercoLogo from "./assets/serco-logo.jpg";

import "./App.css";


type PageKey = "Clients" | "Projets" | "Produits" | "Outils" | "Soumissions";
type ProductMenuKey = "Tous" | "Mapei" | "Prosol" | "Tuile";


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
    "Tuile"
];


function App() {

    const [activePage, setActivePage] = useState<PageKey>("Soumissions");
    const [activeProductMenu, setActiveProductMenu] = useState<ProductMenuKey>("Tous");


    return (

        <div className="app-shell">

            <header className="app-header">

                <div className="brand-lockup">
                    <img
                        src={sercoLogo}
                        alt="Carrelages Serco"
                        className="brand-logo"
                    />
                </div>

                <div className="header-context">
                    <span className="workspace-label">Sercora</span>
                    <h1>
                        {activePage}
                        {activePage === "Produits" && activeProductMenu !== "Tous" && (
                            " - " + activeProductMenu
                        )}
                    </h1>
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
                        <MatrixView />
                    )}
                </main>

            </div>

            <footer className="build-footer">
                Build {__SERCORA_BUILD_NUMBER__} - {__SERCORA_BUILD_DATE__}
            </footer>

        </div>

    );

}


export default App;
