// convert 'variable_declarator' to 'VariableDeclarator'
function snakeCaseToPascalCase(snake_case: string): string {
	const words = snake_case.split("_");
	const camel_case = words
		.map((word) => word[0].toUpperCase() + word.slice(1))
		.join("");
	return camel_case;
}

export const debounce = (callback: (...x: any[]) => void, wait = 50) => {
	let timeoutId: number | null = null;

	return (...args: any[]) => {
		if (typeof timeoutId === "number") window.clearTimeout(timeoutId);
		timeoutId = window.setTimeout(() => callback.apply(null, args), wait);
	};
};

// Convert Jam's AST format to be more pleasing to the eye.
// I'm not really going to explain myself here, because this is admittedly weird
// and not something that would need many changes.
export function transformJsonAst(ast: any): any {
	if (typeof ast === "string") {
		if (ast === "true") return true;
		if (ast === "false") return false;

		const as_num = Number(ast);
		if (Number.isNaN(as_num)) return ast;
		return as_num;
	}

	if (typeof ast !== "object") return ast;

	if (Array.isArray(ast)) {
		if (ast.length == 1 && Array.isArray(ast[0])) {
			const transformed = ast.map(transformJsonAst);
			return transformed;
		}

		return ast.map(transformJsonAst);
	}

	if (ast == null) return null;

	if (typeof ast.start == "number" && typeof ast.end === "number") {
		if (ast.data.none) {
			return null;
		}

		const o = transformJsonAst(ast.data);
		o.__start = ast.start;
		o.__end = ast.end;
		return o;
	}

	const keys = Object.keys(ast);
	if (keys.length == 0) return null;

	if (keys.length == 1) {
		const key = keys[0];
		const value = ast[key];

		if (typeof value === "object" && !Array.isArray(value)) {
			const transformed_value = transformJsonAst(value);
			const transformed = {
				...transformed_value,
				__name: snakeCaseToPascalCase(key),
			};
			return transformed;
		}
	}

	const transformed: any = {};
	for (const key of keys) {
		const value = ast[key];
		if (typeof value === "object" && value && !Array.isArray(value)) {
			const entries_of_value = Object.entries(value);
			if (entries_of_value.length === 3 && value.data && value.data[key]) {
				const transformed_value = transformJsonAst(value.data[key]);
				transformed[key] = transformed_value;
				transformed_value.__start = value.start;
				transformed_value.__end = value.end;
				continue;
			}
		}

		const transformed_value = transformJsonAst(value);
		transformed[key] = transformed_value;
	}

	return transformed;
}
