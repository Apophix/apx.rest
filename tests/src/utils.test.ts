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

	it("copies own enumerable properties", () => {
		const original = { name: "Alice", age: 30, active: true };
		const clone = cloneObject(original);
		expect(clone.name).toBe("Alice");
		expect(clone.age).toBe(30);
		expect(clone.active).toBe(true);
	});

	it("shallow-copies nested objects (not a deep clone)", () => {
		const nested = { value: 42 };
		const original = { nested };
		const clone = cloneObject(original);
		expect(clone.nested).toBe(nested);
	});

	it("works with class instances — methods accessible via prototype", () => {
		class Counter {
			count = 0;
			increment() { this.count++; }
		}
		const original = new Counter();
		original.count = 5;
		const clone = cloneObject(original);
		clone.increment();
		expect(clone.count).toBe(6);
		expect(original.count).toBe(5); // original unchanged
	});
});
