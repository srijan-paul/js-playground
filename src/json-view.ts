interface JsonViewItem {
	render(root: HTMLElement): void;
}

function makeTrivia(content: string): HTMLElement {
	const rbrace = document.createElement("span");
	rbrace.classList.add("jsonObject__trivia");
	rbrace.textContent = content;
	return rbrace;
}

function span(klass: string, text?: string): HTMLSpanElement {
	const el = document.createElement("span");
	el.classList.add(klass);
	if (text) {
		el.textContent = text;
	}

	return el;
}

function div(klass: string, text?: string): HTMLSpanElement {
	const el = document.createElement("div");
	el.classList.add(klass);
	if (text) {
		el.textContent = text;
	}
	return el;
}

export class JsonViewKvPair implements JsonViewItem {
	key: string;
	value: JsonViewItem;

	constructor(key: string, value: JsonViewItem) {
		this.key = key;
		this.value = value;
	}

	render(root: HTMLElement) {
		const container = div("jsonObject__content__item");
		const key_element = span("jsonObject__content__item__key", this.key);
		container.appendChild(key_element);

		const value_container = span("jsonObject__content__item__value");
		if (
			this.value instanceof JsonViewObject ||
			this.value instanceof JsonViewArray
		) {
			const is_object = this.value instanceof JsonViewObject;
			const is_object_with_header_name =
				this.value instanceof JsonViewObject && this.value.header_name;

			const is_array = !is_object;
			const is_empty_array =
				this.value instanceof JsonViewArray && this.value.items.length === 0;

			if ((is_array && !is_empty_array) || (is_object && !is_object_with_header_name)) {
				const lbrace = makeTrivia(is_object ? "{" : "[");
				const rbrace = makeTrivia(is_object ? "}" : "]");
				value_container.appendChild(lbrace);
				this.value.render(value_container, false);
				value_container.appendChild(rbrace);
			} else {
				this.value.render(value_container);
				value_container.style.display = "inline";
			}

			container.appendChild(value_container);

			// for toggling the value by clicking the key
			key_element.classList.add("jsonObject__keyButton");
			key_element.onclick = () => {
				const val = this.value as JsonViewObject | JsonViewArray;
				val.toggle();
			};
		} else {
			this.value.render(value_container);
			container.appendChild(value_container);
		}

		root.appendChild(container);
	}
}

export class JsonViewObject implements JsonViewItem {
	header_name?: string;
	is_open = true;
	kv_pairs: JsonViewKvPair[];
	container_el: HTMLElement = div("jsonObject");
	keyvalue_container_el = div("jsonObject__content");

	open_brace: HTMLElement | null = null;
	close_brace: HTMLElement | null = null;
	toggle_div: HTMLElement | null = null;
	dotdotdot = span("jsonObject__trivia", "...");

	constructor(object: Record<string, any>) {
		const header_name = object.__name;
		const kv_pairs: JsonViewKvPair[] = Object.entries(object)
			.filter(([key]) => !key.startsWith("__"))
			.map(
				([key, value]) => new JsonViewKvPair(key, constructJsonViewItem(value)),
			);

		this.header_name = header_name;
		this.kv_pairs = kv_pairs;
	}

	render(root: HTMLElement, braces = true) {
		const container = this.container_el;

		container.appendChild(this.dotdotdot);
		this.dotdotdot.style.display = "none";

		if (this.header_name) {
			const header = div("jsonObject__header");
			this.toggle_div = span("jsonObject__header__toggle", "-");
			this.toggle_div.classList.add("open");
			header.appendChild(this.toggle_div);

			const header_name = span("jsonObject__header__name", this.header_name);
			header_name.onclick = this.toggle.bind(this);
			header.appendChild(header_name);

			const lbrace = makeTrivia("{");
			header.appendChild(lbrace);
			this.open_brace = lbrace;

			container.appendChild(header);
		}

		const kv_el = this.keyvalue_container_el;

		if (braces && !this.open_brace) {
			const lbrace = makeTrivia("{");
			container.appendChild(lbrace);
			this.open_brace = lbrace;
		}

		for (const kv_pair of this.kv_pairs) {
			kv_pair.render(kv_el);
		}

		container.appendChild(kv_el);
		if (braces || this.header_name) {
			const rbrace = makeTrivia("}");
			container.appendChild(rbrace);
			this.close_brace = rbrace;
		}

		root.appendChild(container);
	}

	toggle() {
		this.is_open = !this.is_open;
		if (!this.container_el) return;

		if (this.header_name) {
			if (this.open_brace)
				this.open_brace.style.display = this.is_open ? "inline" : "none";
			if (this.close_brace)
				this.close_brace.style.display = this.is_open ? "inline" : "none";

			this.keyvalue_container_el.style.display = this.is_open
				? "block"
				: "none";
			this.dotdotdot.style.display = "none";

			if (this.toggle_div) {
				this.toggle_div.textContent = this.is_open ? "-" : "+";
			}

			return;
		}

		this.container_el.style.display = this.is_open ? "block" : "inline";
		this.keyvalue_container_el.style.display = this.is_open ? "block" : "none";
		for (const child of Array.from(this.container_el.children)) {
			if (child instanceof HTMLElement) {
				child.style.display = this.is_open ? "block" : "none";
			}
		}

		this.dotdotdot.style.display = this.is_open ? "none" : "inline";
	}
}

export class JsonViewArray implements JsonViewItem {
	items: Array<JsonViewItem>;
	open_brace: HTMLElement | null = null;
	close_brace: HTMLElement | null = null;
	container_el: HTMLElement | null = null;
	root: HTMLElement | null = null;

	is_open: boolean = true;
	dotdotdot = span("jsonObject__trivia", "...");

	constructor(array: Array<any>) {
		this.items = array.map(constructJsonViewItem);
	}

	render(root: HTMLElement, braces = true) {
		this.root = root;

		if (this.items.length === 0) {
			const container = span("jsonArray");
			const empty = span("jsonArray__empty", "[]");
			container.appendChild(empty);
			root.appendChild(container);
			return;
		}

		const container = div("jsonArray");

		if (braces) {
			const lbrace = makeTrivia("[");
			container.appendChild(lbrace);
			this.open_brace = lbrace;
		}

		const items_container = div("jsonArray__content");
		for (const item of this.items) {
			item.render(items_container);
		}
		container.appendChild(items_container);

		if (braces) {
			const rbrace = makeTrivia("]");
			container.appendChild(rbrace);
			this.close_brace = rbrace;
		}

		root.appendChild(container);
		this.container_el = container;
	}

	toggle() {
		this.is_open = !this.is_open;
		if (!this.container_el) return;

		this.container_el.style.display = this.is_open ? "block" : "inline";
		for (const child of this.container_el.children) {
			if (child instanceof HTMLElement) {
				child.style.display = this.is_open ? "block" : "none";
			}
		}

		this.container_el.appendChild(this.dotdotdot);
		this.dotdotdot.style.display = this.is_open ? "none" : "inline";
	}
}

function escapeString(s: string): string {
	let new_s = "";
	for (const ch of s) {
		switch (ch) {
			case "\n":
				new_s += "\\n";
				break;
			case "\r":
				new_s += "\\r";
				break;
			case "\t":
				new_s += "\\t";
				break;
			case '"':
				new_s += '\\"';
				break;
			case "\\":
				new_s += "\\\\";
				break;
			default:
				new_s += ch;
		}
	}

	return new_s;
}

export class JsonViewPrimitive {
	value: string | number | boolean | null;

	constructor(value: string | number | boolean | null) {
		if (typeof value === "string") {
			value = escapeString(value);
		}
		this.value = value;
	}

	render(root: HTMLElement) {
		const primitive = document.createElement("span");

		switch (typeof this.value) {
			case "string":
				primitive.classList.add("jsonString");
				break;
			case "number":
				primitive.classList.add("jsonNumber");
				break;
			case "boolean":
				primitive.classList.add("jsonBool");
				break;
			case "object":
				primitive.classList.add("jsonNull");
			default: {
			} // not possile.
		}

		let rendered_value: string;
		switch (typeof this.value) {
			case "string":
				rendered_value = this.value;
				break;
			case "boolean":
				rendered_value = this.value ? "true" : "false";
				break;
			case "object":
				rendered_value = "null";
				break;
			default:
				rendered_value = this.value.toString();
		}

		primitive.textContent = rendered_value;
		root.appendChild(primitive);
	}
}

function constructJsonViewItem(value: any): JsonViewItem {
	if (typeof value === "object") {
		if (Array.isArray(value)) return new JsonViewArray(value);

		if (value !== null) return new JsonViewObject(value);
	}

	switch (typeof value) {
		case "string":
		case "number":
		case "boolean":
			return new JsonViewPrimitive(value);
		case "object":
			if (value === null) return new JsonViewPrimitive(null);
		default:
			// TODO: return Either
			throw new Error(`Unknown value type: ${typeof value}`);
	}
}

export function renderJsonToHtml(json: any, root: HTMLElement) {
	const viewItem = constructJsonViewItem(json);
	viewItem.render(root);
}
