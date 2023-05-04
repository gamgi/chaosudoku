// @ts-check

const SudokuBox = require('sudokubox');
const {
  writeMessage, writeSudoku, generateSudoku, generateTimes,
  parseEvent, handleEvent, checkGame, startGame,
} = require('./sudoku');

if (require.main === module) {
  try {
    console.error('starting server');
    main(process, new SudokuBox());
  } catch (e) {
    writeMessage(e?.message || e, process.stdout, 'error');
    console.error(e);
  }
}

/**
 * @param {NodeJS.Process} proc;
 * @param {SudokuBox} sudokuBox
 */
function main(proc, sudokuBox) {
  const state = { ctx: {}, checkInterval: undefined };
  // @ts-expect-error state is initialized by startGame
  handleEvent(['startGame'], state, proc, sudokuBox);

  proc.stdin.on('data', (data) => {
    try {
      // @ts-expect-error - data is actually implicitly cast to string
      const event = parseEvent(JSON.parse(data));
      handleEvent(event, state, proc, sudokuBox);
    } catch (err) {
      console.error(err);
    }
  });
}
