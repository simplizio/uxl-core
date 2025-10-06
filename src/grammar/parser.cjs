// Generated automatically by nearley, version 2.20.1
// http://github.com/Hardmath123/nearley
(function () {
function id(x) { return x[0]; }

const makeLexer = require("./lexer.js").makeLexer;
const lexer = makeLexer({ tabWidth: 4 });
const { normalizeAbNode } = require("./ab/normalizeAbNode.cjs");

// «возможно пустой список» → массив без null и пустых массивов (глубокий flat)
function list(a){
  if (a == null) return [];
  const arr = Array.isArray(a) ? (a.flat ? a.flat(Infinity) : [].concat(...a)) : [a];
  return arr.filter(v => v != null && !(Array.isArray(v) && v.length === 0));
}
// deep-flat + очистка null/[] — чтобы не торчали хвостовые null в AST
function flat(a){
  if (a == null) return [];
  const arr = Array.isArray(a) ? a.flat(Infinity) : [a];
  return arr.filter(v => v != null && !(Array.isArray(v) && v.length === 0));
}

// безопасное превращение произвольной вложенности «списка пар» в объект,
// НЕ разрушая сами пары [k,v]
function toObj(x){
  const pairs = [];
  (function walk(node){
    if (node == null) return;
    if (Array.isArray(node)){
      // это уже пара [k, v]
      if (node.length === 2 && (typeof node[0] === "string" || typeof node[0] === "number")){
        pairs.push([node[0], plain(node[1])]);
        return;
      }
      // иначе — обходим элементы, но пары не "расплющиваем"
      for (const it of node) walk(it);
      return;
    }
    if (typeof node === "object"){
      if ("key" in node && "value" in node){
        pairs.push([node.key, plain(node.value)]);
        return;
      }
      // посторонние объекты игнорируем
    }
    // скаляры игнорируем
  })(x);
  return Object.fromEntries(pairs);
}

// нормализация track-структуры в единый вид
function normTrack(entries){
  const obj = toObj(entries || []);
  const { event: rawEvent = null, props = {}, ...rest } = obj;
  const event = asEvent(rawEvent);

  const propsObj = (props && typeof props === "object") ? props : {};
  return { kind: "track", event, props: propsObj, ...rest };
}

//function isPairsArray(x){
//  return Array.isArray(x) && (
//    x.length === 0 ||
//    Array.isArray(x[0]) ||
//    (x[0] && typeof x[0] === "object" && "key" in x[0])
//  );
//}

function isPairsArray(x){
  if (!Array.isArray(x) || x.length === 0) return false;
  const f = x[0];
  // [[key, val], ...]  или  [{key, value}, ...]
  if (Array.isArray(f) && f.length === 2 && (typeof f[0] === "string" || typeof f[0] === "number")) return true;
  if (f && typeof f === "object" && "key" in f && "value" in f) return true;
  return false;
}

function unwrap(v){
  return (Array.isArray(v) && !isPairsArray(v) && v.length === 1) ? v[0] : v;
}

function plain(v){
  if (v == null) return v;
  if (Array.isArray(v)) return v.map(plain);
  if (typeof v === "object"){
    // пары KeyValLine {key, value} не трогаем здесь — это выше
    if ("value" in v && "key" in v && Object.keys(v).length === 2) return v;
    const out = {};
    for (const k of Object.keys(v)) out[k] = plain(v[k]);
    return out;
  }
  return v;
}

//function asEvent(e){ return Array.isArray(e) ? e[0] : e; }
function asEvent(e){
  if (e == null) return null;

  // 1) если массив — разворачиваем рекурсивно (на случай ["view_home"])
  if (Array.isArray(e)) return asEvent(e[0]);

  if (typeof e === "object"){
    // 2) если это пара {key, value} (KeyValLine) — берём value и разворачиваем дальше
    if ("key" in e && "value" in e) return asEvent(e.value);

    // 3) если это ссылка {ref: "..."} — возвращаем сам путь как имя события
    if ("ref" in e && typeof e.ref === "string") return e.ref;
  }

  // 4) иначе — уже строка (или что-то другое, что ты явно передал)
  return e;
}

function normNav(a){ return Array.isArray(a) ? Object.assign({}, ...a) : a; }

function unwrapDeep(v){
  let cur = v;
  // снимаем любые одноэлементные []-обёртки, но НЕ трогаем массивы пар ([["k",v], ...])
  while (Array.isArray(cur) && cur.length === 1 && !isPairsArray(cur)) cur = cur[0];
  return cur;
}

function normalizeArrItems(xs){
  xs = unwrapDeep(xs);                 // ← снимаем случайную [[…]]-обёртку
  if (!Array.isArray(xs)) return [];
  return xs.map(it => {
    // если уже объект — всё ок
    if (it && typeof it === "object" && !Array.isArray(it)) return plain(it);

    // снимем лишние одноэлементные обёртки: [[x]] → x
    let cur = it;
    while (Array.isArray(cur) && cur.length === 1) cur = cur[0];

    // кейс «сырой ArrObj»: [ headPairs, tailPairs|null ]
    if (Array.isArray(cur) && Array.isArray(cur[0])) {
      const headPairs = cur[0];
      const tailPairs = Array.isArray(cur[1]) ? cur[1] : [];
      return toObj([ headPairs, tailPairs ]);
    }

    return plain(cur);
  });
}


var grammar = {
    Lexer: lexer,
    ParserRules: [
    {"name": "Start", "symbols": ["Project"]},
    {"name": "NLs$ebnf$1$subexpression$1", "symbols": ["NEWLINE"]},
    {"name": "NLs$ebnf$1", "symbols": ["NLs$ebnf$1$subexpression$1"]},
    {"name": "NLs$ebnf$1$subexpression$2", "symbols": ["NEWLINE"]},
    {"name": "NLs$ebnf$1", "symbols": ["NLs$ebnf$1", "NLs$ebnf$1$subexpression$2"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "NLs", "symbols": ["NLs$ebnf$1"], "postprocess": d => null},
    {"name": "OptNL$ebnf$1", "symbols": []},
    {"name": "OptNL$ebnf$1$subexpression$1", "symbols": ["NEWLINE"]},
    {"name": "OptNL$ebnf$1", "symbols": ["OptNL$ebnf$1", "OptNL$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "OptNL", "symbols": ["OptNL$ebnf$1"], "postprocess": d => null},
    {"name": "CNLs$ebnf$1$subexpression$1", "symbols": ["_", "NEWLINE"]},
    {"name": "CNLs$ebnf$1", "symbols": ["CNLs$ebnf$1$subexpression$1"]},
    {"name": "CNLs$ebnf$1$subexpression$2", "symbols": ["_", "NEWLINE"]},
    {"name": "CNLs$ebnf$1", "symbols": ["CNLs$ebnf$1", "CNLs$ebnf$1$subexpression$2"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "CNLs", "symbols": ["CNLs$ebnf$1"], "postprocess": d => null},
    {"name": "OptCNL$ebnf$1", "symbols": []},
    {"name": "OptCNL$ebnf$1$subexpression$1", "symbols": ["_", "NEWLINE"]},
    {"name": "OptCNL$ebnf$1", "symbols": ["OptCNL$ebnf$1", "OptCNL$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "OptCNL", "symbols": ["OptCNL$ebnf$1"], "postprocess": d => null},
    {"name": "BlockOpen$ebnf$1", "symbols": []},
    {"name": "BlockOpen$ebnf$1$subexpression$1", "symbols": ["_", "NEWLINE"]},
    {"name": "BlockOpen$ebnf$1", "symbols": ["BlockOpen$ebnf$1", "BlockOpen$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "BlockOpen", "symbols": ["NEWLINE", "BlockOpen$ebnf$1", "INDENT"], "postprocess": d => null},
    {"name": "Project$ebnf$1", "symbols": []},
    {"name": "Project$ebnf$1$subexpression$1", "symbols": ["OptCNL", "TopDef"]},
    {"name": "Project$ebnf$1", "symbols": ["Project$ebnf$1", "Project$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "Project", "symbols": ["OptCNL", "TopDef", "Project$ebnf$1", "OptCNL"], "postprocess":  d =>
        ({ type:"project",
           defs: list([ d[1], ...(d[2] ? d[2].map(x => x[1]) : []) ]) })
          },
    {"name": "TopDefs$ebnf$1", "symbols": []},
    {"name": "TopDefs$ebnf$1$subexpression$1", "symbols": ["OptCNL", "TopDef"]},
    {"name": "TopDefs$ebnf$1", "symbols": ["TopDefs$ebnf$1", "TopDefs$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "TopDefs", "symbols": ["TopDef", "TopDefs$ebnf$1", "OptCNL"], "postprocess": d => [ d[0], ...(d[1]||[]).map(x=>x[1]) ]},
    {"name": "TopDef", "symbols": ["ImportDef"]},
    {"name": "TopDef", "symbols": ["ExportDef"]},
    {"name": "TopDef", "symbols": ["ScreenDef"]},
    {"name": "TopDef", "symbols": ["TemplateDef"]},
    {"name": "TopDef", "symbols": ["DataDef"]},
    {"name": "TopDef", "symbols": ["I18nDef"]},
    {"name": "TopDef", "symbols": ["AbDef"]},
    {"name": "RefPath$ebnf$1", "symbols": []},
    {"name": "RefPath$ebnf$1", "symbols": ["RefPath$ebnf$1", "RefSeg"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "RefPath", "symbols": ["ident", "RefPath$ebnf$1"], "postprocess": d => [d[0], ...(d[1]||[])].join("")},
    {"name": "RefSeg", "symbols": [{"literal":"."}, "ident"], "postprocess": d => "." + d[1]},
    {"name": "RefSeg", "symbols": ["lbrack", "number", "rbrack"], "postprocess": d => "[" + d[1] + "]"},
    {"name": "ImportDef$ebnf$1", "symbols": ["ImportAlias"], "postprocess": id},
    {"name": "ImportDef$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "ImportDef", "symbols": [(lexer.has("IMPORT") ? {type: "IMPORT"} : IMPORT), "_", "string", "ImportDef$ebnf$1"], "postprocess": d => ({ type:"import", path:d[2], alias: d[3] || null })},
    {"name": "ImportAlias", "symbols": ["_", (lexer.has("AS") ? {type: "AS"} : AS), "_", "ident"], "postprocess": d => d[3]},
    {"name": "ExportDef", "symbols": ["ExportTemplate"]},
    {"name": "ExportDef", "symbols": ["ExportBlock"]},
    {"name": "ExportTemplate", "symbols": [(lexer.has("EXPORT") ? {type: "EXPORT"} : EXPORT), "_", (lexer.has("TEMPLATE") ? {type: "TEMPLATE"} : TEMPLATE), "_", "ident", "_", {"literal":":"}, "_", "BlockOpen", "TemplateItems", "DEDENT"], "postprocess": d => ({ type:"export_template", name:d[4], items:list(d[9]) })},
    {"name": "ExportBlock", "symbols": [(lexer.has("EXPORT") ? {type: "EXPORT"} : EXPORT), "_", (lexer.has("COMPONENT") ? {type: "COMPONENT"} : COMPONENT), "_", "ident", "_", {"literal":":"}, "_", "BlockOpen", "ComponentItems", "DEDENT"], "postprocess": d => ({ type:"export_block", name:d[4], items:list(d[9]) })},
    {"name": "IncludeLine$ebnf$1", "symbols": ["IncludeWithOpt"], "postprocess": id},
    {"name": "IncludeLine$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "IncludeLine", "symbols": [(lexer.has("INCLUDE") ? {type: "INCLUDE"} : INCLUDE), "_", "IncludeRef", "IncludeLine$ebnf$1"], "postprocess":  d => {
            const node = { type:"include", ref:d[2] };
            if (d[3]) node.locals = d[3];   // { product:{ref:"..."}, ... }
            return node;
        } },
    {"name": "IncludeRef", "symbols": ["key"], "postprocess": d => d[0]},
    {"name": "IncludeWithOpt$subexpression$1", "symbols": ["IncludeWithBlock"]},
    {"name": "IncludeWithOpt$subexpression$1", "symbols": ["IncludeWithInline"]},
    {"name": "IncludeWithOpt", "symbols": ["_", (lexer.has("WITH") ? {type: "WITH"} : WITH), "_", {"literal":":"}, "_", "IncludeWithOpt$subexpression$1"], "postprocess": d => d[5]},
    {"name": "IncludeWithBlock$ebnf$1", "symbols": ["IncludeEntryLines"], "postprocess": id},
    {"name": "IncludeWithBlock$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "IncludeWithBlock", "symbols": ["BlockOpen", "OptCNL", "IncludeWithBlock$ebnf$1", "OptCNL", "DEDENT"], "postprocess": d => toObj(d[2] || [])},
    {"name": "IncludeWithInline", "symbols": ["IncludeInlinePairs"], "postprocess": d => toObj(d[0])},
    {"name": "IncludeEntryLines$ebnf$1", "symbols": []},
    {"name": "IncludeEntryLines$ebnf$1$subexpression$1", "symbols": ["OptCNL", "IncludeEntryLine"]},
    {"name": "IncludeEntryLines$ebnf$1", "symbols": ["IncludeEntryLines$ebnf$1", "IncludeEntryLines$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "IncludeEntryLines", "symbols": ["IncludeEntryLine", "IncludeEntryLines$ebnf$1", "OptCNL"], "postprocess": d => [ d[0], ...(d[1] ? d[1].map(x=>x[1]) : []) ]},
    {"name": "IncludeEntryLine", "symbols": ["key", "_", {"literal":":"}, "_", "IncludeVal", "_"], "postprocess": d => ({ key:d[0], value:d[4] })},
    {"name": "IncludeInlinePairs$ebnf$1", "symbols": []},
    {"name": "IncludeInlinePairs$ebnf$1$subexpression$1", "symbols": ["_", {"literal":","}, "_", "IncludeInlinePair"]},
    {"name": "IncludeInlinePairs$ebnf$1", "symbols": ["IncludeInlinePairs$ebnf$1", "IncludeInlinePairs$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "IncludeInlinePairs$ebnf$2$subexpression$1", "symbols": ["_", {"literal":","}]},
    {"name": "IncludeInlinePairs$ebnf$2", "symbols": ["IncludeInlinePairs$ebnf$2$subexpression$1"], "postprocess": id},
    {"name": "IncludeInlinePairs$ebnf$2", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "IncludeInlinePairs", "symbols": ["IncludeInlinePair", "IncludeInlinePairs$ebnf$1", "IncludeInlinePairs$ebnf$2"], "postprocess": d => [ d[0], ...(d[1] ? d[1].map(x=>x[3]) : []) ]},
    {"name": "IncludeInlinePair", "symbols": ["key", "_", {"literal":":"}, "_", "IncludeVal"], "postprocess": d => [ d[0], d[4] ]},
    {"name": "IncludeVal", "symbols": ["RefPath"], "postprocess": d => ({ ref: d[0] })},
    {"name": "IncludeVal", "symbols": ["Value"], "postprocess": d => ({ value: unwrapDeep(d[0]) })},
    {"name": "I18nDef", "symbols": [(lexer.has("I18N") ? {type: "I18N"} : I18N), "_", "locale", "_", {"literal":":"}, "_", "BlockOpen", "I18nEntries", "DEDENT"], "postprocess": d => ({ type:"i18n", locale:d[2], entries:d[7] })},
    {"name": "I18nEntries$ebnf$1", "symbols": ["I18nEntryList"], "postprocess": id},
    {"name": "I18nEntries$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "I18nEntries", "symbols": ["I18nEntries$ebnf$1"], "postprocess": d => d[0] || []},
    {"name": "I18nEntryList$ebnf$1", "symbols": []},
    {"name": "I18nEntryList$ebnf$1$subexpression$1", "symbols": ["CNLs", "I18nEntry"]},
    {"name": "I18nEntryList$ebnf$1", "symbols": ["I18nEntryList$ebnf$1", "I18nEntryList$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "I18nEntryList", "symbols": ["I18nEntry", "I18nEntryList$ebnf$1", "OptCNL"], "postprocess": d => [ d[0], ...(d[1]||[]).map(x=>x[1]) ]},
    {"name": "I18nEntry", "symbols": ["key", "_", {"literal":":"}, "_", "string"], "postprocess": d => ({ key:d[0], value:d[4] })},
    {"name": "DataDef", "symbols": [(lexer.has("DATA") ? {type: "DATA"} : DATA), "_", "ident", "_", {"literal":":"}, "_", "BlockOpen", "DataSource", "DEDENT"], "postprocess": d => ({ type:"data", name:d[2], source:d[7] })},
    {"name": "DataSource", "symbols": [{"literal":"endpoint"}, "_", {"literal":":"}, "_", "string"], "postprocess": d => ({ kind:"endpoint", url:d[4] })},
    {"name": "DataSource$subexpression$1", "symbols": ["ObjBlock"]},
    {"name": "DataSource$subexpression$1", "symbols": ["object"]},
    {"name": "DataSource", "symbols": [{"literal":"inline"}, "_", {"literal":":"}, "_", "DataSource$subexpression$1"], "postprocess": d => ({ kind:"inline",   value: unwrapDeep(d[4]) })},
    {"name": "DataSource", "symbols": [{"literal":"fixture"}, "_", {"literal":":"}, "_", "ObjBlock"], "postprocess": d => ({ kind:"fixture",  value:d[4] })},
    {"name": "AbDef", "symbols": [(lexer.has("AB") ? {type: "AB"} : AB), "_", "ident", "_", {"literal":":"}, "_", "BlockOpen", "VariantDefs", "DEDENT"], "postprocess": d => normalizeAbNode({ type:"ab", name:d[2], variants:d[7] })},
    {"name": "VariantDefs$ebnf$1", "symbols": ["VariantDefList"], "postprocess": id},
    {"name": "VariantDefs$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "VariantDefs", "symbols": ["VariantDefs$ebnf$1"], "postprocess": d => d[0] || []},
    {"name": "VariantDefList$ebnf$1", "symbols": []},
    {"name": "VariantDefList$ebnf$1$subexpression$1", "symbols": ["OptCNL", "VariantDef"]},
    {"name": "VariantDefList$ebnf$1", "symbols": ["VariantDefList$ebnf$1", "VariantDefList$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "VariantDefList", "symbols": ["VariantDef", "VariantDefList$ebnf$1", "OptCNL"], "postprocess": d => [ d[0], ...(d[1]||[]).map(x=>x[1]) ]},
    {"name": "VariantDef$ebnf$1", "symbols": ["Weight"], "postprocess": id},
    {"name": "VariantDef$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "VariantDef", "symbols": [(lexer.has("VARIANT") ? {type: "VARIANT"} : VARIANT), "_", "ident", "_", "VariantDef$ebnf$1", "_", {"literal":":"}, "_", "NEWLINE", "INDENT", "VariantItems", "DEDENT"], "postprocess": d => ({ type:"variant", name:d[2], weight:(d[4] ?? null), items:list(d[10]) })},
    {"name": "Weight", "symbols": ["number", (lexer.has("percent") ? {type: "percent"} : percent)], "postprocess": d => ({ kind:"percent", value:d[0] })},
    {"name": "Weight", "symbols": [{"literal":"("}, "_", "number", (lexer.has("percent") ? {type: "percent"} : percent), "_", {"literal":")"}], "postprocess": d => ({ kind:"percent", value:d[2] })},
    {"name": "Weight", "symbols": ["number"], "postprocess": d => ({ kind:"share",   value:d[0] })},
    {"name": "Weight", "symbols": [{"literal":"("}, "_", "number", "_", {"literal":")"}], "postprocess": d => ({ kind:"share",   value:d[2] })},
    {"name": "VariantItems$ebnf$1", "symbols": ["VariantItemList"], "postprocess": id},
    {"name": "VariantItems$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "VariantItems", "symbols": ["VariantItems$ebnf$1"], "postprocess": d => list(d[0])},
    {"name": "VariantItemList$ebnf$1", "symbols": []},
    {"name": "VariantItemList$ebnf$1$subexpression$1", "symbols": ["OptCNL", "VariantItem"]},
    {"name": "VariantItemList$ebnf$1", "symbols": ["VariantItemList$ebnf$1", "VariantItemList$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "VariantItemList", "symbols": ["VariantItem", "VariantItemList$ebnf$1", "OptCNL"], "postprocess": d => list([ d[0], ...(d[1] ? d[1].map(x=>x[1]) : []) ])},
    {"name": "VariantItem", "symbols": ["ComponentDef"]},
    {"name": "VariantItem", "symbols": ["AreaDef"]},
    {"name": "VariantItem", "symbols": ["WhenBlock"]},
    {"name": "VariantItem", "symbols": ["OnBlock"]},
    {"name": "VariantItem", "symbols": ["Track"]},
    {"name": "VariantItem", "symbols": ["PropLine"]},
    {"name": "VariantItem", "symbols": ["IncludeLine"]},
    {"name": "VariantItem", "symbols": ["I18nDef"]},
    {"name": "TemplateDef", "symbols": [(lexer.has("TEMPLATE") ? {type: "TEMPLATE"} : TEMPLATE), "_", "ident", "_", {"literal":":"}, "_", "BlockOpen", "TemplateItems", "DEDENT"], "postprocess": d => ({ type:"template", name:d[2], items:list(d[7]) })},
    {"name": "TemplateItems$ebnf$1$subexpression$1", "symbols": ["OptCNL", "TemplateItem"]},
    {"name": "TemplateItems$ebnf$1", "symbols": ["TemplateItems$ebnf$1$subexpression$1"]},
    {"name": "TemplateItems$ebnf$1$subexpression$2", "symbols": ["OptCNL", "TemplateItem"]},
    {"name": "TemplateItems$ebnf$1", "symbols": ["TemplateItems$ebnf$1", "TemplateItems$ebnf$1$subexpression$2"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "TemplateItems", "symbols": ["TemplateItems$ebnf$1", "OptCNL"], "postprocess": d => list((d[0] || []).map(x => x[1]))},
    {"name": "TemplateItem", "symbols": ["AreaDef"]},
    {"name": "TemplateItem", "symbols": ["ComponentDef"]},
    {"name": "TemplateItem", "symbols": ["WhenBlock"]},
    {"name": "TemplateItem", "symbols": ["OnBlock"]},
    {"name": "TemplateItem", "symbols": ["Track"]},
    {"name": "TemplateItem", "symbols": ["IncludeLine"]},
    {"name": "TemplateItem", "symbols": ["AbDef"]},
    {"name": "AreaDefs$ebnf$1", "symbols": ["AreaDefList"], "postprocess": id},
    {"name": "AreaDefs$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "AreaDefs", "symbols": ["AreaDefs$ebnf$1"], "postprocess": d => list(d[0])},
    {"name": "AreaDefList$ebnf$1", "symbols": []},
    {"name": "AreaDefList$ebnf$1$subexpression$1", "symbols": ["CNLs", "AreaDef"]},
    {"name": "AreaDefList$ebnf$1", "symbols": ["AreaDefList$ebnf$1", "AreaDefList$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "AreaDefList", "symbols": ["AreaDef", "AreaDefList$ebnf$1", "OptCNL"], "postprocess": d => list([ d[0], ...(d[1] ? d[1].map(x=>x[1]) : []) ])},
    {"name": "ScreenDef$ebnf$1", "symbols": ["NLs"], "postprocess": id},
    {"name": "ScreenDef$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "ScreenDef", "symbols": [(lexer.has("SCREEN") ? {type: "SCREEN"} : SCREEN), "_", "ident", {"literal":":"}, "_", "ScreenDef$ebnf$1", "INDENT", "ScreenItems", "DEDENT"], "postprocess": d => ({ type:"screen", name:d[2], items:list(d[7]) })},
    {"name": "ScreenExt", "symbols": ["_", (lexer.has("EXTENDS") ? {type: "EXTENDS"} : EXTENDS), "_", "ident"], "postprocess": d => d[3]},
    {"name": "ScreenBody$ebnf$1", "symbols": ["NLs"], "postprocess": id},
    {"name": "ScreenBody$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "ScreenBody", "symbols": ["ScreenBody$ebnf$1", "INDENT", "ScreenItems", "DEDENT"]},
    {"name": "ScreenItems$ebnf$1$subexpression$1", "symbols": ["OptCNL", "ScreenItem"]},
    {"name": "ScreenItems$ebnf$1", "symbols": ["ScreenItems$ebnf$1$subexpression$1"]},
    {"name": "ScreenItems$ebnf$1$subexpression$2", "symbols": ["OptCNL", "ScreenItem"]},
    {"name": "ScreenItems$ebnf$1", "symbols": ["ScreenItems$ebnf$1", "ScreenItems$ebnf$1$subexpression$2"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "ScreenItems", "symbols": ["ScreenItems$ebnf$1", "OptCNL"], "postprocess": d => list((d[0] || []).map(x => x[1]))},
    {"name": "ScreenItemList$ebnf$1", "symbols": []},
    {"name": "ScreenItemList$ebnf$1$subexpression$1", "symbols": ["ScreenItem", "OptNL"]},
    {"name": "ScreenItemList$ebnf$1", "symbols": ["ScreenItemList$ebnf$1", "ScreenItemList$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "ScreenItemList", "symbols": ["ScreenItemList$ebnf$1"], "postprocess": d => d.map(x=>x[0])},
    {"name": "ScreenItem", "symbols": ["AreaDef"]},
    {"name": "ScreenItem", "symbols": ["ComponentDef"]},
    {"name": "ScreenItem", "symbols": ["WhenBlock"]},
    {"name": "ScreenItem", "symbols": ["OnBlock"]},
    {"name": "ScreenItem", "symbols": ["Track"]},
    {"name": "ScreenItem", "symbols": ["ParamLine"]},
    {"name": "ScreenItem", "symbols": ["UseData"]},
    {"name": "ScreenItem", "symbols": ["IncludeLine"]},
    {"name": "ScreenItem", "symbols": ["AbDef"]},
    {"name": "UseData", "symbols": [(lexer.has("USE") ? {type: "USE"} : USE), "_", (lexer.has("DATA") ? {type: "DATA"} : DATA), "_", "IdList"], "postprocess": d => ({ type:"useData", names:d[4] })},
    {"name": "ParamLine", "symbols": [(lexer.has("PARAM") ? {type: "PARAM"} : PARAM), "_", "ident"], "postprocess": d => ({ type:"param", name:d[2] })},
    {"name": "AreaDef$ebnf$1", "symbols": ["Layout"], "postprocess": id},
    {"name": "AreaDef$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "AreaDef", "symbols": [(lexer.has("AREA") ? {type: "AREA"} : AREA), "_", "ident", "_", {"literal":":"}, "_", "AreaDef$ebnf$1", "BlockOpen", "AreaItems", "DEDENT"], "postprocess": d => ({ type:"area", name:d[2], layout:(d[6] ?? null), items:list(d[8]) })},
    {"name": "Layout", "symbols": [(lexer.has("ROW") ? {type: "ROW"} : ROW)], "postprocess": d => ({ kind:"row" })},
    {"name": "Layout", "symbols": [(lexer.has("COL") ? {type: "COL"} : COL)], "postprocess": d => ({ kind:"col" })},
    {"name": "Layout$ebnf$1$subexpression$1", "symbols": [{"literal":","}, {"literal":"gap"}, {"literal":"="}, "number"]},
    {"name": "Layout$ebnf$1", "symbols": ["Layout$ebnf$1$subexpression$1"], "postprocess": id},
    {"name": "Layout$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "Layout", "symbols": [(lexer.has("GRID") ? {type: "GRID"} : GRID), {"literal":"("}, {"literal":"cols"}, {"literal":"="}, "number", "Layout$ebnf$1", {"literal":")"}], "postprocess": d => ({ kind:"grid", cols:d[5], gap:(d[7]?d[7][3]:null) })},
    {"name": "AreaItems$ebnf$1", "symbols": ["AreaItemList"], "postprocess": id},
    {"name": "AreaItems$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "AreaItems", "symbols": ["AreaItems$ebnf$1"], "postprocess": d => list(d[0])},
    {"name": "AreaItemList$ebnf$1", "symbols": []},
    {"name": "AreaItemList$ebnf$1$subexpression$1", "symbols": ["OptCNL", "AreaItem"]},
    {"name": "AreaItemList$ebnf$1", "symbols": ["AreaItemList$ebnf$1", "AreaItemList$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "AreaItemList", "symbols": ["AreaItemList$ebnf$1", "OptCNL"], "postprocess": d => list(((d[0] || [])).map(x => x[1]))},
    {"name": "AreaItem", "symbols": ["ComponentDef"]},
    {"name": "AreaItem", "symbols": ["AreaDef"]},
    {"name": "AreaItem", "symbols": ["WhenBlock"]},
    {"name": "AreaItem", "symbols": ["Track"]},
    {"name": "AreaItem", "symbols": ["OnBlock"]},
    {"name": "AreaItem", "symbols": ["PropLine"]},
    {"name": "AreaItem", "symbols": ["IncludeLine"]},
    {"name": "AreaItem", "symbols": ["AbDef"]},
    {"name": "TypeName", "symbols": ["ident"], "postprocess": d => d[0]},
    {"name": "TypeName", "symbols": [(lexer.has("ROW") ? {type: "ROW"} : ROW)], "postprocess": d => "row"},
    {"name": "TypeName", "symbols": [(lexer.has("COL") ? {type: "COL"} : COL)], "postprocess": d => "col"},
    {"name": "TypeName", "symbols": [(lexer.has("GRID") ? {type: "GRID"} : GRID)], "postprocess": d => "grid"},
    {"name": "ComponentDef$ebnf$1", "symbols": ["ident"], "postprocess": id},
    {"name": "ComponentDef$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "ComponentDef", "symbols": [(lexer.has("COMPONENT") ? {type: "COMPONENT"} : COMPONENT), "_", "TypeName", "_", "ComponentDef$ebnf$1", "_", {"literal":":"}, "_", "BlockOpen", "ComponentItems", "DEDENT"], "postprocess": d => ({ type:"component", ctype:d[2], cid:(d[4]||null), items:list(d[9]) })},
    {"name": "ComponentItems$ebnf$1", "symbols": ["ComponentItemList"], "postprocess": id},
    {"name": "ComponentItems$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "ComponentItems", "symbols": ["ComponentItems$ebnf$1"], "postprocess": d => list(d[0])},
    {"name": "ComponentItemList$ebnf$1", "symbols": []},
    {"name": "ComponentItemList$ebnf$1$subexpression$1", "symbols": ["OptCNL", "ComponentItem"]},
    {"name": "ComponentItemList$ebnf$1", "symbols": ["ComponentItemList$ebnf$1", "ComponentItemList$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "ComponentItemList", "symbols": ["ComponentItemList$ebnf$1", "OptCNL"], "postprocess": d => list(((d[0] || [])).map(x => x[1]))},
    {"name": "ComponentItem", "symbols": ["PropLine"]},
    {"name": "ComponentItem", "symbols": ["BindBlock"]},
    {"name": "ComponentItem", "symbols": ["WhenBlock"]},
    {"name": "ComponentItem", "symbols": ["OnBlock"]},
    {"name": "ComponentItem", "symbols": ["Track"]},
    {"name": "ComponentItem", "symbols": ["AreaDef"]},
    {"name": "ComponentItem", "symbols": ["IncludeLine"]},
    {"name": "ComponentItem", "symbols": ["ComponentDef"]},
    {"name": "PropLine", "symbols": [{"literal":"prop"}, "_", "ident", "_", {"literal":":"}, "_", "Value"], "postprocess": d => ({ kind:"prop", key:d[2], value:d[6] })},
    {"name": "PropLine", "symbols": ["ident", "_", {"literal":":"}, "_", "Value"], "postprocess": d => ({ kind:"prop", key:d[0], value:d[4] })},
    {"name": "BindBlock", "symbols": ["BindBlockLines"]},
    {"name": "BindBlock", "symbols": ["BindBlockObj"]},
    {"name": "BindBlock", "symbols": ["BindBlockCsv"]},
    {"name": "BindBlockLines$ebnf$1", "symbols": ["BindEntryList"], "postprocess": id},
    {"name": "BindBlockLines$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "BindBlockLines", "symbols": [(lexer.has("BIND") ? {type: "BIND"} : BIND), "_", {"literal":":"}, "_", "BlockOpen", "OptCNL", "BindBlockLines$ebnf$1", "OptCNL", "DEDENT"], "postprocess":  d => ({
          kind: "bind",
          entries: toObj(d[6] || [])
        }) },
    {"name": "BindEntryList$ebnf$1", "symbols": []},
    {"name": "BindEntryList$ebnf$1$subexpression$1", "symbols": ["OptCNL", "BindEntry"]},
    {"name": "BindEntryList$ebnf$1", "symbols": ["BindEntryList$ebnf$1", "BindEntryList$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "BindEntryList", "symbols": ["BindEntry", "BindEntryList$ebnf$1", "OptCNL"], "postprocess": d => [ d[0], ...(d[1]||[]).map(x=>x[1]) ]},
    {"name": "BindEntry", "symbols": ["BindEntryBlock"]},
    {"name": "BindEntry", "symbols": ["BindEntryInline"]},
    {"name": "BindEntryBlock", "symbols": ["key", "_", {"literal":":"}, "_", "BindObjBlock", "_"], "postprocess": d => ({ key:d[0], value:d[4] })},
    {"name": "BindEntryInline$ebnf$1$subexpression$1", "symbols": ["_", "NEWLINE"]},
    {"name": "BindEntryInline$ebnf$1", "symbols": ["BindEntryInline$ebnf$1$subexpression$1"], "postprocess": id},
    {"name": "BindEntryInline$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "BindEntryInline", "symbols": ["key", "_", {"literal":":"}, "_", "BindInlineVal", "BindEntryInline$ebnf$1"], "postprocess": d => ({ key:d[0], value:d[4] })},
    {"name": "BindInlineVal", "symbols": ["string"], "postprocess": d => d[0]},
    {"name": "BindInlineVal", "symbols": ["number"], "postprocess": d => d[0]},
    {"name": "BindInlineVal", "symbols": ["bool"], "postprocess": d => d[0]},
    {"name": "BindInlineVal", "symbols": ["Ref"], "postprocess": d => d[0]},
    {"name": "BindObjBlock$ebnf$1", "symbols": ["BindObjLines"], "postprocess": id},
    {"name": "BindObjBlock$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "BindObjBlock", "symbols": ["BlockOpen", "BindObjBlock$ebnf$1", "OptCNL", "DEDENT"], "postprocess": d => toObj(d[1] || [])},
    {"name": "BindObjLines$ebnf$1", "symbols": []},
    {"name": "BindObjLines$ebnf$1$subexpression$1", "symbols": ["CNLs", "BindObjLine"]},
    {"name": "BindObjLines$ebnf$1", "symbols": ["BindObjLines$ebnf$1", "BindObjLines$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "BindObjLines", "symbols": ["BindObjLine", "BindObjLines$ebnf$1", "OptCNL"], "postprocess": d => [ d[0], ...(d[1]||[]).map(x=>x[1]) ]},
    {"name": "BindObjLine", "symbols": [{"literal":"ref"}, "_", {"literal":":"}, "_", "RefPath"], "postprocess": d => ["ref", d[4]]},
    {"name": "BindObjLine$subexpression$1", "symbols": ["string"]},
    {"name": "BindObjLine$subexpression$1", "symbols": ["ident"]},
    {"name": "BindObjLine", "symbols": [{"literal":"mode"}, "_", {"literal":":"}, "_", "BindObjLine$subexpression$1"], "postprocess": d => ["mode", unwrapDeep(d[4])]},
    {"name": "BindObjLine$subexpression$2", "symbols": ["string"]},
    {"name": "BindObjLine$subexpression$2", "symbols": ["number"]},
    {"name": "BindObjLine$subexpression$2", "symbols": ["bool"]},
    {"name": "BindObjLine$subexpression$2", "symbols": ["object"]},
    {"name": "BindObjLine$subexpression$2", "symbols": ["array"]},
    {"name": "BindObjLine", "symbols": [{"literal":"value"}, "_", {"literal":":"}, "_", "BindObjLine$subexpression$2"], "postprocess": d => ["value", d[4]]},
    {"name": "BindBlockObj$ebnf$1", "symbols": ["BindObjPairs"], "postprocess": id},
    {"name": "BindBlockObj$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "BindBlockObj", "symbols": [(lexer.has("BIND") ? {type: "BIND"} : BIND), "_", {"literal":":"}, "_", "lbrace", "_", "BindBlockObj$ebnf$1", "_", "rbrace"], "postprocess": d => ({ kind:"bind", entries: toObj(d[6] || []) })},
    {"name": "BindObjPairs$ebnf$1", "symbols": []},
    {"name": "BindObjPairs$ebnf$1$subexpression$1", "symbols": ["_", {"literal":","}, "_", "BindObjPair"]},
    {"name": "BindObjPairs$ebnf$1", "symbols": ["BindObjPairs$ebnf$1", "BindObjPairs$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "BindObjPairs$ebnf$2$subexpression$1", "symbols": ["_", {"literal":","}]},
    {"name": "BindObjPairs$ebnf$2", "symbols": ["BindObjPairs$ebnf$2$subexpression$1"], "postprocess": id},
    {"name": "BindObjPairs$ebnf$2", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "BindObjPairs", "symbols": ["BindObjPair", "BindObjPairs$ebnf$1", "BindObjPairs$ebnf$2"], "postprocess": d => [ d[0], ...(d[1] ? d[1].map(x=>x[3]) : []) ]},
    {"name": "BindObjPair", "symbols": ["key", "_", {"literal":":"}, "_", "BindInlineVal"], "postprocess": d => [ d[0], d[4] ]},
    {"name": "BindObjPair$ebnf$1", "symbols": ["BindObjPairs"], "postprocess": id},
    {"name": "BindObjPair$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "BindObjPair", "symbols": ["key", "_", {"literal":":"}, "_", "lbrace", "_", "BindObjPair$ebnf$1", "_", "rbrace"], "postprocess": d => [ d[0], Object.fromEntries(d[6] || []) ]},
    {"name": "BindObjPair", "symbols": ["key", "_", {"literal":":"}, "_", "BindObjBlock"], "postprocess": d => [ d[0], d[4] ]},
    {"name": "BindBlockCsv", "symbols": [(lexer.has("BIND") ? {type: "BIND"} : BIND), "_", {"literal":":"}, "_", "BindCsvPairs"], "postprocess": d => ({ kind:"bind", entries: toObj(d[4]) })},
    {"name": "BindCsvPairs$ebnf$1", "symbols": []},
    {"name": "BindCsvPairs$ebnf$1$subexpression$1", "symbols": ["_", {"literal":","}, "_", "BindCsvPair"]},
    {"name": "BindCsvPairs$ebnf$1", "symbols": ["BindCsvPairs$ebnf$1", "BindCsvPairs$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "BindCsvPairs$ebnf$2$subexpression$1", "symbols": ["_", {"literal":","}]},
    {"name": "BindCsvPairs$ebnf$2", "symbols": ["BindCsvPairs$ebnf$2$subexpression$1"], "postprocess": id},
    {"name": "BindCsvPairs$ebnf$2", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "BindCsvPairs", "symbols": ["BindCsvPair", "BindCsvPairs$ebnf$1", "BindCsvPairs$ebnf$2"], "postprocess": d => [ d[0], ...(d[1] ? d[1].map(x=>x[3]) : []) ]},
    {"name": "BindCsvPair", "symbols": ["key", "_", {"literal":":"}, "_", "BindInlineVal"], "postprocess": d => [ d[0], d[4] ]},
    {"name": "BindCsvPair", "symbols": ["key", "_", {"literal":":"}, "_", "BindObjBlock"], "postprocess": d => [ d[0], d[4] ]},
    {"name": "WhenBlock", "symbols": [(lexer.has("WHEN") ? {type: "WHEN"} : WHEN), "_", "Expr", "_", {"literal":":"}, "_", "BlockOpen", "WhenItems", "DEDENT"], "postprocess": d => ({ kind:"when", expr:d[2], items:list(d[7]) })},
    {"name": "WhenItems$ebnf$1", "symbols": ["WhenItemList"], "postprocess": id},
    {"name": "WhenItems$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "WhenItems", "symbols": ["WhenItems$ebnf$1"], "postprocess": d => list(d[0])},
    {"name": "WhenItemList$ebnf$1", "symbols": []},
    {"name": "WhenItemList$ebnf$1$subexpression$1", "symbols": ["OptCNL", "WhenItem"]},
    {"name": "WhenItemList$ebnf$1", "symbols": ["WhenItemList$ebnf$1", "WhenItemList$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "WhenItemList", "symbols": ["WhenItemList$ebnf$1", "OptCNL"], "postprocess": d => list(((d[0] || [])).map(x => x[1]))},
    {"name": "WhenItem", "symbols": ["ComponentDef"]},
    {"name": "WhenItem", "symbols": ["AreaDef"]},
    {"name": "WhenItem", "symbols": ["PropLine"]},
    {"name": "WhenItem", "symbols": ["OnBlock"]},
    {"name": "WhenItem", "symbols": ["Track"]},
    {"name": "WhenItem", "symbols": ["IncludeLine"]},
    {"name": "OnBlock", "symbols": [(lexer.has("ON") ? {type: "ON"} : ON), "_", "ident", "_", {"literal":":"}, "_", "BlockOpen", "ActionLines", "DEDENT"], "postprocess": d => ({ kind:"on", event:d[2], actions:d[7] })},
    {"name": "ActionLines$ebnf$1", "symbols": []},
    {"name": "ActionLines$ebnf$1$subexpression$1", "symbols": ["CNLs", "ActionLine"]},
    {"name": "ActionLines$ebnf$1", "symbols": ["ActionLines$ebnf$1", "ActionLines$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "ActionLines", "symbols": ["ActionLine", "ActionLines$ebnf$1", "OptCNL"], "postprocess": d => list([ d[0], ...((d[1]||[]).map(x => x[1])) ])},
    {"name": "ActionLine", "symbols": [{"literal":"navigate"}, {"literal":"("}, "NavigateArgs", {"literal":")"}], "postprocess": d => ({ type:"navigate", args: normNav(d[2]) })},
    {"name": "ActionLine", "symbols": [{"literal":"record"}, {"literal":"("}, "KeyVals", {"literal":")"}], "postprocess": d => ({ type:"record",   args:d[2] })},
    {"name": "ActionLine", "symbols": [{"literal":"record"}, {"literal":"("}, "Value", {"literal":")"}], "postprocess": d => ({ type:"record",   args:{ event: d[2] } })},
    {"name": "ActionLine", "symbols": [{"literal":"emit"}, {"literal":"("}, "KeyVals", {"literal":")"}], "postprocess": d => ({ type:"emit",     args:d[2] })},
    {"name": "NavigateArgs", "symbols": ["NavigateToArgs"]},
    {"name": "NavigateArgs", "symbols": ["NavigateBackArgs"]},
    {"name": "NavigateArgs", "symbols": ["NavigatePopToArgs"]},
    {"name": "NavigateArgs", "symbols": ["NavigateResetArgs"]},
    {"name": "NavigateArgs", "symbols": ["NavigateDismissArgs"]},
    {"name": "NavigateArgs", "symbols": ["NavigateTabArgs"]},
    {"name": "NavigateToArgs$ebnf$1", "symbols": []},
    {"name": "NavigateToArgs$ebnf$1$subexpression$1", "symbols": ["_", {"literal":","}, "_", "NavMod"]},
    {"name": "NavigateToArgs$ebnf$1", "symbols": ["NavigateToArgs$ebnf$1", "NavigateToArgs$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "NavigateToArgs", "symbols": ["ToArg", "NavigateToArgs$ebnf$1"], "postprocess": d => Object.assign({}, d[0], ...((d[1]||[]).map(x=>x[3])))},
    {"name": "ToArg", "symbols": [{"literal":"to"}, "_", {"literal":":"}, "_", "ScreenRef"], "postprocess": d => ({ to: d[4] })},
    {"name": "NavMod", "symbols": ["ParamsArg"]},
    {"name": "NavMod", "symbols": ["ReplaceArg"]},
    {"name": "NavMod", "symbols": ["ModeArg"]},
    {"name": "NavMod", "symbols": ["TransitionArg"]},
    {"name": "NavMod", "symbols": ["ExpectResultArg"]},
    {"name": "ParamsArg", "symbols": [{"literal":"params"}, "_", {"literal":":"}, "_", "object"], "postprocess": d => ({ params: d[4] })},
    {"name": "ReplaceArg", "symbols": [{"literal":"replace"}, "_", {"literal":":"}, "_", "bool"], "postprocess": d => ({ replace: d[4] })},
    {"name": "ModeArg", "symbols": [{"literal":"mode"}, "_", {"literal":":"}, "_", "Mode"], "postprocess": d => ({ mode: d[4] })},
    {"name": "TransitionArg", "symbols": [{"literal":"transition"}, "_", {"literal":":"}, "_", "string"], "postprocess": d => ({ transition: d[4] })},
    {"name": "ExpectResultArg", "symbols": [{"literal":"expect_result"}, "_", {"literal":":"}, "_", "bool"], "postprocess": d => ({ expect_result: d[4] })},
    {"name": "Mode", "symbols": [{"literal":"modal"}]},
    {"name": "Mode", "symbols": [{"literal":"push"}], "postprocess": d => d[0]},
    {"name": "ScreenRef", "symbols": ["ident"]},
    {"name": "ScreenRef", "symbols": ["string"], "postprocess": d => d[0]},
    {"name": "NavigateBackArgs", "symbols": ["BackArg"], "postprocess": d => d[0]},
    {"name": "BackArg", "symbols": [{"literal":"back"}, "_", {"literal":":"}, "_", "number"], "postprocess": d => ({ back: d[4] })},
    {"name": "NavigatePopToArgs", "symbols": ["PopToArg"], "postprocess": d => d[0]},
    {"name": "PopToArg", "symbols": [{"literal":"pop_to"}, "_", {"literal":":"}, "_", "ScreenRef"], "postprocess": d => ({ pop_to: d[4] })},
    {"name": "NavigateResetArgs", "symbols": ["ResetArg"], "postprocess": d => d[0]},
    {"name": "ResetArg", "symbols": [{"literal":"reset"}, "_", {"literal":":"}, "_", "bool"], "postprocess": d => ({ reset: d[4] })},
    {"name": "NavigateDismissArgs", "symbols": ["DismissArg"], "postprocess": d => d[0]},
    {"name": "DismissArg", "symbols": [{"literal":"dismiss"}, "_", {"literal":":"}, "_", "bool"], "postprocess": d => ({ dismiss: d[4] })},
    {"name": "NavigateTabArgs", "symbols": ["TabArg"], "postprocess": d => d[0]},
    {"name": "TabArg", "symbols": [{"literal":"tab"}, "_", {"literal":":"}, "_", "ScreenRef"], "postprocess": d => ({ tab: d[4] })},
    {"name": "Track", "symbols": ["TrackBlock"]},
    {"name": "Track", "symbols": ["TrackInline"]},
    {"name": "Track", "symbols": ["TrackHeadBlock"]},
    {"name": "Track", "symbols": ["TrackHeadInline"]},
    {"name": "TrackEvent", "symbols": ["key"]},
    {"name": "TrackEvent", "symbols": ["string"], "postprocess": d => d[0]},
    {"name": "HeadExtras", "symbols": [{"literal":"("}, "_", "KeyValList", "_", {"literal":")"}], "postprocess": d => toObj(d[2])},
    {"name": "TrackProps", "symbols": ["KeyValList"], "postprocess": d => toObj(d[0])},
    {"name": "TrackProps", "symbols": ["KeyValLineList"], "postprocess": d => toObj(d[0])},
    {"name": "TrackProps", "symbols": ["ObjBlock"], "postprocess": d => d[0]},
    {"name": "TrackBlock$ebnf$1", "symbols": ["KeyValLines"], "postprocess": id},
    {"name": "TrackBlock$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "TrackBlock", "symbols": [(lexer.has("TRACK") ? {type: "TRACK"} : TRACK), "_", {"literal":":"}, "_", "BlockOpen", "OptNL", "TrackBlock$ebnf$1", "OptNL", "DEDENT"], "postprocess": d => normTrack(d[6])},
    {"name": "TrackHeadInline$ebnf$1", "symbols": ["HeadExtras"], "postprocess": id},
    {"name": "TrackHeadInline$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "TrackHeadInline", "symbols": [(lexer.has("TRACK") ? {type: "TRACK"} : TRACK), "_", "TrackEvent", "TrackHeadInline$ebnf$1", "_", {"literal":":"}, "_", "TrackProps"], "postprocess": d => ({ kind:"track", event:asEvent(d[2]), props:d[7], ...(d[3] || {}) })},
    {"name": "TrackHeadBlock$ebnf$1", "symbols": ["HeadExtras"], "postprocess": id},
    {"name": "TrackHeadBlock$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "TrackHeadBlock$ebnf$2", "symbols": ["HeadKeyValLineList"], "postprocess": id},
    {"name": "TrackHeadBlock$ebnf$2", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "TrackHeadBlock", "symbols": [(lexer.has("TRACK") ? {type: "TRACK"} : TRACK), "_", "TrackEvent", "TrackHeadBlock$ebnf$1", "_", {"literal":":"}, "_", "BlockOpen", "OptNL", "TrackHeadBlock$ebnf$2", "OptNL", "DEDENT"], "postprocess":  d => ({
          kind:"track",
          event: asEvent(d[2]),
          props: toObj(d[9] || []),
          ...(d[3] || {})
        }) },
    {"name": "ValueNoIdent", "symbols": ["string"], "postprocess": d => d[0]},
    {"name": "ValueNoIdent", "symbols": ["number"], "postprocess": d => d[0]},
    {"name": "ValueNoIdent", "symbols": ["bool"], "postprocess": d => d[0]},
    {"name": "ValueNoIdent", "symbols": ["object"], "postprocess": d => d[0]},
    {"name": "ValueNoIdent", "symbols": ["array"], "postprocess": d => d[0]},
    {"name": "ValueNoIdent", "symbols": ["Ref"], "postprocess": d => d[0]},
    {"name": "HeadKeyValLine$subexpression$1", "symbols": ["ValueNoIdent"]},
    {"name": "HeadKeyValLine$subexpression$1", "symbols": ["KeyValList"]},
    {"name": "HeadKeyValLine$subexpression$1", "symbols": ["ObjBlock"]},
    {"name": "HeadKeyValLine", "symbols": ["key", "_", {"literal":":"}, "_", "HeadKeyValLine$subexpression$1", "_"], "postprocess":  d => {
            const v = unwrapDeep(d[4]);                 // <— СНИМАЕМ обёртку subexpression
            const val = Array.isArray(v) && isPairsArray(v) ? toObj(v) : plain(v);
            return { key: d[0], value: val };
        } },
    {"name": "HeadKeyValLineList$ebnf$1", "symbols": []},
    {"name": "HeadKeyValLineList$ebnf$1$subexpression$1", "symbols": ["OptCNL", "HeadKeyValLine"]},
    {"name": "HeadKeyValLineList$ebnf$1", "symbols": ["HeadKeyValLineList$ebnf$1", "HeadKeyValLineList$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "HeadKeyValLineList", "symbols": ["HeadKeyValLine", "HeadKeyValLineList$ebnf$1", "OptCNL"], "postprocess": d => list([ d[0], ...(d[1] ? d[1].map(x=>x[1]) : []) ])},
    {"name": "TrackInline", "symbols": [(lexer.has("TRACK") ? {type: "TRACK"} : TRACK), "_", {"literal":":"}, "_", "TrackKVs"], "postprocess": d => normTrack(d[4])},
    {"name": "TrackKVs", "symbols": ["TrackPairs"], "postprocess": d => d[0]},
    {"name": "TrackKVs", "symbols": ["KeyValLineList"], "postprocess": d => d[0]},
    {"name": "TrackPairs$ebnf$1", "symbols": []},
    {"name": "TrackPairs$ebnf$1$subexpression$1", "symbols": ["_", {"literal":","}, "_", "TrackPair"]},
    {"name": "TrackPairs$ebnf$1", "symbols": ["TrackPairs$ebnf$1", "TrackPairs$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "TrackPairs$ebnf$2$subexpression$1", "symbols": ["_", {"literal":","}]},
    {"name": "TrackPairs$ebnf$2", "symbols": ["TrackPairs$ebnf$2$subexpression$1"], "postprocess": id},
    {"name": "TrackPairs$ebnf$2", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "TrackPairs", "symbols": ["TrackPair", "TrackPairs$ebnf$1", "TrackPairs$ebnf$2"], "postprocess": d => [ d[0], ...(d[1] ? d[1].map(x => x[3]) : []) ]},
    {"name": "TrackPair", "symbols": ["key", "_", {"literal":":"}, "_", "TrackValue"], "postprocess": d => ({ key: d[0], value: d[4] })},
    {"name": "TrackValue", "symbols": ["Value"], "postprocess": d => unwrapDeep(d[0])},
    {"name": "TrackValue", "symbols": ["KeyValList"], "postprocess": d => toObj(d[0])},
    {"name": "TrackValue", "symbols": ["ObjBlock"], "postprocess": d => d[0]},
    {"name": "KeyValLines$ebnf$1", "symbols": ["KeyValLineList"], "postprocess": id},
    {"name": "KeyValLines$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "KeyValLines", "symbols": ["KeyValLines$ebnf$1"], "postprocess": d => d[0] || []},
    {"name": "KeyValLineList$ebnf$1", "symbols": []},
    {"name": "KeyValLineList$ebnf$1$subexpression$1", "symbols": ["OptCNL", "KeyValLine"]},
    {"name": "KeyValLineList$ebnf$1", "symbols": ["KeyValLineList$ebnf$1", "KeyValLineList$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "KeyValLineList", "symbols": ["KeyValLine", "KeyValLineList$ebnf$1", "OptCNL"], "postprocess": d => list([ d[0], ...(d[1] ? d[1].map(x=>x[1]) : []) ])},
    {"name": "ObjBlock$ebnf$1", "symbols": ["KeyValLineList"], "postprocess": id},
    {"name": "ObjBlock$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "ObjBlock", "symbols": ["BlockOpen", "ObjBlock$ebnf$1", "OptNL", "DEDENT"], "postprocess": d => toObj(d[1] || [])},
    {"name": "KeyValLine$subexpression$1", "symbols": ["Value"]},
    {"name": "KeyValLine$subexpression$1", "symbols": ["KeyValList"]},
    {"name": "KeyValLine$subexpression$1", "symbols": ["ObjBlock"]},
    {"name": "KeyValLine", "symbols": ["key", "_", {"literal":":"}, "_", "KeyValLine$subexpression$1", "_"], "postprocess":  d => {
             const v = unwrapDeep(d[4]);
             const val = Array.isArray(v) && isPairsArray(v) ? toObj(v) : plain(v);
             return { key: d[0], value: val };
        } },
    {"name": "KeyVals$ebnf$1", "symbols": ["KeyValList"], "postprocess": id},
    {"name": "KeyVals$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "KeyVals", "symbols": ["KeyVals$ebnf$1"], "postprocess": d => toObj(d[0] || [])},
    {"name": "KeyValList$ebnf$1", "symbols": []},
    {"name": "KeyValList$ebnf$1$subexpression$1", "symbols": ["_", {"literal":","}, "_", "KeyVal"]},
    {"name": "KeyValList$ebnf$1", "symbols": ["KeyValList$ebnf$1", "KeyValList$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "KeyValList$ebnf$2$subexpression$1", "symbols": ["_", {"literal":","}]},
    {"name": "KeyValList$ebnf$2", "symbols": ["KeyValList$ebnf$2$subexpression$1"], "postprocess": id},
    {"name": "KeyValList$ebnf$2", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "KeyValList", "symbols": ["KeyVal", "KeyValList$ebnf$1", "KeyValList$ebnf$2"], "postprocess": d => [ d[0], ...(d[1] ? d[1].map(x=>x[3]) : []) ]},
    {"name": "KeyVal", "symbols": ["key", "_", {"literal":":"}, "_", "Value"], "postprocess": d => [ d[0], unwrapDeep(d[4]) ]},
    {"name": "Value", "symbols": ["string"], "postprocess": d => d[0]},
    {"name": "Value", "symbols": ["number"], "postprocess": d => d[0]},
    {"name": "Value", "symbols": ["bool"], "postprocess": d => d[0]},
    {"name": "Value", "symbols": ["object"], "postprocess": d => d[0]},
    {"name": "Value", "symbols": ["array"], "postprocess": d => d[0]},
    {"name": "Value", "symbols": ["Ref"], "postprocess": d => d[0]},
    {"name": "Value", "symbols": ["ident"], "postprocess": d => ({ ref:d[0] })},
    {"name": "Value", "symbols": ["ObjBlock"]},
    {"name": "Value", "symbols": ["ArrBlock"]},
    {"name": "Expr", "symbols": ["OrExpr"], "postprocess": d => d[0]},
    {"name": "OrExpr$ebnf$1", "symbols": []},
    {"name": "OrExpr$ebnf$1$subexpression$1", "symbols": ["_", {"literal":"||"}, "_", "AndExpr"]},
    {"name": "OrExpr$ebnf$1", "symbols": ["OrExpr$ebnf$1", "OrExpr$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "OrExpr", "symbols": ["AndExpr", "OrExpr$ebnf$1"], "postprocess": d => d[1] ? d[1].reduce((acc,c)=>({op:"||",left:acc,right:c[3]}), d[0]) : d[0]},
    {"name": "AndExpr$ebnf$1", "symbols": []},
    {"name": "AndExpr$ebnf$1$subexpression$1", "symbols": ["_", {"literal":"&&"}, "_", "CmpExpr"]},
    {"name": "AndExpr$ebnf$1", "symbols": ["AndExpr$ebnf$1", "AndExpr$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "AndExpr", "symbols": ["CmpExpr", "AndExpr$ebnf$1"], "postprocess": d => d[1] ? d[1].reduce((acc,c)=>({op:"&&",left:acc,right:c[3]}), d[0]) : d[0]},
    {"name": "CmpExpr$ebnf$1", "symbols": []},
    {"name": "CmpExpr$ebnf$1$subexpression$1", "symbols": ["_", "CmpOp", "_", "AddExpr"]},
    {"name": "CmpExpr$ebnf$1", "symbols": ["CmpExpr$ebnf$1", "CmpExpr$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "CmpExpr", "symbols": ["AddExpr", "CmpExpr$ebnf$1"], "postprocess": d => d[1] ? d[1].reduce((acc,c)=>({op:c[1],left:acc,right:c[3]}), d[0]) : d[0]},
    {"name": "CmpEq", "symbols": [(lexer.has("eq") ? {type: "eq"} : eq), (lexer.has("eq") ? {type: "eq"} : eq)], "postprocess": d => "=="},
    {"name": "CmpNe", "symbols": [{"literal":"!"}, (lexer.has("eq") ? {type: "eq"} : eq)], "postprocess": d => "!="},
    {"name": "CmpGe", "symbols": [{"literal":">"}, (lexer.has("eq") ? {type: "eq"} : eq)], "postprocess": d => ">="},
    {"name": "CmpLe", "symbols": [{"literal":"<"}, (lexer.has("eq") ? {type: "eq"} : eq)], "postprocess": d => "<="},
    {"name": "CmpOp", "symbols": [{"literal":"=="}], "postprocess": d => d[0]},
    {"name": "CmpOp", "symbols": ["CmpEq"], "postprocess": d => d[0]},
    {"name": "CmpOp", "symbols": [{"literal":"!="}], "postprocess": d => d[0]},
    {"name": "CmpOp", "symbols": ["CmpNe"], "postprocess": d => d[0]},
    {"name": "CmpOp", "symbols": [{"literal":">="}], "postprocess": d => d[0]},
    {"name": "CmpOp", "symbols": ["CmpGe"], "postprocess": d => d[0]},
    {"name": "CmpOp", "symbols": [{"literal":"<="}], "postprocess": d => d[0]},
    {"name": "CmpOp", "symbols": ["CmpLe"], "postprocess": d => d[0]},
    {"name": "CmpOp", "symbols": [{"literal":">"}], "postprocess": d => d[0]},
    {"name": "CmpOp", "symbols": [{"literal":"<"}], "postprocess": d => d[0]},
    {"name": "AddExpr$ebnf$1", "symbols": []},
    {"name": "AddExpr$ebnf$1$subexpression$1", "symbols": ["_", "AddOp", "_", "MulExpr"]},
    {"name": "AddExpr$ebnf$1", "symbols": ["AddExpr$ebnf$1", "AddExpr$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "AddExpr", "symbols": ["MulExpr", "AddExpr$ebnf$1"], "postprocess": d => d[1] ? d[1].reduce((acc,c)=>({op:c[2],left:acc,right:c[4]}), d[0]) : d[0]},
    {"name": "AddOp", "symbols": [{"literal":"+"}]},
    {"name": "AddOp", "symbols": [{"literal":"-"}], "postprocess": d => d[0]},
    {"name": "MulExpr$ebnf$1", "symbols": []},
    {"name": "MulExpr$ebnf$1$subexpression$1", "symbols": ["_", "MulOp", "_", "Primary"]},
    {"name": "MulExpr$ebnf$1", "symbols": ["MulExpr$ebnf$1", "MulExpr$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "MulExpr", "symbols": ["Primary", "MulExpr$ebnf$1"], "postprocess": d => d[1] ? d[1].reduce((acc,c)=>({op:c[2],left:acc,right:c[4]}), d[0]) : d[0]},
    {"name": "MulOp", "symbols": [{"literal":"*"}]},
    {"name": "MulOp", "symbols": [{"literal":"/"}], "postprocess": d => d[0]},
    {"name": "Primary", "symbols": ["Value"]},
    {"name": "Primary", "symbols": [{"literal":"("}, "_", "Expr", "_", {"literal":")"}], "postprocess": d => d[2]},
    {"name": "object$ebnf$1", "symbols": ["ObjPairsNL"], "postprocess": id},
    {"name": "object$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "object", "symbols": ["lbrace", "_", "OptNL", "object$ebnf$1", "OptNL", "_", "rbrace"], "postprocess": d => Object.fromEntries(d[3] || [])},
    {"name": "ObjPairsNL$ebnf$1", "symbols": []},
    {"name": "ObjPairsNL$ebnf$1$subexpression$1", "symbols": ["_", {"literal":","}, "_", "OptNL", "ObjPair"]},
    {"name": "ObjPairsNL$ebnf$1", "symbols": ["ObjPairsNL$ebnf$1", "ObjPairsNL$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "ObjPairsNL$ebnf$2$subexpression$1", "symbols": ["_", {"literal":","}, "OptNL"]},
    {"name": "ObjPairsNL$ebnf$2", "symbols": ["ObjPairsNL$ebnf$2$subexpression$1"], "postprocess": id},
    {"name": "ObjPairsNL$ebnf$2", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "ObjPairsNL", "symbols": ["ObjPair", "ObjPairsNL$ebnf$1", "ObjPairsNL$ebnf$2"], "postprocess": d => [ d[0], ...(d[1] ? d[1].map(x=>x[4]) : []) ]},
    {"name": "ObjPairs$ebnf$1", "symbols": []},
    {"name": "ObjPairs$ebnf$1$subexpression$1", "symbols": ["_", {"literal":","}, "_", "ObjPair"]},
    {"name": "ObjPairs$ebnf$1", "symbols": ["ObjPairs$ebnf$1", "ObjPairs$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "ObjPairs$ebnf$2$subexpression$1", "symbols": ["_", {"literal":","}]},
    {"name": "ObjPairs$ebnf$2", "symbols": ["ObjPairs$ebnf$2$subexpression$1"], "postprocess": id},
    {"name": "ObjPairs$ebnf$2", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "ObjPairs", "symbols": ["ObjPair", "ObjPairs$ebnf$1", "ObjPairs$ebnf$2"], "postprocess": d => [ d[0], ...(d[1] ? d[1].map(x=>x[3]) : []) ]},
    {"name": "ObjPair", "symbols": ["key", "_", {"literal":":"}, "_", "Value"], "postprocess": d => [d[0], d[4]]},
    {"name": "array$ebnf$1", "symbols": ["ArrValsNL"], "postprocess": id},
    {"name": "array$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "array", "symbols": ["lbrack", "_", "OptNL", "array$ebnf$1", "OptNL", "_", "rbrack"], "postprocess": d => d[3] || []},
    {"name": "ArrValsNL$ebnf$1", "symbols": []},
    {"name": "ArrValsNL$ebnf$1$subexpression$1", "symbols": ["_", {"literal":","}, "_", "OptNL", "Value"]},
    {"name": "ArrValsNL$ebnf$1", "symbols": ["ArrValsNL$ebnf$1", "ArrValsNL$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "ArrValsNL$ebnf$2$subexpression$1", "symbols": ["_", {"literal":","}, "OptNL"]},
    {"name": "ArrValsNL$ebnf$2", "symbols": ["ArrValsNL$ebnf$2$subexpression$1"], "postprocess": id},
    {"name": "ArrValsNL$ebnf$2", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "ArrValsNL", "symbols": ["Value", "ArrValsNL$ebnf$1", "ArrValsNL$ebnf$2"], "postprocess": d => [ d[0], ...(d[1] ? d[1].map(x=>x[4]) : []) ]},
    {"name": "ArrBlock$ebnf$1", "symbols": ["ArrItems"], "postprocess": id},
    {"name": "ArrBlock$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "ArrBlock", "symbols": ["BlockOpen", "OptCNL", "ArrBlock$ebnf$1", "OptCNL", "DEDENT"], "postprocess": d => normalizeArrItems(unwrapDeep(d[2]) || [])},
    {"name": "ArrItems$ebnf$1", "symbols": []},
    {"name": "ArrItems$ebnf$1$subexpression$1", "symbols": ["OptCNL", "ArrItem"]},
    {"name": "ArrItems$ebnf$1", "symbols": ["ArrItems$ebnf$1", "ArrItems$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "ArrItems", "symbols": ["ArrItem", "ArrItems$ebnf$1", "OptCNL"], "postprocess": d => [ d[0], ...(d[1] ? d[1].map(x=>x[1]) : []) ]},
    {"name": "ArrItem", "symbols": ["ArrObj"]},
    {"name": "ArrItem", "symbols": ["Value"]},
    {"name": "ArrObj$ebnf$1", "symbols": ["ArrObjTail"], "postprocess": id},
    {"name": "ArrObj$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "ArrObj", "symbols": ["ArrObjHead", "ArrObj$ebnf$1"], "postprocess":  d => {
          const headPairs = d[0];          // [[k,v], ...]
          const tailPairs = d[1] || [];    // [{key, value}, ...] либо []
          const entries = [];
          // из головы уже пары-массивы:
          for (const kv of headPairs) entries.push(kv);
          // хвост: KeyValLine -> {key, value}
          for (const kv of tailPairs) entries.push([kv.key, plain(kv.value)]);
          return Object.fromEntries(entries.map(([k, v]) => [k, plain(v)]));
        } },
    {"name": "ArrObjHead$ebnf$1$subexpression$1", "symbols": ["_", {"literal":","}, "_", "KeyValList"]},
    {"name": "ArrObjHead$ebnf$1", "symbols": ["ArrObjHead$ebnf$1$subexpression$1"], "postprocess": id},
    {"name": "ArrObjHead$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "ArrObjHead", "symbols": ["key", "_", {"literal":":"}, "_", "Value", "ArrObjHead$ebnf$1"], "postprocess":  d => {
          const head = [ d[0], unwrap(d[4]) ];        // [k,v]
          const csv  = d[5] ? d[5][3] : [];           // KeyValList → [[k,v],...]
          return [ head, ...csv ];
        } },
    {"name": "ArrObjTail$ebnf$1$subexpression$1", "symbols": ["_", {"literal":","}]},
    {"name": "ArrObjTail$ebnf$1", "symbols": ["ArrObjTail$ebnf$1$subexpression$1"], "postprocess": id},
    {"name": "ArrObjTail$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "ArrObjTail", "symbols": ["ArrObjTail$ebnf$1", "_", "NEWLINE", "INDENT", "KeyValLineList", "DEDENT"], "postprocess": d => d[4]},
    {"name": "ArrVals$ebnf$1", "symbols": []},
    {"name": "ArrVals$ebnf$1$subexpression$1", "symbols": ["_", {"literal":","}, "_", "Value"]},
    {"name": "ArrVals$ebnf$1", "symbols": ["ArrVals$ebnf$1", "ArrVals$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "ArrVals$ebnf$2$subexpression$1", "symbols": ["_", {"literal":","}]},
    {"name": "ArrVals$ebnf$2", "symbols": ["ArrVals$ebnf$2$subexpression$1"], "postprocess": id},
    {"name": "ArrVals$ebnf$2", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "ArrVals", "symbols": ["Value", "ArrVals$ebnf$1", "ArrVals$ebnf$2"], "postprocess": d => [ d[0], ...(d[1] ? d[1].map(x=>x[3]) : []) ]},
    {"name": "key$ebnf$1", "symbols": []},
    {"name": "key$ebnf$1$subexpression$1", "symbols": [{"literal":"."}, "ident"]},
    {"name": "key$ebnf$1", "symbols": ["key$ebnf$1", "key$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "key", "symbols": ["ident", "key$ebnf$1"], "postprocess": d => d[1] ? d[1].reduce((acc,cur)=>acc+"."+cur[1], d[0]) : d[0]},
    {"name": "IdList$ebnf$1", "symbols": []},
    {"name": "IdList$ebnf$1$subexpression$1", "symbols": ["_", {"literal":","}, "_", "ident"]},
    {"name": "IdList$ebnf$1", "symbols": ["IdList$ebnf$1", "IdList$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "IdList", "symbols": ["ident", "IdList$ebnf$1"], "postprocess": d => [ d[0], ...(d[1]? d[1].map(x=>x[3]):[]) ]},
    {"name": "ident", "symbols": [(lexer.has("ident") ? {type: "ident"} : ident)], "postprocess": d => d[0].value},
    {"name": "number", "symbols": [(lexer.has("number") ? {type: "number"} : number)], "postprocess": d => Number(d[0].value)},
    {"name": "string", "symbols": [(lexer.has("string") ? {type: "string"} : string)], "postprocess": d => JSON.parse(d[0].value[0]==="'" ? d[0].value.replace(/^'/,'"').replace(/'$/,'"') : d[0].value)},
    {"name": "bool", "symbols": [(lexer.has("bool") ? {type: "bool"} : bool)], "postprocess": d => d[0].value === "true"},
    {"name": "Ref", "symbols": ["RefPath"], "postprocess": d => ({ ref: d[0] })},
    {"name": "locale", "symbols": ["ident"]},
    {"name": "lbrace", "symbols": [(lexer.has("lbrace") ? {type: "lbrace"} : lbrace)], "postprocess": d => d[0].value},
    {"name": "rbrace", "symbols": [(lexer.has("rbrace") ? {type: "rbrace"} : rbrace)], "postprocess": d => d[0].value},
    {"name": "lbrack", "symbols": [(lexer.has("lbrack") ? {type: "lbrack"} : lbrack)], "postprocess": d => d[0].value},
    {"name": "rbrack", "symbols": [(lexer.has("rbrack") ? {type: "rbrack"} : rbrack)], "postprocess": d => d[0].value},
    {"name": "NEWLINE", "symbols": [(lexer.has("NEWLINE") ? {type: "NEWLINE"} : NEWLINE)], "postprocess": d => d[0]},
    {"name": "INDENT", "symbols": [(lexer.has("INDENT") ? {type: "INDENT"} : INDENT)], "postprocess": d => d[0]},
    {"name": "DEDENT", "symbols": [(lexer.has("DEDENT") ? {type: "DEDENT"} : DEDENT)], "postprocess": d => d[0]},
    {"name": "_$ebnf$1", "symbols": []},
    {"name": "_$ebnf$1$subexpression$1", "symbols": [(lexer.has("ws") ? {type: "ws"} : ws)]},
    {"name": "_$ebnf$1$subexpression$1", "symbols": [(lexer.has("comment") ? {type: "comment"} : comment)]},
    {"name": "_$ebnf$1", "symbols": ["_$ebnf$1", "_$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "_", "symbols": ["_$ebnf$1"], "postprocess": d => null}
]
  , ParserStart: "Start"
}
if (typeof module !== 'undefined'&& typeof module.exports !== 'undefined') {
   module.exports = grammar;
} else {
   window.grammar = grammar;
}
})();
