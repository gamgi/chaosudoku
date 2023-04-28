// @ts-check

const SudokuBox = require("sudokubox");

if (require.main === module) {
    process.stderr.write("starting server\n");
    try {
        main(process.stdin, process.stdout, new SudokuBox());
    } catch (e) {
        writeMessage(e?.message || e, process.stdout, "error");
        console.error(e);
    }
}

/**
 * @param {NodeJS.ReadStream & { fd: 0; }} stdin
 * @param {NodeJS.WriteStream & { fd: 1; }} stdout
 * @param {SudokuBox} sudokuBox
 */
function main(stdin, stdout, sudokuBox) {
    let checkInterval;
    let context;

    const startGame = () => {
        writeMessage("", process.stdout);
        writeMessage("", process.stdout, "error");
        context = {
            ...generateTimes(10),
            ...generateSudoku(sudokuBox),
        }
        writeSudoku(context.board, stdout);
        checkInterval = setInterval(doChecks, 2500, context)
    };

    const doChecks = (ctx) => {
        const { percentComplete, isComplete } = checkSudoku(ctx);
        const { percentTime, timeRemaining, isOuttaTime } = checkTime(ctx);
        if (isOuttaTime) {
            writeMessage("Failed!", process.stdout);
            clearInterval(checkInterval);
            setTimeout(() => startGame(), 5000);
        } else if (isComplete) {
            writeMessage("Success!", process.stdout);
            clearInterval(checkInterval);
            setTimeout(() => startGame(), 5000);
        }
        writeProgress(stdout, percentComplete, percentTime, timeRemaining);
    };

    stdin.on("data", (data) => {
        // @ts-expect-error - data is actually implicitly cast to string
        const event = parseEvent(JSON.parse(data));
        switch (event[0]) {
            case "setCell":
                const [_, x, y, value] = event;
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
    startGame();
}


/**
 * @param {number} timeMin
 * @returns {{"startTime": number, "endTime": number}}
 */
function generateTimes(timeMin) {
    return {
        startTime: Date.now(),
        endTime: Date.now() + 60 * timeMin * 1000,
    };
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
        value == 0 ? acc + 1 : acc, 0
    );
    return { board, boardNumbers, solutionNumbers: solution.flat(), blankCount, solution }
}


/**
 * @param {{"board": number[][], "solutionNumbers": number[], "blankCount": number}} context
 * @returns {{"isComplete": boolean, "percentComplete": number}}
 */
function checkSudoku({ board, solutionNumbers, blankCount }) {
    const totalCount = solutionNumbers.length;
    const correctCount = board.flat().reduce((acc, value, i) =>
        (value == solutionNumbers[i]) ? acc + 1 : acc, 0
    );
    board.flat().forEach((value, i) => {
        if (value != 0 && value != solutionNumbers[i]) {
            console.error("wrong", i, value, solutionNumbers[i])
        }
    });
    const percentComplete = Math.floor((correctCount + blankCount - totalCount) / (blankCount) * 10) * 10;

    return { percentComplete, isComplete: correctCount === totalCount }
}


/**
* @returns {{"isOuttaTime": boolean, "percentTime": number, "timeRemaining": number}}
*/
function checkTime({ startTime, endTime }) {
    const interval = endTime - startTime
    const elapsed = Date.now() - startTime;
    const percentTime = Math.round((elapsed / interval) * 100);
    const timeRemaining = Math.ceil((interval - elapsed) / 60000);
    return { percentTime, timeRemaining, isOuttaTime: timeRemaining <= 0 }
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
        const payload = data?.[htmxElementId];

        if (prefix == "cell" && coordinates.length == 2 && payload) {
            const value = payload ?? 0;
            const args = /** @type {[number, number, number]} */
                ([...coordinates, value].map(v => parseInt(v)));
            if (args.some(isOutOfBounds)) return [null];

            return ["setCell", ...args];
        }
    } else if (scaleSocketEvent) {
        if (scaleSocketEvent == "Join" && data?.id !== undefined) {
            console.error("new player");
            return ['newPlayer', data.id];
        }
    }
    return [null];
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
 * @param {"message" | "error"} id
 */
function writeMessage(message, stdout, id = "message") {
    stdout.write(`<div id="${id}" class="overlay">${message}</div>\n`);
}

function writeProgress(stdout, percentComplete, percentTime, timeRemaining) {
    stdout.write(`<span id="completion-label">${percentComplete}% completed</span>\n`);
    stdout.write(`<span id="completion-label-data" class="progress-bar" role="progressbar" aria-labelledby="completion-label" aria-valuenow="${percentComplete}"><svg width="100" height="10"><rect height="10" width="100" fill="white" /><rect height="10" width="${percentComplete}" fill="#0369a1" /></svg></span>\n`);
    stdout.write(`<span id="time-label">${timeRemaining} min remaining</span>\n`);
    stdout.write(`<span id="time-label-data" class="progress-bar" role="progressbar" aria-labelledby="completion-label" aria-valuenow="${percentTime}"><svg width="100" height="10"><rect height="10" width="100" fill="white" /><rect height="10" width="${percentTime}" fill="#0369a1" /></svg></span>\n`);
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

/**
 * @param {number} value
 * @returns {boolean}
 */
function isOutOfBounds(value) {
    return isNaN(value) || value < 0 || value > 9;
}



module.exports = { parseEvent, renderRow, checkSudoku };