// src/lexer.js
// UXL indent-sensitive lexer using moo with offside rule (ESM).
// - Tabs -> spaces (tabWidth)
// - Generates NEWLINE / INDENT / DEDENT (Python-like offside rule)
// - Case-insensitive reserved keywords via postprocess (keywordSet)
// - Preserves CamelCase for identifiers and strings
// - DO NOT promote action verbs (navigate/emit/record) to keywords
//
// Usage with Nearley:
//   import { makeLexer } from "./lexer.js";
//   const lexer = makeLexer({ tabWidth: 4, baseIndent: 2 });

import moo from "moo";

/** Reserved keywords (lowercase) — syntax only, NOT action verbs. */
function keywordSet() {
    return new Set([
        // structure
        "screen", "template", "area", "component",
        "bind", "when", "on", "track", // track is a BLOCK keyword (track:)
        "data", "i18n", "param", "use",
        "variant", "ab", "extends",
        // layout
        "row", "col", "grid",
        // import/export/reuse
        "import", "export", "include", "as", "with",
        // IMPORTANT: no "navigate", "emit", "record" here (these are actions)
    ]);
}

// сегмент: первая буква/_, далее буквы/цифры/_/./- (но не заканчиваемся на . или -)
//const ident = /[A-Za-z_][A-Za-z0-9_.-]*[A-Za-z0-9_]/
//    .source;

// сегмент может быть из 1 символа, но не оканчиваться на . или -
const segment = /[A-Za-z_](?:[A-Za-z0-9_.-]*[A-Za-z0-9_])?/;

/** Base moo tokens (order here isn't critical — we promote keywords/bools post-lexing). */
function createBaseTokens() {
    return {
        // whitespace & comments
        ws:      /[ \t]+/,
        comment: /#[^\n]*/,

        // operators (LONGEST FIRST!)
        oror:    '||',
        andand:  '&&',
        eqeq:    '==',
        noteq:   '!=',
        gte:     '>=',
        lte:     '<=',
        gt:      '>',
        lt:      '<',
        plus:    '+',
        minus:   '-',
        star:    '*',
        slash:   '/',

        // punctuation (no '=' here)
        colon:   ':',
        comma:   ',',
        dot:     '.',
        percent: '%',
        lparen:  '(',
        rparen:  ')',
        lbrace:  '{',
        rbrace:  '}',
        lbrack:  '[',
        rbrack:  ']',
        // single '=' LAST so it can't steal '==', '>=', '<='
        eq:      '=',

        // literals
        string:  /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/,
        number:  /-?\d+(?:\.\d+)?/,

        // identifiers (allow . and : and space/dash for namespaces/titles; keep CamelCase)
        // e.g. Map.Marker, Filter:Range, CheckoutForm, Product-Card, "Some Name"
        //ident: /[A-Za-z_][A-Za-z0-9_:\.-]*/,

        // допускаем двоеточия ТОЛЬКО как разделители между сегментами
        // итог: <segment>(:<segment>)*  — без двоеточия на конце
        // допускаем двоеточия ТОЛЬКО как разделители между сегментами
        ident:  new RegExp(`${segment.source}(?::${segment.source})*`), // new RegExp(`${ident}(?::${ident})*`),
        // ident: /[A-Za-z_](?:[A-Za-z0-9_.-]*[A-Za-z0-9_])?(?::[A-Za-z_](?:[A-Za-z0-9_.-]*[A-Za-z0-9_])?)*/,

        // raw newline from moo (we normalize to NEWLINE below)
        nl:      { match: /\r?\n/, lineBreaks: true },
    };
}

/** tabs -> spaces by tab stops */
function expandTabsWhole(input, tabWidth) {
    let out = "";
    let col = 0;
    for (let i = 0; i < input.length; i++) {
        const ch = input[i];
        if (ch === "\t") {
            const add = tabWidth - (col % tabWidth);
            out += " ".repeat(add);
            col += add;
        } else {
            out += ch;
            if (ch === "\n") col = 0;
            else col += 1;
        }
    }
    return out;
}

/**
 * Indent-sensitive lexer.
 * opts:
 *  - tabWidth=4         : how many spaces per tab
 *  - baseIndent=2       : indentation step (spaces), must be a multiple when strictIndent
 *  - strictIndent=true  : enforce multiples of baseIndent
 */
export function makeLexer(opts = {}) {
    const {
        tabWidth = 4,
        baseIndent = 2,
        strictIndent = true,
    } = opts;

    const kw = keywordSet();
    const base = createBaseTokens();
    const core = moo.compile(base);

    // state for offside rule
    const indentStack = [0];
    let queue = [];     // synthetic tokens (INDENT/DEDENT/NEWLINE)
    let bol = true;     // beginning of line?
    let savedTok = null;
    let lastLine = 1, lastCol = 1;

    function pushToken(tok) {
        if (!tok) return;
        if (typeof tok.line === "number") lastLine = tok.line;
        if (typeof tok.col === "number")  lastCol  = tok.col;
        queue.push(tok);
    }

    function makeSynthetic(type) {
        return {
            type,
            value: type === "NEWLINE" ? "\n" : "",
            text: "",
            toString() { return type; },
            line: lastLine,
            col:  lastCol,
        };
    }

    function nextBase() {
        if (savedTok) { const t = savedTok; savedTok = null; return t; }
        return core.next();
    }

    function lexNext() {
        if (queue.length) return queue.shift();

        let tok = nextBase();
        if (!tok) {
            // emit remaining DEDENTs at EOF
            if (indentStack.length > 1) {
                indentStack.pop();
                return makeSynthetic("DEDENT");
            }
            return null;
        }

        // At beginning of line: handle indentation & blank/comment-only lines
        if (bol) {
            // count leading spaces
            let spaces = 0;
            while (tok && tok.type === "ws") {
                spaces += tok.value.length;
                tok = nextBase();
            }

            // comment-only line: skip until newline
            if (tok && tok.type === "comment") {
                do { tok = nextBase(); } while (tok && tok.type !== "nl");
            }

            // empty line
            if (tok && tok.type === "nl") {
                if (typeof tok.line === "number") lastLine = tok.line;
                if (typeof tok.col === "number")  lastCol  = tok.col;
                return { type: "NEWLINE", value: "\n", line: tok.line, col: tok.col };
            }

            // indentation checks
            if (strictIndent && spaces % baseIndent !== 0) {
                const err = new Error(
                    `IndentationError: expected indent multiple of ${baseIndent}, got ${spaces}`
                );
                err.name = "IndentationError";
                if (tok && typeof tok.line === "number") err.line = tok.line;
                throw err;
            }

            const top = indentStack[indentStack.length - 1];
            if (spaces > top) {
                indentStack.push(spaces);
                pushToken(makeSynthetic("INDENT"));
            } else if (spaces < top) {
                while (indentStack.length > 1 && spaces < indentStack[indentStack.length - 1]) {
                    indentStack.pop();
                    pushToken(makeSynthetic("DEDENT"));
                }
                if (spaces !== indentStack[indentStack.length - 1]) {
                    const err = new Error(
                        `IndentationError: mismatched dedent (expected ${indentStack[indentStack.length - 1]}, got ${spaces})`
                    );
                    err.name = "IndentationError";
                    if (tok && typeof tok.line === "number") err.line = tok.line;
                    throw err;
                }
            }

            bol = false;
            //if (queue.length) return queue.shift();
            if (queue.length) {
                                savedTok = tok;          // ← вернём его на следующем вызове nextBase()
                                return queue.shift();
                            }
            // fallthrough to handle first non-ws token
        }

        // normalize newline
        if (tok.type === "nl") {
            lastLine = tok.line ?? lastLine;
            lastCol  = tok.col  ?? lastCol;
            bol = true;
            return { type: "NEWLINE", value: "\n", line: tok.line, col: tok.col };
        }

        // Promote bools & keywords from ident (case-insensitive for recognition; preserve CamelCase otherwise)
        if (tok.type === "ident") {
            const raw = tok.value;
            const low = raw.toLowerCase();

            // 1) bool/null literals (no /i in regex; recognize here)
            if (low === "true" || low === "false" || low === "null") {
                tok.type = "bool";
                tok.value = low; // normalize to "true"/"false"/"null"
            }
            // 2) reserved keywords (syntax), including 'track' as BLOCK
            else if (kw.has(low)) {
                if (low === "row") tok.type = "ROW";
                else if (low === "col") tok.type = "COL";
                else if (low === "grid") tok.type = "GRID";
                else tok.type = low.toUpperCase();
                tok.value = tok.type; // canonicalize so grammar "SCREEN"/"AREA"/... matches
            }
            // NOTE: navigate / emit / record remain as ident (grammar matches them as "navigate"/"emit"/"record")
        }

        // update pos
        lastLine = tok.line ?? lastLine;
        lastCol  = tok.col  ?? lastCol;

        return tok;
    }

    return {
        reset(input) {
            const normalized = expandTabsWhole(String(input ?? ""), tabWidth);
            core.reset(normalized);
            indentStack.length = 1;
            indentStack[0] = 0;
            queue = [];
            bol = true;
            savedTok = null;
            lastLine = 1;
            lastCol = 1;
        },
        next: lexNext,
        save() { return core.save(); },
        // ВАЖНО: привязываем this к core, иначе this.buffer undefined
        formatError(token, message) { return core.formatError.call(core, token, message); },
        push(tok) { savedTok = tok; },
        has(name) { return true; } // важно для nearley
    };
}

// Экспорт: по умолчанию — готовый лексер, плюс фабрика.
const defaultLexer = makeLexer();
if (typeof defaultLexer.has !== "function") {
    defaultLexer.has = function has() { return true; };
}
export default defaultLexer;
