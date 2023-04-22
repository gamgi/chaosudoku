//@ts-check

/**
 * @param {Object} data
 * @returns {[null] | ["setCell", number, number, number]}
 */
function parseEvent(data) {
    const trigger = data?.HEADERS?.["HX-Trigger"];
    /** @type {string[]} */
    const [prefix, ...args] = trigger ? trigger.split("_") : [];

    if (prefix == "cell" && args.length == 2) {
        const value = data?.[trigger];
        const eventData = /** @type {[number, number, number]} */ ([...args, value].map(v => parseInt(v)));

        if (eventData.some(isOutOfBounds)) return [null];
        return ["setCell", ...eventData];
    }
    return [null];
}

/**
 * @param {number} value
 * @returns {boolean}
 */
function isValidCellValue(value) {
    return !isNaN(value) && value >= 1 && value <= 9;
}

/**
 * @param {number} value
 * @returns {boolean}
 */
function isOutOfBounds(value) {
    return isNaN(value) || value < 0 || value > 8;
}

function main(stdin) {
    process.stderr.write("started");
    const sudoku = generateSudoku();
    stdin.on("data", data => {
        // console.error(parseEvent(data));
        const [event, ...args] = parseEvent(JSON.parse(data));
        switch (event) {
            case "setCell":
                const [x, y, value] = args;
                // @ts-ignore
                sudoku[x][y] = value;
                process.stdout.write(inputElement(x, y, value) + "\n");
                break;
            case null:
                break;
            default:
                process.stderr.write("unknown");
                break;
        }
    })

}

/**
 * @returns {number[][]}
 * */
function generateSudoku() {
    return [
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0]
    ];
}

function inputElement(x, y, value) {
    return `<input id="cell_${x}_${y}" hx-swap-oob="true" name="cell_${x}_${y}" value="${value}" hx-ws="send" hx-trigger="keyup changed" maxlength="1" onfocus="this.select()" onclick="this.select()" />`;
}

if (require.main === module) {
    process.stderr.write("starting");
    main(process.stdin);
}

module.exports = { sum2, parseEvent };