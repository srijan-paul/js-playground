import { Wasm } from "./wasm";
import { renderJsonToHtml } from "./json-view";
import { EditorView, keymap } from "@codemirror/view";
import { defaultKeymap } from "@codemirror/commands";
import { basicSetup } from "codemirror";
import { javascript as js_code_mirror } from "@codemirror/lang-javascript";
import { tokyoNight } from "@uiw/codemirror-theme-tokyo-night";

// convert 'variable_declarator' to 'VariableDeclarator'
function snakeCaseToPascalCase(snake_case: string): string {
	const words = snake_case.split("_");
	const camel_case = words
		.map((word, i) => {
			return word[0].toUpperCase() + word.slice(1);
		})
		.join("");
	return camel_case;
}

const debounce = (callback: (...x: any[]) => void, wait = 50) => {
	let timeoutId: number | null = null;

	return (...args: any[]) => {
		if (typeof timeoutId === "number") window.clearTimeout(timeoutId);

		timeoutId = window.setTimeout(() => {
			callback.apply(null, args);
		}, wait);
	};
};

// convert `{ foo: { bar: { <properties> } } }` to { foo: { __name: "bar", <properties> } }
function transformJsonAst(ast: any): any {
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
			return null 
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

const source = `
/**
 * Copyright (c) 2024, Srijan Paul – https://injuly.in
 *
 * Playground for [The Jam JS parser](https://github.com/srijan-paul/jam).
 * Jam is a high performance JavaScript toolchain written in Zig.
 * This playground uses a WASM build of the parser.
 *
 * Write javascript code on this pane, and the AST 
 * will be displayed on the right.
 **/

async function parseScript() {
  const json_s = jam.parseModule(new_code);
  if (json_s == null) 
    return;

  const parse_result = transformJsonAst(JSON.parse(json_s));
  const root = document.getElementById("root");
  if (root == null)  return;

  root.innerHTML = "";
  renderJsonToHtml(parse_result, root);
}
`;

async function main() {
	const jam_wasm_source = await fetch("jam_js.wasm");
	const jam_wasm_binary = await jam_wasm_source.arrayBuffer();
	const { instance } = await WebAssembly.instantiate(jam_wasm_binary);
	const jam = new Wasm(instance);

	const custom_theme = EditorView.theme({
		"&": { fontSize: "13pt", backgroundColor: "#eaeef3" },
	});

	const editor_view = new EditorView({
		doc: source,
		extensions: [
			keymap.of(defaultKeymap),
			basicSetup,
			js_code_mirror(),
			tokyoNight,
			custom_theme,
		],
		parent: document.getElementById("editorRoot")!,
	});

	let prev_code = "";
	const renderCode = debounce(() => {
		const new_code = editor_view.state.doc.toString();
		if (new_code == "" || new_code == prev_code) return;
		prev_code = new_code;

		const json_s = jam.parseModule(new_code);
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

		root.innerHTML = "";
		renderJsonToHtml(parse_result, root);
	}, 50);

	setInterval(renderCode, 100);
}

main();
