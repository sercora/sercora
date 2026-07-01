import {
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";
import type { FormEvent } from "react";

import {
    createProjectWithFiles,
    fetchClients,
    fetchProjects,
    searchBsdqProjects,
    updateProjectCurrent,
    updateProjectSubmissionState
} from "../utils/businessApi";
import {
    fetchProjectFilePreview,
    fetchProjectFolders,
    projectFilePreviewUrl,
    projectFileUrl
} from "../utils/matrixApi";
import { openPdfPreviewWindow } from "../utils/filePreview";
import { clickableMsgHtml } from "../utils/msgPreviewHtml";
import type {
    BsdqProjectSearchResult,
    Client,
    ProjectInput,
    ProjectSummary
} from "../utils/businessApi";
import type {
    EstimateFilePreview,
    EstimateFolderItem
} from "../utils/matrixApi";

import "../styles/business.css";
import "../styles/grid.css";


type ProjectsPageProps = {
    projectMenu: "En cours" | "En Soumission" | "Création";
    projectSubmissionState: ProjectSubmissionMenuKey;
    currentUserId: number;
    onOpenEstimate: (estimateId: number) => void;
};


const EMPTY_PROJECT: ProjectInput = {
    project_number: null,
    bsdq_project_number: null,
    project_name: "",
    status: "PENDING",
    client_id: null,
    address_line1: null,
    address_line2: null,
    city: null,
    province: "QC",
    postal_code: null,
    bid_due_date: null,
    bsdq_due_time: null,
    start_date: null,
    end_date: null,
    architect_name: null,
    probable_schedule: null,
    source_template_path: null,
    warranty_years: 1,
    tile_holdback_percent: 10
};


type DirectoryFile = File & {
    webkitRelativePath?: string;
};


const EMPTY_ADDENDA = {
    name: "",
    date: "",
    plans: false,
    specs: false,
    description: ""
};


function cleanBsdqText(
    value: string | null | undefined
) {

    return (value || "").replace(
        /\s+/g,
        " "
    ).trim();

}


function stripTrailingCity(
    value: string,
    city: string
) {

    const cleanCity = cleanBsdqText(city);

    if (!cleanCity)
        return value;

    return value.replace(
        new RegExp(
            "[,\\s-]*" +
                cleanCity.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
                "\\s*$",
            "i"
        ),
        ""
    ).trim();

}


function parseBsdqProjectDescription(
    result: BsdqProjectSearchResult
) {

    const description = cleanBsdqText(result.description);
    const explicitAddress = cleanBsdqText(result.address_line1);
    const addressMatch = description.match(
        /\b\d{1,6}\s*,?\s+(?:rue|avenue|av\.?|boulevard|boul\.?|chemin|ch\.?|route|rang|place|pl\.?|promenade|croissant|côte|montee|montée|autoroute|aut\.?|impasse|terrasse|allee|allée|voie|quai)\b.*$/i
    );
    const addressLine1 = explicitAddress || (
        addressMatch ?
            stripTrailingCity(
                addressMatch[0].replace(/^[,\s-]+/, ""),
                result.city
            ) :
            ""
    );
    const projectName = addressMatch ?
        description.slice(
            0,
            addressMatch.index
        ).replace(
            /[,;\s-]+$/,
            ""
        ).trim() :
        description;

    return {
        projectName: projectName || description,
        addressLine1,
        addressLine2: cleanBsdqText(result.address_line2),
        city: cleanBsdqText(result.city)
    };

}


const WEEKDAY_LABELS = [
    "Dim",
    "Lun",
    "Mar",
    "Mer",
    "Jeu",
    "Ven",
    "Sam"
];


const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat(
    "fr-CA",
    {
        month: "long",
        year: "numeric"
    }
);


type ProjectViewMode = "Liste" | "Calendrier";
type ProjectSubmissionMenuKey = "Nouveaux" | "Approuvés" | "Indécis" | "Refusés" | "Envoyés";
type ProjectSubmissionApiState = "new" | "approved" | "undecided" | "refused";


const PROJECT_SUBMISSION_API_STATE: Record<
    Exclude<ProjectSubmissionMenuKey, "Envoyés">,
    ProjectSubmissionApiState
> = {
    Nouveaux: "new",
    Approuvés: "approved",
    Indécis: "undecided",
    Refusés: "refused"
};


const PROJECT_CALENDAR_API_STATES: ProjectSubmissionApiState[] = [
    "new",
    "approved",
    "undecided"
];


const PROJECT_SUBMISSION_LABELS: Record<string, string> = {
    NEW: "Nouveau",
    APPROVED: "Approuvé",
    UNDECIDED: "Indécis",
    REFUSED: "Refusé"
};


const PROJECT_SUBMISSION_STATE_VALUES: Record<
    string,
    ProjectSubmissionApiState
> = {
    NEW: "new",
    APPROVED: "approved",
    UNDECIDED: "undecided",
    REFUSED: "refused"
};


function submissionStateLabel(
    state: string | null
) {

    return PROJECT_SUBMISSION_LABELS[state || "NEW"] || "Nouveau";

}


function submissionMenuApiState(
    menu: ProjectSubmissionMenuKey
) {

    if (menu === "Envoyés")
        return null;

    return PROJECT_SUBMISSION_API_STATE[menu];

}


function nullableValue(
    value: string
) {

    return value.trim() || null;

}


function padDatePart(
    value: number
) {

    return String(value).padStart(
        2,
        "0"
    );

}


function formatDateKey(
    date: Date
) {

    return [
        date.getFullYear(),
        padDatePart(date.getMonth() + 1),
        padDatePart(date.getDate())
    ].join("-");

}


function formatMonthKey(
    date: Date
) {

    return [
        date.getFullYear(),
        padDatePart(date.getMonth() + 1)
    ].join("-");

}


function monthStart(
    monthKey: string
) {

    const [
        year,
        month
    ] = monthKey.split("-").map(Number);

    return new Date(
        year,
        month - 1,
        1
    );

}


function addMonths(
    monthKey: string,
    offset: number
) {

    const start =
        monthStart(monthKey);

    start.setMonth(
        start.getMonth() + offset
    );

    return formatMonthKey(start);

}


function addDays(
    dateKey: string,
    offset: number
) {

    const [
        year,
        month,
        day
    ] = dateKey.split("-").map(Number);
    const date = new Date(
        year,
        month - 1,
        day
    );

    date.setDate(
        date.getDate() + offset
    );

    return formatDateKey(date);

}


function calendarDates(
    monthKey: string
) {

    const firstDay =
        monthStart(monthKey);
    const startOffset =
        firstDay.getDay();
    const daysInMonth =
        new Date(
            firstDay.getFullYear(),
            firstDay.getMonth() + 1,
            0
        ).getDate();
    const cellCount =
        Math.ceil(
            (startOffset + daysInMonth) / 7
        ) * 7;
    const firstCell =
        new Date(
            firstDay.getFullYear(),
            firstDay.getMonth(),
            1 - startOffset
        );

    return Array.from(
        {
            length: cellCount
        },
        (_item, index) => {
            const date =
                new Date(firstCell);

            date.setDate(
                firstCell.getDate() + index
            );

            return date;
        }
    );

}


function fileDisplayName(
    file: File
) {

    return (file as DirectoryFile).webkitRelativePath || file.name;

}


function formatFileSize(
    size: number
) {

    if (!size)
        return "";

    if (size < 1024)
        return `${size} o`;

    if (size < 1024 * 1024)
        return `${(size / 1024).toFixed(1)} Ko`;

    return `${(size / 1024 / 1024).toFixed(1)} Mo`;

}


function formatFileDate(
    value: number
) {

    if (!value)
        return "";

    return new Date(value * 1000).toLocaleDateString(
        "fr-CA"
    );

}


function ProjectsPage({
    projectMenu,
    projectSubmissionState,
    currentUserId,
    onOpenEstimate
}: ProjectsPageProps) {

    const msgInputRef = useRef<HTMLInputElement | null>(null);
    const editMsgInputRef = useRef<HTMLInputElement | null>(null);
    const folderInputRef = useRef<HTMLInputElement | null>(null);
    const calendarInitializedRef = useRef(false);
    const [projects, setProjects] = useState<ProjectSummary[]>([]);
    const [calendarProjects, setCalendarProjects] = useState<ProjectSummary[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [form, setForm] = useState<ProjectInput>(EMPTY_PROJECT);
    const [msgFiles, setMsgFiles] = useState<File[]>([]);
    const [editMsgFiles, setEditMsgFiles] = useState<File[]>([]);
    const [folderFiles, setFolderFiles] = useState<File[]>([]);
    const [editingProject, setEditingProject] = useState<ProjectSummary | null>(null);
    const [folderProject, setFolderProject] = useState<ProjectSummary | null>(null);
    const [projectFolderPath, setProjectFolderPath] = useState("");
    const [projectRootName, setProjectRootName] = useState("");
    const [projectFolderItems, setProjectFolderItems] = useState<EstimateFolderItem[]>([]);
    const [projectFolderSearch, setProjectFolderSearch] = useState("");
    const [isProjectFolderLoading, setIsProjectFolderLoading] = useState(false);
    const [projectFolderError, setProjectFolderError] = useState("");
    const [projectFilePreview, setProjectFilePreview] = useState<EstimateFilePreview | null>(null);
    const [projectPreviewPath, setProjectPreviewPath] = useState("");
    const [projectPdfPreviewUrl, setProjectPdfPreviewUrl] = useState("");
    const [projectPreviewError, setProjectPreviewError] = useState("");
    const [isProjectPreviewLoading, setIsProjectPreviewLoading] = useState(false);
    const [editProjectName, setEditProjectName] = useState("");
    const [editAddressLine1, setEditAddressLine1] = useState("");
    const [editAddressLine2, setEditAddressLine2] = useState("");
    const [editCity, setEditCity] = useState("");
    const [editProvince, setEditProvince] = useState("");
    const [editPostalCode, setEditPostalCode] = useState("");
    const [editBidDueDate, setEditBidDueDate] = useState("");
    const [editBsdqProjectNumber, setEditBsdqProjectNumber] = useState("");
    const [editBsdqDueTime, setEditBsdqDueTime] = useState("");
    const [editClientIds, setEditClientIds] = useState<number[]>([]);
    const [editInvitationClientId, setEditInvitationClientId] = useState<number | null>(null);
    const [editAddenda, setEditAddenda] = useState(EMPTY_ADDENDA);
    const [createBsdqSearchText, setCreateBsdqSearchText] = useState("");
    const [createBsdqResults, setCreateBsdqResults] = useState<BsdqProjectSearchResult[]>([]);
    const [createBsdqSearchError, setCreateBsdqSearchError] = useState("");
    const [isCreateBsdqSearching, setIsCreateBsdqSearching] = useState(false);
    const [editBsdqSearchText, setEditBsdqSearchText] = useState("");
    const [bsdqResults, setBsdqResults] = useState<BsdqProjectSearchResult[]>([]);
    const [bsdqSearchError, setBsdqSearchError] = useState("");
    const [isBsdqSearching, setIsBsdqSearching] = useState(false);
    const [isMsgDragActive, setIsMsgDragActive] = useState(false);
    const [isEditMsgDragActive, setIsEditMsgDragActive] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditSaving, setIsEditSaving] = useState(false);
    const [projectViewMode, setProjectViewMode] = useState<ProjectViewMode>("Liste");
    const [calendarMonth, setCalendarMonth] = useState(
        () =>
            formatMonthKey(new Date())
    );
    const [status, setStatus] = useState("");
    const [error, setError] = useState("");


    const projectsByDueDate = useMemo(
        () => {
            const groupedProjects = new Map<string, ProjectSummary[]>();

            calendarProjects.forEach(
                project => {
                    if (!project.bid_due_date)
                        return;

                    const dayProjects =
                        groupedProjects.get(project.bid_due_date) || [];

                    dayProjects.push(project);
                    groupedProjects.set(
                        project.bid_due_date,
                        dayProjects
                    );
                }
            );

            return groupedProjects;
        },
        [
            calendarProjects
        ]
    );

    const calendarMonthProjects = useMemo(
        () =>
            calendarProjects.filter(
                project =>
                    project.bid_due_date?.startsWith(calendarMonth)
            ),
        [
            calendarMonth,
            calendarProjects
        ]
    );

    const undatedProjects = useMemo(
        () =>
            calendarProjects.filter(
                project =>
                    !project.bid_due_date
            ),
        [
            calendarProjects
        ]
    );

    const filteredProjectFolderItems = useMemo(
        () => {
            const normalizedSearch =
                projectFolderSearch.trim().toLowerCase();

            if (!normalizedSearch)
                return projectFolderItems;

            return projectFolderItems.filter(
                item =>
                    item.name.toLowerCase().includes(normalizedSearch)
            );
        },
        [
            projectFolderItems,
            projectFolderSearch
        ]
    );

    const projectFolderBreadcrumbs = useMemo(
        () => {
            const parts =
                projectFolderPath ?
                    projectFolderPath.split("/") :
                    [];

            return [
                {
                    label:
                        projectRootName || "Dossier projet",
                    path:
                        ""
                },
                ...parts.map(
                    (_part, index) => ({
                        label:
                            parts[index],
                        path:
                            parts.slice(
                                0,
                                index + 1
                            ).join("/")
                    })
                )
            ];
        },
        [
            projectFolderPath,
            projectRootName
        ]
    );


    function loadProjects() {

        setIsLoading(true);
        setError("");

        const submissionApiState = submissionMenuApiState(projectSubmissionState);

        if (submissionApiState === null) {
            setProjects([]);
            setIsLoading(false);
            return;
        }

        fetchProjects(
            projectMenu === "En Soumission" ?
                "submission" :
                "current",
            submissionApiState || "new"
        )
            .then(setProjects)
            .catch(
                () =>
                    setError("Impossible de charger les projets.")
            )
            .finally(
                () =>
                    setIsLoading(false)
            );

    }


    function loadCalendarProjects() {

        if (projectMenu !== "En Soumission" || projectSubmissionState === "Envoyés") {
            setCalendarProjects([]);
            return;
        }

        Promise.all(
            PROJECT_CALENDAR_API_STATES.map(
                submissionState =>
                    fetchProjects(
                        "submission",
                        submissionState
                    )
            )
        )
            .then(
                projectGroups => {
                    const uniqueProjects = new Map<number, ProjectSummary>();

                    projectGroups.flat().forEach(
                        project =>
                            uniqueProjects.set(
                                project.id,
                                project
                            )
                    );

                    setCalendarProjects(
                        Array.from(uniqueProjects.values())
                    );
                }
            )
            .catch(
                () =>
                    setError("Impossible de charger le calendrier des soumissions.")
            );

    }


    function saveProjectSubmissionState(
        projectId: number,
        submissionState: ProjectSubmissionApiState
    ) {

        setStatus("");
        setError("");

        updateProjectSubmissionState(
            projectId,
            submissionState,
            currentUserId
        )
            .then(
                () => {
                    setStatus("Etat du projet enregistré.");
                    loadProjects();
                    loadCalendarProjects();
                }
            )
            .catch(
                error =>
                    setError(
                        error instanceof Error ?
                            error.message :
                            "Impossible d'enregistrer l'état du projet."
                    )
            );

    }


    function loadClients() {

        fetchClients()
            .then(
                nextClients =>
                    setClients(
                        nextClients.filter(
                            client =>
                                client.active
                        )
                    )
            )
            .catch(
                () =>
                    setError("Impossible de charger les clients.")
            );

    }


    function addMsgFiles(
        files: FileList | File[]
    ) {

        const nextFiles = Array.from(files);
        const validFiles = nextFiles.filter(
            file =>
                file.name.toLowerCase().endsWith(".msg")
        );

        if (validFiles.length !== nextFiles.length) {
            setError("Seuls les fichiers .msg sont acceptés dans cette zone.");
        }

        if (validFiles.length > 0) {
            setMsgFiles(
                currentFiles => [
                    ...currentFiles,
                    ...validFiles
                ]
            );
        }

    }


    function addEditMsgFiles(
        files: FileList | File[]
    ) {

        const nextFiles = Array.from(files);
        const validFiles = nextFiles.filter(
            file =>
                file.name.toLowerCase().endsWith(".msg")
        );

        if (validFiles.length !== nextFiles.length) {
            setError("Seuls les fichiers .msg sont acceptés dans cette zone.");
        }

        if (validFiles.length > 0) {
            setEditMsgFiles(
                currentFiles => [
                    ...currentFiles,
                    ...validFiles
                ]
            );
        }

    }


    function openProjectEditor(
        project: ProjectSummary
    ) {

        setEditingProject(project);
        setEditProjectName(project.project_name);
        setEditAddressLine1(project.address_line1 || "");
        setEditAddressLine2(project.address_line2 || "");
        setEditCity(project.city || "");
        setEditProvince(project.province || "QC");
        setEditPostalCode(project.postal_code || "");
        setEditBidDueDate(project.bid_due_date || "");
        setEditBsdqProjectNumber(project.bsdq_project_number || "");
        setEditBsdqDueTime(project.bsdq_due_time || "");
        setEditClientIds(project.client_ids || []);
        setEditInvitationClientId(project.client_ids?.[0] || null);
        setEditMsgFiles([]);
        setEditAddenda(EMPTY_ADDENDA);
        setBsdqResults([]);
        setBsdqSearchError("");
        setEditBsdqSearchText(project.project_name);
        setStatus("");
        setError("");

        if (editMsgInputRef.current)
            editMsgInputRef.current.value = "";

    }


    function searchBsdqForEditingProject() {

        if (!editingProject)
            return;

        setIsBsdqSearching(true);
        setBsdqSearchError("");
        setBsdqResults([]);

        const dateFrom =
            editBidDueDate ?
                addDays(
                    editBidDueDate,
                    -30
                ) :
                formatDateKey(new Date());
        const dateTo =
            editBidDueDate ?
                addDays(
                    editBidDueDate,
                    60
                ) :
                addDays(
                    formatDateKey(new Date()),
                    180
                );

        searchBsdqProjects(
            {
                description: editBsdqSearchText || editingProject.project_name,
                city: editingProject.city,
                date_from: dateFrom,
                date_to: dateTo
            }
        )
            .then(
                response =>
                    setBsdqResults(response.rows)
            )
            .catch(
                error =>
                    setBsdqSearchError(
                        error instanceof Error ?
                            error.message :
                            "Recherche BSDQ impossible."
                    )
            )
            .finally(
                () =>
                    setIsBsdqSearching(false)
            );

    }


    function searchBsdqForNewProject() {

        setIsCreateBsdqSearching(true);
        setCreateBsdqSearchError("");
        setCreateBsdqResults([]);

        const dateFrom =
            form.bid_due_date ?
                addDays(
                    form.bid_due_date,
                    -30
                ) :
                formatDateKey(new Date());
        const dateTo =
            form.bid_due_date ?
                addDays(
                    form.bid_due_date,
                    60
                ) :
                addDays(
                    formatDateKey(new Date()),
                    180
                );

        searchBsdqProjects(
            {
                description: createBsdqSearchText || form.project_name,
                city: form.city,
                date_from: dateFrom,
                date_to: dateTo
            }
        )
            .then(
                response =>
                    setCreateBsdqResults(response.rows)
            )
            .catch(
                error =>
                    setCreateBsdqSearchError(
                        error instanceof Error ?
                            error.message :
                            "Recherche BSDQ impossible."
                    )
            )
            .finally(
                () =>
                    setIsCreateBsdqSearching(false)
            );

    }


    function applyBsdqResultToForm(
        result: BsdqProjectSearchResult
    ) {

        const parsedProject = parseBsdqProjectDescription(result);

        setForm(
            currentForm => ({
                ...currentForm,
                bsdq_project_number: result.bsdq_project_number,
                project_name: parsedProject.projectName || currentForm.project_name,
                address_line1:
                    parsedProject.addressLine1 || currentForm.address_line1,
                address_line2:
                    parsedProject.addressLine2 || currentForm.address_line2,
                city: parsedProject.city || currentForm.city,
                bid_due_date: result.due_date || currentForm.bid_due_date,
                bsdq_due_time: result.due_time || currentForm.bsdq_due_time
            })
        );

    }


    function applyBsdqResultToEdit(
        result: BsdqProjectSearchResult
    ) {

        const parsedProject = parseBsdqProjectDescription(result);

        setEditBsdqProjectNumber(result.bsdq_project_number);
        setEditProjectName(
            parsedProject.projectName || editProjectName
        );

        if (parsedProject.addressLine1)
            setEditAddressLine1(parsedProject.addressLine1);

        if (parsedProject.addressLine2)
            setEditAddressLine2(parsedProject.addressLine2);

        if (parsedProject.city)
            setEditCity(parsedProject.city);

        if (result.due_date)
            setEditBidDueDate(result.due_date);

        if (result.due_time)
            setEditBsdqDueTime(result.due_time);

    }


    function renderBsdqResults(
        results: BsdqProjectSearchResult[],
        onApply: (result: BsdqProjectSearchResult) => void
    ) {

        if (results.length === 0)
            return null;

        return (
            <div className="business-compact-list">
                {results.map(
                    result => (
                        <div
                            key={`${result.bsdq_project_number}-${result.due_at_text}-${result.city}`}
                            className="business-compact-item"
                        >
                            <div>
                                <strong>{result.bsdq_project_number}</strong>
                                <span>{result.description}</span>
                                <small>
                                    {result.city || "-"}
                                    {" | Tombée: "}
                                    {result.due_at_text || "Non indiquée"}
                                </small>
                            </div>
                            <button
                                type="button"
                                onClick={
                                    () =>
                                        onApply(result)
                                }
                            >
                                Utiliser
                            </button>
                        </div>
                    )
                )}
            </div>
        );

    }


    function loadProjectFolder(
        projectId: number,
        path = ""
    ) {

        setIsProjectFolderLoading(true);
        setProjectFolderError("");

        fetchProjectFolders(
            projectId,
            path
        )

        .then(
            response => {
                setProjectFolderPath(response.path);
                setProjectRootName(response.root_name);
                setProjectFolderItems(response.items);
            }
        )

        .catch(
            error =>
                setProjectFolderError(
                    error instanceof Error ?
                        error.message :
                        "Impossible de charger le dossier projet."
                )
        )

        .finally(
            () =>
                setIsProjectFolderLoading(false)
        );

    }


    function openProjectFolder(
        project: ProjectSummary
    ) {

        setFolderProject(project);
        setProjectFolderPath("");
        setProjectRootName("");
        setProjectFolderItems([]);
        setProjectFolderSearch("");
        setProjectFolderError("");
        setProjectFilePreview(null);
        setProjectPreviewPath("");
        setProjectPdfPreviewUrl("");
        setProjectPreviewError("");
        loadProjectFolder(
            project.id,
            ""
        );

    }


    function closeProjectFolder() {

        setFolderProject(null);
        setProjectFolderPath("");
        setProjectRootName("");
        setProjectFolderSearch("");
        setProjectFolderItems([]);
        setProjectFilePreview(null);
        setProjectPreviewPath("");
        setProjectPdfPreviewUrl("");
        setProjectPreviewError("");

    }


    function openProjectFolderPath(
        path: string
    ) {

        if (!folderProject)
            return;

        setProjectFilePreview(null);
        setProjectPreviewPath("");
        setProjectPdfPreviewUrl("");
        setProjectPreviewError("");
        loadProjectFolder(
            folderProject.id,
            path
        );

    }


    function openProjectFolderParent() {

        if (!projectFolderPath)
            return;

        openProjectFolderPath(
            projectFolderPath.split("/").slice(
                0,
                -1
            ).join("/")
        );

    }


    function openProjectFilePreview(
        item: EstimateFolderItem
    ) {

        if (!folderProject)
            return;

        setProjectPreviewPath(item.relative_path);
        setProjectFilePreview(null);
        setProjectPdfPreviewUrl("");
        setProjectPreviewError("");
        setIsProjectPreviewLoading(true);

        fetchProjectFilePreview(
            folderProject.id,
            item.relative_path
        )

        .then(
            preview => {
                setProjectFilePreview(preview);

                if (preview.type === "pdf")
                    setProjectPdfPreviewUrl(
                        projectFilePreviewUrl(
                            folderProject.id,
                            item.relative_path
                        )
                    );
            }
        )

        .catch(
            () =>
                setProjectPreviewError("Aperçu non disponible pour ce fichier.")
        )

        .finally(
            () =>
                setIsProjectPreviewLoading(false)
        );

    }


    function openProjectFolderItem(
        item: EstimateFolderItem
    ) {

        if (item.is_dir) {
            openProjectFolderPath(item.relative_path);
            return;
        }

        openProjectFilePreview(item);

    }


    function renderProjectFilePreview() {

        if (!folderProject)
            return null;

        if (!projectFilePreview && !projectPreviewError && !isProjectPreviewLoading)
            return (
                <aside className="estimate-file-preview empty">
                    Sélectionner un PDF, Word, Excel ou courriel .msg.
                </aside>
            );

        return (
            <aside className="estimate-file-preview">
                <header>
                    <strong>
                        {projectFilePreview?.name || "Prévisualisation"}
                    </strong>
                    <div>
                        {projectPreviewPath && (
                            <button
                                type="button"
                                onClick={
                                    () =>
                                        window.open(
                                            projectFileUrl(
                                                folderProject.id,
                                                projectPreviewPath
                                            ),
                                            "_blank",
                                            "noopener,noreferrer"
                                        )
                                }
                            >
                                Ouvrir
                            </button>
                        )}
                        {projectFilePreview?.type === "pdf" && projectPdfPreviewUrl && (
                            <button
                                type="button"
                                onClick={
                                    () => openPdfPreviewWindow(
                                        projectPdfPreviewUrl,
                                        projectFilePreview.name
                                    )
                                }
                            >
                                Plein écran
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={
                                () => {
                                    setProjectFilePreview(null);
                                    setProjectPreviewPath("");
                                    setProjectPdfPreviewUrl("");
                                    setProjectPreviewError("");
                                }
                            }
                        >
                            Fermer
                        </button>
                    </div>
                </header>

                {isProjectPreviewLoading && (
                    <div className="estimate-file-preview-empty">
                        Chargement...
                    </div>
                )}

                {projectPreviewError && (
                    <div className="estimate-folder-error">
                        {projectPreviewError}
                    </div>
                )}

                {projectFilePreview?.type === "pdf" && projectPdfPreviewUrl && (
                    <object
                        className="estimate-pdf-object"
                        data={projectPdfPreviewUrl}
                        type="application/pdf"
                    >
                        <div className="estimate-file-preview-empty">
                            Prévisualisation non disponible dans ce navigateur.
                        </div>
                    </object>
                )}

                {projectFilePreview?.type === "msg" && (
                    <div className="msg-preview">
                        <h2>{projectFilePreview.subject}</h2>
                        <dl>
                            <dt>De</dt>
                            <dd>{projectFilePreview.from || "-"}</dd>
                            <dt>À</dt>
                            <dd>{projectFilePreview.to || "-"}</dd>
                            {projectFilePreview.cc && (
                                <>
                                    <dt>CC</dt>
                                    <dd>{projectFilePreview.cc}</dd>
                                </>
                            )}
                            <dt>Date</dt>
                            <dd>{projectFilePreview.date || "-"}</dd>
                        </dl>
                        {projectFilePreview.attachments.length > 0 && (
                            <div className="msg-attachments">
                                <strong>Pièces jointes</strong>
                                {projectFilePreview.attachments.map(
                                    attachment => (
                                        <span key={attachment}>
                                            {attachment}
                                        </span>
                                    )
                                )}
                            </div>
                        )}
                        {projectFilePreview.html ? (
                            <iframe
                                className="msg-html-frame"
                                title={projectFilePreview.subject || projectFilePreview.name}
                                sandbox="allow-popups allow-popups-to-escape-sandbox"
                                srcDoc={clickableMsgHtml(projectFilePreview.html)}
                            />
                        ) : (
                            <pre>
                                {projectFilePreview.body || "Aucun contenu texte."}
                            </pre>
                        )}
                    </div>
                )}
            </aside>
        );

    }


    function renderProjectFolderPage() {

        if (!folderProject)
            return null;

        return (
            <div className="matrix-page estimate-folder-page">
                <div className="estimate-folder-toolbar">
                    <button
                        type="button"
                        className="estimate-folder-back"
                        onClick={closeProjectFolder}
                    >
                        Retour aux projets
                    </button>

                    <div className="estimate-folder-breadcrumbs">
                        {projectFolderBreadcrumbs.map(
                            (breadcrumb, index) => (
                                <button
                                    key={`${breadcrumb.path}-${index}`}
                                    type="button"
                                    onClick={
                                        () =>
                                            openProjectFolderPath(breadcrumb.path)
                                    }
                                >
                                    {index > 0 && "/ "}
                                    {breadcrumb.label}
                                </button>
                            )
                        )}
                    </div>

                    <input
                        type="search"
                        value={projectFolderSearch}
                        onChange={
                            event =>
                                setProjectFolderSearch(event.target.value)
                        }
                        placeholder="Rechercher"
                    />
                </div>

                <div className="estimate-folder-content">
                    {projectFolderPath && (
                        <button
                            type="button"
                            className="estimate-folder-back"
                            onClick={openProjectFolderParent}
                        >
                            Remonter
                        </button>
                    )}

                    {projectFolderError && (
                        <div className="estimate-folder-error">
                            {projectFolderError}
                        </div>
                    )}

                    {isProjectFolderLoading && (
                        <div className="estimate-folder-empty">
                            Chargement...
                        </div>
                    )}

                    {!isProjectFolderLoading && !projectFolderError && (
                        <div className="estimate-folder-browser">
                            <div className="estimate-folder-list">
                                {filteredProjectFolderItems.map(
                                    item => (
                                        <button
                                            key={item.relative_path}
                                            type="button"
                                            className={
                                                [
                                                    item.is_dir ?
                                                        "estimate-folder-item directory" :
                                                        "estimate-folder-item file",
                                                    item.relative_path === projectPreviewPath ?
                                                        "selected" :
                                                        ""
                                                ].filter(Boolean).join(" ")
                                            }
                                            onClick={
                                                () =>
                                                    openProjectFolderItem(item)
                                            }
                                        >
                                            <span className="estimate-folder-icon">
                                                {item.is_dir ? "Dossier" : "Fichier"}
                                            </span>
                                            <span className="estimate-folder-name">
                                                {item.name}
                                            </span>
                                            <span className="estimate-folder-meta">
                                                {item.is_dir ?
                                                    "" :
                                                    formatFileSize(item.size)}
                                            </span>
                                            <span className="estimate-folder-date">
                                                {formatFileDate(item.modified_at)}
                                            </span>
                                        </button>
                                    )
                                )}

                                {filteredProjectFolderItems.length === 0 && (
                                    <div className="estimate-folder-empty">
                                        Aucun élément à afficher.
                                    </div>
                                )}
                            </div>

                            {renderProjectFilePreview()}
                        </div>
                    )}
                </div>
            </div>
        );

    }


    function toggleEditClient(
        clientId: number
    ) {

        setEditClientIds(
            currentIds =>
                currentIds.includes(clientId) ?
                    currentIds.filter(
                        currentId =>
                            currentId !== clientId
                    ) :
                    [
                        ...currentIds,
                        clientId
                    ]
        );

        setEditInvitationClientId(
            currentClientId =>
                currentClientId === clientId ?
                    null :
                    currentClientId || clientId
        );

    }


    function saveProjectEdit(
        event: FormEvent<HTMLFormElement>
    ) {

        event.preventDefault();

        if (!editingProject)
            return;

        setIsEditSaving(true);
        setError("");
        setStatus("");

        updateProjectCurrent(
            editingProject.id,
            {
                project_name: editProjectName.trim(),
                address_line1: nullableValue(editAddressLine1),
                address_line2: nullableValue(editAddressLine2),
                city: nullableValue(editCity),
                province: nullableValue(editProvince),
                postal_code: nullableValue(editPostalCode),
                bid_due_date: editBidDueDate || null,
                bsdq_project_number: nullableValue(editBsdqProjectNumber),
                bsdq_due_time: nullableValue(editBsdqDueTime),
                client_ids: editClientIds,
                invitation_client_id: editInvitationClientId,
                msgFiles: editMsgFiles,
                addenda: editAddenda
            }
        )
            .then(
                response => {
                    setStatus(
                        "Projet modifié. Révision 0 " +
                        (
                            response.revision_zero_created ?
                                "créée" :
                                "déjà existante"
                        ) +
                        `. ${response.msg_file_count} courriel(s) ajouté(s).`
                    );
                    setEditingProject(null);
                    setEditMsgFiles([]);
                    setEditAddenda(EMPTY_ADDENDA);

                    if (editMsgInputRef.current)
                        editMsgInputRef.current.value = "";

                    loadProjects();
                }
            )
            .catch(
                error =>
                    setError(
                        error instanceof Error ?
                            error.message :
                            "Impossible de modifier le projet."
                    )
            )
            .finally(
                () =>
                    setIsEditSaving(false)
            );

    }


    function browseUploadFolder() {

        if (!folderInputRef.current)
            return;

        folderInputRef.current.setAttribute("webkitdirectory", "");
        folderInputRef.current.setAttribute("directory", "");
        folderInputRef.current.click();

    }


    function saveProject(
        event: FormEvent<HTMLFormElement>
    ) {

        event.preventDefault();
        setIsSaving(true);
        setError("");
        setStatus("");

        createProjectWithFiles(
            {
                ...form,
                project_number: nullableValue(form.project_number || ""),
                bsdq_project_number: nullableValue(form.bsdq_project_number || ""),
                project_name: form.project_name.trim(),
                address_line1: nullableValue(form.address_line1 || ""),
                address_line2: nullableValue(form.address_line2 || ""),
                city: nullableValue(form.city || ""),
                province: nullableValue(form.province || ""),
                postal_code: nullableValue(form.postal_code || ""),
                bsdq_due_time: nullableValue(form.bsdq_due_time || ""),
                architect_name: nullableValue(form.architect_name || ""),
                probable_schedule: nullableValue(form.probable_schedule || ""),
                source_template_path: nullableValue(form.source_template_path || "")
            },
            msgFiles,
            folderFiles
        )
            .then(
                response => {
                    setStatus(
                        `Projet créé dans ${response.folder_name}. ` +
                        `${response.msg_file_count || 0} courriel(s), ` +
                        `${response.upload_file_count || 0} fichier(s) téléversé(s).`
                    );
                    setForm(EMPTY_PROJECT);
                    setCreateBsdqSearchText("");
                    setCreateBsdqResults([]);
                    setCreateBsdqSearchError("");
                    setMsgFiles([]);
                    setFolderFiles([]);

                    if (msgInputRef.current)
                        msgInputRef.current.value = "";

                    if (folderInputRef.current)
                        folderInputRef.current.value = "";

                    loadProjects();
                }
            )
            .catch(
                error =>
                    setError(
                        error instanceof Error ?
                            error.message :
                            "Impossible de créer le projet."
                    )
            )
            .finally(
                () =>
                    setIsSaving(false)
            );

    }


    useEffect(
        () => {
            calendarInitializedRef.current = false;
            loadProjects();
            loadCalendarProjects();
            loadClients();
        },
        [
            projectMenu,
            projectSubmissionState
        ]
    );


    useEffect(
        () => {
            if (projectMenu !== "En Soumission")
                return;

            if (calendarInitializedRef.current)
                return;

            const firstDatedProject = calendarProjects.find(
                project =>
                    project.bid_due_date
            );

            if (!firstDatedProject?.bid_due_date)
                return;

            setCalendarMonth(
                firstDatedProject.bid_due_date.slice(
                    0,
                    7
                )
            );
            calendarInitializedRef.current = true;
        },
        [
            projectMenu,
            calendarProjects
        ]
    );


    if (folderProject)
        return renderProjectFolderPage();


    if (projectMenu === "En Soumission" && projectSubmissionState === "Envoyés") {
        return (
            <section className="business-page">
                <div className="business-toolbar">
                    <div className="business-summary">
                        <strong>0</strong>
                        <span>soumissions envoyées</span>
                    </div>
                </div>
                <div className="business-empty-panel">
                    L'état des soumissions envoyées sera affiché ici lorsque la fonction d'envoi sera disponible.
                </div>
            </section>
        );
    }


    if (projectMenu === "Création") {
        return (
            <section className="business-page">
                <form
                    className="project-create"
                    onSubmit={saveProject}
                >
                    <div className="business-section-heading">
                        <div>
                            <span>Projets</span>
                            <h2>Création</h2>
                        </div>
                        <button
                            type="submit"
                            disabled={isSaving}
                        >
                            Créer projet
                        </button>
                    </div>

                    {status && (
                        <div className="business-status">{status}</div>
                    )}
                    {error && (
                        <div className="business-error">{error}</div>
                    )}

                    <div className="business-form-grid">
                        <label className="business-field">
                            <span>No projet</span>
                            <input
                                value={form.project_number || ""}
                                onChange={
                                    event =>
                                        setForm(
                                            {
                                                ...form,
                                                project_number: event.target.value
                                            }
                                        )
                                }
                            />
                        </label>

                        <label className="business-field wide">
                            <span>Nom du projet</span>
                            <input
                                value={form.project_name}
                                required
                                onChange={
                                    event =>
                                        setForm(
                                            {
                                                ...form,
                                                project_name: event.target.value
                                            }
                                        )
                                }
                            />
                        </label>

                        <label className="business-field">
                            <span>Client</span>
                            <select
                                value={form.client_id || ""}
                                onChange={
                                    event =>
                                        setForm(
                                            {
                                                ...form,
                                                client_id:
                                                    event.target.value ?
                                                        Number(event.target.value) :
                                                        null
                                            }
                                        )
                                }
                            >
                                <option value="">Aucun client</option>
                                {clients.map(
                                    client => (
                                        <option
                                            key={client.id}
                                            value={client.id}
                                        >
                                            {client.name}
                                        </option>
                                    )
                                )}
                            </select>
                        </label>

                        <label className="business-field">
                            <span>Date dépôt</span>
                            <input
                                type="date"
                                value={form.bid_due_date || ""}
                                onChange={
                                    event =>
                                        setForm(
                                            {
                                                ...form,
                                                bid_due_date: event.target.value || null
                                            }
                                        )
                                }
                            />
                        </label>

                        <label className="business-field wide">
                            <span>Adresse</span>
                            <input
                                value={form.address_line1 || ""}
                                onChange={
                                    event =>
                                        setForm(
                                            {
                                                ...form,
                                                address_line1: event.target.value
                                            }
                                        )
                                }
                            />
                        </label>

                        <label className="business-field">
                            <span>Ville</span>
                            <input
                                value={form.city || ""}
                                onChange={
                                    event =>
                                        setForm(
                                            {
                                                ...form,
                                                city: event.target.value
                                            }
                                        )
                                }
                            />
                        </label>

                        <label className="business-field">
                            <span>Province</span>
                            <input
                                value={form.province || ""}
                                onChange={
                                    event =>
                                        setForm(
                                            {
                                                ...form,
                                                province: event.target.value
                                            }
                                        )
                                }
                            />
                        </label>

                        <label className="business-field">
                            <span>Code postal</span>
                            <input
                                value={form.postal_code || ""}
                                onChange={
                                    event =>
                                        setForm(
                                            {
                                                ...form,
                                                postal_code: event.target.value
                                            }
                                        )
                                }
                            />
                        </label>

                        <label className="business-field">
                            <span>Début probable</span>
                            <input
                                type="date"
                                value={form.start_date || ""}
                                onChange={
                                    event =>
                                        setForm(
                                            {
                                                ...form,
                                                start_date: event.target.value || null
                                            }
                                        )
                                }
                            />
                        </label>

                        <label className="business-field">
                            <span>Fin probable</span>
                            <input
                                type="date"
                                value={form.end_date || ""}
                                onChange={
                                    event =>
                                        setForm(
                                            {
                                                ...form,
                                                end_date: event.target.value || null
                                            }
                                        )
                                }
                            />
                        </label>

                        <label className="business-field wide">
                            <span>Architecte</span>
                            <input
                                value={form.architect_name || ""}
                                onChange={
                                    event =>
                                        setForm(
                                            {
                                                ...form,
                                                architect_name: event.target.value
                                            }
                                        )
                                }
                            />
                        </label>
                    </div>

                    <section className="business-edit-section">
                        <div className="business-section-heading">
                            <div>
                                <span>BSDQ</span>
                                <h2>Babillard de projets</h2>
                            </div>
                            <button
                                type="button"
                                onClick={searchBsdqForNewProject}
                                disabled={isCreateBsdqSearching || (!createBsdqSearchText && !form.project_name)}
                            >
                                {isCreateBsdqSearching ? "Recherche..." : "Rechercher"}
                            </button>
                        </div>

                        <div className="business-form-grid compact">
                            <label className="business-field wide">
                                <span>Texte à rechercher</span>
                                <input
                                    value={createBsdqSearchText}
                                    placeholder={form.project_name || "Nom, numéro ou mots clés du babillard"}
                                    onChange={
                                        event =>
                                            setCreateBsdqSearchText(event.target.value)
                                    }
                                />
                            </label>

                            <label className="business-field">
                                <span>No BSDQ</span>
                                <input
                                    value={form.bsdq_project_number || ""}
                                    onChange={
                                        event =>
                                            setForm(
                                                {
                                                    ...form,
                                                    bsdq_project_number: event.target.value
                                                }
                                            )
                                    }
                                />
                            </label>

                            <label className="business-field">
                                <span>Heure tombée</span>
                                <input
                                    type="time"
                                    value={form.bsdq_due_time || ""}
                                    onChange={
                                        event =>
                                            setForm(
                                                {
                                                    ...form,
                                                    bsdq_due_time: event.target.value || null
                                                }
                                            )
                                    }
                                />
                            </label>
                        </div>

                        {createBsdqSearchError && (
                            <div className="business-error">
                                {createBsdqSearchError}
                            </div>
                        )}

                        {!createBsdqSearchError && createBsdqResults.length === 0 && !isCreateBsdqSearching && (
                            <div className="business-muted-panel">
                                Recherche un projet ouvert au babillard BSDQ et remplit le numéro BSDQ, la date et l'heure de tombée.
                            </div>
                        )}

                        {renderBsdqResults(
                            createBsdqResults,
                            applyBsdqResultToForm
                        )}
                    </section>

                    <div className="business-upload-grid">
                        <div
                            className={
                                "business-dropzone" +
                                (isMsgDragActive ? " dragging" : "")
                            }
                            onDragOver={
                                event => {
                                    event.preventDefault();
                                    setIsMsgDragActive(true);
                                }
                            }
                            onDragLeave={
                                () =>
                                    setIsMsgDragActive(false)
                            }
                            onDrop={
                                event => {
                                    event.preventDefault();
                                    setIsMsgDragActive(false);
                                    addMsgFiles(event.dataTransfer.files);
                                }
                            }
                        >
                            <div>
                                <span>Courriel Outlook</span>
                                <h3>Glisser un .msg</h3>
                            </div>
                            <button
                                type="button"
                                onClick={
                                    () =>
                                        msgInputRef.current?.click()
                                }
                            >
                                Parcourir .msg
                            </button>
                            <input
                                ref={msgInputRef}
                                className="business-hidden-input"
                                type="file"
                                accept=".msg"
                                multiple
                                onChange={
                                    event =>
                                        addMsgFiles(event.target.files || [])
                                }
                            />
                            {msgFiles.length > 0 && (
                                <ul className="business-file-list">
                                    {msgFiles.slice(0, 6).map(
                                        (file, index) => (
                                            <li key={`${file.name}-${index}`}>
                                                {file.name}
                                            </li>
                                        )
                                    )}
                                    {msgFiles.length > 6 && (
                                        <li>
                                            +{msgFiles.length - 6} autre(s)
                                        </li>
                                    )}
                                </ul>
                            )}
                        </div>

                        <div className="business-upload-panel">
                            <div>
                                <span>Dossier à téléverser</span>
                                <h3>Fichiers projet</h3>
                            </div>
                            <button
                                type="button"
                                onClick={browseUploadFolder}
                            >
                                Parcourir dossier
                            </button>
                            <input
                                ref={folderInputRef}
                                className="business-hidden-input"
                                type="file"
                                multiple
                                onChange={
                                    event =>
                                        setFolderFiles(
                                            Array.from(event.target.files || [])
                                        )
                                }
                            />
                            <div className="business-upload-count">
                                {folderFiles.length} fichier(s) sélectionné(s)
                            </div>
                            {folderFiles.length > 0 && (
                                <ul className="business-file-list">
                                    {folderFiles.slice(0, 6).map(
                                        (file, index) => (
                                            <li key={`${fileDisplayName(file)}-${index}`}>
                                                {fileDisplayName(file)}
                                            </li>
                                        )
                                    )}
                                    {folderFiles.length > 6 && (
                                        <li>
                                            +{folderFiles.length - 6} autre(s)
                                        </li>
                                    )}
                                </ul>
                            )}
                        </div>
                    </div>
                </form>
            </section>
        );
    }


    return (
        <section className="business-page">
            <div className="business-toolbar">
                <button
                    type="button"
                    onClick={loadProjects}
                    disabled={isLoading}
                >
                    Rafraîchir
                </button>
                <div className="business-summary">
                    <strong>{projects.length}</strong>
                    <span>
                        {projectMenu === "En Soumission" ?
                            (
                                "projets " +
                                submissionStateLabel(
                                    Object.keys(PROJECT_SUBMISSION_STATE_VALUES).find(
                                        state =>
                                            PROJECT_SUBMISSION_STATE_VALUES[state] ===
                                            submissionMenuApiState(projectSubmissionState)
                                    ) || "NEW"
                                ).toLowerCase()
                            ) :
                            "projets en cours"}
                    </span>
                </div>
            </div>

            {error && (
                <div className="business-error">{error}</div>
            )}

            {status && (
                <div className="business-status">{status}</div>
            )}

            {projectMenu === "En Soumission" && (
                <div className="business-tabs">
                    {(["Liste", "Calendrier"] as ProjectViewMode[]).map(
                        viewMode => (
                            <button
                                key={viewMode}
                                type="button"
                                className={
                                    projectViewMode === viewMode ?
                                        "active" :
                                        ""
                                }
                                onClick={
                                    () =>
                                        setProjectViewMode(viewMode)
                                }
                            >
                                {viewMode}
                            </button>
                        )
                    )}
                </div>
            )}

            {projectViewMode === "Calendrier" && projectMenu === "En Soumission" ? (
                <div className="project-calendar-wrap">
                    <div className="project-calendar-toolbar">
                        <button
                            type="button"
                            onClick={
                                () =>
                                    setCalendarMonth(
                                        addMonths(
                                            calendarMonth,
                                            -1
                                        )
                                    )
                            }
                        >
                            Mois précédent
                        </button>
                        <strong>
                            {MONTH_LABEL_FORMATTER.format(monthStart(calendarMonth))}
                        </strong>
                        <button
                            type="button"
                            onClick={
                                () =>
                                    setCalendarMonth(
                                        formatMonthKey(new Date())
                                    )
                            }
                        >
                            Aujourd'hui
                        </button>
                        <button
                            type="button"
                            onClick={
                                () =>
                                    setCalendarMonth(
                                        addMonths(
                                            calendarMonth,
                                            1
                                        )
                                    )
                            }
                        >
                            Mois suivant
                        </button>
                        <span>
                            {calendarMonthProjects.length} dépôt(s)
                        </span>
                    </div>

                    <div className="project-calendar-weekdays">
                        {WEEKDAY_LABELS.map(
                            weekday => (
                                <div key={weekday}>{weekday}</div>
                            )
                        )}
                    </div>

                    <div className="project-calendar-grid">
                        {calendarDates(calendarMonth).map(
                            date => {
                                const dateKey =
                                    formatDateKey(date);
                                const dayProjects =
                                    projectsByDueDate.get(dateKey) || [];
                                const isOutsideMonth =
                                    formatMonthKey(date) !== calendarMonth;
                                const isToday =
                                    dateKey === formatDateKey(new Date());

                                return (
                                    <div
                                        key={dateKey}
                                        className={[
                                            "project-calendar-day",
                                            isOutsideMonth ? "outside" : "",
                                            isToday ? "today" : "",
                                            dayProjects.length ? "has-projects" : ""
                                        ].filter(Boolean).join(" ")}
                                    >
                                        <div className="project-calendar-day-number">
                                            {date.getDate()}
                                        </div>
                                        <div className="project-calendar-items">
                                            {dayProjects.map(
                                                project => (
                                                    <button
                                                        key={project.id}
                                                        type="button"
                                                        className={
                                                            "project-calendar-item " +
                                                            (
                                                                project.submission_state === "APPROVED" ?
                                                                    "approved" :
                                                                    project.submission_state === "UNDECIDED" ?
                                                                        "undecided" :
                                                                        "new"
                                                            )
                                                        }
                                                        disabled={!project.latest_estimate_id}
                                                        onClick={
                                                            () => {
                                                                if (project.latest_estimate_id)
                                                                    onOpenEstimate(project.latest_estimate_id);
                                                            }
                                                        }
                                                    >
                                                        <strong>
                                                            {project.project_number || "Sans no"}
                                                        </strong>
                                                        <span>{project.project_name}</span>
                                                        {project.client_names && (
                                                            <small>
                                                                {project.client_names}
                                                            </small>
                                                        )}
                                                    </button>
                                                )
                                            )}
                                        </div>
                                    </div>
                                );
                            }
                        )}
                    </div>

                    {undatedProjects.length > 0 && (
                        <div className="project-calendar-undated">
                            <strong>Sans date de dépôt</strong>
                            {undatedProjects.map(
                                project => (
                                    <button
                                        key={project.id}
                                        type="button"
                                        onClick={
                                            () =>
                                                openProjectEditor(project)
                                        }
                                    >
                                        {project.project_number || "-"}
                                        {" - "}
                                        {project.project_name}
                                    </button>
                                )
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <div className="business-table-wrap">
                    <table className="business-table">
                        <thead>
                            <tr>
                                <th>No</th>
                                <th>Projet</th>
                                <th>Client</th>
                                <th>Adresse</th>
                                <th>Dépôt</th>
                                {projectMenu === "En Soumission" && (
                                    <th>BSDQ</th>
                                )}
                                <th>Échéancier</th>
                                <th>Révisions</th>
                                {projectMenu === "En Soumission" && (
                                    <>
                                        <th>État</th>
                                        <th>Enregistré par</th>
                                    </>
                                )}
                                <th>Statut</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={projectMenu === "En Soumission" ? 12 : 9}>
                                        Chargement...
                                    </td>
                                </tr>
                            ) : projects.length === 0 ? (
                                <tr>
                                    <td colSpan={projectMenu === "En Soumission" ? 12 : 9}>
                                        Aucun projet à afficher.
                                    </td>
                                </tr>
                            ) : (
                                projects.map(
                                    project => (
                                        <tr key={project.id}>
                                            <td>{project.project_number || "-"}</td>
                                            <td>{project.project_name}</td>
                                            <td>{project.client_names || "-"}</td>
                                            <td>{project.address || "-"}</td>
                                            <td>{project.bid_due_date || "-"}</td>
                                            {projectMenu === "En Soumission" && (
                                                <td>
                                                    {project.bsdq_project_number || "-"}
                                                    {project.bsdq_due_time && (
                                                        <small className="business-muted-line">
                                                            {project.bsdq_due_time}
                                                        </small>
                                                    )}
                                                </td>
                                            )}
                                            <td>
                                                {project.start_date || "-"}
                                                {" à "}
                                                {project.end_date || "-"}
                                            </td>
                                            <td>{project.revision_count}</td>
                                            {projectMenu === "En Soumission" && (
                                                <>
                                                    <td>
                                                        <select
                                                            value={
                                                                PROJECT_SUBMISSION_STATE_VALUES[
                                                                    project.submission_state || "NEW"
                                                                ] || "new"
                                                            }
                                                            onChange={
                                                                event =>
                                                                    saveProjectSubmissionState(
                                                                        project.id,
                                                                        event.target.value as ProjectSubmissionApiState
                                                                    )
                                                            }
                                                        >
                                                            <option value="new">Nouveau</option>
                                                            <option value="approved">Approuvé</option>
                                                            <option value="undecided">Indécis</option>
                                                            <option value="refused">Refusé</option>
                                                        </select>
                                                    </td>
                                                    <td>
                                                        {project.submission_state_user_name || "-"}
                                                        {project.submission_state_updated_at && (
                                                            <small className="business-muted-line">
                                                                {new Date(
                                                                    project.submission_state_updated_at
                                                                ).toLocaleDateString("fr-CA")}
                                                            </small>
                                                        )}
                                                    </td>
                                                </>
                                            )}
                                            <td>{project.status || "-"}</td>
                                            <td>
                                                {projectMenu === "En Soumission" && (
                                                    <button
                                                        type="button"
                                                        className="business-table-action"
                                                        onClick={
                                                            () =>
                                                                openProjectFolder(project)
                                                        }
                                                    >
                                                        Dossier
                                                    </button>
                                                )}
                                                {projectMenu === "En Soumission" && (
                                                    <button
                                                        type="button"
                                                        className="business-table-action"
                                                        disabled={!project.latest_estimate_id}
                                                        onClick={
                                                            () => {
                                                                if (project.latest_estimate_id)
                                                                    onOpenEstimate(project.latest_estimate_id);
                                                            }
                                                        }
                                                    >
                                                        Dernière révision
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    className="business-table-action"
                                                    onClick={
                                                        () =>
                                                            openProjectEditor(project)
                                                    }
                                                >
                                                    Modifier
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                )
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {editingProject && (
                <div className="business-modal-backdrop">
                    <form
                        className="business-modal project-edit-modal"
                        onSubmit={saveProjectEdit}
                    >
                        <header>
                            <div>
                                <span>Projet en cours</span>
                                <h2>Modifier</h2>
                            </div>
                            <button
                                type="button"
                                onClick={
                                    () =>
                                        setEditingProject(null)
                                }
                            >
                                Annuler
                            </button>
                        </header>

                        <div className="business-form-grid compact">
                            <label className="business-field wide">
                                <span>Projet</span>
                                <input
                                    value={editProjectName}
                                    required
                                    onChange={
                                        event =>
                                            setEditProjectName(event.target.value)
                                    }
                                />
                            </label>

                            <label className="business-field">
                                <span>Date dépôt</span>
                                <input
                                    type="date"
                                    value={editBidDueDate}
                                    onChange={
                                        event =>
                                            setEditBidDueDate(event.target.value)
                                    }
                                />
                            </label>

                            <label className="business-field wide">
                                <span>Adresse</span>
                                <input
                                    value={editAddressLine1}
                                    onChange={
                                        event =>
                                            setEditAddressLine1(event.target.value)
                                    }
                                />
                            </label>

                            <label className="business-field wide">
                                <span>Adresse 2</span>
                                <input
                                    value={editAddressLine2}
                                    onChange={
                                        event =>
                                            setEditAddressLine2(event.target.value)
                                    }
                                />
                            </label>

                            <label className="business-field">
                                <span>Ville</span>
                                <input
                                    value={editCity}
                                    onChange={
                                        event =>
                                            setEditCity(event.target.value)
                                    }
                                />
                            </label>

                            <label className="business-field">
                                <span>Province</span>
                                <input
                                    value={editProvince}
                                    onChange={
                                        event =>
                                            setEditProvince(event.target.value)
                                    }
                                />
                            </label>

                            <label className="business-field">
                                <span>Code postal</span>
                                <input
                                    value={editPostalCode}
                                    onChange={
                                        event =>
                                            setEditPostalCode(event.target.value)
                                    }
                                />
                            </label>
                        </div>

                        <section className="business-edit-section">
                            <div className="business-section-heading">
                                <div>
                                    <span>BSDQ</span>
                                    <h2>Babillard de projets</h2>
                                </div>
                                <button
                                    type="button"
                                    onClick={searchBsdqForEditingProject}
                                    disabled={isBsdqSearching}
                                >
                                    {isBsdqSearching ? "Recherche..." : "Rechercher"}
                                </button>
                            </div>

                            <div className="business-form-grid compact">
                                <label className="business-field wide">
                                    <span>Texte à rechercher</span>
                                    <input
                                        value={editBsdqSearchText}
                                        placeholder={editingProject.project_name}
                                        onChange={
                                            event =>
                                                setEditBsdqSearchText(event.target.value)
                                        }
                                    />
                                </label>

                                <label className="business-field">
                                    <span>No BSDQ</span>
                                    <input
                                        value={editBsdqProjectNumber}
                                        onChange={
                                            event =>
                                                setEditBsdqProjectNumber(event.target.value)
                                        }
                                    />
                                </label>

                                <label className="business-field">
                                    <span>Heure tombée</span>
                                    <input
                                        type="time"
                                        value={editBsdqDueTime}
                                        onChange={
                                            event =>
                                                setEditBsdqDueTime(event.target.value)
                                        }
                                    />
                                </label>
                            </div>

                            {bsdqSearchError && (
                                <div className="business-error">
                                    {bsdqSearchError}
                                </div>
                            )}

                            {!bsdqSearchError && bsdqResults.length === 0 && !isBsdqSearching && (
                                <div className="business-muted-panel">
                                    Recherche le projet ouvert au babillard BSDQ pour valider le numéro et la date de tombée.
                                </div>
                            )}

                            {renderBsdqResults(
                                bsdqResults,
                                applyBsdqResultToEdit
                            )}
                        </section>

                        <section className="business-edit-section">
                            <div className="business-section-heading">
                                <div>
                                    <span>Clients</span>
                                    <h2>Ajouter au projet</h2>
                                </div>
                            </div>
                            <div className="business-checkbox-grid">
                                {clients.map(
                                    client => (
                                        <label
                                            key={client.id}
                                            className="business-checkbox"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={editClientIds.includes(client.id)}
                                                onChange={
                                                    () =>
                                                        toggleEditClient(client.id)
                                                }
                                            />
                                            <span>{client.name}</span>
                                        </label>
                                    )
                                )}
                            </div>
                        </section>

                        <section className="business-edit-section">
                            <div className="business-section-heading">
                                <div>
                                    <span>Addenda</span>
                                    <h2>Ajouter une entrée</h2>
                                </div>
                            </div>
                            <div className="business-form-grid compact">
                                <label className="business-field">
                                    <span>Nom</span>
                                    <input
                                        value={editAddenda.name}
                                        onChange={
                                            event =>
                                                setEditAddenda(
                                                    {
                                                        ...editAddenda,
                                                        name: event.target.value
                                                    }
                                                )
                                        }
                                    />
                                </label>

                                <label className="business-field">
                                    <span>Date</span>
                                    <input
                                        type="date"
                                        value={editAddenda.date}
                                        onChange={
                                            event =>
                                                setEditAddenda(
                                                    {
                                                        ...editAddenda,
                                                        date: event.target.value
                                                    }
                                                )
                                        }
                                    />
                                </label>

                                <label className="business-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={editAddenda.plans}
                                        onChange={
                                            event =>
                                                setEditAddenda(
                                                    {
                                                        ...editAddenda,
                                                        plans: event.target.checked
                                                    }
                                                )
                                        }
                                    />
                                    <span>Plans</span>
                                </label>

                                <label className="business-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={editAddenda.specs}
                                        onChange={
                                            event =>
                                                setEditAddenda(
                                                    {
                                                        ...editAddenda,
                                                        specs: event.target.checked
                                                    }
                                                )
                                        }
                                    />
                                    <span>Devis</span>
                                </label>

                                <label className="business-field wide">
                                    <span>Incidences</span>
                                    <input
                                        value={editAddenda.description}
                                        onChange={
                                            event =>
                                                setEditAddenda(
                                                    {
                                                        ...editAddenda,
                                                        description: event.target.value
                                                    }
                                                )
                                        }
                                    />
                                </label>
                            </div>
                        </section>

                        <section
                            className={
                                "business-dropzone" +
                                (isEditMsgDragActive ? " dragging" : "")
                            }
                            onDragOver={
                                event => {
                                    event.preventDefault();
                                    setIsEditMsgDragActive(true);
                                }
                            }
                            onDragLeave={
                                () =>
                                    setIsEditMsgDragActive(false)
                            }
                            onDrop={
                                event => {
                                    event.preventDefault();
                                    setIsEditMsgDragActive(false);
                                    addEditMsgFiles(event.dataTransfer.files);
                                }
                            }
                        >
                            <div>
                                <span>Courriels clients</span>
                                <h3>Glisser des .msg</h3>
                            </div>
                            <label className="business-field">
                                <span>Client de l'invitation</span>
                                <select
                                    value={editInvitationClientId || ""}
                                    onChange={
                                        event =>
                                            setEditInvitationClientId(
                                                event.target.value ?
                                                    Number(event.target.value) :
                                                    null
                                            )
                                    }
                                >
                                    <option value="">Client non précisé</option>
                                    {clients.map(
                                        client => (
                                            <option
                                                key={client.id}
                                                value={client.id}
                                            >
                                                {client.name}
                                            </option>
                                        )
                                    )}
                                </select>
                            </label>
                            <button
                                type="button"
                                onClick={
                                    () =>
                                        editMsgInputRef.current?.click()
                                }
                            >
                                Parcourir .msg
                            </button>
                            <input
                                ref={editMsgInputRef}
                                className="business-hidden-input"
                                type="file"
                                accept=".msg"
                                multiple
                                onChange={
                                    event =>
                                        addEditMsgFiles(event.target.files || [])
                                }
                            />
                            {editMsgFiles.length > 0 && (
                                <ul className="business-file-list">
                                    {editMsgFiles.map(
                                        (file, index) => (
                                            <li key={`${file.name}-${index}`}>
                                                {file.name}
                                            </li>
                                        )
                                    )}
                                </ul>
                            )}
                        </section>

                        <section className="business-edit-section">
                            <div className="business-section-heading">
                                <div>
                                    <span>Invitations</span>
                                    <h2>Clients reçus</h2>
                                </div>
                            </div>
                            {editingProject.invitations.length === 0 ? (
                                <div className="business-upload-count">
                                    Aucune invitation enregistrée.
                                </div>
                            ) : (
                                <ul className="business-invitation-list">
                                    {editingProject.invitations.map(
                                        invitation => (
                                            <li key={invitation.id}>
                                                <strong>
                                                    {invitation.client_name || "Client non précisé"}
                                                </strong>
                                                <span>
                                                    {invitation.invited_on || "-"}
                                                </span>
                                                <span>
                                                    {invitation.msg_filename}
                                                </span>
                                            </li>
                                        )
                                    )}
                                </ul>
                            )}
                        </section>

                        <footer>
                            <button
                                type="button"
                                onClick={
                                    () =>
                                        setEditingProject(null)
                                }
                            >
                                Annuler
                            </button>
                            <button
                                type="submit"
                                disabled={isEditSaving}
                            >
                                Sauvegarder
                            </button>
                        </footer>
                    </form>
                </div>
            )}
        </section>
    );

}


export default ProjectsPage;
