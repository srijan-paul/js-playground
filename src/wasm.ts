function toUtf8Bytes(s: string) {
	const utf8 = new TextEncoder().encode(s);
	return utf8;
}

interface Exports {
	alloc(len: number): number;
	free(addr: number, len: number): void;
	parseModule(ptr: number, len: number): number;

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

export class Wasm {
	private wasm: Exports;

	constructor(wasm_instance: WebAssembly.Instance) {
		assert(
			wasm_instance.exports.alloc !== undefined,
			"alloc not found in wasm instance",
		);
		assert(
			wasm_instance.exports.free !== undefined,
			"free not found in wasm instance",
		);
		assert(
			wasm_instance.exports.parseModule !== undefined,
			"parseModule not found in wasm instance",
		);
		assert(
			wasm_instance.exports.memory !== undefined,
			"memory not found in wasm instance",
		);

		this.wasm = wasm_instance.exports as unknown as Exports;
	}

	allocString(str: string): WasmString | null {
		const utf8 = toUtf8Bytes(str);
		const len = utf8.length;

		const wasm_buf_addr = this.wasm.alloc(len);
		if (wasm_buf_addr == 0) {
			return null;
		}

		const memory = new Uint8Array(this.wasm.memory.buffer);

		memory.set(utf8, wasm_buf_addr);
		return { ptr: wasm_buf_addr, len: len };
	}

	freeString(str: WasmString) {
		this.wasm.free(str.ptr, str.len);
	}

	private strlen(ptr: number): number {
		const memory = new Uint8Array(this.wasm.memory.buffer);
		let len = 0;
		while (memory[ptr + len] != 0) {
			len++;
		}
		return len;
	}

	readWasmString(str: WasmString): string {
		const memory = new Uint8Array(this.wasm.memory.buffer);
		const utf8 = memory.slice(str.ptr, str.ptr + str.len);
		const str_decoder = new TextDecoder();
		return str_decoder.decode(utf8);
	}

	parseModule(str: string): string | null {
		const wasm_str = this.allocString(str);
		if (wasm_str == null) {
			return null;
		}

		const parsed_str_addr = this.wasm.parseModule(wasm_str.ptr, wasm_str.len);
		if (parsed_str_addr == 0) return null;

		const parsed_str_len = this.strlen(parsed_str_addr);
		const parsed_str: WasmString = {
			ptr: parsed_str_addr,
			len: parsed_str_len,
		};

		const parsed_js_str = this.readWasmString(parsed_str);
		this.freeString(wasm_str);
		return parsed_js_str;
	}
}
