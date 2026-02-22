import { describe, it, expect } from "vitest";
import { EnumComponent } from "../../generator/Generator.js";

function makeEnum(overrides: Partial<ConstructorParameters<typeof EnumComponent>[0]> = {}) {
	return new EnumComponent({
		name: "status",
		values: ["active", "inactive"],
		type: "string",
		...overrides,
	});
}

// ─── capitalizedName ─────────────────────────────────────────────────────────

describe("EnumComponent — capitalizedName", () => {
	it("uppercases the first character", () => {
		expect(makeEnum({ name: "status" }).capitalizedName).toBe("Status");
	});

	it("preserves name when already capitalised", () => {
		expect(makeEnum({ name: "Status" }).capitalizedName).toBe("Status");
	});

	it("handles single character name", () => {
		expect(makeEnum({ name: "x" }).capitalizedName).toBe("X");
	});
});

// ─── getEnumName ─────────────────────────────────────────────────────────────

describe("EnumComponent — getEnumName()", () => {
	it("returns enumNames[index] when enumNames provided", () => {
		const e = makeEnum({ values: ["0", "1"], enumNames: ["Active", "Inactive"] });
		expect(e.getEnumName(0)).toBe("Active");
		expect(e.getEnumName(1)).toBe("Inactive");
	});

	it("falls back to values[index] when enumNames is undefined", () => {
		const e = makeEnum({ values: ["active", "inactive"], enumNames: undefined });
		expect(e.getEnumName(0)).toBe("active");
		expect(e.getEnumName(1)).toBe("inactive");
	});

	it("falls back to values[index] when enumNames is shorter than values", () => {
		const e = makeEnum({ values: ["a", "b", "c"], enumNames: ["A"] });
		expect(e.getEnumName(1)).toBe("b");
	});
});

// ─── formatValue (via render) ────────────────────────────────────────────────

describe("EnumComponent — formatValue (tested via render)", () => {
	it("wraps string values in double quotes", () => {
		const rendered = makeEnum({ type: "string", values: ["active"] }).render();
		expect(rendered).toContain(`active = "active"`);
	});

	it("returns raw integer value without quotes for type 'integer'", () => {
		const rendered = makeEnum({ type: "integer", values: ["1", "2"] }).render();
		expect(rendered).toContain("= 1");
		expect(rendered).not.toContain('"1"');
	});

	it("returns raw value without quotes for type 'number'", () => {
		const rendered = makeEnum({ type: "number", values: ["3"] }).render();
		expect(rendered).toContain("= 3");
	});

	it("returns raw value without quotes for type 'int32'", () => {
		const rendered = makeEnum({ type: "int32", values: ["0"] }).render();
		expect(rendered).toContain("= 0");
	});

	it("returns raw value without quotes for type 'int64'", () => {
		const rendered = makeEnum({ type: "int64", values: ["9"] }).render();
		expect(rendered).toContain("= 9");
	});
});

// ─── render() ────────────────────────────────────────────────────────────────

describe("EnumComponent — render()", () => {
	it("produces a valid TypeScript enum declaration with correct name", () => {
		const rendered = makeEnum({ name: "color", values: ["red"], type: "string" }).render();
		expect(rendered).toMatch(/^export enum Color \{/);
	});

	it("uses enumNames as member identifiers when provided", () => {
		const rendered = makeEnum({
			values: ["0", "1"],
			enumNames: ["Active", "Inactive"],
			type: "integer",
		}).render();
		expect(rendered).toContain("Active = 0");
		expect(rendered).toContain("Inactive = 1");
	});

	it("uses values as member identifiers when enumNames not provided", () => {
		const rendered = makeEnum({ values: ["pending", "done"], type: "string" }).render();
		expect(rendered).toContain("pending");
		expect(rendered).toContain("done");
	});

	it("produces multi-value enum with comma separators", () => {
		const rendered = makeEnum({ values: ["a", "b", "c"], type: "string" }).render();
		// Three members → two commas
		const commas = (rendered.match(/,/g) ?? []).length;
		expect(commas).toBe(2);
	});

	it("ends with closing brace", () => {
		const rendered = makeEnum().render();
		expect(rendered.trimEnd().endsWith("}")).toBe(true);
	});

	it("each member is indented with a tab", () => {
		const rendered = makeEnum({ values: ["x"], type: "string" }).render();
		expect(rendered).toContain("\tx");
	});
});
