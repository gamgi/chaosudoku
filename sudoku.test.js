const { parseEvent } = require('./sudoku');

describe("parseEvent", () => {
	test('parses events', () => {
		expect(parseEvent(
			{ "cell_0_0": "3", "HEADERS": { "HX-Trigger": "cell_0_0" } }
		)).toEqual(
			["setCell", 0, 0, 3]
		);
		expect(parseEvent(
			{"cell_8_8":"2","HEADERS":{"HX-Request":"true","HX-Trigger":"cell_8_8","HX-Trigger-Name":"cell_8_8","HX-Target":null,"HX-Current-URL":"http://localhost:9000/"}}
		)).toEqual(
			["setCell", 8, 8, 2]
		);
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
