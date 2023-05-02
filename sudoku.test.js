const { checkSudoku, parseEvent, renderRow } = require('./sudoku');

describe("parseEvent", () => {
	test('parses htmx events', () => {
		expect(parseEvent(
			{ "cell_0_0": "3", "HEADERS": { "HX-Trigger": "cell_0_0" } }
		)).toEqual(
			["setCell", 0, 0, 3]
		);
		expect(parseEvent(
			{ "cell_8_8": "2", "HEADERS": { "HX-Request": "true", "HX-Trigger": "cell_8_8", "HX-Trigger-Name": "cell_8_8", "HX-Target": null, "HX-Current-URL": "http://localhost:9000/" } }
		)).toEqual(
			["setCell", 8, 8, 2]
		);
	});

	test('parses scalesocket events', () => {
		expect(parseEvent({ "t": "Join", "id": 123 })).toEqual(["newPlayer", 123]);
	});

	test('returns [null] for unparseable events', () => {
		expect(parseEvent()).toEqual([null]);
		expect(parseEvent("")).toEqual([null]);
		expect(parseEvent({})).toEqual([null]);
		expect(parseEvent({ "HEADERS": { "HX-Trigger": "unknown" } })).toEqual([null]);
	});

	test('returns [null] for invalid events', () => {
		expect(parseEvent({ "cell_3_4": "5", "HEADERS": { "HX-Trigger": "cell_1_2" } })).toEqual([null]);
		expect(parseEvent({ "cell_1_2_3": "4", "HEADERS": { "HX-Trigger": "cell_1_2" } })).toEqual([null]);
		expect(parseEvent({ "cell_1_2": "-1", "HEADERS": { "HX-Trigger": "cell_1_2" } })).toEqual([null]);
		expect(parseEvent({ "cell_1_2": "10", "HEADERS": { "HX-Trigger": "cell_1_2" } })).toEqual([null]);
	});
})

describe("renderRow", () => {
	test('renders empty cell correctly', () => {
		expect(renderRow([0], [0], 0)).toEqual(`<tr id="row_0"><td><input id="cell_0_0" hx-swap-oob="true" name="cell_0_0" value="" hx-ws="send" hx-trigger="keyup changed" maxlength="1" onfocus="this.select()" onclick="this.select()" /></td></tr>`);
	});
	test('renders prefilled cell correctly', () => {
		expect(renderRow([1], [1], 0)).toEqual(`<tr id="row_0"><td><input id="cell_0_0" disabled="true" hx-swap-oob="true" name="cell_0_0" value="1" /></td></tr>`);
	});
	test('renders filled cell correctly', () => {
		expect(renderRow([0], [1], 0)).toEqual(`<tr id="row_0"><td><input id="cell_0_0" disabled="true" hx-swap-oob="true" name="cell_0_0" value="" /></td></tr>`);
	});
});

describe("checkSudoku", () => {
	test('returns percentComplete correctly for unfilled board', () => {
		const { percentComplete, isComplete } = checkSudoku({ board: [[1, 0, 0, 4]], solutionNumbers: [1, 2, 3, 4], blankCount: 2 });
		expect(percentComplete).toBe(0);
		expect(isComplete).toBe(false);
	});

	test('returns percentComplete correctly for board with errors', () => {
		const { percentComplete, isComplete } = checkSudoku({ board: [[1, 9, 9, 4]], solutionNumbers: [1, 2, 3, 4], blankCount: 2 });
		expect(percentComplete).toBe(0);
		expect(isComplete).toBe(false);
	});

	test('returns percentComplete correctly for half-completed board', () => {
		const { percentComplete, isComplete } = checkSudoku({ board: [[1, 2, 0, 4]], solutionNumbers: [1, 2, 3, 4], blankCount: 2 });
		expect(percentComplete).toBe(50);
		expect(isComplete).toBe(false);
	});

	test('returns percentComplete correctly for half-completed board with errors', () => {
		const { percentComplete, isComplete } = checkSudoku({ board: [[1, 2, 9, 4]], solutionNumbers: [1, 2, 3, 4], blankCount: 2 });
		expect(percentComplete).toBe(50);
		expect(isComplete).toBe(false);
	});

	test('returns percentComplete correctly for completed board', () => {
		const { percentComplete, isComplete } = checkSudoku({ board: [[1, 2, 3, 4]], solutionNumbers: [1, 2, 3, 4], blankCount: 2 });
		expect(percentComplete).toBe(100);
		expect(isComplete).toBe(true);
	});
});