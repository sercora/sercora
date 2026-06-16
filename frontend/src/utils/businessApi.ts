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
    created_at: string | null;
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


function parseResponse(
    response: Response
) {

    if (!response.ok)
        throw new Error("Request failed");

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
    scope: "all" | "current" = "all"
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
) {

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
