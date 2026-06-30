type QrVersion = 1 | 2 | 3 | 4 | 5;


const DATA_CODEWORDS: Record<QrVersion, number> = {
    1: 19,
    2: 34,
    3: 55,
    4: 80,
    5: 108
};

const ECC_CODEWORDS: Record<QrVersion, number> = {
    1: 7,
    2: 10,
    3: 15,
    4: 20,
    5: 26
};

const PAD_CODEWORDS = [
    0xec,
    0x11
];


function gfMultiply(
    left: number,
    right: number
) {

    let result = 0;
    let nextLeft = left;
    let nextRight = right;

    while (nextRight) {
        if (nextRight & 1)
            result ^= nextLeft;

        nextRight >>= 1;
        nextLeft <<= 1;

        if (nextLeft & 0x100)
            nextLeft ^= 0x11d;
    }

    return result;

}


function gfPow(
    value: number,
    power: number
) {

    let result = 1;

    for (let index = 0; index < power; index += 1)
        result = gfMultiply(result, value);

    return result;

}


function multiplyPolynomials(
    left: number[],
    right: number[]
) {

    const result = Array(left.length + right.length - 1).fill(0);

    left.forEach(
        (leftValue, leftIndex) => {
            right.forEach(
                (rightValue, rightIndex) => {
                    result[leftIndex + rightIndex] ^= gfMultiply(
                        leftValue,
                        rightValue
                    );
                }
            );
        }
    );

    return result;

}


function reedSolomonGenerator(
    degree: number
) {

    let result = [
        1
    ];

    for (let index = 0; index < degree; index += 1) {
        result = multiplyPolynomials(
            result,
            [
                1,
                gfPow(
                    2,
                    index
                )
            ]
        );
    }

    return result;

}


function reedSolomonRemainder(
    data: number[],
    degree: number
) {

    const generator = reedSolomonGenerator(degree);
    const result = Array(degree).fill(0);

    data.forEach(
        value => {
            const factor = value ^ result[0];
            result.copyWithin(
                0,
                1
            );
            result[degree - 1] = 0;

            generator.slice(1).forEach(
                (coefficient, index) => {
                    result[index] ^= gfMultiply(
                        coefficient,
                        factor
                    );
                }
            );
        }
    );

    return result;

}


function appendBits(
    bits: boolean[],
    value: number,
    length: number
) {

    for (let index = length - 1; index >= 0; index -= 1)
        bits.push(((value >>> index) & 1) === 1);

}


function chooseVersion(
    byteLength: number
): QrVersion {

    const versions: QrVersion[] = [
        1,
        2,
        3,
        4,
        5
    ];
    const totalBits = 4 + 8 + byteLength * 8;
    const version = versions.find(
        currentVersion =>
            totalBits <= DATA_CODEWORDS[currentVersion] * 8
    );

    if (!version)
        throw new Error("QR payload is too long.");

    return version;

}


function createDataCodewords(
    value: string,
    version: QrVersion
) {

    const bytes = Array.from(
        new TextEncoder().encode(value)
    );
    const bits: boolean[] = [];

    appendBits(
        bits,
        0b0100,
        4
    );
    appendBits(
        bits,
        bytes.length,
        8
    );

    bytes.forEach(
        byte =>
            appendBits(
                bits,
                byte,
                8
            )
    );

    const capacityBits = DATA_CODEWORDS[version] * 8;
    const terminatorLength = Math.min(
        4,
        capacityBits - bits.length
    );

    appendBits(
        bits,
        0,
        terminatorLength
    );

    while (bits.length % 8)
        bits.push(false);

    const codewords: number[] = [];

    for (let index = 0; index < bits.length; index += 8) {
        let codeword = 0;

        for (let bitIndex = 0; bitIndex < 8; bitIndex += 1)
            codeword = (codeword << 1) | (bits[index + bitIndex] ? 1 : 0);

        codewords.push(codeword);
    }

    let padIndex = 0;

    while (codewords.length < DATA_CODEWORDS[version]) {
        codewords.push(PAD_CODEWORDS[padIndex % PAD_CODEWORDS.length]);
        padIndex += 1;
    }

    return codewords;

}


function setModule(
    matrix: boolean[][],
    reserved: boolean[][],
    x: number,
    y: number,
    value: boolean,
    isReserved = true
) {

    if (
        y < 0 ||
        y >= matrix.length ||
        x < 0 ||
        x >= matrix.length
    )
        return;

    matrix[y][x] = value;

    if (isReserved)
        reserved[y][x] = true;

}


function drawFinder(
    matrix: boolean[][],
    reserved: boolean[][],
    x: number,
    y: number
) {

    for (let dy = -1; dy <= 7; dy += 1) {
        for (let dx = -1; dx <= 7; dx += 1) {
            const distanceX = Math.abs(dx - 3);
            const distanceY = Math.abs(dy - 3);
            const isBlack = Math.max(
                distanceX,
                distanceY
            ) !== 2;

            setModule(
                matrix,
                reserved,
                x + dx,
                y + dy,
                dx >= 0 &&
                    dx <= 6 &&
                    dy >= 0 &&
                    dy <= 6 &&
                    isBlack
            );
        }
    }

}


function drawAlignment(
    matrix: boolean[][],
    reserved: boolean[][],
    centerX: number,
    centerY: number
) {

    for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
            const distance = Math.max(
                Math.abs(dx),
                Math.abs(dy)
            );

            setModule(
                matrix,
                reserved,
                centerX + dx,
                centerY + dy,
                distance !== 1
            );
        }
    }

}


function reserveFormatAreas(
    reserved: boolean[][]
) {

    const size = reserved.length;
    const reserve = (
        x: number,
        y: number
    ) => {
        if (
            y >= 0 &&
            y < size &&
            x >= 0 &&
            x < size
        )
            reserved[y][x] = true;
    };

    for (let index = 0; index <= 5; index += 1)
        reserve(
            8,
            index
        );

    reserve(8, 7);
    reserve(8, 8);
    reserve(7, 8);

    for (let index = 9; index < 15; index += 1)
        reserve(
            14 - index,
            8
        );

    for (let index = 0; index < 8; index += 1)
        reserve(
            size - 1 - index,
            8
        );

    for (let index = 8; index < 15; index += 1)
        reserve(
            8,
            size - 15 + index
        );

}


function drawFormatBits(
    matrix: boolean[][],
    reserved: boolean[][],
    mask: number
) {

    const size = matrix.length;
    const data = (1 << 3) | mask;
    let remainder = data << 10;

    for (let index = 14; index >= 10; index -= 1) {
        if (((remainder >>> index) & 1) !== 0)
            remainder ^= 0x537 << (index - 10);
    }

    const bits = ((data << 10) | remainder) ^ 0x5412;
    const bit = (
        index: number
    ) => ((bits >>> index) & 1) !== 0;

    for (let index = 0; index <= 5; index += 1)
        setModule(
            matrix,
            reserved,
            8,
            index,
            bit(index)
        );

    setModule(matrix, reserved, 8, 7, bit(6));
    setModule(matrix, reserved, 8, 8, bit(7));
    setModule(matrix, reserved, 7, 8, bit(8));

    for (let index = 9; index < 15; index += 1)
        setModule(
            matrix,
            reserved,
            14 - index,
            8,
            bit(index)
        );

    for (let index = 0; index < 8; index += 1)
        setModule(
            matrix,
            reserved,
            size - 1 - index,
            8,
            bit(index)
        );

    for (let index = 8; index < 15; index += 1)
        setModule(
            matrix,
            reserved,
            8,
            size - 15 + index,
            bit(index)
        );

}


function initializeMatrix(
    version: QrVersion
) {

    const size = 21 + (version - 1) * 4;
    const matrix = Array.from(
        {
            length: size
        },
        () => Array(size).fill(false)
    );
    const reserved = Array.from(
        {
            length: size
        },
        () => Array(size).fill(false)
    );

    drawFinder(matrix, reserved, 0, 0);
    drawFinder(matrix, reserved, size - 7, 0);
    drawFinder(matrix, reserved, 0, size - 7);

    for (let index = 8; index < size - 8; index += 1) {
        const value = index % 2 === 0;

        setModule(matrix, reserved, 6, index, value);
        setModule(matrix, reserved, index, 6, value);
    }

    if (version > 1)
        drawAlignment(
            matrix,
            reserved,
            size - 7,
            size - 7
        );

    setModule(matrix, reserved, 8, size - 8, true);
    reserveFormatAreas(reserved);

    return {
        matrix,
        reserved
    };

}


function placeData(
    matrix: boolean[][],
    reserved: boolean[][],
    dataBits: boolean[]
) {

    const size = matrix.length;
    let bitIndex = 0;
    let upward = true;

    for (let right = size - 1; right >= 1; right -= 2) {
        if (right === 6)
            right -= 1;

        for (let vertical = 0; vertical < size; vertical += 1) {
            const y = upward ? size - 1 - vertical : vertical;

            for (let column = 0; column < 2; column += 1) {
                const x = right - column;

                if (!reserved[y][x]) {
                    matrix[y][x] =
                        bitIndex < dataBits.length ?
                            dataBits[bitIndex] :
                            false;
                    bitIndex += 1;
                }
            }
        }

        upward = !upward;
    }

}


function applyMask(
    matrix: boolean[][],
    reserved: boolean[][]
) {

    for (let y = 0; y < matrix.length; y += 1) {
        for (let x = 0; x < matrix.length; x += 1) {
            if (!reserved[y][x] && (x + y) % 2 === 0)
                matrix[y][x] = !matrix[y][x];
        }
    }

}


export function createQrMatrix(
    value: string
) {

    const bytes = new TextEncoder().encode(value);
    const version = chooseVersion(bytes.length);
    const data = createDataCodewords(
        value,
        version
    );
    const ecc = reedSolomonRemainder(
        data,
        ECC_CODEWORDS[version]
    );
    const bits: boolean[] = [];

    [
        ...data,
        ...ecc
    ].forEach(
        codeword =>
            appendBits(
                bits,
                codeword,
                8
            )
    );

    const {
        matrix,
        reserved
    } = initializeMatrix(version);

    placeData(
        matrix,
        reserved,
        bits
    );
    applyMask(
        matrix,
        reserved
    );
    drawFormatBits(
        matrix,
        reserved,
        0
    );

    return matrix;

}
