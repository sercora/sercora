import { API_URL } from "./matrixApi";


export type UserRole = "admin" | "execution" | "estimation" | "entrepot";


export type SercoraUser = {
    id: number;
    username: string;
    full_name: string;
    email: string | null;
    phone_number: string | null;
    role: UserRole;
    active: boolean;
    must_change_password: boolean;
    created_at: string | null;
    last_login_at: string | null;
};


export type LoginResponse = {
    token: string;
    user: SercoraUser;
};


export type UserInput = {
    username: string;
    full_name: string;
    email: string | null;
    phone_number: string | null;
    role: UserRole;
    password?: string;
    active: boolean;
};


export type ProfileInput = {
    full_name: string;
    email: string | null;
    phone_number: string | null;
    current_password?: string;
    new_password?: string;
};


export type EmailSettings = {
    smtp_host: string;
    smtp_port: number;
    smtp_username: string;
    smtp_password?: string;
    from_email: string;
    from_name: string;
    reply_to_email: string;
    use_tls: boolean;
    use_ssl: boolean;
    active: boolean;
    password_configured?: boolean;
};


export type SmsSettings = {
    provider_name: string;
    account_id: string;
    api_key: string;
    api_secret?: string;
    from_number: string;
    alert_minutes_before: number;
    active: boolean;
    secret_configured?: boolean;
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


export function inviteNewUser(
    token: string,
    user: UserInput
) {

    return fetch(
        API_URL + "/user-invitations",
        {
            method: "POST",
            headers: authHeaders(token),
            body: JSON.stringify(user)
        }
    ).then(parseResponse);

}


export function inviteExistingUser(
    token: string,
    userId: number
) {

    return fetch(
        API_URL + "/users/" + userId + "/invite",
        {
            method: "POST",
            headers: authHeaders(token)
        }
    ).then(parseResponse);

}


export function sendPasswordReset(
    token: string,
    userId: number
) {

    return fetch(
        API_URL + "/users/" + userId + "/password-reset",
        {
            method: "POST",
            headers: authHeaders(token)
        }
    ).then(parseResponse);

}


export function setPasswordFromToken(
    setupToken: string,
    password: string
) {

    return fetch(
        API_URL + "/auth/set-password",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(
                {
                    token: setupToken,
                    password
                }
            )
        }
    ).then(parseResponse);

}


export function fetchEmailSettings(
    token: string
): Promise<EmailSettings> {

    return fetch(
        API_URL + "/admin/email-settings",
        {
            headers: authHeaders(token)
        }
    ).then(parseResponse);

}


export function saveEmailSettings(
    token: string,
    settings: EmailSettings
): Promise<EmailSettings> {

    return fetch(
        API_URL + "/admin/email-settings",
        {
            method: "PUT",
            headers: authHeaders(token),
            body: JSON.stringify(settings)
        }
    ).then(parseResponse);

}


export function testEmailSettings(
    token: string,
    recipient: string
) {

    return fetch(
        API_URL + "/admin/email-settings/test",
        {
            method: "POST",
            headers: authHeaders(token),
            body: JSON.stringify(
                {
                    recipient
                }
            )
        }
    ).then(parseResponse);

}


export function fetchSmsSettings(
    token: string
): Promise<SmsSettings> {

    return fetch(
        API_URL + "/admin/sms-settings",
        {
            headers: authHeaders(token)
        }
    ).then(parseResponse);

}


export function saveSmsSettings(
    token: string,
    settings: SmsSettings
): Promise<SmsSettings> {

    return fetch(
        API_URL + "/admin/sms-settings",
        {
            method: "PUT",
            headers: authHeaders(token),
            body: JSON.stringify(settings)
        }
    ).then(parseResponse);

}


export function testSmsSettings(
    token: string,
    destination: string,
    message: string
) {

    return fetch(
        API_URL + "/admin/sms-settings/test",
        {
            method: "POST",
            headers: authHeaders(token),
            body: JSON.stringify(
                {
                    destination,
                    message
                }
            )
        }
    ).then(parseResponse);

}
