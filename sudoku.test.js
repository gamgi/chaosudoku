const SudokuBox = require('sudokubox');
const { checkSudoku, parseEvent, renderRow, handleEvent, writeSudoku, checkGame } = require('./sudoku');

const createCtx = (ctx) => ({ board: [[]], boardHint: [[]], startTime: Date.now(), endTime: Date.now() + 10000, ...ctx });
const createState = (ctx) => ({ ctx: createCtx(ctx) });
const createProcess = () => ({ stdout: { read: jest.fn(), write: jest.fn() } });

describe('parseEvent', () => {
  test('parses htmx events', () => {
    expect(parseEvent({ cell_0_0: '3', HEADERS: { 'HX-Trigger': 'cell_0_0' } })).toEqual(['setCell', 0, 0, 3]);
    expect(parseEvent(
      {
        cell_8_8: '2',
        HEADERS: {
          'HX-Request': 'true', 'HX-Trigger': 'cell_8_8', 'HX-Trigger-Name': 'cell_8_8', 'HX-Target': null, 'HX-Current-URL': 'http://localhost:9000/',
        },
      },
    )).toEqual(['setCell', 8, 8, 2]);
  });

  test('parses scalesocket events', () => {
    expect(parseEvent({ t: 'Join', id: 123 })).toEqual(['newPlayer', 123]);
  });

  test('returns [null] for unparseable events', () => {
    expect(parseEvent()).toEqual([null]);
    expect(parseEvent('')).toEqual([null]);
    expect(parseEvent({})).toEqual([null]);
    expect(parseEvent({ HEADERS: { 'HX-Trigger': 'unknown' } })).toEqual([null]);
  });

  test('returns [null] for invalid events', () => {
    expect(parseEvent({ cell_3_4: '5', HEADERS: { 'HX-Trigger': 'cell_1_2' } })).toEqual([null]);
    expect(parseEvent({ cell_1_2_3: '4', HEADERS: { 'HX-Trigger': 'cell_1_2' } })).toEqual([null]);
    expect(parseEvent({ cell_1_2: '-1', HEADERS: { 'HX-Trigger': 'cell_1_2' } })).toEqual([null]);
    expect(parseEvent({ cell_1_2: '10', HEADERS: { 'HX-Trigger': 'cell_1_2' } })).toEqual([null]);
  });
});

describe('handleEvent', () => {
  const sudokuBox = new SudokuBox();

  test('setCell sets sudoku cell and sends board', () => {
    const state = createState({ board: [[1, 0, 3]], boardHint: [[1, 0, 3]] });
    const mockProcess = createProcess();
    const [x, y] = [1, 0];
    handleEvent(['setCell', x, y, 2], state, mockProcess, sudokuBox);

    expect(state.ctx.board).toEqual([[1, 2, 3]]);
    expect(mockProcess.stdout.write).toHaveBeenCalledWith(expect.stringMatching(/id="cell_1_0"/));
    expect(mockProcess.stdout.write).toHaveBeenCalledWith(expect.stringMatching(/value="2"/));
  });

  test('newPlayer sends board', () => {
    const state = createState({ board: [[1, 0]], boardHint: [[1, 2]] });
    const mockProcess = createProcess();
    handleEvent(['newPlayer', 123], state, mockProcess, sudokuBox);

    expect(mockProcess.stdout.write).toHaveBeenCalled();
  });

  test('startGame initializes state context', () => {
    const state = ({ ctx: {} });
    const mockProcess = createProcess();

    handleEvent(['startGame'], state, mockProcess, sudokuBox);
    clearInterval(state.checkInterval);

    expect(Object.keys(state.ctx)).toEqual([
      'startTime',
      'endTime',
      'board',
      'boardHint',
      'solution',
      'blankCount',
    ]);
  });

  test('startGame starts checking sudoku with interval', () => {
    const state = createState();
    const mockProcess = createProcess();

    handleEvent(['startGame'], state, mockProcess, sudokuBox);
    clearInterval(state.checkInterval);

    expect(state.checkInterval).not.toBeUndefined();
  });
});

describe('renderRow', () => {
  test('renders empty cell correctly', () => {
    expect(renderRow([0], [0], 0)).toEqual(expect.stringMatching('<input.*? value="" .*?/>'));
    expect(renderRow([0], [0], 0)).toEqual(expect.stringMatching('<input.*? hx-ws="send" .*?/>'));
  });
  test('renders prefilled cell correctly', () => {
    expect(renderRow([1], [1], 0)).toEqual(expect.stringMatching('<input.*? value="1" .*?/>'));
    expect(renderRow([1], [1], 0)).toEqual(expect.stringMatching('<input.*? disabled="true" .*?/>'));
  });
  test('renders filled cell correctly', () => {
    expect(renderRow([0], [1], 0)).toEqual(expect.stringMatching('<input.*? value="" .*?/>'));
    expect(renderRow([0], [1], 0)).toEqual(expect.stringMatching('<input.*? disabled="true" .*?/>'));
  });
});

describe('writeSudoku', () => {
  test('sends sudoku without newlines', () => {
    const mockProcess = createProcess();
    writeSudoku([[1, 0]], [[1, 2]], mockProcess);

    expect(mockProcess.stdout.write).toHaveBeenCalledWith(expect.stringMatching(/<tr id="row_0"><td><input id="cell_0_0" [^^]+><\/td><td><input id="cell_1_0" [^^]+ \/><\/td><\/tr>/));
    expect(mockProcess.stdout.write).toHaveBeenCalledWith(expect.not.stringMatching('/n'));
  });
});

describe('checkSudoku', () => {
  test('returns percentComplete correctly for unfilled board', () => {
    const { percentComplete, isComplete } = checkSudoku({ board: [[1, 0, 0, 4]], solution: [1, 2, 3, 4], blankCount: 2 });
    expect(percentComplete).toBe(0);
    expect(isComplete).toBe(false);
  });

  test('returns percentComplete correctly for board with errors', () => {
    const { percentComplete, isComplete } = checkSudoku({ board: [[1, 9, 9, 4]], solution: [1, 2, 3, 4], blankCount: 2 });
    expect(percentComplete).toBe(0);
    expect(isComplete).toBe(false);
  });

  test('returns percentComplete correctly for half-completed board', () => {
    const { percentComplete, isComplete } = checkSudoku({ board: [[1, 2, 0, 4]], solution: [1, 2, 3, 4], blankCount: 2 });
    expect(percentComplete).toBe(50);
    expect(isComplete).toBe(false);
  });

  test('returns percentComplete correctly for half-completed board with errors', () => {
    const { percentComplete, isComplete } = checkSudoku({ board: [[1, 2, 9, 4]], solution: [1, 2, 3, 4], blankCount: 2 });
    expect(percentComplete).toBe(50);
    expect(isComplete).toBe(false);
  });

  test('returns percentComplete correctly for completed board', () => {
    const { percentComplete, isComplete } = checkSudoku({ board: [[1, 2, 3, 4]], solution: [1, 2, 3, 4], blankCount: 2 });
    expect(percentComplete).toBe(100);
    expect(isComplete).toBe(true);
  });
});

describe('checkGame', () => {
  test('sends success message for completed board', () => {
    const state = createState({ board: [[1, 2, 3, 4]], solution: [1, 2, 3, 4], blankCount: 2 });
    const mockProcess = createProcess();
    checkGame(state, mockProcess, jest.fn(), false);

    expect(mockProcess.stdout.write).toHaveBeenCalledWith(expect.stringMatching(/<div.*? id="message" .*?>Success/));
  });

  test('sends progress', () => {
    const state = createState({ board: [[1, 0]], solution: [1, 2], blankCount: 1 });
    const mockProcess = createProcess();
    checkGame(state, mockProcess, jest.fn(), false);

    expect(mockProcess.stdout.write).toHaveBeenCalledWith(expect.stringMatching(/<span id="completion-label">0% completed/));
  });
});
