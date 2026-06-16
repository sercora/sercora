export function getQtyTotal(
    params: any,
    rooms: string[]
) {

    if (!params.data)
        return 0;

    let total = 0;

    rooms.forEach(
        room => {

            total += Number(
                params.data[room] ?? 0
            );

        }
    );

    return total;

}


export function getQtyWithLoss(
    params: any,
    rooms: string[]
) {

    if (!params.data)
        return 0;

    return (
        getQtyTotal(
            params,
            rooms
        )

        *

        (
            1 +
            Number(params.data.loss_percent || 0) / 100
        )
    );

}


export function getLossQuantity(
    params: any,
    rooms: string[]
) {

    if (!params.data)
        return 0;

    return (
        getQtyTotal(
            params,
            rooms
        )

        *

        Number(params.data.loss_percent || 0)

        / 100
    );

}


export function getMaterialCost(
    params: any,
    rooms: string[]
) {

    if (!params.data)
        return 0;

    return (
        getQtyWithLoss(
            params,
            rooms
        )

        *

        Number(params.data.purchase_price || 0)
    );

}


export function getUnitProfit(
    params: any
) {

    if (!params.data)
        return 0;

    return (
        Number(params.data.purchase_price || 0)

        *

        Number(params.data.profit_percent || 0)

        / 100
    );

}


export function getUnitSellPrice(
    params: any
) {

    if (!params.data)
        return 0;

    return (
        Number(params.data.purchase_price || 0)

        +

        getUnitProfit(params)
    );

}


export function getProfit(
    params: any,
    rooms: string[]
) {

    if (!params.data)
        return 0;

    return (

        getMaterialCost(
            params,
            rooms
        )

        *

        Number(params.data.profit_percent || 0)

        / 100

    );

}


export function getInstallTotal(
    params: any,
    rooms: string[]
) {

    if (!params.data)
        return 0;

    return (

        getQtyWithLoss(
            params,
            rooms
        )

        *

        Number(params.data.installation_cost || 0)

    );

}


export function getInstallationSellTotal(
    params: any,
    rooms: string[]
) {

    return (
        getInstallTotal(
            params,
            rooms
        )

        +

        getProfit(
            params,
            rooms
        )
    );

}


export function getInstallHours(
    params: any,
    rooms: string[],
    hourlyRate: number
) {

    if (!hourlyRate)
        return 0;

    return (
        getInstallTotal(
            params,
            rooms
        )

        /

        hourlyRate
    );

}


export function getAllocatedInstallHours(
    params: any,
    rooms: string[],
    hourlyRate: number
) {

    const multiplier =
        Number(params.data?.manpower_multiplier || 1);

    if (!multiplier)
        return getInstallHours(
            params,
            rooms,
            hourlyRate
        );

    return (
        getInstallHours(
            params,
            rooms,
            hourlyRate
        )

        /

        multiplier
    );

}


export function getMaterialSellTotal(
    params: any,
    rooms: string[]
) {

    return (
        getMaterialCost(
            params,
            rooms
        )

        +

        getProfit(
            params,
            rooms
        )
    );

}


export function getSellPrice(
    params: any,
    rooms: string[]
) {

    if (!params.data)
        return 0;

    return (

        getMaterialCost(
            params,
            rooms
        )

        +

        getProfit(
            params,
            rooms
        )

        +

        getInstallTotal(
            params,
            rooms
        )

    );

}
