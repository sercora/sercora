import { API_URL } from "./matrixApi";


export type UserRole = "admin" | "execution" | "estimation" | "entrepot";


export type SercoraUser = {
    id: number;
    username: string;
    full_name: string;
    email: string | null;
    role: UserRole;
    active: boolean;
    must_change_password: boolean;
};


export type LoginResponse = {
    token: string;
    user: SercoraUser;
};


export type UserInput = {
    username: string;
    full_name: string;
    email: string | null;
    role: UserRole;
    password?: string;
    active: boolean;
};


export type ProfileInput = {
    full_name: string;
    email: string | null;
    current_password?: string;
    new_password?: string;
};


async function parseResponse(
    response: Response
) {

    if (!response.ok) {
        const payload = await response.json().catch(
            () => null
        );

        throw new Error(
            payload?.detail ||
            "Requete refusee"
        );
    }

    return response.json();

}


function authHeaders(
    token: string
) {

    return {
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json"
    };

}


export function login(
    username: string,
    password: string
): Promise<LoginResponse> {

    return fetch(
        API_URL + "/auth/login",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(
                {
                    username,
                    password
                }
            )
        }
    ).then(parseResponse);

}


export function fetchMe(
    token: string
): Promise<SercoraUser> {

    return fetch(
        API_URL + "/auth/me",
        {
            headers: authHeaders(token)
        }
    ).then(parseResponse);

}


export function updateProfile(
    token: string,
    profile: ProfileInput
): Promise<SercoraUser> {

    return fetch(
        API_URL + "/auth/me",
        {
            method: "PUT",
            headers: authHeaders(token),
            body: JSON.stringify(profile)
        }
    ).then(parseResponse);

}


export function fetchUsers(
    token: string
): Promise<SercoraUser[]> {

    return fetch(
        API_URL + "/users",
        {
            headers: authHeaders(token)
        }
    ).then(parseResponse);

}


export function createUser(
    token: string,
    user: UserInput & { password: string }
) {

    return fetch(
        API_URL + "/users",
        {
            method: "POST",
            headers: authHeaders(token),
            body: JSON.stringify(user)
        }
    ).then(parseResponse);

}


export function updateUser(
    token: string,
    userId: number,
    user: UserInput
) {

    return fetch(
        API_URL + "/users/" + userId,
        {
            method: "PUT",
            headers: authHeaders(token),
            body: JSON.stringify(user)
        }
    ).then(parseResponse);

}
