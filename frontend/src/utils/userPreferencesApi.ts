import { API_URL } from "./matrixApi";


const AUTH_TOKEN_KEY = "sercora_auth_token";


function authHeaders() {

    const token = window.localStorage.getItem(AUTH_TOKEN_KEY);

    return {
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json"
    };

}


function parseResponse<T>(
    response: Response
): Promise<T> {

    if (!response.ok)
        throw new Error("Impossible de sauvegarder les préférences.");

    return response.json();

}


export function fetchUserPreference<T>(
    key: string
): Promise<T | null> {

    return fetch(
        API_URL + "/user-preferences/" + encodeURIComponent(key),
        {
            headers: authHeaders()
        }
    )
    .then(parseResponse<{ value: T | null }>)
    .then(
        response =>
            response.value
    );

}


export function saveUserPreference<T>(
    key: string,
    value: T
): Promise<T> {

    return fetch(
        API_URL + "/user-preferences/" + encodeURIComponent(key),
        {
            method: "PUT",
            headers: authHeaders(),
            body: JSON.stringify(
                {
                    value
                }
            )
        }
    )
    .then(parseResponse<{ value: T }>)
    .then(
        response =>
            response.value
    );

}
