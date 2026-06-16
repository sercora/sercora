import { useEffect, useState } from "react";

import ConfigurationPage from "./pages/ConfigurationPage";
import LoginPage from "./pages/LoginPage";
import MatrixView from "./pages/MatrixView";
import ProfilePage from "./pages/ProfilePage";
import ProductsPage from "./pages/ProductsPage";
import SetPasswordPage from "./pages/SetPasswordPage";
import ToolsPage from "./pages/ToolsPage";
import UsersPage from "./pages/UsersPage";
import sercoraLogo from "./assets/sercora-logo.png";
import type { SercoraUser } from "./utils/authApi";
import {
    fetchMe,
    login
} from "./utils/authApi";

import "./App.css";


type PageKey = "Clients" | "Projets" | "Produits" | "Outils" | "Soumissions" | "Profil" | "Usagers" | "Configuration";
type ProductMenuKey = "Tous" | "Mapei" | "Prosol" | "Schluter" | "Tuile" | "Centura" | "Olympia";
type EstimateMenuKey = "En cours" | "Envoyées" | "Refusé" | "Template";
type ConfigurationMenuKey = "Courriel" | "Importation";


const NAV_ITEMS: PageKey[] = [
    "Clients",
    "Projets",
    "Produits",
    "Outils",
    "Soumissions",
    "Usagers",
    "Configuration"
];


const PRODUCT_MENU_ITEMS: ProductMenuKey[] = [
    "Tuile",
    "Schluter",
    "Mapei",
    "Prosol"
];


const TILE_SUPPLIER_MENU_ITEMS: ProductMenuKey[] = [
    "Centura",
    "Olympia"
];


const ESTIMATE_MENU_ITEMS: EstimateMenuKey[] = [
    "En cours",
    "Envoyées",
    "Refusé",
    "Template"
];


const CONFIGURATION_MENU_ITEMS: ConfigurationMenuKey[] = [
    "Courriel",
    "Importation"
];


const PAGE_CONTEXT: Record<PageKey, string> = {
    Clients: "Relations et comptes",
    Projets: "Chantiers et suivis",
    Produits: "Catalogue, prix et fournisseurs",
    Outils: "Inventaire Snipe-IT",
    Soumissions: "Estimations et quantités",
    Profil: "Compte et mot de passe",
    Usagers: "Roles et acces",
    Configuration: "Parametres systeme"
};


const AUTH_TOKEN_KEY = "sercora_auth_token";


function App() {

    const [activePage, setActivePage] = useState<PageKey>("Soumissions");
    const [activeProductMenu, setActiveProductMenu] = useState<ProductMenuKey>("Tous");
    const [activeEstimateMenu, setActiveEstimateMenu] = useState<EstimateMenuKey>("En cours");
    const [activeConfigurationMenu, setActiveConfigurationMenu] = useState<ConfigurationMenuKey>("Courriel");
    const [token, setToken] = useState<string | null>(
        () => localStorage.getItem(AUTH_TOKEN_KEY)
    );
    const [currentUser, setCurrentUser] = useState<SercoraUser | null>(null);
    const [isCheckingSession, setIsCheckingSession] = useState(Boolean(token));
    const [setupToken, setSetupToken] = useState(
        () => new URLSearchParams(window.location.search).get("setup_token")
    );


    useEffect(
        () => {
            if (!token)
                return;

            let isMounted = true;

            fetchMe(token)
                .then(
                    user => {
                        if (!isMounted)
                            return;

                        setCurrentUser(user);
                        setIsCheckingSession(false);
                    }
                )
                .catch(
                    () => {
                        if (!isMounted)
                            return;

                        localStorage.removeItem(AUTH_TOKEN_KEY);
                        setToken(null);
                        setCurrentUser(null);
                        setIsCheckingSession(false);
                    }
                );

            return () => {
                isMounted = false;
            };
        },
        [
            token
        ]
    );


    async function handleLogin(
        username: string,
        password: string
    ) {

        const response = await login(
            username,
            password
        );

        localStorage.setItem(
            AUTH_TOKEN_KEY,
            response.token
        );
        setToken(response.token);
        setCurrentUser(response.user);
        setActivePage(
            response.user.must_change_password ?
                "Profil" :
                "Soumissions"
        );

    }


    function handleLogout() {

        localStorage.removeItem(AUTH_TOKEN_KEY);
        setToken(null);
        setCurrentUser(null);
        setActivePage("Soumissions");

    }


    function handleUserUpdate(
        user: SercoraUser
    ) {

        setCurrentUser(user);

    }


    function clearSetupToken() {

        window.history.replaceState(
            {},
            "",
            window.location.pathname
        );
        setSetupToken(null);

    }


    if (setupToken) {
        return (
            <SetPasswordPage
                setupToken={setupToken}
                onComplete={clearSetupToken}
            />
        );
    }


    if (isCheckingSession) {
        return (
            <main className="session-loading">
                Chargement de la session...
            </main>
        );
    }


    if (!token || !currentUser) {
        return (
            <LoginPage onLogin={handleLogin} />
        );
    }


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
                        {activePage === "Configuration" && (
                            " - " + activeConfigurationMenu
                        )}
                    </h1>
                </div>

                <div className="header-meta">
                    <button
                        type="button"
                        className="header-action"
                        onClick={
                            () => setActivePage("Profil")
                        }
                    >
                        {currentUser.full_name}
                    </button>
                    <span className="role-header-pill">{currentUser.role}</span>
                    <span className="environment-pill">Production</span>
                    <span className="build-pill">
                        Build {__SERCORA_BUILD_NUMBER__}
                    </span>
                    <button
                        type="button"
                        className="header-action"
                        onClick={handleLogout}
                    >
                        Deconnexion
                    </button>
                </div>

            </header>

            <div className="app-body">

                <nav
                    className="main-nav"
                    aria-label="Navigation principale"
                >

                    {NAV_ITEMS.filter(
                        item => (
                            (
                                item !== "Usagers" &&
                                item !== "Configuration"
                            ) ||
                            currentUser.role === "admin"
                        )
                    ).map(
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

                                            if (item === "Configuration")
                                                setActiveConfigurationMenu("Courriel");
                                        }
                                    }
                                >
                                    {item}
                                </button>

                                {item === "Produits" && (
                                    <div className="nav-submenu">
                                        {PRODUCT_MENU_ITEMS.map(
                                            productMenuItem => (
                                                <div
                                                    key={productMenuItem}
                                                    className="nav-subgroup"
                                                >
                                                    <button
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
                                                        {productMenuItem === "Tuile" ?
                                                            "Tuiles" :
                                                            productMenuItem === "Mapei" ?
                                                                "Mapeï" :
                                                                productMenuItem}
                                                    </button>

                                                    {productMenuItem === "Tuile" && (
                                                        <div className="nav-submenu nested">
                                                            {TILE_SUPPLIER_MENU_ITEMS.map(
                                                                tileSupplierMenuItem => (
                                                                    <button
                                                                        key={tileSupplierMenuItem}
                                                                        type="button"
                                                                        className={
                                                                            (
                                                                                activePage === "Produits" &&
                                                                                activeProductMenu === tileSupplierMenuItem
                                                                            ) ?
                                                                                "nav-subitem nested active" :
                                                                                "nav-subitem nested"
                                                                        }
                                                                        onClick={
                                                                            () => {
                                                                                setActiveProductMenu(tileSupplierMenuItem);
                                                                                setActivePage("Produits");
                                                                            }
                                                                        }
                                                                    >
                                                                        {tileSupplierMenuItem}
                                                                    </button>
                                                                )
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
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

                                {item === "Configuration" && currentUser.role === "admin" && (
                                    <div className="nav-submenu">
                                        {CONFIGURATION_MENU_ITEMS.map(
                                            configurationMenuItem => (
                                                <button
                                                    key={configurationMenuItem}
                                                    type="button"
                                                    className={
                                                        (
                                                            activePage === "Configuration" &&
                                                            activeConfigurationMenu === configurationMenuItem
                                                        ) ?
                                                            "nav-subitem active" :
                                                            "nav-subitem"
                                                    }
                                                    onClick={
                                                        () => {
                                                            setActiveConfigurationMenu(configurationMenuItem);
                                                            setActivePage("Configuration");
                                                        }
                                                    }
                                                >
                                                    {configurationMenuItem}
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

                    {activePage === "Profil" && (
                        <ProfilePage
                            token={token}
                            user={currentUser}
                            onUserUpdate={handleUserUpdate}
                        />
                    )}

                    {activePage === "Usagers" && (
                        <UsersPage
                            token={token}
                            currentUser={currentUser}
                        />
                    )}

                    {activePage === "Configuration" && (
                        <ConfigurationPage
                            token={token}
                            currentUser={currentUser}
                            configurationMenu={activeConfigurationMenu}
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
