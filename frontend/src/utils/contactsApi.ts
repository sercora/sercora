import { API_URL } from "./matrixApi";


export type ContactType = {
    id: number;
    code: string;
    name: string;
    active: boolean;
};


export type ContactTask = {
    id: number;
    code: string;
    name: string;
    sort_order: number;
    active: boolean;
};


export type ContactOption = {
    id: number;
    name: string;
};


export type ContactOptions = {
    clients: ContactOption[];
    suppliers: ContactOption[];
};


export type Supplier = {
    id: number;
    name: string;
    federal_tax_number: string;
    provincial_tax_number: string;
    active: boolean;
};


export type SupplierInput = {
    name: string;
    federal_tax_number: string;
    provincial_tax_number: string;
    active: boolean;
};


export type Contact = {
    id: number;
    contact_type_id: number;
    contact_type_code: string;
    contact_type_name: string;
    client_id: number | null;
    client_name: string | null;
    supplier_id: number | null;
    supplier_name: string | null;
    name: string;
    title: string | null;
    email: string | null;
    phone: string | null;
    mobile: string | null;
    active: boolean;
    created_at: string | null;
    tasks: ContactTask[];
};


export type ContactInput = {
    contact_type_id: number | null;
    client_id: number | null;
    supplier_id: number | null;
    name: string;
    title: string;
    email: string;
    phone: string;
    mobile: string;
    active: boolean;
    task_ids: number[];
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


export function fetchContactTypes(): Promise<ContactType[]> {

    return fetch(
        API_URL + "/contact-types"
    )

    .then(parseResponse);

}


export function fetchContactTasks(): Promise<ContactTask[]> {

    return fetch(
        API_URL + "/contact-tasks"
    )

    .then(parseResponse);

}


export function fetchContactOptions(): Promise<ContactOptions> {

    return fetch(
        API_URL + "/contacts/options"
    )

    .then(parseResponse);

}


export function fetchContacts(): Promise<Contact[]> {

    return fetch(
        API_URL + "/contacts"
    )

    .then(parseResponse);

}


export function fetchSuppliers(): Promise<Supplier[]> {

    return fetch(
        API_URL + "/suppliers"
    )

    .then(parseResponse);

}


export function updateSupplier(
    supplierId: number,
    supplier: SupplierInput
): Promise<Supplier> {

    return fetch(
        API_URL + "/suppliers/" + supplierId,
        {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(supplier)
        }
    )

    .then(parseResponse);

}


export function createContact(
    contact: ContactInput
) {

    return fetch(
        API_URL + "/contacts",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(contact)
        }
    )

    .then(parseResponse);

}


export function updateContact(
    contactId: number,
    contact: ContactInput
) {

    return fetch(
        API_URL + "/contacts/" + contactId,
        {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(contact)
        }
    )

    .then(parseResponse);

}
