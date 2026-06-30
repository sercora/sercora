import { useEffect, useState } from "react";

import CalibreView from "./pages/CalibreView";
import ChantiersPage from "./pages/ChantiersPage";
import ClientsPage from "./pages/ClientsPage";
import ContactsPage from "./pages/ContactsPage";
import ConfigurationPage from "./pages/ConfigurationPage";
import LoginPage from "./pages/LoginPage";
import MatrixView from "./pages/MatrixView";
import ProfilePage from "./pages/ProfilePage";
import ProjectsPage from "./pages/ProjectsPage";
import ProductsPage from "./pages/ProductsPage";
import SetPasswordPage from "./pages/SetPasswordPage";
import ToolsPage from "./pages/ToolsPage";
import UsersPage from "./pages/UsersPage";
import sercoraLogo from "./assets/sercora-logo.png";
import type { SercoraUser } from "./utils/authApi";
import type { ToolScope } from "./utils/toolsApi";
import {
    fetchMe,
    login
} from "./utils/authApi";

import "./App.css";


type PageKey = "Clients" | "Contacts" | "Fournisseurs" | "Projets" | "Chantiers" | "Produits" | "Outils" | "Calibre" | "Soumissions" | "Profil" | "Usagers" | "Configuration";
type NavGroupKey = "Clients" | "Contacts" | "Fournisseurs" | "Projets" | "Produits" | "Outils" | "Calibre" | "Soumissions" | "Usagers" | "Configuration";
type ProductMenuKey = "Tous" | "Mapei" | "Prosol" | "Schluter" | "Tuile" | "Centura" | "Olympia";
type ProjectMenuKey = "En cours" | "En Soumission" | "Création";
type ProjectSubmissionMenuKey = "Nouveaux" | "Approuvés" | "Indécis" | "Refusés" | "Envoyés";
type EstimateMenuKey = "En cours" | "Envoyées" | "Refusé" | "Template";
type ToolsMenuKey = "Tous les outils" | "Disponible" | "Déployé";
type ConfigurationMenuKey = "Courriel" | "VoIP/SMS" | "Snipe-IT" | "Quick-book" | "Mobile-Punch" | "Importation" | "Statut";


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


const PROJECT_MENU_ITEMS: ProjectMenuKey[] = [
    "En cours",
    "En Soumission",
    "Création"
];


const DISABLED_PROJECT_MENU_ITEMS: ProjectMenuKey[] = [
    "En cours"
];


const PROJECT_SUBMISSION_MENU_ITEMS: ProjectSubmissionMenuKey[] = [
    "Nouveaux",
    "Approuvés",
    "Indécis",
    "Refusés",
    "Envoyés"
];


const ESTIMATE_MENU_ITEMS: EstimateMenuKey[] = [
    "En cours",
    "Envoyées",
    "Refusé",
    "Template"
];


const TOOLS_MENU_ITEMS: ToolsMenuKey[] = [
    "Tous les outils",
    "Disponible",
    "Déployé"
];


const CONFIGURATION_MENU_ITEMS: ConfigurationMenuKey[] = [
    "Courriel",
    "VoIP/SMS",
    "Snipe-IT",
    "Quick-book",
    "Mobile-Punch",
    "Importation",
    "Statut"
];


const DISABLED_CONFIGURATION_MENU_ITEMS: ConfigurationMenuKey[] = [
    "Quick-book",
    "Mobile-Punch"
];


const PAGE_CONTEXT: Record<PageKey, string> = {
    Clients: "Relations et comptes",
    Contacts: "Répertoire des personnes",
    Fournisseurs: "Répertoire des fournisseurs",
    Projets: "Chantiers et suivis",
    Chantiers: "Lieux Snipe-IT",
    Produits: "Catalogue, prix et fournisseurs",
    Outils: "Inventaire Snipe-IT",
    Calibre: "Relevés et métrés",
    Soumissions: "Legacy",
    Profil: "Compte et mot de passe",
    Usagers: "Roles et acces",
    Configuration: "Parametres systeme"
};


const AUTH_TOKEN_KEY = "sercora_auth_token";

const MAIN_NAV_ITEMS: NavGroupKey[] = [
    "Clients",
    "Contacts",
    "Fournisseurs",
    "Projets",
    "Produits",
    "Outils",
    "Calibre",
    "Soumissions",
    "Configuration"
];

const NAV_BUTTON_LABELS: Record<NavGroupKey, string> = {
    Clients: "Clients",
    Contacts: "Contacts",
    Fournisseurs: "Fournisseurs",
    Projets: "Projets",
    Produits: "Produits",
    Outils: "Outils",
    Calibre: "Calibre",
    Soumissions: "LEGACY",
    Usagers: "Usagers",
    Configuration: "Configuration"
};

const NAV_SUBTITLE: Partial<Record<NavGroupKey, string>> = {
    Clients: "Comptes et fiches",
    Contacts: "Répertoire",
    Fournisseurs: "Partenaires",
    Projets: "Chantiers",
    Produits: "Catalogue",
    Outils: "Inventaire",
    Calibre: "Mesures",
    Soumissions: "Legacy",
    Configuration: "Paramètres"
};


function pageLabel(
    page: PageKey
) {

    return page === "Soumissions" ?
        "LEGACY" :
        page;

}


function App() {

    const [activePage, setActivePage] = useState<PageKey>("Soumissions");
    const [activeProductMenu, setActiveProductMenu] = useState<ProductMenuKey>("Tous");
    const [activeProjectMenu, setActiveProjectMenu] = useState<ProjectMenuKey>("En Soumission");
    const [activeProjectSubmissionMenu, setActiveProjectSubmissionMenu] =
        useState<ProjectSubmissionMenuKey>("Nouveaux");
    const [activeEstimateMenu, setActiveEstimateMenu] = useState<EstimateMenuKey>("En cours");
    const [activeEstimateId, setActiveEstimateId] = useState<number | null>(null);
    const [activeToolsMenu, setActiveToolsMenu] = useState<ToolsMenuKey>("Tous les outils");
    const [activeConfigurationMenu, setActiveConfigurationMenu] = useState<ConfigurationMenuKey>("Courriel");
    const [openNavGroup, setOpenNavGroup] = useState<NavGroupKey | null>(null);
    const [navigationRefreshKey, setNavigationRefreshKey] = useState(0);
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


    function refreshNavigationView() {

        setNavigationRefreshKey(
            currentKey =>
                currentKey + 1
        );

    }


    function closeNavMenu() {

        setOpenNavGroup(null);

    }


    function selectPage(
        page: PageKey
    ) {

        setActivePage(page);
        refreshNavigationView();
        closeNavMenu();

    }


    function toggleNavMenu(
        page: NavGroupKey
    ) {

        setOpenNavGroup(
            previousPage =>
                previousPage === page ?
                    null :
                    page
        );

    }


    function navButtonActive(
        page: NavGroupKey
    ) {

        return (
            activePage === page ||
            (
                page === "Outils" &&
                activePage === "Chantiers"
            )
        );

    }


    function navLabel(
        page: NavGroupKey
    ) {

        return NAV_BUTTON_LABELS[page];

    }


    function renderSubmenu(
        page: NavGroupKey
    ) {

        if (page === "Produits") {
            return (
                <div className="nav-dropdown-panel">
                    <button
                        type="button"
                        className={
                            activePage === "Produits" && activeProductMenu === "Tous" ?
                                "nav-dropdown-item active" :
                                "nav-dropdown-item"
                        }
                        onClick={() => {
                            setActiveProductMenu("Tous");
                            selectPage("Produits");
                        }}
                    >
                        Tous les produits
                    </button>
                    {PRODUCT_MENU_ITEMS.map(
                        productMenuItem => (
                            <div
                                key={productMenuItem}
                                className="nav-dropdown-group"
                            >
                                <button
                                    type="button"
                                    className={
                                        activePage === "Produits" && activeProductMenu === productMenuItem ?
                                            "nav-dropdown-item active" :
                                            "nav-dropdown-item"
                                    }
                                    onClick={() => {
                                        setActiveProductMenu(productMenuItem);
                                        selectPage("Produits");
                                    }}
                                >
                                    {productMenuItem === "Tuile" ? "Tuiles" : productMenuItem === "Mapei" ? "Mapeï" : productMenuItem}
                                </button>
                                {productMenuItem === "Tuile" && (
                                    <div className="nav-dropdown-nested">
                                        {TILE_SUPPLIER_MENU_ITEMS.map(
                                            tileSupplierMenuItem => (
                                                <button
                                                    key={tileSupplierMenuItem}
                                                    type="button"
                                                    className={
                                                        activePage === "Produits" && activeProductMenu === tileSupplierMenuItem ?
                                                            "nav-dropdown-item nested active" :
                                                            "nav-dropdown-item nested"
                                                    }
                                                    onClick={() => {
                                                        setActiveProductMenu(tileSupplierMenuItem);
                                                        selectPage("Produits");
                                                    }}
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
            );
        }

        if (page === "Projets") {
            return (
                <div className="nav-dropdown-panel">
                    {PROJECT_MENU_ITEMS.map(
                        projectMenuItem => {
                            const isProjectMenuDisabled =
                                DISABLED_PROJECT_MENU_ITEMS.includes(projectMenuItem);

                            return (
                                <div
                                    key={projectMenuItem}
                                    className="nav-dropdown-group"
                                >
                                    <button
                                        type="button"
                                        className={
                                            activePage === "Projets" && activeProjectMenu === projectMenuItem ?
                                                "nav-dropdown-item active" :
                                                "nav-dropdown-item"
                                        }
                                        disabled={isProjectMenuDisabled}
                                        title={
                                            isProjectMenuDisabled ?
                                                "Disponible plus tard pour les projets obtenus par bon de commande." :
                                                undefined
                                        }
                                        onClick={() => {
                                            if (isProjectMenuDisabled)
                                                return;

                                            setActiveProjectMenu(projectMenuItem);
                                            if (projectMenuItem === "En Soumission")
                                                setActiveProjectSubmissionMenu("Nouveaux");
                                            selectPage("Projets");
                                        }}
                                    >
                                        {projectMenuItem}
                                    </button>
                                    {projectMenuItem === "En Soumission" && (
                                        <div className="nav-dropdown-nested">
                                            {PROJECT_SUBMISSION_MENU_ITEMS.map(
                                                submissionMenuItem => (
                                                    <button
                                                        key={submissionMenuItem}
                                                        type="button"
                                                        className={
                                                            activePage === "Projets" &&
                                                            activeProjectMenu === "En Soumission" &&
                                                            activeProjectSubmissionMenu === submissionMenuItem ?
                                                                "nav-dropdown-item nested active" :
                                                                "nav-dropdown-item nested"
                                                        }
                                                        onClick={() => {
                                                            setActiveProjectMenu("En Soumission");
                                                            setActiveProjectSubmissionMenu(submissionMenuItem);
                                                            selectPage("Projets");
                                                        }}
                                                    >
                                                        {submissionMenuItem === "Nouveaux" ? <strong>{submissionMenuItem}</strong> : submissionMenuItem}
                                                    </button>
                                                )
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        }
                    )}
                </div>
            );
        }

        if (page === "Soumissions") {
            return (
                <div className="nav-dropdown-panel">
                    {ESTIMATE_MENU_ITEMS.map(
                        estimateMenuItem => (
                            <button
                                key={estimateMenuItem}
                                type="button"
                                className={
                                    activePage === "Soumissions" && activeEstimateMenu === estimateMenuItem ?
                                        "nav-dropdown-item active" :
                                        "nav-dropdown-item"
                                }
                                onClick={() => {
                                    setActiveEstimateMenu(estimateMenuItem);
                                    setActiveEstimateId(null);
                                    selectPage("Soumissions");
                                }}
                            >
                                {estimateMenuItem}
                            </button>
                        )
                    )}
                </div>
            );
        }

        if (page === "Outils") {
            return (
                <div className="nav-dropdown-panel">
                    <button
                        type="button"
                        className={
                            activePage === "Chantiers" ?
                                "nav-dropdown-item active" :
                                "nav-dropdown-item"
                        }
                        onClick={() => selectPage("Chantiers")}
                    >
                        Chantiers
                    </button>
                    {TOOLS_MENU_ITEMS.map(
                        toolsMenuItem => (
                            <button
                                key={toolsMenuItem}
                                type="button"
                                className={
                                    activePage === "Outils" && activeToolsMenu === toolsMenuItem ?
                                        "nav-dropdown-item active" :
                                        "nav-dropdown-item"
                                }
                                onClick={() => {
                                    setActiveToolsMenu(toolsMenuItem);
                                    selectPage("Outils");
                                }}
                            >
                                {toolsMenuItem}
                            </button>
                        )
                    )}
                </div>
            );
        }

        if (page === "Configuration") {
            return (
                <div className="nav-dropdown-panel">
                    {currentUser?.role === "admin" && (
                        <button
                            type="button"
                            className={
                                activePage === "Usagers" ?
                                    "nav-dropdown-item active" :
                                    "nav-dropdown-item"
                            }
                            onClick={() => {
                                setActivePage("Usagers");
                                refreshNavigationView();
                                closeNavMenu();
                            }}
                        >
                            Usagers
                        </button>
                    )}
                    {CONFIGURATION_MENU_ITEMS.map(
                        configurationMenuItem => {
                            const isConfigurationMenuDisabled =
                                DISABLED_CONFIGURATION_MENU_ITEMS.includes(configurationMenuItem);

                            return (
                                <button
                                    key={configurationMenuItem}
                                    type="button"
                                    className={
                                        activePage === "Configuration" && activeConfigurationMenu === configurationMenuItem ?
                                            "nav-dropdown-item active" :
                                            "nav-dropdown-item"
                                    }
                                    disabled={isConfigurationMenuDisabled}
                                    title={
                                        isConfigurationMenuDisabled ?
                                            "Integration en developpement." :
                                            undefined
                                    }
                                    onClick={() => {
                                        if (isConfigurationMenuDisabled)
                                            return;

                                        setActiveConfigurationMenu(configurationMenuItem);
                                        selectPage("Configuration");
                                    }}
                                >
                                    {configurationMenuItem}
                                </button>
                            );
                        }
                    )}
                </div>
            );
        }

        return null;

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
                        {pageLabel(activePage)}
                        {activePage === "Produits" && activeProductMenu !== "Tous" && (
                            " - " + activeProductMenu
                        )}
                        {activePage === "Projets" && (
                            " - " + activeProjectMenu
                        )}
                        {activePage === "Projets" && activeProjectMenu === "En Soumission" && (
                            " - " + activeProjectSubmissionMenu
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
                            () => {
                                setActivePage("Profil");
                                refreshNavigationView();
                            }
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
                    {MAIN_NAV_ITEMS.filter(
                        item => (
                            item !== "Configuration" ||
                            currentUser?.role === "admin"
                        )
                    ).map(
                        item => {
                            const hasDropdown =
                                ![
                                    "Clients",
                                    "Contacts",
                                    "Fournisseurs",
                                    "Calibre"
                                ].includes(item);

                            return (
                                <div
                                    key={item}
                                    className={
                                        openNavGroup === item ?
                                            "nav-group open" :
                                            "nav-group"
                                    }
                                >
                                    <button
                                        type="button"
                                        className={
                                            navButtonActive(item) ?
                                                "nav-item active" :
                                                "nav-item"
                                        }
                                        aria-current={
                                            navButtonActive(item) ?
                                                "page" :
                                                undefined
                                        }
                                        aria-haspopup={
                                            hasDropdown ?
                                                "menu" :
                                                undefined
                                        }
                                        aria-expanded={openNavGroup === item}
                                        onClick={() => {
                                            if (!hasDropdown) {
                                                setActivePage(item);
                                                refreshNavigationView();
                                                closeNavMenu();
                                                return;
                                            }

                                            toggleNavMenu(item);
                                        }}
                                    >
                                        <span className="nav-item-label">
                                            {navLabel(item)}
                                        </span>
                                        {hasDropdown && (
                                            <span className="nav-item-chevron">▾</span>
                                        )}
                                    </button>

                                    {NAV_SUBTITLE[item] && (
                                        <span className="nav-item-subtitle">
                                            {NAV_SUBTITLE[item]}
                                        </span>
                                    )}

                                    {openNavGroup === item && renderSubmenu(item)}
                                </div>
                            );
                        }
                    )}

                </nav>

                <main className="app-content">
                    {activePage === "Clients" && (
                        <ClientsPage key={`clients-${navigationRefreshKey}`} />
                    )}

                    {activePage === "Contacts" && (
                        <ContactsPage key={`contacts-${navigationRefreshKey}`} />
                    )}

                    {activePage === "Fournisseurs" && (
                        <ContactsPage
                            key={`suppliers-${navigationRefreshKey}`}
                            defaultContactTypeCode="supplier"
                        />
                    )}

                    {activePage === "Projets" && (
                        <ProjectsPage
                            key={`${activeProjectMenu}-${activeProjectSubmissionMenu}-${navigationRefreshKey}`}
                            projectMenu={activeProjectMenu}
                            projectSubmissionState={activeProjectSubmissionMenu}
                            currentUserId={currentUser.id}
                            onOpenEstimate={
                                estimateId => {
                                    setActiveEstimateId(estimateId);
                                    setActiveEstimateMenu("Template");
                                    setActivePage("Soumissions");
                                }
                            }
                        />
                    )}

                    {activePage === "Chantiers" && (
                        <ChantiersPage key={`chantiers-${navigationRefreshKey}`} />
                    )}

                    {activePage === "Produits" && (
                        <ProductsPage
                            key={`${activeProductMenu}-${navigationRefreshKey}`}
                            productMenu={activeProductMenu}
                        />
                    )}

                    {activePage === "Outils" && (
                        <ToolsPage
                            key={`${activeToolsMenu}-${navigationRefreshKey}`}
                            toolScope={
                                (
                                    activeToolsMenu === "Disponible" ?
                                        "available" :
                                        activeToolsMenu === "Déployé" ?
                                            "deployed" :
                                            "all"
                                ) as ToolScope
                            }
                        />
                    )}

                    {activePage === "Soumissions" && (
                        <MatrixView
                            key={`${activeEstimateMenu}-${activeEstimateId || "legacy"}-${navigationRefreshKey}`}
                            estimateMenu={activeEstimateMenu}
                            estimateId={activeEstimateId}
                            onEstimateChange={setActiveEstimateId}
                        />
                    )}

                    {activePage === "Calibre" && (
                        <CalibreView key={`calibre-${navigationRefreshKey}`} />
                    )}

                    {activePage === "Profil" && (
                        <ProfilePage
                            key={`profile-${navigationRefreshKey}`}
                            token={token}
                            user={currentUser}
                            onUserUpdate={handleUserUpdate}
                        />
                    )}

                    {activePage === "Usagers" && (
                        <UsersPage
                            key={`users-${navigationRefreshKey}`}
                            token={token}
                            currentUser={currentUser}
                        />
                    )}

                    {activePage === "Configuration" && (
                        <ConfigurationPage
                            key={`${activeConfigurationMenu}-${navigationRefreshKey}`}
                            token={token}
                            currentUser={currentUser}
                            configurationMenu={activeConfigurationMenu}
                        />
                    )}
                </main>

            </div>

            <footer className="build-footer">
                <span>Crédits : Simon Mathieu 2026</span>
                <nav aria-label="Liens projet">
                    <a
                        href="https://github.com/sercora/sercora/tree/main"
                        target="_blank"
                        rel="noreferrer"
                    >
                        GitHub main
                    </a>
                    <a
                        href="https://github.com/sercora/sercora/tree/main/docs"
                        target="_blank"
                        rel="noreferrer"
                    >
                        Documentation
                    </a>
                </nav>
                <span>{__SERCORA_BUILD_DATE__}</span>
            </footer>

        </div>

    );

}


export default App;
