import { Wasm } from "./wasm";
import { renderJsonToHtml } from "./json-view";

// convert 'variable_declarator' to 'VariableDeclarator'
function snakeCaseToPascalCase(snake_case: string): string {
	const words = snake_case.split("_");
	const camel_case = words.map((word, i) => {
		return word[0].toUpperCase() + word.slice(1);
	}).join("");
	return camel_case;
}

// convert `{ foo: { bar: { <properties> } } }` to { foo: { __name: "bar", <properties> } }
function transformJsonAst(ast: any): any {
	if (typeof ast !== "object") return ast;

	if (Array.isArray(ast)) {
		return ast.map(transformJsonAst);
	}

	if (ast == null) return null;


	const keys = Object.keys(ast);
	if (keys.length == 1) {
		const key = keys[0];
		const value = ast[key];
		if (typeof value === "object" && !Array.isArray(value)) {
			const transformed_value = transformJsonAst(value);
			const transformed = { ...transformed_value, __name: snakeCaseToPascalCase(key) };
			return transformed;
		}
	}

	const transformed = {};
	for (const key of keys) {
		const value = ast[key];
		const transformed_value = transformJsonAst(value);
		transformed[key] = transformed_value;
	}

	return transformed;
}

const source = `
async function main() {
	const jam_wasm_source = await fetch("jam_js.wasm")
	const jam_wasm_binary = await jam_wasm_source.arrayBuffer();
	const { instance } = await WebAssembly.instantiate(jam_wasm_binary);
	const jam = new Wasm(instance);

	const json_s = jam.parseModuleWasm(source);
	if (json_s == null) {
		console.log("Failed to parse module");
		return;
	}

	const parse_result = transformJsonAst(JSON.parse(json_s));
	console.log(parse_result);

	const root = document.getElementById("root");
	if (root == null) {
		console.log("Root element not found");
		return;
	}

	renderJsonToHtml(parse_result, root);
}

main();
`

async function main() {
	const jam_wasm_source = await fetch("jam_js.wasm")
	const jam_wasm_binary = await jam_wasm_source.arrayBuffer();
	const { instance } = await WebAssembly.instantiate(jam_wasm_binary);
	const jam = new Wasm(instance);

	const json_s = jam.parseModuleWasm(source);
	if (json_s == null) {
		console.log("Failed to parse module");
		return;
	}

	const parse_result = transformJsonAst(JSON.parse(json_s));
	console.log(parse_result);

	const root = document.getElementById("root");
	if (root == null) {
		console.log("Root element not found");
		return;
	}

	renderJsonToHtml(parse_result, root);
}

main();
