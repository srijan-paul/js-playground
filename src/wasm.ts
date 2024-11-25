function toUtf8Bytes(s: string) {
	const utf8 = new TextEncoder().encode(s);
	return utf8;
}

interface Exports {
	alloc(len: number): number;
	free(addr: number, len: number): void;
	parseModule(ptr: number, len: number, out_addr: number): number;
	parseScript(ptr: number, len: number, out_addr: number): number;
	freeResult(addr: number): void;
	ResultWasmSize: WebAssembly.Global;
	ParseResultSize: WebAssembly.Global;

	memory: WebAssembly.Memory;
}

interface WasmString {
	ptr: number;
	len: number;
}

function assert(condition: boolean, message: string): asserts condition {
	if (!condition) {
		throw new Error(message);
	}
}

function strlen(buf: Uint8Array, ptr: number): number {
	let len = 0;
	while (buf[ptr + len] !== 0) len++;
	return len;
}

function readWasmString(mem: WebAssembly.Memory, ptr: number): string {
	const memory = new Uint8Array(mem.buffer);
	const len = strlen(memory, ptr);
	const utf8 = memory.slice(ptr, ptr + len);
	const str_decoder = new TextDecoder();
	return str_decoder.decode(utf8);
}

function memRead(mem: WebAssembly.Memory, ptr: number): number {
	return new Uint8Array(mem.buffer)[ptr];
}

function readi32(mem: WebAssembly.Memory, ptr: number): number {
	const memory = new DataView(mem.buffer);
	return memory.getInt32(ptr, true);
}

enum Primitive {
	i32 = 4,
	ptr = 4,
}

type Struct<Keys extends string> = Array<[Keys, Primitive]>;
function structClass<T extends string>(struct: Struct<T>) {
	return class {
		addr_of_field = new Map<string, number>();
		byte_length: number;

		constructor(
			public wasm: Exports,
			public addr: number,
		) {
			let offset = 0;
			for (const [fieldName, fieldType] of struct) {
				this.addr_of_field.set(fieldName, addr + offset);
				offset += fieldType;
			}

			this.byte_length = offset;
		}

		get(key: T): number | null {
			const addr = this.addr_of_field.get(key);
			if (!addr) return null;
			return readi32(this.wasm.memory, addr);
		}
	};
}

const Result = structClass([
	["json_ast", Primitive.ptr],
	["error_message", Primitive.ptr],
	["error_line", Primitive.i32],
	["error_column", Primitive.i32],
	["ok", Primitive.i32],
	["has_result", Primitive.i32],
]);

type ParseResult =
	| { success: true; ast: string }
	| {
			success: false;
			error_message: string;
			error_line: number;
			error_column: number;
	  };

export class WasmAdapter {
	public wasm: Exports;
	public ResultWasmSize: number;

	constructor(wasm_instance: WebAssembly.Instance) {
		const expected_props = [
			"alloc",
			"free",
			"parseModule",
			"parseScript",
			"ResultWasmSize",
			"ParseResultSize",
			"memory",
			"freeResult",
		];

		for (const prop of expected_props) {
			assert(
				prop in wasm_instance.exports,
				`${prop} not found in wasm instance`,
			);
		}

		this.wasm = wasm_instance.exports as unknown as Exports;
		this.ResultWasmSize = memRead(
			this.wasm.memory,
			this.wasm.ResultWasmSize.value,
		);
	}

	allocString(str: string): WasmString | null {
		const utf8 = toUtf8Bytes(str);
		const len = utf8.length;

		const wasm_buf_addr = this.wasm.alloc(len);
		if (wasm_buf_addr == 0) return null;

		const memory = new Uint8Array(this.wasm.memory.buffer);
		memory.set(utf8, wasm_buf_addr);
		return { ptr: wasm_buf_addr, len: len };
	}

	freeString(str: WasmString) {
		this.wasm.free(str.ptr, str.len);
	}

	readWasmString(str: WasmString): string {
		const memory = new Uint8Array(this.wasm.memory.buffer);
		const utf8 = memory.slice(str.ptr, str.ptr + str.len);
		const str_decoder = new TextDecoder();
		return str_decoder.decode(utf8);
	}

	parseModule(str: string): ParseResult | null {
		const wasm_str = this.allocString(str);
		if (wasm_str == null) return null;

		const out_buf = this.wasm.alloc(this.ResultWasmSize);
		this.wasm.parseModule(out_buf, wasm_str.ptr, wasm_str.len);
		this.freeString(wasm_str);
		if (out_buf == 0) return null;

		const result = new Result(this.wasm, out_buf);
		if (!result.get("has_result")) {
			this.wasm.freeResult(out_buf);
			return null;
		}

		if (!result.get("ok")) {
			const error_message_ptr = result.get("error_message");
			const error_line = result.get("error_line");
			const error_column = result.get("error_column");

			assert(
				typeof error_message_ptr === "number",
				"error_message is not a string",
			);

			assert(
				typeof error_line === "number" && typeof error_column === "number",
				"error_line and error_column must both be numbers",
			);

			this.wasm.freeResult(out_buf);
			return {
				success: false,
				error_message: readWasmString(this.wasm.memory, error_message_ptr),
				error_line,
				error_column,
			};
		}

		const json_str_ptr = result.get("json_ast");
		if (!json_str_ptr) {
			this.wasm.freeResult(out_buf);
			return null;
		}

		const json_ast_str = readWasmString(this.wasm.memory, json_str_ptr);
		this.wasm.freeResult(out_buf);
		return { success: true, ast: json_ast_str };
	}
}
