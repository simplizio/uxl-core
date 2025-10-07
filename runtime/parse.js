import nearley from "nearley";
const { Parser, Grammar } = nearley;

export function parseText(compiled, text) {
    const grammar = Grammar.fromCompiled(compiled);
    const parser = new Parser(grammar);
    parser.feed(text);
    const [ast] = parser.results;
    if (!ast) throw new Error("Parse produced 0 results");
    return ast;
}

export function parseProjectFromMap(compiled, { files, entry }) {
    if (!files || typeof files[entry] !== "string") {
        throw new Error(`Entry not found: ${entry}`);
    }
    const ast = parseText(compiled, files[entry]);
    // при необходимости позже сюда добавим построение index/графа импортов
    return { ast, errors: [], index: {} };
}
