// @ts-check

const SudokuBox = require('sudokubox');
const { writeMessage, main } = require('./sudoku');

const { stdin, stdout } = process;

if (require.main === module) {
  try {
    console.error('starting server');
    main(stdin, stdout, new SudokuBox());
  } catch (e) {
    writeMessage(e?.message || e, stdout, 'error');
    console.error(e);
  } finally {
    console.error('stopping server');
  }
}
