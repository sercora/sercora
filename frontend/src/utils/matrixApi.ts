export const API_URL =
    import.meta.env.VITE_API_URL ||
    "https://api.serco.pro";


export function fetchEstimateMatrix() {

    return fetch(
        API_URL +
        "/estimates/1/matrix"
    )

    .then(
        response => response.json()
    );

}


export function updateEstimateQuantity(
    quantityId: any,
    quantity: number
) {

    if (!quantityId)
        return;

    return fetch(

        API_URL +
        "/estimate-quantities/" +
        quantityId,

        {

            method: "PUT",

            headers: {

                "Content-Type":
                    "application/json"

            },

            body: JSON.stringify(

                {

                    quantity:
                        quantity

                }

            )

        }

    );

}


export function updateEstimateLine(
    lineId: any,
    line: {
        loss_percent: number;
        purchase_price: number;
        profit_percent: number;
        installation_cost: number;
    }
) {

    return fetch(

        API_URL +
        "/estimate-lines/" +
        lineId,

        {

            method: "PUT",

            headers: {

                "Content-Type":
                    "application/json"

            },

            body: JSON.stringify(
                line
            )

        }

    );

}
