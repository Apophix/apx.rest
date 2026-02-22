import { describe, it, expect, beforeEach } from "vitest";
import {
	Property,
	requestComponents,
	RequestComponent,
	EComponentType,
	resetGeneratorState,
} from "../../generator/Generator.js";

function prop(overrides: Partial<ConstructorParameters<typeof Property>[0]> = {}) {
	return new Property({
		name: "myProp",
		type: "string",
		nullable: false,
		referenceIsEnum: false,
		isFormField: false,
		...overrides,
	});
}

beforeEach(() => resetGeneratorState());

// ─── Computed getters ─────────────────────────────────────────────────────────

describe("Property — referenceComponentName", () => {
	it("returns last segment of $ref path", () => {
		const p = prop({ $ref: "#/components/schemas/UserModel" });
		expect(p.referenceComponentName).toBe("UserModel");
	});

	it("returns undefined when $ref not set", () => {
		const p = prop();
		expect(p.referenceComponentName).toBeUndefined();
	});
});

describe("Property — isArray", () => {
	it("returns true when type is 'array'", () => {
		expect(prop({ type: "array" }).isArray).toBe(true);
	});

	it("returns false for non-array type", () => {
		expect(prop({ type: "string" }).isArray).toBe(false);
	});
});

describe("Property — isDictionary", () => {
	it("returns true when type is 'object' and additionalProperties is set", () => {
		const p = prop({
			type: "object",
			additionalProperties: { name: "v", type: "string", nullable: false, referenceIsEnum: false, isFormField: false },
		});
		expect(p.isDictionary).toBe(true);
	});

	it("returns false when type is 'object' but no additionalProperties", () => {
		expect(prop({ type: "object" }).isDictionary).toBe(false);
	});

	it("returns false when type is not 'object'", () => {
		expect(prop({ type: "string" }).isDictionary).toBe(false);
	});
});

describe("Property — isDate", () => {
	it("returns true for type 'string' + format 'date-time'", () => {
		expect(prop({ type: "string", format: "date-time" }).isDate).toBe(true);
	});

	it("returns false for type 'string' without format", () => {
		expect(prop({ type: "string" }).isDate).toBe(false);
	});

	it("returns false for non-string type with date-time format", () => {
		expect(prop({ type: "integer", format: "date-time" }).isDate).toBe(false);
	});
});

describe("Property — isNumberType", () => {
	it.each(["number", "integer", "int32"])("returns true for type '%s'", (type) => {
		expect(prop({ type }).isNumberType).toBe(true);
	});

	it.each(["int32", "int64", "float", "double"])("returns true for no type but format '%s'", (format) => {
		expect(prop({ type: undefined, format }).isNumberType).toBe(true);
	});

	it("returns false for type 'string'", () => {
		expect(prop({ type: "string" }).isNumberType).toBe(false);
	});

	it("returns false for type 'boolean'", () => {
		expect(prop({ type: "boolean" }).isNumberType).toBe(false);
	});
});

describe("Property — isFormFile", () => {
	it("returns true for type 'string' + format 'binary'", () => {
		expect(prop({ type: "string", format: "binary" }).isFormFile).toBe(true);
	});

	it("returns true when referenceComponentName is 'IFormFile'", () => {
		expect(prop({ $ref: "#/components/schemas/IFormFile" }).isFormFile).toBe(true);
	});

	it("returns false for other types", () => {
		expect(prop({ type: "boolean" }).isFormFile).toBe(false);
	});
});

describe("Property — lowerCamelName", () => {
	it("lowercases the first character", () => {
		expect(prop({ name: "UserId" }).lowerCamelName).toBe("userId");
	});

	it("leaves already-lowercase name unchanged", () => {
		expect(prop({ name: "name" }).lowerCamelName).toBe("name");
	});
});

describe("Property — renderName", () => {
	it("returns lowerCamelName when isFormField=true", () => {
		expect(prop({ name: "FileName", isFormField: true }).renderName).toBe("fileName");
	});

	it("returns name when isFormField=false", () => {
		expect(prop({ name: "FileName", isFormField: false }).renderName).toBe("FileName");
	});
});

// ─── formattedDtoType ─────────────────────────────────────────────────────────

describe("Property — formattedDtoType", () => {
	it("returns enum array type for array of enum refs", () => {
		const p = prop({
			type: "array",
			referenceIsEnum: true,
			items: {
				name: "item",
				type: undefined,
				nullable: false,
				$ref: "#/components/schemas/Status",
				referenceIsEnum: true,
				isFormField: false,
			},
		});
		expect(p.formattedDtoType).toBe("Status[]");
	});

	it("returns 'File' for a form file", () => {
		expect(prop({ type: "string", format: "binary" }).formattedDtoType).toBe("File");
	});

	it("returns 'File[]' for an array of form files", () => {
		const p = prop({
			type: "array",
			items: {
				name: "f",
				type: "string",
				format: "binary",
				nullable: false,
				referenceIsEnum: false,
				isFormField: false,
			},
		});
		expect(p.formattedDtoType).toBe("File[]");
	});

	it("returns plain enum name for single enum ref", () => {
		const p = prop({ $ref: "#/components/schemas/Status", referenceIsEnum: true });
		expect(p.formattedDtoType).toBe("Status");
	});

	it("returns TXxxDto for a non-enum $ref", () => {
		const p = prop({ $ref: "#/components/schemas/UserResponse", referenceIsEnum: false });
		expect(p.formattedDtoType).toBe("TUserResponseDto");
	});

	it("returns TXxxDto[] for array of non-enum $refs", () => {
		const p = prop({
			type: "array",
			items: {
				name: "i",
				type: undefined,
				nullable: false,
				$ref: "#/components/schemas/UserModel",
				referenceIsEnum: false,
				isFormField: false,
			},
		});
		expect(p.formattedDtoType).toBe("TUserModelDto[]");
	});

	it("returns 'number' for numeric types", () => {
		expect(prop({ type: "integer" }).formattedDtoType).toBe("number");
	});

	it("returns primitive array type for array of scalars", () => {
		const p = prop({
			type: "array",
			items: { name: "i", type: "string", nullable: false, referenceIsEnum: false, isFormField: false },
		});
		expect(p.formattedDtoType).toBe("string[]");
	});

	it("returns Record type for dictionary", () => {
		const p = prop({
			type: "object",
			additionalProperties: { name: "v", type: "string", nullable: false, referenceIsEnum: false, isFormField: false },
		});
		expect(p.formattedDtoType).toBe("Record<string, string>");
	});

	it("returns Record<string, any> when additionalProperties has no type", () => {
		const p = prop({
			type: "object",
			additionalProperties: { name: "v", type: undefined, nullable: false, referenceIsEnum: false, isFormField: false },
		});
		expect(p.formattedDtoType).toBe("Record<string, any>");
	});

	it("returns raw type for plain scalars", () => {
		expect(prop({ type: "boolean" }).formattedDtoType).toBe("boolean");
	});
});

// ─── formattedType ────────────────────────────────────────────────────────────

describe("Property — formattedType", () => {
	it("returns 'Date' for date-time string", () => {
		expect(prop({ type: "string", format: "date-time" }).formattedType).toBe("Date");
	});

	it("returns 'number' for integer", () => {
		expect(prop({ type: "integer" }).formattedType).toBe("number");
	});

	it("returns 'File' for binary form file", () => {
		expect(prop({ type: "string", format: "binary" }).formattedType).toBe("File");
	});

	it("returns 'File[]' for array of binary form files", () => {
		const p = prop({
			type: "array",
			items: {
				name: "f",
				type: "string",
				format: "binary",
				nullable: false,
				referenceIsEnum: false,
				isFormField: false,
			},
		});
		expect(p.formattedType).toBe("File[]");
	});

	it("returns enum array type for array of enum refs", () => {
		const p = prop({
			type: "array",
			items: {
				name: "i",
				type: undefined,
				nullable: false,
				$ref: "#/components/schemas/Status",
				referenceIsEnum: true,
				isFormField: false,
			},
		});
		expect(p.formattedType).toBe("Status[]");
	});

	it("returns plain enum name for single enum ref (no T prefix)", () => {
		expect(prop({ $ref: "#/components/schemas/Status", referenceIsEnum: true }).formattedType).toBe("Status");
	});

	it("returns plain reference name for non-enum $ref (no T prefix)", () => {
		expect(prop({ $ref: "#/components/schemas/UserModel", referenceIsEnum: false }).formattedType).toBe("UserModel");
	});

	it("returns XxxArray ref for array of references", () => {
		const p = prop({
			type: "array",
			items: {
				name: "i",
				type: undefined,
				nullable: false,
				$ref: "#/components/schemas/Tag",
				referenceIsEnum: false,
				isFormField: false,
			},
		});
		expect(p.formattedType).toBe("Tag[]");
	});

	it("returns primitive array for array of scalars", () => {
		const p = prop({
			type: "array",
			items: { name: "i", type: "boolean", nullable: false, referenceIsEnum: false, isFormField: false },
		});
		expect(p.formattedType).toBe("boolean[]");
	});

	it("returns Map type for dictionary", () => {
		const p = prop({
			type: "object",
			additionalProperties: { name: "v", type: "string", nullable: false, referenceIsEnum: false, isFormField: false },
		});
		expect(p.formattedType).toBe("Map<string, string>");
	});

	it("returns raw type for plain scalar", () => {
		expect(prop({ type: "string" }).formattedType).toBe("string");
	});
});

// ─── render() and renderAsDto() ───────────────────────────────────────────────

describe("Property — render()", () => {
	it("produces nullable field with '?' when nullable=true", () => {
		expect(prop({ name: "id", type: "string", nullable: true }).render()).toContain("id?:");
	});

	it("produces non-nullable field without '?' when nullable=false", () => {
		const rendered = prop({ name: "id", type: "string", nullable: false }).render();
		expect(rendered).toContain("id:");
		expect(rendered).not.toContain("id?:");
	});

	it("adds 'T' prefix for request-component reference in isRequest=true mode", () => {
		requestComponents.set(
			"CreateUserRequest",
			new RequestComponent({
				name: "CreateUserRequest",
				properties: [],
				requiredProperties: [],
				componentType: EComponentType.Request,
			})
		);
		const p = prop({ name: "body", $ref: "#/components/schemas/CreateUserRequest", referenceIsEnum: false });
		expect(p.render(true)).toContain("TCreateUserRequest");
	});

	it("does NOT add 'T' prefix when isRequest=false", () => {
		const p = prop({ name: "body", $ref: "#/components/schemas/SomeModel", referenceIsEnum: false });
		const rendered = p.render(false);
		expect(rendered).not.toMatch(/T[A-Z]/);
	});
});

describe("Property — renderAsDto()", () => {
	it("uses formattedDtoType", () => {
		const p = prop({ name: "count", type: "integer" });
		expect(p.renderAsDto()).toBe("count: number;");
	});

	it("produces nullable field with '?' when nullable=true", () => {
		expect(prop({ name: "tag", type: "string", nullable: true }).renderAsDto()).toContain("tag?:");
	});
});
