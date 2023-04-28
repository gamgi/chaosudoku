// @ts-check

const SudokuBox = require("sudokubox");

if (require.main === module) {
    process.stderr.write("starting server\n");
    try {
        main(process.stdin, process.stdout, new SudokuBox());
    } catch (e) {
        if (typeof e?.message === "string") {
            writeError(e.message, process.stdout);
        } else if (typeof e === "string") {
            writeError(e, process.stdout);
        }
        console.error(e);
    }
}

/**
 * @param {NodeJS.ReadStream & { fd: 0; }} stdin
 * @param {NodeJS.WriteStream & { fd: 1; }} stdout
 * @param {SudokuBox} sudokuBox
 */
function main(stdin, stdout, sudokuBox) {
    const context = generateSudoku(sudokuBox);
    writeSudoku(context.board, stdout);

    stdin.on("data", (data) => {
        // @ts-expect-error - data is actually implicitly cast to string
        const event = parseEvent(JSON.parse(data));
        switch (event[0]) {
            case "setCell":
                const [_, x, y, value] = event;
                console.error("setcell", x, y, value);
                context.board[y][x] = value;
                stdout.write(renderCell(value, x, y) + "\n");
                break;
            case "newPlayer":
                writeSudoku(context.board, stdout);
                break;
            default:
                break;
        }
    })

    setInterval((ctx) => {
        const { percentComplete, isComplete } = checkSudoku(ctx);
        writeProgress(stdout, percentComplete);
    }, 1000, context);
}

/**
 * @param {SudokuBox} sudokuBox
 * @returns {{"board": number[][], "boardNumbers": number[], "solutionNumbers": number[], "blankCount": number}}
 */
function generateSudoku(sudokuBox) {
    // @ts-expect-error - error and board are mutually exclusive
    const { board, puzzle: boardNumbers, error } = sudokuBox.generate({ level: 'EASY' });

    if (error) {
        throw new Error(`Failed to generate sudoku: ${error.message}`)
    }

    const { isPuzzleSolved, board: solution } = sudokuBox.solve({ input: boardNumbers });

    if (!isPuzzleSolved) {
        throw new Error("Failed to solve generated sudoku")
    }

    const blankCount = board.flat().reduce((acc, value) =>
        value == 0 ? acc + 1 : acc,
        0
    );
    return { board, boardNumbers, solutionNumbers: solution.flat(), blankCount }
}


/**
 * @param {{"board": number[][], "solutionNumbers": number[], "blankCount": number}} context
 * @returns {{"isComplete": boolean, "percentComplete": number}}
 */
function checkSudoku({ board, solutionNumbers, blankCount }) {
    const totalCount = solutionNumbers.length;
    const correctCount = board.flat().reduce((acc, value, i) =>
        (value == solutionNumbers[i]) ? acc + 1 : acc,
        0
    );
    const percentComplete = Math.floor((correctCount + blankCount - totalCount) / (blankCount) * 10) * 10;

    return { percentComplete, isComplete: correctCount === totalCount }
}


/**
* @returns {{"isOuttaTime": boolean, "percentTime": number, "timeRemaining": number}}
*/
function checkTime({ startTime, endTime }) {
    const interval = endTime - startTime
    const elapsed = Date.now()-startTime;
    const percentTime = 100 - Math.round((elapsed / interval) * 100);
    const timeRemaining = Math.ceil((interval - elapsed) / 60000);
    return { percentTime, timeRemaining, isOuttaTime: false }
}
/**
 * Parse incoming data.
 * 
 * Data may be:
 * * HTMX events of the form `{"cell_x_y": <number>, "HEADERS": {"HX-Trigger": "cell_x_y", ...}}`  
 * * ScaleSocket room events of the form `{"t": "Join", "arg": 123}`
 * 
 * @param {Object} data
 * @returns {[null] | ["setCell", number, number, number] | ["clearCell", number, number] | ["newPlayer", number]}
 */
function parseEvent(data) {
    const htmxElementId = /** @type {string | undefined} */ (data?.HEADERS?.["HX-Trigger"]);
    const scaleSocketEvent = /** @type {string | undefined} */  (data?.t);

    if (htmxElementId) {
        const [prefix, ...coordinates] = (htmxElementId ? htmxElementId.split("_") : []);
        if (prefix == "cell" && coordinates.length == 2) {
            const value = data?.[htmxElementId] || 0;
            const args = /** @type {[number, number, number]} */ ([...coordinates, value].map(v => parseInt(v)));
            if (args.some(isOutOfBounds)) return [null];

            return ["setCell", ...args];
        }
    } else if (scaleSocketEvent) {
        if (scaleSocketEvent == "Join" && data?.id !== undefined) {
            return ['newPlayer', data.id];
        }
    }
    return [null];
}

/**
 * @param {number} value
 * @returns {boolean}
 */
function isOutOfBounds(value) {
    return isNaN(value) || value < 0 || value > 8;
}

/**
 * @param {number[][]} board
 * @param {NodeJS.WriteStream & { fd: 1; }} stdout
 */
function writeSudoku(board, stdout) {
    board.map(renderRow).forEach(row => stdout.write(row + "\n"));
}

/**
 * @param {string} message
 * @param {NodeJS.WriteStream & { fd: 1; }} stdout
 */
function writeError(message, stdout) {
    stdout.write(`<div id="error">Error: ${message}</div>\n`);
}

function writeProgress(stdout, percentComplete) {
    stdout.write(`<span id="completion-label">${percentComplete}% completed</span>\n`);
    stdout.write(`<span id="completion-label-data" class="progress-bar" role="progressbar" aria-labelledby="completion-label" aria-valuenow="${percentComplete}"><svg width="100" height="10"><rect height="10" width="100" fill="white" /><rect height="10" width="${percentComplete}" fill="#0369a1" /></svg></span>`);
}

/**
 Inlined rendering of rows and cells
 * @param {number[]} row
 * @param {number} y
 * @returns {string}
 */
function renderRow(row, y) {
    return [
        `<tr id="row_${y}">`,
        ...row.map((value, x) => `<td>${renderCell(value, x, y, value != 0)}</td>`),
        `</tr>`
    ].join("");
}

/**
 * @param {number | undefined} value
 * @param {number} x
 * @param {number} y
 */
function renderCell(value, x, y, disabled = false) {
    const v = value === 0 || value === undefined ? "" : value;
    if (disabled) {
        return `<input id="cell_${x}_${y}" disabled="true" hx-swap-oob="true" name="cell_${x}_${y}" value="${v}" />`;
    } else {
        return `<input id="cell_${x}_${y}" hx-swap-oob="true" name="cell_${x}_${y}" value="${v}" hx-ws="send" hx-trigger="keyup changed" maxlength="1" onfocus="this.select()" onclick="this.select()" />`;
    }
}


module.exports = { parseEvent, renderRow, checkSudoku };