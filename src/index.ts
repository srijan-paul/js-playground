import { Wasm } from "./wasm";
import { renderJson } from "./json-view";
import {
	Decoration,
	EditorView,
	keymap
} from "@codemirror/view";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { basicSetup } from "codemirror";
import { javascript as js_code_mirror } from "@codemirror/lang-javascript";
import { tokyoNight } from "@uiw/codemirror-theme-tokyo-night";
import {
	Range,
	StateEffect,
	StateField,
} from "@codemirror/state";

// convert 'variable_declarator' to 'VariableDeclarator'
function snakeCaseToPascalCase(snake_case: string): string {
	const words = snake_case.split("_");
	const camel_case = words
		.map((word) => word[0].toUpperCase() + word.slice(1))
		.join("");
	return camel_case;
}

const debounce = (callback: (...x: any[]) => void, wait = 50) => {
	let timeoutId: number | null = null;

	return (...args: any[]) => {
		if (typeof timeoutId === "number") window.clearTimeout(timeoutId);
		timeoutId = window.setTimeout(() => callback.apply(null, args), wait);
	};
};

// Convert Jam's AST format to be more pleasing to the eye.
// I'm not really going to explain myself here, because this is admittedly weird
// and not something that would need many changes.
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

const source = `/**
 * Copyright (c) 2024, Srijan Paul 
 * (https://injuly.in)
 *
 * Playground for The Jam JS parser.
 * Jam is a high performance JavaScript toolchain written 
 * in Zig. This playground uses a WASM build of the parser.
 *
 * Write javascript code on this pane, and the AST 
 * will be updated on the right. Hover on an AST node
 * to see it highlighted in the source.
 *
 * https://github.com/srijan-paul/jam	
 **/

async function parseAndRender() {
  const json_s = jam.parseModule(source);
  if (json_s == null) 
    return;

  const parse_result = transformJsonAst(JSON.parse(json_s));
  const root = document.getElementById("root");
  if (root == null)  return;

  root.innerHTML = "";
  renderJson(parse_result, root);
}
`;

type ByteOffsetMap = { utf8Bytes: Uint8Array; offsetMap: number[] };

/**
	* Prepare a map from byte offsets to the corresponding character offsets in a string.
	* @param str A regular JavaScript string
	*/
function prepareByteOffsetMap(str: string): ByteOffsetMap {
	const encoder = new TextEncoder();
	const utf8Bytes = encoder.encode(str);
	const offsetMap = [];

	let currentIndex = 0;
	for (let i = 0; i < utf8Bytes.length; i++) {
		if (i === 0 || utf8Bytes[i] >= 0b10000000) {
			offsetMap.push(currentIndex);
		} else {
			offsetMap.push(currentIndex++);
		}
	}

	return { utf8Bytes, offsetMap };
}

async function main() {
	const jam_wasm_source = await fetch("jam_js.wasm");
	const jam_wasm_binary = await jam_wasm_source.arrayBuffer();
	const { instance } = await WebAssembly.instantiate(jam_wasm_binary);
	const jam = new Wasm(instance);

	const custom_theme = EditorView.theme({
		"&": {
			fontSize: "13pt",
			backgroundColor: "#eaeef3",
			height: "100%",
		},
	});

	// code mirror effect for highlighting selected nodes
	const highlight_effect = StateEffect.define<[Range<Decoration>]>();
	// code mirror extension to trigger (and clear) highlight on hover. 
	const highlight_extension = StateField.define({
		create() {
			return Decoration.none;
		},
		update(value, transaction) {
			for (let effect of transaction.effects) {
				if (effect.is(highlight_effect)) {
					value = value.update({
						filter() {
							return false;
						},
					});
					value = value.update({ add: effect.value, sort: false });
				} else if (effect.is(clear_highlight_effect)) {
					value = value.update({
						filter() {
							return false;
						},
					});
				}
			}
			return value;
		},
		provide: (f) => EditorView.decorations.from(f),
	});

	// code mirror effect to clear syntax highlights
	const clear_highlight_effect = StateEffect.define();
	// this is your decoration where you can define the change you want : a css class or directly css attributes
	const highlight_decoration = Decoration.mark({
		attributes: { style: "background-color: rgba(255, 250, 112, 0.2);" },
	});

	function highlightRange(view: EditorView, from: number, to: number) {
		const range = highlight_decoration.range(from, to);
		view.dispatch({
			effects: highlight_effect.of([range]),
		});
		return true;
	}

	function clearHighlights(view: EditorView) {
		view.dispatch({ effects: clear_highlight_effect.of(null) });
		return true;
	}

	const editor_view = new EditorView({
		doc: source,
		extensions: [
			keymap.of([...defaultKeymap, indentWithTab]),
			basicSetup,
			js_code_mirror(),
			tokyoNight,
			custom_theme,
			highlight_extension,
		],
		parent: document.getElementById("editorRoot")!,
	});

	let default_source = "";
	let byte_offset_map = prepareByteOffsetMap(default_source);
	const renderCode = () => {
		const updated_code = editor_view.state.doc.toString();
		if (updated_code == "" || updated_code == default_source) return;

		default_source = updated_code;
		byte_offset_map = prepareByteOffsetMap(updated_code);

		const json_s = jam.parseModule(updated_code);
		if (json_s == null) {
			console.error("Failed to parse as module");
			return;
		}

		const parse_result = transformJsonAst(JSON.parse(json_s));
		const root = document.getElementById("root");
		if (root == null) {
			console.error("Root element not found");
			return;
		}

		root.innerHTML = "";
		renderJson(parse_result, root, (ast_node, event_type) => {
			if (event_type === "enter") {
				if (ast_node.__start && ast_node.__end) {
					const start_index = byte_offset_map.offsetMap[ast_node.__start] + 1;
					const end_index = byte_offset_map.offsetMap[ast_node.__end] + 1;
					highlightRange(editor_view, start_index, end_index);
				}
			} else {
				clearHighlights(editor_view);
			}
		});
	}

	const renderCodeDebounced = debounce(renderCode, 50);
	setInterval(renderCodeDebounced, 100);
}

main();
