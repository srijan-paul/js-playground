
interface JsonViewItem {
	render(root: HTMLElement): void;
}


function makeTrivia(content: string): HTMLElement {
	const rbrace = document.createElement("span");
	rbrace.classList.add("jsonObject__trivia");
	rbrace.textContent = content;
	return rbrace;
}

function span(klass, text): HTMLSpanElement {
	const el = document.createElement("span");
	el.classList.add(klass);
	el.textContent = text;
	return el;
}

export class JsonViewObject implements JsonViewItem {
	header_name?: string;
	is_open = true;
	kv_pairs: Array<[string, JsonViewItem]>;
	content_div: HTMLElement | null = null;
	lbrace_div: HTMLElement | null = null;
	rbrace_div: HTMLElement | null = null;
	toggle_div: HTMLElement | null = null;

	constructor(object: Record<string, any>) {
		const header_name = object.__name;
		const kv_pairs: Array<[string, JsonViewItem]> = Object.entries(object)
			.filter(([key]) => key !== "__name")
			.map(([key, value]) => [key, constructJsonViewItem(value)]);

		this.header_name = header_name;
		this.kv_pairs = kv_pairs;
	}

	render(root: HTMLElement, leading_lbrace = true) {
		const container = document.createElement("div");
		container.classList.add("jsonObject");

		const header = document.createElement("div");
		header.classList.add("jsonObject__header");

		const header_name = span("jsonObject__header__name", this.header_name ?? "")
		const toggle = span("jsonObject__header__toggle", this.is_open ? "-" : "+");
		this.toggle_div = toggle;

		if (typeof this.header_name === "string")
			header.append(toggle, header_name);

		const lbrace = makeTrivia("{");
		this.lbrace_div = lbrace;
		if (leading_lbrace) {
			header.append(lbrace);
		}

		const content = document.createElement("div");
		content.classList.add("jsonObject__content");
		content.style.display = this.is_open ? "block" : "none";
		this.content_div = content;
		container.append(header, content);


		this.kv_pairs.forEach(([key, value]) => {
			const item = document.createElement("div");
			item.classList.add("jsonObject__content__item");

			const keyElement = span("jsonObject__content__item__key", key);
			const valueElement = document.createElement("span");

			let is_value_object = value instanceof JsonViewObject;
			let is_value_array = value instanceof JsonViewArray;
			let is_expandable_value = is_value_object || is_value_array;

			if (is_expandable_value) {
				keyElement.classList.add("jsonObject__keyButton")
				keyElement.onclick = () => {
					const val = value as JsonViewObject | JsonViewArray;
					val.toggle();
				}
			}

			if (is_value_object || is_value_array) {
				valueElement.classList.add("jsonObject__content__item__value");
			} else {
				valueElement.classList.add("jsonObject__content__item__oneline");
			}

			if (value instanceof JsonViewObject || value instanceof JsonViewArray) {
				value.render(valueElement, false);
			} else {
				value.render(valueElement);
			}

			item.appendChild(keyElement);
			if (value instanceof JsonViewObject) {
				const lb = makeTrivia("{")
				item.appendChild(lb);
				value.lbrace_div = lb;
			} else if (value instanceof JsonViewArray) {
				const lb = makeTrivia("[")
				item.appendChild(lb);
				value.lbrac_el = lb;
			}

			item.appendChild(valueElement);
			content.appendChild(item);
		});

		const rbrace = makeTrivia("}");
		this.rbrace_div = rbrace;

		if (this.header_name) {
			header_name.onclick = this.toggle.bind(this);
		}

		if (this.header_name) {
			rbrace.style.marginLeft = "0.5em";
		}

		container.appendChild(rbrace);
		root.appendChild(container);
	}

	toggle() {
		this.is_open = !this.is_open;
		if (this.content_div)
			this.content_div.style.display = this.is_open ? "block" : "none";
		if (this.toggle_div)
			this.toggle_div.textContent = this.is_open ? "-" : "+";
		if (this.rbrace_div)
			this.rbrace_div.style.display = this.is_open ? "inline" : "none";
		if (this.lbrace_div)
			this.lbrace_div.style.display = this.is_open ? "inline" : "none";
	}
}

export class JsonViewArray implements JsonViewItem {
	items: Array<JsonViewItem>;
	lbrac_el: HTMLElement | null = null;
	rbrac_el: HTMLElement | null = null;
	container_el: HTMLElement | null = null;
	is_open: boolean = true;

	constructor(array: Array<any>) {
		this.items = array.map(constructJsonViewItem);
	}

	render(root: HTMLElement, leading_lbrac = true) {
		const container = document.createElement("div");
		container.classList.add("jsonArray");
		this.container_el = container;

		if (leading_lbrac) {
			this.lbrac_el = makeTrivia("[");
			container.appendChild(this.lbrac_el);
		}

		this.items.forEach(item => {
			const itemElement = document.createElement("div");
			itemElement.classList.add("jsonArray__item");
			item.render(itemElement);
			container.appendChild(itemElement);
		});

		root.appendChild(container);
		this.rbrac_el = makeTrivia("]");
		root.appendChild(this.rbrac_el);
	}

	toggle() {
		this.is_open = !this.is_open;
		if (this.container_el)
			this.container_el.style.display = this.is_open ? "block" : "none";
		if (this.lbrac_el)
			this.lbrac_el.style.display = this.is_open ? "inline" : "none";
		if (this.rbrac_el)
			this.rbrac_el.style.display = this.is_open ? "inline" : "none";
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
			case "\"":
				new_s += "\\\"";
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
				primitive.classList.add("jsonBoolean");
				break;
			case "object":
				primitive.classList.add("jsonNull");
			default: { } // not possile.
		}

		let rendered_value: string
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
		if (Array.isArray(value))
			return new JsonViewArray(value);

		if (value !== null)
			return new JsonViewObject(value);
	}

	switch (typeof value) {
		case "string":
		case "number":
		case "boolean":
			return new JsonViewPrimitive(value);
		case "object":
			if (value === null)
				return new JsonViewPrimitive(null);
		default:
			// TODO: return Either
			throw new Error(`Unknown value type: ${typeof value}`);
	}
}

export function renderJsonToHtml(json: any, root: HTMLElement) {
	const viewItem = constructJsonViewItem(json);
	viewItem.render(root);
}
