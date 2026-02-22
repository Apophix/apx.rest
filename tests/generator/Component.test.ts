import { describe, it, expect, beforeEach } from "vitest";
import {
	Component,
	RequestComponent,
	ResponseComponent,
	ModelComponent,
	EComponentType,
	responsesMarkedAsUnions,
	resetGeneratorState,
} from "../../generator/Generator.js";

beforeEach(() => resetGeneratorState());

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeComponent(overrides: Partial<ConstructorParameters<typeof Component>[0]> = {}) {
	return new ModelComponent({
		name: "UserResponse",
		properties: [],
		requiredProperties: [],
		componentType: EComponentType.Response,
		...overrides,
	});
}

function makeRequest(overrides: Partial<ConstructorParameters<typeof RequestComponent>[0]> = {}) {
	return new RequestComponent({
		name: "CreateUserRequest",
		properties: [],
		requiredProperties: [],
		componentType: EComponentType.Request,
		...overrides,
	});
}

function makeResponse(overrides: Partial<ConstructorParameters<typeof ResponseComponent>[0]> = {}) {
	return new ResponseComponent({
		name: "UserListResponse",
		properties: [],
		requiredProperties: [],
		componentType: EComponentType.Response,
		...overrides,
	});
}

function propDto(name: string, type: string, nullable = false, extra: Record<string, unknown> = {}) {
	return { name, type, nullable, referenceIsEnum: false, isFormField: false, ...extra };
}

// ─── Component base ───────────────────────────────────────────────────────────

describe("Component — capitalizedName", () => {
	it("uppercases the first character", () => {
		expect(makeComponent({ name: "userResponse" }).capitalizedName).toBe("UserResponse");
	});

	it("preserves name when already capitalised", () => {
		expect(makeComponent({ name: "UserResponse" }).capitalizedName).toBe("UserResponse");
	});
});

describe("Component — dtoName", () => {
	it("returns 'T{CapitalizedName}Dto'", () => {
		expect(makeComponent({ name: "UserResponse" }).dtoName).toBe("TUserResponseDto");
	});
});

describe("Component — renderDto()", () => {
	it("produces export type declaration", () => {
		const c = makeComponent({ name: "Foo", properties: [propDto("id", "string") as any] });
		const rendered = c.render();
		expect(rendered).toContain("export type TFooDto = {");
	});

	it("includes all properties", () => {
		const c = makeComponent({
			name: "Foo",
			properties: [propDto("id", "string") as any, propDto("count", "integer") as any],
		});
		const rendered = c.render();
		expect(rendered).toContain("id:");
		expect(rendered).toContain("count:");
	});
});

describe("Component — render() class output", () => {
	it("produces export class declaration", () => {
		const rendered = makeComponent({ name: "Foo", properties: [] }).render();
		expect(rendered).toContain("export class Foo {");
	});

	it("class constructor assigns plain scalar properties from dto", () => {
		const c = makeComponent({ name: "Foo", properties: [propDto("name", "string") as any] });
		const rendered = c.render();
		expect(rendered).toContain("this.name = dto.name;");
	});

	it("class constructor wraps date property with 'new Date()'", () => {
		const c = makeComponent({
			name: "Foo",
			properties: [propDto("createdAt", "string", false, { format: "date-time" }) as any],
		});
		const rendered = c.render();
		expect(rendered).toContain("this.createdAt = new Date(dto.createdAt);");
	});

	it("class constructor wraps nullable date with conditional new Date()", () => {
		const c = makeComponent({
			name: "Foo",
			properties: [propDto("updatedAt", "string", true, { format: "date-time" }) as any],
		});
		const rendered = c.render();
		expect(rendered).toContain("dto.updatedAt ? new Date(dto.updatedAt) : undefined");
	});

	it("class constructor wraps non-enum $ref property with 'new Ref(dto.x)'", () => {
		const c = makeComponent({
			name: "Foo",
			properties: [
				{
					name: "user",
					type: undefined,
					nullable: false,
					$ref: "#/components/schemas/UserModel",
					referenceIsEnum: false,
					isFormField: false,
				} as any,
			],
		});
		const rendered = c.render();
		expect(rendered).toContain("new UserModel(dto.user)");
	});

	it("class constructor wraps nullable $ref with conditional new", () => {
		const c = makeComponent({
			name: "Foo",
			properties: [
				{
					name: "user",
					type: undefined,
					nullable: true,
					$ref: "#/components/schemas/UserModel",
					referenceIsEnum: false,
					isFormField: false,
				} as any,
			],
		});
		const rendered = c.render();
		expect(rendered).toContain("dto.user ? new UserModel(dto.user) : undefined");
	});

	it("class constructor maps array of non-enum objects with .map()", () => {
		const c = makeComponent({
			name: "Foo",
			properties: [
				{
					name: "tags",
					type: "array",
					nullable: false,
					referenceIsEnum: false,
					isFormField: false,
					items: {
						name: "item",
						type: undefined,
						nullable: false,
						$ref: "#/components/schemas/Tag",
						referenceIsEnum: false,
						isFormField: false,
					},
				} as any,
			],
		});
		const rendered = c.render();
		expect(rendered).toContain(".map((item) => new Tag(item))");
	});

	it("class constructor maps nullable array with optional chaining", () => {
		const c = makeComponent({
			name: "Foo",
			properties: [
				{
					name: "tags",
					type: "array",
					nullable: true,
					referenceIsEnum: false,
					isFormField: false,
					items: {
						name: "item",
						type: undefined,
						nullable: false,
						$ref: "#/components/schemas/Tag",
						referenceIsEnum: false,
						isFormField: false,
					},
				} as any,
			],
		});
		const rendered = c.render();
		expect(rendered).toContain("dto.tags?.map");
	});

	it("class constructor handles dictionary of primitives as a Map", () => {
		const c = makeComponent({
			name: "Foo",
			properties: [
				{
					name: "meta",
					type: "object",
					nullable: false,
					referenceIsEnum: false,
					isFormField: false,
					additionalProperties: { name: "v", type: "string", nullable: false, referenceIsEnum: false, isFormField: false },
				} as any,
			],
		});
		const rendered = c.render();
		expect(rendered).toContain("new Map(Object.entries(dto.meta)");
	});
});

describe("Component — renderImplementsDto", () => {
	it("returns dtoName when no date properties", () => {
		const c = makeComponent({ name: "Foo", properties: [propDto("id", "string") as any] });
		expect(c.renderImplementsDto).toBe("TFooDto");
	});

	it("returns Omit<dtoName, 'dateField'> when one date property exists", () => {
		const c = makeComponent({
			name: "Foo",
			properties: [propDto("createdAt", "string", false, { format: "date-time" }) as any],
		});
		expect(c.renderImplementsDto).toContain("Omit<TFooDto");
		expect(c.renderImplementsDto).toContain("createdAt");
	});

	it("omits multiple date fields joined by ' | '", () => {
		const c = makeComponent({
			name: "Foo",
			properties: [
				propDto("createdAt", "string", false, { format: "date-time" }) as any,
				propDto("updatedAt", "string", false, { format: "date-time" }) as any,
			],
		});
		expect(c.renderImplementsDto).toContain("createdAt");
		expect(c.renderImplementsDto).toContain("updatedAt");
	});
});

// ─── RequestComponent ─────────────────────────────────────────────────────────

describe("RequestComponent — dtoName", () => {
	it("returns 'T{CapitalizedName}' (no Dto suffix)", () => {
		expect(makeRequest({ name: "CreateUser" }).dtoName).toBe("TCreateUser");
	});
});

describe("RequestComponent — render()", () => {
	it("produces a TypeScript type (not class)", () => {
		const rendered = makeRequest({ name: "CreateUser" }).render();
		expect(rendered).toContain("export type TCreateUser = {");
		expect(rendered).not.toContain("export class");
	});

	it("ends with '};'", () => {
		const rendered = makeRequest().render();
		expect(rendered.trim().endsWith("};")).toBe(true);
	});

	it("includes all properties", () => {
		const rendered = makeRequest({
			name: "Req",
			properties: [propDto("title", "string") as any, propDto("count", "integer") as any],
		}).render();
		expect(rendered).toContain("title");
		expect(rendered).toContain("count");
	});
});

// ─── ResponseComponent ────────────────────────────────────────────────────────

describe("ResponseComponent — isUnionType", () => {
	it("returns false when name not in responsesMarkedAsUnions", () => {
		expect(makeResponse({ name: "FooResponse" }).isUnionType).toBe(false);
	});

	it("returns true when name is in responsesMarkedAsUnions", () => {
		responsesMarkedAsUnions.add("FooResponse");
		expect(makeResponse({ name: "FooResponse" }).isUnionType).toBe(true);
	});
});

describe("ResponseComponent — union type rendering", () => {
	it("render includes switch() method for union types", () => {
		responsesMarkedAsUnions.add("UnionResp");
		const r = makeResponse({
			name: "UnionResp",
			properties: [
				{ name: "optA", type: "string", nullable: true, referenceIsEnum: false, isFormField: false } as any,
			],
		});
		const rendered = r.render();
		expect(rendered).toContain("public switch(");
	});

	it("switch() throws when no matching type in union", () => {
		responsesMarkedAsUnions.add("UnionResp2");
		const r = makeResponse({
			name: "UnionResp2",
			properties: [
				{ name: "optA", type: "string", nullable: true, referenceIsEnum: false, isFormField: false } as any,
			],
		});
		const rendered = r.render();
		expect(rendered).toContain('throw new Error("No matching type in union")');
	});

	it("render includes match() method for union types", () => {
		responsesMarkedAsUnions.add("UnionResp3");
		const r = makeResponse({
			name: "UnionResp3",
			properties: [
				{ name: "optA", type: "string", nullable: true, referenceIsEnum: false, isFormField: false } as any,
			],
		});
		const rendered = r.render();
		expect(rendered).toContain("public match<TResult>(");
	});

	it("match() returns the matched value", () => {
		responsesMarkedAsUnions.add("UnionResp4");
		const r = makeResponse({
			name: "UnionResp4",
			properties: [
				{ name: "optA", type: "string", nullable: true, referenceIsEnum: false, isFormField: false } as any,
			],
		});
		const rendered = r.render();
		expect(rendered).toContain("return optA(this.optA)");
	});

	it("does NOT generate switch/match for non-union types", () => {
		const r = makeResponse({ name: "NormalResp", properties: [] });
		const rendered = r.render();
		expect(rendered).not.toContain("public switch(");
		expect(rendered).not.toContain("public match<TResult>(");
	});
});

// ─── ModelComponent ───────────────────────────────────────────────────────────

describe("ModelComponent", () => {
	it("inherits Component.render() — produces both dto type and class", () => {
		const m = new ModelComponent({
			name: "Tag",
			properties: [propDto("label", "string") as any],
			requiredProperties: [],
			componentType: EComponentType.Model,
		});
		const rendered = m.render();
		expect(rendered).toContain("export type TTagDto = {");
		expect(rendered).toContain("export class Tag {");
	});
});
