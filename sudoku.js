// @ts-check

/**
 * @typedef {import('sudokubox')} SudokuBox
 * @typedef {{ board: number[][]; originalBoard: number[][], solutionNumbers: number[]; blankCount: number; isEnded: boolean }} GameState
 * @typedef {{startTime: number, endTime: number}} TimeState
 * @typedef {{ctx: GameState & TimeState, checkInterval: NodeJS.Timer}} State
 * @typedef {[null] | ["setCell", number, number, number] | ["clearCell", number, number] | ["newPlayer", number] | ["startGame"]} Event
 */

/**
 * @param {Event} event
 * @param {State} state
 * @param {NodeJS.Process} proc
 * @param {SudokuBox} sudoku
 */
function handleEvent(event, state, proc, sudoku) {
  switch (event[0]) {
    case 'setCell': {
      const [_, x, y, value] = event;
      state.ctx.board[y][x] = value;
      proc.stdout.write(`${renderCell(value, x, y)}\n`);
      break;
    }
    case 'newPlayer':
      writeSudoku(state.ctx.board, state.ctx.originalBoard, proc);
      break;
    case 'startGame':
      clearInterval(state?.checkInterval);
      state.ctx = {
        ...generateTimes(10),
        ...generateSudoku(sudoku),
      };

      state.checkInterval = setInterval(checkGame, 2500, state, proc, sudoku);

      writeSudoku(state.ctx.board, state.ctx.originalBoard, proc);
      break;
    default:
      break;
  }
}

/**
 * @param {number} roundTimeMins
 * @returns {{"startTime": number, "endTime": number}}
 */
function generateTimes(roundTimeMins) {
  return {
    startTime: Date.now(),
    endTime: Date.now() + 60 * roundTimeMins * 1000,
  };
}

/**
 * @param {SudokuBox} sudoku
 * @returns {GameState}
 */
function generateSudoku(sudoku) {
  // @ts-expect-error - error and board are mutually exclusive
  const { board, puzzle: boardNumbers, error } = sudoku.generate({ level: 'EASY' });

  if (error) {
    throw new Error(`Failed to generate sudoku: ${error.message}`);
  }

  const { isPuzzleSolved, board: solution } = sudoku.solve({ input: boardNumbers });

  if (!isPuzzleSolved) {
    throw new Error('Failed to solve generated sudoku');
  }

  const blankCount = board.flat().reduce((acc, value) => (value == 0 ? acc + 1 : acc), 0);
  return {
    board, originalBoard: structuredClone(board), solutionNumbers: solution.flat(), blankCount,
  };
}

/**
 * @param {State} state
 * @param {NodeJS.Process} proc
 * @param {SudokuBox} sudoku
 */
function checkGame(state, proc, sudoku, isRestart = true) {
  const { percentComplete, isComplete } = checkSudoku(state.ctx);
  const { percentTime, timeRemaining, isOuttaTime } = checkTime(state.ctx);
  const shouldRestart = (isOuttaTime || isComplete) && isRestart;

  if (isOuttaTime) {
    writeMessage('Failed!', process.stdout);
  } else if (isComplete) {
    writeMessage('Success!', process.stdout);
  }

  if (shouldRestart) {
    clearInterval(state.checkInterval);
    setTimeout(() => handleEvent(['startGame'], state, proc, sudoku), 5000);
  }

  writeProgress(proc.stdout, percentComplete, percentTime, timeRemaining);
}

/**
 * @param {GameState} context
 * @returns {{"isComplete": boolean, "percentComplete": number}}
 */
function checkSudoku({ board, solutionNumbers, blankCount }) {
  const totalCount = solutionNumbers.length;
  // eslint-disable-next-line max-len
  const correctCount = board.flat().reduce((acc, value, i) => ((value === solutionNumbers[i]) ? acc + 1 : acc), 0);
  // eslint-disable-next-line max-len
  const percentComplete = Math.floor(((correctCount + blankCount - totalCount) / blankCount) * 10) * 10;

  return { percentComplete, isComplete: correctCount === totalCount };
}

/**
 * @param {TimeState} context
* @returns {{"isOuttaTime": boolean, "percentTime": number, "timeRemaining": number}}
*/
function checkTime({ startTime, endTime }) {
  const interval = endTime - startTime;
  const elapsed = Date.now() - startTime;
  const percentTime = Math.round((elapsed / interval) * 100);
  const timeRemaining = Math.ceil((interval - elapsed) / 60000);
  return { percentTime, timeRemaining, isOuttaTime: timeRemaining <= 0 };
}
/**
 * Parse incoming data.
 *
 * Data may be:
 * * HTMX events of the form `{"cell_x_y": <number>, "HEADERS": {"HX-Trigger": "cell_x_y", ...}}`
 * * ScaleSocket room events of the form `{"t": "Join", "arg": 123}`
 *
 * @param {Object} data
 * @returns {Event}
 */
function parseEvent(data) {
  const htmxElementId = /** @type {string | undefined} */ (data?.HEADERS?.['HX-Trigger']);
  const scaleSocketEvent = /** @type {string | undefined} */ (data?.t);

  if (htmxElementId) {
    const [prefix, ...coordinates] = (htmxElementId ? htmxElementId.split('_') : []);
    const payload = data?.[htmxElementId];

    if (prefix == 'cell' && coordinates.length == 2 && payload) {
      const value = payload ?? 0;
      const args = /** @type {[number, number, number]} */
        ([...coordinates, value].map((v) => parseInt(v)));
      if (args.some(isOutOfBounds)) return [null];

      return ['setCell', ...args];
    }
  } else if (scaleSocketEvent) {
    if (scaleSocketEvent == 'Join' && data?.id !== undefined) {
      return ['newPlayer', data.id];
    }
  }
  return [null];
}

/**
 * @param {number[][]} board
 * @param {number[][]} originalBoard
 * @param {NodeJS.Process} proc
 */
function writeSudoku(board, originalBoard, proc) {
  board.map(
    (row, i) => renderRow(row, originalBoard[i], i),
  ).forEach((row) => proc.stdout.write(`${row}\n`));
}

/**
 * @param {string} message
 * @param {NodeJS.WriteStream & { fd: 1; }} stdout
 * @param {"message" | "error"} id
 */
function writeMessage(message, stdout, id = 'message') {
  stdout.write(`<div id="${id}" class="overlay">${message}</div>\n`);
}

/**
 * @param {NodeJS.WriteStream & { fd: 1; }} stdout
 * @param {number} percentComplete
 * @param {number} percentTime
 * @param {number} timeRemaining
 */
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
function renderRow(row, originalRow, y) {
  return [
    `<tr id="row_${y}">`,
    ...row.map((value, x) => `<td>${renderCell(value, x, y, originalRow[x] != 0)}</td>`),
    '</tr>',
  ].join('');
}

/**
 * @param {number | undefined} value
 * @param {number} x
 * @param {number} y
 */
function renderCell(value, x, y, disabled = false) {
  const v = value === 0 || value === undefined ? '' : value;
  if (disabled) {
    return `<input id="cell_${x}_${y}" disabled="true" hx-swap-oob="true" name="cell_${x}_${y}" value="${v}" />`;
  }
  return `<input id="cell_${x}_${y}" hx-swap-oob="true" name="cell_${x}_${y}" value="${v}" hx-ws="send" hx-trigger="keyup changed" maxlength="1" onfocus="this.select()" onclick="this.select()" />`;
}

/**
 * @param {number} value
 * @returns {boolean}
 */
function isOutOfBounds(value) {
  return Number.isNaN(value) || value < 0 || value > 9;
}

module.exports = {
  // eslint-disable-next-line max-len
  parseEvent, renderRow, writeSudoku, writeMessage, writeProgress, generateTimes, generateSudoku, checkSudoku, checkTime, handleEvent, checkGame,
};
