
import {validateContract} from "./utils/validate.js";
import {diffAST} from "./utils/diff.js";

import nearley from "nearley";           // <- CJS default
import grammar from "./grammar/parser.cjs";       // compiled by nearleyc (CJS -> default ok)
import { makeLexer } from "./grammar/lexer.js";
import { transpile } from "./transpiler.js";


function prettySymbol(sym) {
    if (!sym) return "«EOF»";
    if (typeof sym === "string") return sym;
    if (sym && sym.literal) return JSON.stringify(sym.literal);
    if (sym && sym.type) return sym.type;
    if (sym && sym.test) return "token(test)";
    return String(sym);
}

function expectedNow(parser) {
    // nearley.Parser «прячет» таблицу неофициально, но она доступна
    const col = parser.table?.[parser.current];
    if (!col) return [];
    const next = new Set();
    for (const st of col.states) {
        if (st.dot < st.rule.symbols.length) {
            next.add(prettySymbol(st.rule.symbols[st.dot]));
        }
    }
    return [...next];
}

function dumpColumn(parser, k) {
    const col = parser.table?.[k];
    if (!col) return;
    // eslint-disable-next-line no-console
    console.error(`\n== COLUMN ${k} (after consuming ${k} token(s)) ==`);
    for (const st of col.states) {
        const { rule, dot, reference } = st;
        const before = rule.symbols.slice(0, dot).map(prettySymbol).join(" ");
        const after  = rule.symbols.slice(dot).map(prettySymbol).join(" ");
        // eslint-disable-next-line no-console
        console.error(`  ${rule.name} → ${before} • ${after}   {from:${reference}}`);
    }
}
// function dumpColumn(parser, k) {
//     const col = parser.table?.[k];
//     if (!col) return;
//     console.error(`\n== COLUMN ${k} ==`);
//     for (const st of col.states) {
//         const before = st.rule.symbols.slice(0, st.dot).map(prettySymbol).join(" ");
//         const after  = st.rule.symbols.slice(st.dot).map(prettySymbol).join(" ");
//         console.error(`  ${st.rule.name} → ${before} • ${after}  {from:${st.reference}}`);
//     }
// }

/**
 * Разбор исходника с опциональным трейсом.
 * @param {string} source
 * @param {{ trace?: boolean }} [opts]
 * @returns {*} AST (первый результат)
 */

export function parse(source, opts = {}) {
    const trace = !!opts.trace || !!process.env.UXL_TRACE;

    // compiled — это именно объект с ParserRules/ParserStart/Lexer из parser.cjs
    const compiledGrammar = nearley.Grammar.fromCompiled(grammar);
    const parser = new nearley.Parser(compiledGrammar, { keepHistory: true });

    // ТРЕЙС: перехватываем lexer.next(), парсер кормим СТРОКОЙ
    if (trace && parser.lexer && typeof parser.lexer.next === "function") {
        const origNext = parser.lexer.next.bind(parser.lexer);
        let i = 0;
        console.error("== PARSE TRACE ==");
        parser.lexer.next = () => {
            const exp = expectedNow(parser); // ожидания ДО чтения токена
            const t = origNext();
            console.error(
                `feed #${i++}:`,
                t && t.type, JSON.stringify(t ? t.value : null),
                `@${t && t.line}:${t && t.col}`,
                "\n  expects →", exp.join(", ")
            );
            return t;
        };
    }

    try {
        parser.feed(String(source)); // всегда строкой; nearley сам вызывает лексер
    } catch (e) {
        if (trace) {
            console.error("\n!! PARSE ERROR:", e && e.message ? e.message : e);
            dumpColumn(parser, Math.max(0, parser.current - 1));
            dumpColumn(parser, parser.current);
        }
        throw e;
    }

    if (!parser.results.length) throw new Error("Parse error: no result");
    // при неоднозначности берём первый — как у тебя было
    return parser.results[0];
}

/** AST -> Contract JSON (stable shape for runtimes) */
export function toContract(ast) {
    return transpile(ast);
}

/** Quick validation: returns { ok: boolean, errors?: [...] } */
export function validate(contract) {
    return validateContract(contract);
}

/** Semantic diff between two ASTs -> array of change objects */
export function diff(astA, astB) {
    return diffAST(astA, astB);
}

export { makeLexer, transpile };
export default { makeLexer, parse, transpile };
