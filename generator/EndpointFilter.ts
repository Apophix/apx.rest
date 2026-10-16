/**
 * Endpoint path filtering for the generator.
 *
 * Patterns are globs matched against the OpenAPI path keys (e.g. "/users/{id}"):
 *   *   any run of characters inside one path segment (never crosses "/")
 *   ?   exactly one character inside one path segment
 *   **  as a whole segment: zero or more path segments
 *
 * Every other character is literal, including "{" and "}" of path parameters.
 * Matching is case-sensitive and ignores leading/trailing slash differences.
 */

export type TEndpointFilterOptions = {
	/** Glob patterns. When non-empty, only matching endpoints are generated. */
	include?: string[];
	/** Glob patterns. Matching endpoints are never generated, even if included. */
	exclude?: string[];
};

export type TUnmatchedPatterns = {
	include: string[];
	exclude: string[];
};

type TCompiledPattern = {
	source: string;
	regExp: RegExp;
	matched: boolean;
};

/** Adds a leading "/" and removes trailing "/" characters. The root path "/" becomes "". */
export function normalizeEndpointPath(path: string): string {
	let normalized = path.trim();
	if (!normalized.startsWith("/")) {
		normalized = `/${normalized}`;
	}
	return normalized.replace(/\/+$/, "");
}

function escapeRegExp(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function segmentToRegExpSource(segment: string): string {
	let source = "";
	for (const char of segment) {
		if (char === "*") {
			// collapse runs of stars inside a segment into a single wildcard
			if (!source.endsWith("[^/]*")) source += "[^/]*";
		} else if (char === "?") {
			source += "[^/]";
		} else {
			source += escapeRegExp(char);
		}
	}
	return source;
}

/** Compiles a glob pattern to an anchored RegExp that tests normalized endpoint paths. */
export function globToRegExp(pattern: string): RegExp {
	const segments = normalizeEndpointPath(pattern).split("/").slice(1);
	let source = "^";
	for (const segment of segments) {
		if (segment === "**") {
			source += "(?:/[^/]+)*";
		} else {
			source += `/${segmentToRegExpSource(segment)}`;
		}
	}
	source += "$";
	return new RegExp(source);
}

/** Checks that a config value is an array of non-empty strings and returns a copy. */
export function validatePatternList(value: unknown, configKey: string): string[] {
	if (value === undefined || value === null) {
		return [];
	}
	if (!Array.isArray(value)) {
		throw new Error(`"${configKey}" must be an array of strings.`);
	}
	value.forEach((entry, index) => {
		if (typeof entry !== "string" || entry.trim() === "") {
			throw new Error(`"${configKey}" entry at index ${index} must be a non-empty string.`);
		}
	});
	return [...value];
}

export class EndpointFilter {
	private readonly includePatterns: TCompiledPattern[];
	private readonly excludePatterns: TCompiledPattern[];

	public constructor(options: TEndpointFilterOptions = {}) {
		this.includePatterns = validatePatternList(options.include, "includeEndpoints").map(compile);
		this.excludePatterns = validatePatternList(options.exclude, "excludeEndpoints").map(compile);
	}

	/** True when at least one include or exclude pattern is configured. */
	public get isActive(): boolean {
		return this.includePatterns.length > 0 || this.excludePatterns.length > 0;
	}

	/**
	 * Returns true when the endpoint should be generated. Exclude patterns win over
	 * include patterns. Every pattern is tested (no short-circuit) so that
	 * getUnmatchedPatterns() can report patterns that never matched anything.
	 */
	public isIncluded(endpoint: string): boolean {
		const path = normalizeEndpointPath(endpoint);
		const matchesInclude = testAll(this.includePatterns, path);
		const matchesExclude = testAll(this.excludePatterns, path);

		if (matchesExclude) return false;
		return this.includePatterns.length === 0 || matchesInclude;
	}

	/** Patterns that have not matched any endpoint passed to isIncluded() so far. */
	public getUnmatchedPatterns(): TUnmatchedPatterns {
		const unmatched = (patterns: TCompiledPattern[]) =>
			patterns.filter((pattern) => !pattern.matched).map((pattern) => pattern.source);
		return {
			include: unmatched(this.includePatterns),
			exclude: unmatched(this.excludePatterns),
		};
	}
}

function compile(source: string): TCompiledPattern {
	return { source, regExp: globToRegExp(source), matched: false };
}

function testAll(patterns: TCompiledPattern[], path: string): boolean {
	let anyMatch = false;
	for (const pattern of patterns) {
		if (pattern.regExp.test(path)) {
			pattern.matched = true;
			anyMatch = true;
		}
	}
	return anyMatch;
}
