import { describe, it, expect } from "vitest";
import {
	EndpointFilter,
	globToRegExp,
	normalizeEndpointPath,
	validatePatternList,
} from "../../generator/EndpointFilter.js";

// ─── normalizeEndpointPath ────────────────────────────────────────────────────

describe("normalizeEndpointPath()", () => {
	it("keeps a path that already starts with a slash", () => {
		expect(normalizeEndpointPath("/users")).toBe("/users");
	});

	it("adds a leading slash when it is missing", () => {
		expect(normalizeEndpointPath("users/{id}")).toBe("/users/{id}");
	});

	it("removes one trailing slash", () => {
		expect(normalizeEndpointPath("/users/")).toBe("/users");
	});

	it("removes multiple trailing slashes", () => {
		expect(normalizeEndpointPath("/users///")).toBe("/users");
	});

	it("normalizes the root path to an empty string", () => {
		expect(normalizeEndpointPath("/")).toBe("");
	});

	it("normalizes an empty string to an empty string", () => {
		expect(normalizeEndpointPath("")).toBe("");
	});

	it("trims surrounding whitespace", () => {
		expect(normalizeEndpointPath("  /users  ")).toBe("/users");
	});
});

// ─── globToRegExp ─────────────────────────────────────────────────────────────

describe("globToRegExp()", () => {
	const matches = (pattern: string, path: string) =>
		globToRegExp(pattern).test(normalizeEndpointPath(path));

	describe("literal patterns", () => {
		it("matches the exact same path", () => {
			expect(matches("/users", "/users")).toBe(true);
		});

		it("does not match a longer path", () => {
			expect(matches("/users", "/users/{id}")).toBe(false);
		});

		it("does not match a path that only shares a prefix", () => {
			expect(matches("/users", "/usersettings")).toBe(false);
		});

		it("is case-sensitive", () => {
			expect(matches("/Users", "/users")).toBe(false);
		});

		it("ignores a missing leading slash in the pattern", () => {
			expect(matches("users", "/users")).toBe(true);
		});

		it("ignores a trailing slash in the pattern", () => {
			expect(matches("/users/", "/users")).toBe(true);
		});

		it("ignores a trailing slash in the path", () => {
			expect(matches("/users", "/users/")).toBe(true);
		});

		it("matches path parameter braces literally", () => {
			expect(matches("/users/{id}", "/users/{id}")).toBe(true);
			expect(matches("/users/{id}", "/users/{userId}")).toBe(false);
		});

		it("matches the root path with a '/' pattern", () => {
			expect(matches("/", "/")).toBe(true);
			expect(matches("/", "/users")).toBe(false);
		});
	});

	describe("regex metacharacters are literal", () => {
		it.each([
			["/v1.0/users", "/v1.0/users", true],
			["/v1.0/users", "/v1x0/users", false],
			["/a+b", "/a+b", true],
			["/a+b", "/aab", false],
			["/(group)", "/(group)", true],
			["/$ref", "/$ref", true],
			["/a|b", "/a", false],
			["/[x]", "/[x]", true],
			["/[x]", "/x", false],
			["/^top", "/^top", true],
			["/back\\slash", "/back\\slash", true],
		])("pattern %s against %s → %s", (pattern, path, expected) => {
			expect(matches(pattern, path)).toBe(expected);
		});
	});

	describe("single star (*)", () => {
		it("matches one whole segment", () => {
			expect(matches("/users/*", "/users/{id}")).toBe(true);
		});

		it("does not match across a slash", () => {
			expect(matches("/users/*", "/users/{id}/orders")).toBe(false);
		});

		it("does not match an absent segment", () => {
			expect(matches("/users/*", "/users")).toBe(false);
		});

		it("matches part of a segment", () => {
			expect(matches("/users/*-report", "/users/daily-report")).toBe(true);
			expect(matches("/users/*-report", "/users/daily-summary")).toBe(false);
		});

		it("matches an empty run of characters inside a segment", () => {
			expect(matches("/api/v1*", "/api/v1")).toBe(true);
			expect(matches("/api/v1*", "/api/v12")).toBe(true);
		});

		it("matches a middle segment", () => {
			expect(matches("/api/*/health", "/api/v1/health")).toBe(true);
			expect(matches("/api/*/health", "/api/v1/v2/health")).toBe(false);
		});

		it("treats consecutive stars inside a segment like a single star", () => {
			expect(matches("/api/v**", "/api/v2")).toBe(true);
			expect(matches("/api/v**", "/api/v2/users")).toBe(false);
		});
	});

	describe("question mark (?)", () => {
		it("matches exactly one character", () => {
			expect(matches("/api/v?", "/api/v1")).toBe(true);
			expect(matches("/api/v?", "/api/v10")).toBe(false);
			expect(matches("/api/v?", "/api/v")).toBe(false);
		});

		it("does not match a slash", () => {
			expect(matches("/api?users", "/api/users")).toBe(false);
		});
	});

	describe("double star (**) as a whole segment", () => {
		it("matches the base path with zero extra segments", () => {
			expect(matches("/admin/**", "/admin")).toBe(true);
		});

		it("matches one extra segment", () => {
			expect(matches("/admin/**", "/admin/users")).toBe(true);
		});

		it("matches many extra segments", () => {
			expect(matches("/admin/**", "/admin/users/{id}/roles")).toBe(true);
		});

		it("does not match a different base path", () => {
			expect(matches("/admin/**", "/administrator")).toBe(false);
			expect(matches("/admin/**", "/api/admin")).toBe(false);
		});

		it("matches any leading segments", () => {
			expect(matches("/**/health", "/health")).toBe(true);
			expect(matches("/**/health", "/api/health")).toBe(true);
			expect(matches("/**/health", "/api/v1/health")).toBe(true);
			expect(matches("/**/health", "/api/healthz")).toBe(false);
		});

		it("matches any segments in the middle", () => {
			expect(matches("/api/**/export", "/api/export")).toBe(true);
			expect(matches("/api/**/export", "/api/a/b/c/export")).toBe(true);
			expect(matches("/api/**/export", "/other/export")).toBe(false);
		});

		it("matches every path when it is the whole pattern", () => {
			expect(matches("/**", "/")).toBe(true);
			expect(matches("/**", "/users")).toBe(true);
			expect(matches("/**", "/a/b/c")).toBe(true);
			expect(matches("**", "/a/b/c")).toBe(true);
		});

		it("matches empty segments from consecutive slashes", () => {
			expect(matches("/**", "/users//active")).toBe(true);
			expect(matches("/admin/**", "/admin//jobs")).toBe(true);
			expect(matches("/**/health", "//health")).toBe(true);
			expect(matches("/api/**/export", "/api//v1//export")).toBe(true);
		});

		it("keeps the literal prefix bounded when empty segments follow", () => {
			expect(matches("/admin/**", "/administrator//x")).toBe(false);
			expect(matches("/**/health", "/api//healthz")).toBe(false);
		});

		it("supports two double-star segments in one pattern", () => {
			expect(matches("/**/internal/**", "/internal")).toBe(true);
			expect(matches("/**/internal/**", "/api/internal/jobs/{id}")).toBe(true);
			expect(matches("/**/internal/**", "/api/internalize")).toBe(false);
		});
	});

	it("anchors the expression to the full path", () => {
		const re = globToRegExp("/users");
		expect(re.source.startsWith("^")).toBe(true);
		expect(re.source.endsWith("$")).toBe(true);
	});
});

// ─── validatePatternList ──────────────────────────────────────────────────────

describe("validatePatternList()", () => {
	it("returns an empty array for undefined", () => {
		expect(validatePatternList(undefined, "includeEndpoints")).toEqual([]);
	});

	it("returns an empty array for null", () => {
		expect(validatePatternList(null, "includeEndpoints")).toEqual([]);
	});

	it("returns a copy of a valid string array", () => {
		const input = ["/a", "/b/**"];
		const result = validatePatternList(input, "includeEndpoints");
		expect(result).toEqual(["/a", "/b/**"]);
		expect(result).not.toBe(input);
	});

	it("throws when the value is a string, not an array", () => {
		expect(() => validatePatternList("/users", "excludeEndpoints")).toThrow(
			'"excludeEndpoints" must be an array of strings.'
		);
	});

	it("throws when the value is an object", () => {
		expect(() => validatePatternList({ a: 1 }, "includeEndpoints")).toThrow(
			'"includeEndpoints" must be an array of strings.'
		);
	});

	it("throws when an entry is not a string", () => {
		expect(() => validatePatternList(["/a", 5], "includeEndpoints")).toThrow(
			'"includeEndpoints" entry at index 1 must be a non-empty string.'
		);
	});

	it("throws when an entry is an empty string", () => {
		expect(() => validatePatternList([""], "excludeEndpoints")).toThrow(
			'"excludeEndpoints" entry at index 0 must be a non-empty string.'
		);
	});

	it("throws when an entry is only whitespace", () => {
		expect(() => validatePatternList(["   "], "excludeEndpoints")).toThrow(
			'"excludeEndpoints" entry at index 0 must be a non-empty string.'
		);
	});
});

// ─── EndpointFilter ───────────────────────────────────────────────────────────

describe("EndpointFilter", () => {
	describe("with no patterns", () => {
		it("includes every endpoint", () => {
			const filter = new EndpointFilter();
			expect(filter.isIncluded("/users")).toBe(true);
			expect(filter.isIncluded("/admin/jobs")).toBe(true);
		});

		it("reports that it is not active", () => {
			expect(new EndpointFilter().isActive).toBe(false);
			expect(new EndpointFilter({ include: [], exclude: [] }).isActive).toBe(false);
		});

		it("reports no unmatched patterns", () => {
			expect(new EndpointFilter().getUnmatchedPatterns()).toEqual({ include: [], exclude: [] });
		});
	});

	describe("include only", () => {
		const filter = () => new EndpointFilter({ include: ["/users/**", "/health"] });

		it("reports that it is active", () => {
			expect(filter().isActive).toBe(true);
		});

		it("includes an endpoint that matches a pattern", () => {
			expect(filter().isIncluded("/users/{id}")).toBe(true);
			expect(filter().isIncluded("/health")).toBe(true);
		});

		it("excludes an endpoint that matches no pattern", () => {
			expect(filter().isIncluded("/orders")).toBe(false);
		});
	});

	describe("exclude only", () => {
		const filter = () => new EndpointFilter({ exclude: ["/internal/**"] });

		it("reports that it is active", () => {
			expect(filter().isActive).toBe(true);
		});

		it("excludes an endpoint that matches a pattern", () => {
			expect(filter().isIncluded("/internal/jobs")).toBe(false);
		});

		it("includes an endpoint that matches no pattern", () => {
			expect(filter().isIncluded("/users")).toBe(true);
		});
	});

	describe("include and exclude together", () => {
		const filter = () =>
			new EndpointFilter({
				include: ["/api/**"],
				exclude: ["/api/internal/**"],
			});

		it("includes an endpoint that matches include and not exclude", () => {
			expect(filter().isIncluded("/api/users")).toBe(true);
		});

		it("excludes an endpoint that matches both — exclude wins", () => {
			expect(filter().isIncluded("/api/internal/jobs")).toBe(false);
		});

		it("excludes an endpoint that matches neither", () => {
			expect(filter().isIncluded("/health")).toBe(false);
		});
	});

	it("matches endpoint paths without a leading slash", () => {
		const filter = new EndpointFilter({ include: ["/users"] });
		expect(filter.isIncluded("users")).toBe(true);
	});

	it("does not keep a reference to the caller's arrays", () => {
		const include = ["/users"];
		const filter = new EndpointFilter({ include });
		include.push("/orders");
		expect(filter.isIncluded("/orders")).toBe(false);
	});

	it("validates patterns on construction", () => {
		expect(() => new EndpointFilter({ include: [""] })).toThrow(
			'"includeEndpoints" entry at index 0 must be a non-empty string.'
		);
		expect(() => new EndpointFilter({ exclude: "x" as any })).toThrow(
			'"excludeEndpoints" must be an array of strings.'
		);
	});

	describe("getUnmatchedPatterns()", () => {
		it("lists every pattern before any endpoint is checked", () => {
			const filter = new EndpointFilter({ include: ["/a"], exclude: ["/b"] });
			expect(filter.getUnmatchedPatterns()).toEqual({ include: ["/a"], exclude: ["/b"] });
		});

		it("removes patterns that matched at least one endpoint", () => {
			const filter = new EndpointFilter({
				include: ["/users/**", "/typo"],
				exclude: ["/users/secret", "/nothing/**"],
			});
			filter.isIncluded("/users");
			filter.isIncluded("/users/secret");
			expect(filter.getUnmatchedPatterns()).toEqual({
				include: ["/typo"],
				exclude: ["/nothing/**"],
			});
		});

		it("counts an exclude match even when the endpoint matched no include pattern", () => {
			const filter = new EndpointFilter({ include: ["/a"], exclude: ["/b"] });
			filter.isIncluded("/b");
			expect(filter.getUnmatchedPatterns().exclude).toEqual([]);
		});

		it("reports the patterns as the user wrote them", () => {
			const filter = new EndpointFilter({ include: ["users/"] });
			expect(filter.getUnmatchedPatterns().include).toEqual(["users/"]);
		});
	});
});
