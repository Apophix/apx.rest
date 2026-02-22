import { describe, it, expect } from "vitest";
import { cloneObject } from "../../src/utils.js";

describe("cloneObject", () => {
	it("returns a different object reference", () => {
		const original = { a: 1 };
		const clone = cloneObject(original);
		expect(clone).not.toBe(original);
	});

	it("preserves the prototype chain", () => {
		class Foo { x = 1; }
		const original = new Foo();
		const clone = cloneObject(original);
		expect(Object.getPrototypeOf(clone)).toBe(Object.getPrototypeOf(original));
	});
});
