import { Wasm } from "./wasm";
import { Decoration, EditorView, keymap } from "@codemirror/view";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { basicSetup } from "codemirror";
import { javascript as js_code_mirror } from "@codemirror/lang-javascript";
import { tokyoNight } from "@uiw/codemirror-theme-tokyo-night";
import { tokyoNightDay } from "@uiw/codemirror-theme-tokyo-night-day";
import { Range, StateEffect, StateField } from "@codemirror/state";
import {
	renderJson,
	styles,
	themes,
	isJsonObject,
} from "@jam-tools/json-tree-view";
import { transformJsonAst, debounce } from "./util";

export const tokyoNightDayJson: styles.Theme = {
	jsonString: { color: "#587539" },
	jsonNumber: { color: "#b15c00" },
	jsonBoolean: { color: "#3760bf" },
	jsonNull: { color: "#007197" },
	jsonKey: { color: "#007197" },
	jsonTitle: { color: "#3760bf" },
	bgColor: "#e1e2e7",
};

const cm_theme_config_light = {
	"&": {
		fontSize: "11pt",
		backgroundColor: "#eaeef3",
		maxHeight: "100%",
	},
};

const cm_theme_config_dark = {
	"&": {
		fontSize: "11pt",
		backgroundColor: "#1e1e1e",
		maxHeight: "100%",
	},
};

const custom_theme_dark = EditorView.theme(cm_theme_config_dark);
const custom_theme_light = EditorView.theme(cm_theme_config_light);

const initialSource = `/**
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

// Stylesheet for the interactive JSON view
const jsonStylesheetLight = styles.makeStyleSheet(tokyoNightDayJson).attach();
const jsonStylesheetDark = styles.makeStyleSheet(themes.tokyoNight).attach();
let jsonViewStyles = jsonStylesheetDark;

jsonViewStyles.attach();

let parse_result: any = null;
const root = document.getElementById("root");

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
const highlight_color_dark = "background-color: rgba(255, 250, 112, 0.2)";
const highlight_color_light = "background-color: rgba(145, 240, 180, 0.5)";
const highlight_decoration_light = Decoration.mark({
	attributes: { style: highlight_color_light },
});
const highlight_decoration_dark = Decoration.mark({
	attributes: { style: highlight_color_dark },
});

let highlight_decoration = highlight_decoration_dark;

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

const base_extensions = [
	keymap.of([...defaultKeymap, indentWithTab]),
	basicSetup,
	js_code_mirror(),
	highlight_extension,
];

const extensions = [...base_extensions, tokyoNight, custom_theme_dark];

const editor_view = new EditorView({
	doc: initialSource,
	extensions,
	parent: document.getElementById("editorRoot")!,
});

let byte_offset_map = prepareByteOffsetMap("");
let updated_code = "";

function onJsonItemHover(ast_node: any, event_type: "enter" | "exit") {
	if (event_type === "enter" && isJsonObject(ast_node)) {
		if (
			typeof ast_node.__start === "number" &&
			typeof ast_node.__end === "number"
		) {
			let start_index = byte_offset_map.offsetMap[ast_node.__start];
			if (start_index > 0) start_index += 1; // why is this needed!?
			let end_index = byte_offset_map.offsetMap[ast_node.__end] + 1;
			if (Number.isNaN(end_index)) end_index = updated_code.length;
			highlightRange(editor_view, start_index, end_index);
		}
	} else {
		clearHighlights(editor_view);
	}
}

function initResizer() {
	const resizer = document.querySelector(
		".horizontalResizer",
	) as HTMLDivElement | null;
	if (resizer == null) return;

	const leftSide = resizer.previousElementSibling;
	const rightSide = resizer.nextElementSibling;

	if (!(leftSide instanceof HTMLElement && rightSide instanceof HTMLElement))
		return;

	// The current position of mouse
	let mousePosX = 0;
	let leftWidth = 0;

	const mouseMoveHandler = function (e: MouseEvent) {
		// How far the mouse has been moved
		const dx = e.clientX - mousePosX;

		if (!(resizer.parentNode instanceof HTMLElement)) return;
		if (!(leftSide instanceof HTMLElement)) return;

		const newLeftWidth =
			((leftWidth + dx) * 100) /
			resizer.parentNode.getBoundingClientRect().width;

		leftSide.style.userSelect = "none";
		leftSide.style.pointerEvents = "none";

		rightSide.style.userSelect = "none";
		rightSide.style.pointerEvents = "none";

		leftSide.style.width = `${newLeftWidth}%`;
		document.body.style.cursor = "col-resize";
	};

	const mouseUpHandler = function () {
		resizer.style.removeProperty("cursor");
		document.body.style.removeProperty("cursor");

		leftSide.style.removeProperty("user-select");
		leftSide.style.removeProperty("pointer-events");

		rightSide.style.removeProperty("user-select");
		rightSide.style.removeProperty("pointer-events");

		// Remove the handlers of `mousemove` and `mouseup`
		document.removeEventListener("mousemove", mouseMoveHandler);
		document.removeEventListener("mouseup", mouseUpHandler);
	};

	// Handle the mousedown event
	// that's triggered when user drags the resizer
	const mouseDownHandler = function (e: MouseEvent) {
		// Get the current mouse position
		mousePosX = e.clientX;
		leftWidth = leftSide.getBoundingClientRect().width;

		// Attach the listeners to `document`
		document.addEventListener("mousemove", mouseMoveHandler);
		document.addEventListener("mouseup", mouseUpHandler);
	};

	resizer.addEventListener("mousedown", mouseDownHandler);
}

function initNavbar() {
	const themeSwitcher = document.querySelector(
		".nav__themeSwitcher",
	) as HTMLDivElement;
	if (themeSwitcher == null) return;

	const sun = document.getElementById("nav__themeSwitcher__sun");
	const moon = document.getElementById("nav__themeSwitcher__moon");
	if (sun == null || moon == null) {
		document.body.textContent = "Error: Theme switcher icons not found";
		return;
	}

	themeSwitcher.addEventListener("click", () => {
		let currentTheme = document.body.getAttribute("data-theme") ?? "dark";
		if (currentTheme === "dark") {
			document.body.setAttribute("data-theme", "light");
			highlight_decoration = highlight_decoration_light;
			jsonViewStyles = jsonStylesheetLight;
			const extensions = [
				...base_extensions,
				tokyoNightDay,
				custom_theme_light,
			];
			editor_view.dispatch({ effects: StateEffect.reconfigure.of(extensions) });
			sun.style.display = "block";
			moon.style.display = "none";
		} else {
			document.body.setAttribute("data-theme", "dark");
			jsonViewStyles = jsonStylesheetDark;
			highlight_decoration = highlight_decoration_dark;
			const extensions = [...base_extensions, tokyoNight, custom_theme_dark];
			editor_view.dispatch({ effects: StateEffect.reconfigure.of(extensions) });
			moon.style.display = "block";
			sun.style.display = "none";
		}

		if (root != null) {
			root.innerHTML = "";
			renderJson(parse_result, root, jsonViewStyles, onJsonItemHover);
			// TODO(@injuly): this might be a bug in the rendering library.
			// re-assignment shouldn't be needed.
			root.style.backgroundColor =
				(currentTheme === "dark"
					? tokyoNightDayJson.bgColor
					: themes.tokyoNight.bgColor) ?? "#fff";
		}
	});
}

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
	initResizer();
	initNavbar();

	const jam_wasm_source = await fetch("jam_js.wasm");
	const jam_wasm_binary = await jam_wasm_source.arrayBuffer();
	const { instance } = await WebAssembly.instantiate(jam_wasm_binary);
	const jam = new Wasm(instance);

	let default_source = "";
	const renderCode = () => {
		updated_code = editor_view.state.doc.toString();
		if (updated_code == "" || updated_code == default_source) return;

		default_source = updated_code;
		byte_offset_map = prepareByteOffsetMap(updated_code);

		const json_s = jam.parseModule(updated_code);
		if (json_s == null) {
			console.error("Failed to parse as module");
			return;
		}

		parse_result = transformJsonAst(JSON.parse(json_s));
		if (root == null) {
			console.error("Root element not found");
			return;
		}

		root.innerHTML = "";
		renderJson(parse_result, root, jsonViewStyles, onJsonItemHover);
	};

	const renderCodeDebounced = debounce(renderCode, 50);
	setInterval(renderCodeDebounced, 100);
}

main();
