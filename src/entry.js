// src/entry.js
// Всё бандлим в один файл: грамматика (CJS), рантайм-парсинг (ESM), утилиты (по желанию)
import compiled from "./grammar/parser.cjs";
import { parseProjectFromMap } from "../runtime/parse.js";

export function parseProject({ files, entry = "main.uxl" }) {
    return parseProjectFromMap(compiled, { files, entry });
}

/**
 * Поддерживает формы:
 *   parse(text, entry?)
 *   parse({ files, entry })
 *   parse(filesMap, entry?)
 */
export function parse(input, maybeEntry) {
    // 1) parse(text, entry?)
    if (typeof input === "string") {
        const entry =
            typeof maybeEntry === "string"
                ? maybeEntry
                : (maybeEntry && maybeEntry.entry) || "main.uxl";
        const files =
            (maybeEntry && maybeEntry.files) || { [entry]: input };
        return parseProject({ files, entry });
    }

    // 2) parse({ files, entry })
    if (input && typeof input === "object" && "files" in input) {
        const { files, entry = "main.uxl" } = input;
        return parseProject({ files, entry });
    }

    // 3) parse(filesMap, entry?)
    if (input && typeof input === "object") {
        const entry = typeof maybeEntry === "string" ? maybeEntry : "main.uxl";
        const files = input;
        return parseProject({ files, entry });
    }

    throw new Error(
        "parse: expected (text, entry?) or ({ files, entry }) or (filesMap, entry)"
    );
}

export { diffAST as diff} from "./utils/diff.js";
export { validateContract as validate } from "./utils/validate.js";
export { transpile } from "./../src/transpiler.js";
