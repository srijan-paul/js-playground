import { defaultStyleSheet, StyleSheet } from "./styles";

type JsonPrimitive = string | number | boolean | null;
type JsonArray = JsonValue[];
type JsonObject = { [key: string]: JsonValue };
type JsonValue = JsonPrimitive | JsonArray | JsonObject;

export function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isJsonArray(value: JsonValue): value is JsonArray {
  return Array.isArray(value);
}

export function isJsonPrimitive(value: JsonValue): value is JsonPrimitive {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  );
}

/**
 * Represents a render-able JSON item.
 */
interface JsonViewItem {
  /**
   * Renders the JSON item as an HTML element on the DOM.
   * @param root The root element to append the rendered JSON item to.
   */
  render(root: HTMLElement): void;
}

/**
 * @param content Contents of the trivia span, usually "{", "...", "]", etc.
 * @returns A span element with the given content and the class styles.jsonObject__trivia.
 */
function makeTrivia(
  styles: StyleSheet["classes"],
  content: string
): HTMLElement {
  return span(styles.jsonObject__trivia, content);
}

/**
 * @param klass Class name to add to the span element.
 * @param text Text content of the span element, if any
 */
function span(klass: string, text?: string): HTMLSpanElement {
  const el = document.createElement("span");
  el.classList.add(klass);
  if (text) {
    el.textContent = text;
  }

  return el;
}

/**
 * @param klass Class name to add to the div element.
 * @param text  Text content of the div element, if any
 */
function div(klass: string, text?: string): HTMLDivElement {
  const el = document.createElement("div");
  el.classList.add(klass);
  if (text) {
    el.textContent = text;
  }
  return el;
}

/**
 * A drawable key-value pair in a JSON object.
 */
export class JsonViewKvPair implements JsonViewItem {
  key: string;
  value: JsonViewItem;

  constructor(
    key: string,
    value: JsonViewItem,
    private styles: StyleSheet["classes"] = defaultStyleSheet.classes,
    public callback?: JsonCallback
  ) {
    this.key = key;
    this.value = value;
  }

  render(root: HTMLElement) {
    const container = div(this.styles.jsonObject__content__item);
    const key_element = span(
      this.styles.jsonObject__content__item__key,
      this.key
    );
    container.appendChild(key_element);
    container.onmouseenter = () => {
      if (this.value instanceof JsonViewObject) {
        this.callback?.(this.value.object, "enter");
      }
    };
    container.onmouseleave = () => {
      if (this.value instanceof JsonViewObject) {
        this.callback?.(this.value.object, "exit");
      }
    };

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

      if (
        (is_array && !is_empty_array) ||
        (is_object && !is_object_with_header_name)
      ) {
        const lbrace = makeTrivia(this.styles, is_object ? "{" : "[");
        const rbrace = makeTrivia(this.styles, is_object ? "}" : "]");
        value_container.appendChild(lbrace);
        this.value.render(value_container, false);
        value_container.appendChild(rbrace);
      } else {
        this.value.render(value_container);
        value_container.style.display = "inline";
      }

      container.appendChild(value_container);

      // for toggling the value by clicking the key
      key_element.classList.add(this.styles.jsonObject__keyButton);
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

/**
 * Callback function to be called when a JSON item is hovered over.
 */
export type JsonCallback = (item: JsonValue, event: "enter" | "exit") => void;

export class JsonViewObject implements JsonViewItem {
  header_name?: string;
  /**
   * Whether the object is currently open or closed.
   */
  is_open = true;
  /**
   * Key-value pairs in the JSON object.
   */
  kv_pairs: JsonViewKvPair[];
  /**
   * The root element of the JSON object.
   */
  container_el: HTMLDivElement;
  /**
   * The container element for the key-value pairs.
   */
  keyvalue_container_el: HTMLDivElement;
  /**
   * The opening "{" element in the DOM of the JSON object.
   */
  open_brace_el: HTMLElement | null = null;
  /**
   * The closing "}" element in the DOM of the JSON object.
   */
  close_brace_el: HTMLElement | null = null;
  /**
   * The "+" or "-" element to toggle the object open or closed.
   * This may not exist if the object has no header name.
   */
  toggle_div: HTMLElement | null = null;
  dotdotdot: HTMLSpanElement;

  constructor(
    public object: JsonObject,
    private styles: StyleSheet["classes"] = defaultStyleSheet.classes,
    private callback?: JsonCallback
  ) {
    const header_name =
      typeof object.__name === "string" ? object.__name : undefined;

    const kv_pairs: JsonViewKvPair[] = Object.entries(object)
      .filter(([key]) => !key.startsWith("__"))
      .map(
        ([key, value]) =>
          new JsonViewKvPair(
            key,
            constructJsonViewItem(value, styles, callback),
            styles,
            callback
          )
      );

    this.header_name = header_name;
    this.kv_pairs = kv_pairs;

    this.container_el = div(styles.jsonObject);
    this.keyvalue_container_el = div(styles.jsonObject__content);
    this.dotdotdot = span(styles.jsonObject__trivia, "...");
  }

  render(root: HTMLElement, braces = true) {
    const container = this.container_el;

    container.appendChild(this.dotdotdot);
    this.dotdotdot.style.display = "none";

    if (this.header_name) {
      const header = div(this.styles.jsonObject__header);
      this.toggle_div = span(this.styles.jsonObject__header__toggle, "-");
      this.toggle_div.classList.add("open");
      header.appendChild(this.toggle_div);

      const header_name = span(
        this.styles.jsonObject__header__name,
        this.header_name
      );
      header_name.onclick = this.toggle.bind(this);
      header_name.onmouseenter = () => this.callback?.(this.object, "enter");
      header_name.onmouseleave = () => this.callback?.(this.object, "exit");

      header.appendChild(header_name);

      const lbrace = makeTrivia(this.styles, "{");
      header.appendChild(lbrace);
      this.open_brace_el = lbrace;

      container.appendChild(header);
    }

    container.onmouseenter = () => this.callback?.(this.object, "enter");
    container.onmouseleave = () => this.callback?.(this.object, "exit");

    const kv_el = this.keyvalue_container_el;

    if (braces && !this.open_brace_el) {
      const lbrace = makeTrivia(this.styles, "{");
      container.appendChild(lbrace);
      this.open_brace_el = lbrace;
    }

    for (const kv_pair of this.kv_pairs) {
      kv_pair.render(kv_el);
    }

    container.appendChild(kv_el);
    if (braces || this.header_name) {
      const rbrace = makeTrivia(this.styles, "}");
      container.appendChild(rbrace);
      this.close_brace_el = rbrace;
    }

    root.appendChild(container);
  }

  /**
   * Toggle the expanded/collapsed state of the object's node in the DOM.
   */
  toggle() {
    this.is_open = !this.is_open;
    if (!this.container_el) return;

    if (this.header_name) {
      if (this.open_brace_el)
        this.open_brace_el.style.display = this.is_open ? "inline" : "none";
      if (this.close_brace_el)
        this.close_brace_el.style.display = this.is_open ? "inline" : "none";

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
  items: JsonViewItem[];
  dotdotdot: HTMLSpanElement;

  open_brace: HTMLElement | null = null;
  close_brace: HTMLElement | null = null;
  container_el: HTMLElement | null = null;
  root: HTMLElement | null = null;
  is_open: boolean = true;

  constructor(
    public array: JsonValue[],
    private styles: StyleSheet["classes"] = defaultStyleSheet.classes,
    private callback?: JsonCallback
  ) {
    this.dotdotdot = span(styles.jsonObject__trivia, "...");
    this.items = array.map((x) => constructJsonViewItem(x, styles, callback));
  }

  render(root: HTMLElement, braces = true) {
    this.root = root;

    if (this.items.length === 0) {
      const container = span("jsonArray");
      const empty = span(this.styles.jsonArray__empty, "[]");
      container.appendChild(empty);
      root.appendChild(container);
      return;
    }

    const container = div("jsonArray");

    if (braces) {
      const lbrace = makeTrivia(this.styles, "[");
      container.appendChild(lbrace);
      this.open_brace = lbrace;
    }

    const items_container = div(this.styles.jsonArray__content);
    items_container.onmouseenter = () => this.callback?.(this.array, "enter");
    items_container.onmouseleave = () => this.callback?.(this.array, "exit");

    for (const item of this.items) {
      item.render(items_container);
    }
    container.appendChild(items_container);

    if (braces) {
      const rbrace = makeTrivia(this.styles, "]");
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
  constructor(
    public value: JsonPrimitive,
    private styles: StyleSheet["classes"] = defaultStyleSheet.classes
  ) {
    if (typeof this.value === "string") {
      this.value = escapeString(this.value);
    }
  }

  render(root: HTMLElement) {
    const primitive = document.createElement("span");

    switch (typeof this.value) {
      case "string":
        primitive.classList.add(this.styles.jsonString);
        break;
      case "number":
        primitive.classList.add(this.styles.jsonNumber);
        break;
      case "boolean":
        primitive.classList.add(this.styles.jsonBool);
        break;
      case "object":
        primitive.classList.add(this.styles.jsonNull);
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

function constructJsonViewItem(
  value: JsonValue,
  styles: StyleSheet["classes"] = defaultStyleSheet.classes,
  callback?: JsonCallback
): JsonViewItem {
  if (typeof value === "object") {
    if (Array.isArray(value)) return new JsonViewArray(value, styles, callback);

    if (value !== null) return new JsonViewObject(value, styles, callback);
  }

  switch (typeof value) {
    case "string":
    case "number":
    case "boolean":
      return new JsonViewPrimitive(value, styles);
    case "object":
      if (value === null) return new JsonViewPrimitive(null, styles);
    default:
      // TODO: return Either
      throw new Error(`Unknown value type: ${typeof value}`);
  }
}

export function renderJson(
  json: any,
  root: HTMLElement,
  stylesheet: StyleSheet,
  callback?: JsonCallback
) {
  const styles = stylesheet.classes;
  root.classList.add(styles.jsonContainer);
  const viewItem = constructJsonViewItem(json, styles, callback);
  viewItem.render(root);
}
