// @ts-check

const SudokuBox = require('sudokubox');
const { parseEvent, handleEvent } = require('./sudoku');

/** @type {import('./sudoku.js').State}} */
// @ts-expect-error state is initialized by startGame
const state = ({ ctx: {}, checkInterval: undefined });
const sudoku = new SudokuBox();

handleEvent(['startGame'], state, process, sudoku);

process.stdin.on('data', (data) => handleEvent(
  parseEvent(JSON.parse(data.toString())),
  state,
  process,
  sudoku,
));
