import { API_URL } from "./matrixApi";


export type ClientType = {
    id: number;
    name: string;
    active: boolean;
};


export type Client = {
    id: number;
    name: string;
    client_type_id: number | null;
    client_type_name: string | null;
    active: boolean;
    created_at: string | null;
    project_count: number;
};


export type ClientInput = {
    name: string;
    client_type_id: number | null;
    active: boolean;
};


export type ProjectSummary = {
    id: number;
    project_number: string | null;
    project_name: string;
    status: string | null;
    start_date: string | null;
    end_date: string | null;
    bid_due_date: string | null;
    address: string;
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    province: string | null;
    postal_code: string | null;
    architect_name: string | null;
    probable_schedule: string | null;
    client_names: string;
    client_ids: number[];
    revision_zero_estimate_id: number | null;
    latest_estimate_id: number | null;
    revision_count: number;
    invitations: ProjectInvitation[];
    addenda: string | null;
    created_at: string | null;
};


export type ProjectInvitation = {
    id: number;
    client_id: number | null;
    client_name: string | null;
    invited_on: string;
    msg_filename: string;
    msg_relative_path: string;
};


export type ProjectInput = {
    project_number: string | null;
    project_name: string;
    status: string;
    client_id: number | null;
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    province: string | null;
    postal_code: string | null;
    bid_due_date: string | null;
    start_date: string | null;
    end_date: string | null;
    architect_name: string | null;
    probable_schedule: string | null;
    source_template_path: string | null;
    warranty_years: number;
    tile_holdback_percent: number;
};


export type ProjectCreateResponse = {
    id: number;
    message: string;
    folder_status: string;
    folder_message: string;
    folder_name: string;
    folder_path: string;
    msg_file_count?: number;
    upload_file_count?: number;
    revision_zero_estimate_id?: number;
    revision_zero_created?: boolean;
};


export type ProjectCurrentEditInput = {
    bid_due_date: string | null;
    client_ids: number[];
    invitation_client_id: number | null;
    msgFiles: File[];
    addenda: {
        name: string;
        date: string;
        plans: boolean;
        specs: boolean;
        description: string;
    };
};


export type ProjectCurrentEditResponse = {
    id: number;
    message: string;
    folder_name: string;
    folder_status: string;
    folder_message: string;
    msg_file_count: number;
    addenda_count: number;
    revision_zero_estimate_id: number;
    revision_zero_created: boolean;
};


function parseResponse(
    response: Response
) {

    if (!response.ok) {
        return response.text()
            .then(
                text => {
                    let message = text || "Request failed";

                    try {
                        const payload = JSON.parse(text);
                        message = payload.detail || message;
                    } catch {
                        message = text || "Request failed";
                    }

                    throw new Error(message);
                }
            );
    }

    return response.json();

}


export function fetchClientTypes(): Promise<ClientType[]> {

    return fetch(
        API_URL + "/client-types"
    )

    .then(parseResponse);

}


export function fetchClients(): Promise<Client[]> {

    return fetch(
        API_URL + "/clients"
    )

    .then(parseResponse);

}


export function createClient(
    client: ClientInput
) {

    return fetch(
        API_URL + "/clients",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(client)
        }
    )

    .then(parseResponse);

}


export function updateClient(
    clientId: number,
    client: ClientInput
) {

    return fetch(
        API_URL + "/clients/" + clientId,
        {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(client)
        }
    )

    .then(parseResponse);

}


export function fetchProjects(
    scope: "all" | "current" | "submission" = "all"
): Promise<ProjectSummary[]> {

    const params = new URLSearchParams(
        {
            scope
        }
    );

    return fetch(
        API_URL +
        "/projects?" +
        params.toString()
    )

    .then(parseResponse);

}


export function createProject(
    project: ProjectInput
): Promise<ProjectCreateResponse> {

    return fetch(
        API_URL + "/projects",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(project)
        }
    )

    .then(parseResponse);

}


function appendProjectFormValue(
    formData: FormData,
    key: string,
    value: string | number | null
) {

    if (value === null || value === "")
        return;

    formData.append(
        key,
        String(value)
    );

}


export function createProjectWithFiles(
    project: ProjectInput,
    msgFiles: File[],
    folderFiles: File[]
): Promise<ProjectCreateResponse> {

    const formData = new FormData();

    appendProjectFormValue(formData, "project_number", project.project_number);
    appendProjectFormValue(formData, "project_name", project.project_name);
    appendProjectFormValue(formData, "status", project.status);
    appendProjectFormValue(formData, "client_id", project.client_id);
    appendProjectFormValue(formData, "address_line1", project.address_line1);
    appendProjectFormValue(formData, "address_line2", project.address_line2);
    appendProjectFormValue(formData, "city", project.city);
    appendProjectFormValue(formData, "province", project.province);
    appendProjectFormValue(formData, "postal_code", project.postal_code);
    appendProjectFormValue(formData, "bid_due_date", project.bid_due_date);
    appendProjectFormValue(formData, "start_date", project.start_date);
    appendProjectFormValue(formData, "end_date", project.end_date);
    appendProjectFormValue(formData, "architect_name", project.architect_name);
    appendProjectFormValue(formData, "probable_schedule", project.probable_schedule);
    appendProjectFormValue(formData, "source_template_path", project.source_template_path);
    appendProjectFormValue(formData, "warranty_years", project.warranty_years);
    appendProjectFormValue(
        formData,
        "tile_holdback_percent",
        project.tile_holdback_percent
    );

    msgFiles.forEach(
        file =>
            formData.append(
                "msg_files",
                file,
                file.name
            )
    );

    folderFiles.forEach(
        file =>
            formData.append(
                "folder_files",
                file,
                (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
                    file.name
            )
    );

    return fetch(
        API_URL + "/projects/with-files",
        {
            method: "POST",
            body: formData
        }
    )

    .then(parseResponse);

}


export function updateProjectCurrent(
    projectId: number,
    input: ProjectCurrentEditInput
): Promise<ProjectCurrentEditResponse> {

    const formData = new FormData();

    appendProjectFormValue(formData, "bid_due_date", input.bid_due_date);

    input.client_ids.forEach(
        clientId =>
            appendProjectFormValue(
                formData,
                "client_ids",
                clientId
            )
    );

    appendProjectFormValue(
        formData,
        "invitation_client_id",
        input.invitation_client_id
    );

    appendProjectFormValue(formData, "addenda_name", input.addenda.name);
    appendProjectFormValue(formData, "addenda_date", input.addenda.date);
    appendProjectFormValue(
        formData,
        "addenda_plans",
        input.addenda.plans ? "true" : "false"
    );
    appendProjectFormValue(
        formData,
        "addenda_specs",
        input.addenda.specs ? "true" : "false"
    );
    appendProjectFormValue(
        formData,
        "addenda_description",
        input.addenda.description
    );

    input.msgFiles.forEach(
        file =>
            formData.append(
                "msg_files",
                file,
                file.name
            )
    );

    return fetch(
        API_URL + "/projects/" + projectId + "/current-edit",
        {
            method: "PUT",
            body: formData
        }
    )

    .then(parseResponse);

}
