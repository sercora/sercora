import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";


const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const outputPath = resolve(repoRoot, "frontend/public/operations-backlog.json");


const operationGroups = [
    {
        title: "Fondation et architecture",
        summary: "Mise en place FastAPI, PostgreSQL, frontend React/Vite, structure de documentation et premieres API metier."
    },
    {
        title: "Matrice de soumission",
        summary: "AG Grid, quantites editables, locaux, surfaces, sous-totaux, ventilation materiel/installation, heures, jours, lignes liees et revisions."
    },
    {
        title: "Catalogues fournisseurs",
        summary: "Import Prosol, Schluter, Centura, Olympia, rabais fournisseurs, pagination, recherche, prix au pied carre et televersements de listes."
    },
    {
        title: "Projets, clients et NAS",
        summary: "Clients, projets en soumission, creation de dossiers, exploration NAS, visualisation PDF/MSG/Office et revisions de templates."
    },
    {
        title: "Outils et integrations",
        summary: "Snipe-IT, images d'outils, filtres disponible/deploye, SMTP, VoIP/SMS, BSDQ, Mobile-Punch en developpement."
    },
    {
        title: "Calibre",
        summary: "Module takeoff integre: import image/PDF, conversion de pages, calibration, lignes, rectangles, polygones, calques, secteurs, plein ecran et zoom profond."
    },
    {
        title: "Deploiement et gouvernance",
        summary: "Branches main/staging/codex, release v0.1.0, instance staging separee, scripts de deploiement, docs et liens GitHub."
    }
];


function git(args) {

    return execFileSync(
        "git",
        args,
        {
            cwd: repoRoot,
            encoding: "utf8"
        }
    ).trim();

}


function commitCategory(message) {

    const normalized = message.toLowerCase();

    if (normalized.includes("calibre") || normalized.includes("pdf renderer") || normalized.includes("takeoff"))
        return "Calibre";

    if (normalized.includes("matrix") || normalized.includes("estimate") || normalized.includes("soumission") || normalized.includes("line") || normalized.includes("room") || normalized.includes("local"))
        return "Matrice de soumission";

    if (normalized.includes("product") || normalized.includes("prosol") || normalized.includes("schluter") || normalized.includes("centura") || normalized.includes("olympia") || normalized.includes("catalogue") || normalized.includes("price"))
        return "Catalogues fournisseurs";

    if (normalized.includes("project") || normalized.includes("client") || normalized.includes("nas") || normalized.includes("folder") || normalized.includes("msg") || normalized.includes("office") || normalized.includes("libreoffice"))
        return "Projets, clients et NAS";

    if (normalized.includes("snipe") || normalized.includes("tools") || normalized.includes("sms") || normalized.includes("smtp") || normalized.includes("bsdq") || normalized.includes("mobile-punch") || normalized.includes("voip"))
        return "Outils et integrations";

    if (normalized.includes("staging") || normalized.includes("deploy") || normalized.includes("documentation") || normalized.includes("footer") || normalized.includes("release") || normalized.includes("github"))
        return "Deploiement et gouvernance";

    return "Fondation et architecture";

}


const logFormat = "%H%x1f%h%x1f%ad%x1f%D%x1f%s";
const rawLog = git([
    "log",
    "--all",
    "--date=short",
    "--pretty=format:" + logFormat
]);

const commits = rawLog ? rawLog.split("\n").map(
    line => {
        const [hash, shortHash, date, refs, subject] = line.split("\x1f");

        return {
            hash,
            shortHash,
            date,
            refs,
            subject,
            category: commitCategory(subject || "")
        };
    }
) : [];

const releases = git([
    "tag",
    "--list",
    "--sort=-creatordate"
]).split("\n").filter(Boolean);

const branch = git([
    "branch",
    "--show-current"
]);
const generatedAt = new Date().toISOString();
const head = commits[0] || null;

const categoryCounts = commits.reduce(
    (counts, commit) => ({
        ...counts,
        [commit.category]: (counts[commit.category] || 0) + 1
    }),
    {}
);

const payload = {
    generatedAt,
    branch,
    head,
    commitCount: commits.length,
    releases,
    operationGroups,
    categoryCounts,
    commits
};

mkdirSync(
    dirname(outputPath),
    {
        recursive: true
    }
);
writeFileSync(
    outputPath,
    JSON.stringify(payload, null, 2) + "\n"
);

console.log(`Generated ${outputPath} with ${commits.length} commits.`);
