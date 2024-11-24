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
    if (ast === "null") return null;

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

  const transformed: any = {};
  for (const [key, value] of Object.entries(ast)) {
    const transformed_value = transformJsonAst(value);
    transformed[key] = transformed_value;
  }

  if (
    typeof transformed.start == "number" &&
    typeof transformed.end == "number"
  ) {
    transformed.__start = transformed.start;
    transformed.__end = transformed.end;
    delete transformed.start;
    delete transformed.end;
  }

  if (transformed.type) {
    transformed.__name = transformed.type;
    delete transformed.type;
  }

  return transformed;
}
