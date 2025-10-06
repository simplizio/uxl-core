# grammar.ne — Nearley grammar for UXL (indent-sensitive)
# Root: Project

@{%
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


%}

@lexer lexer
# ---------- root (make this the first rule) ----------
Start -> Project

# ---------- helpers ----------
NLs -> (NEWLINE):+      {% d => null %}
OptNL -> (NEWLINE):*   {% d => null %}

# переносы с поддержкой комментариев
CNLs   -> (_ NEWLINE):+  {% d => null %}
OptCNL -> (_ NEWLINE):*  {% d => null %}

#TopGap -> ( _ | NEWLINE ):*   {% d => null %}   # любой микс пустых строк и комментариев
#TopSep -> ( _ | NEWLINE ):+   {% d => null %}   # то же, но хотя бы один разделитель


BlockOpen -> NEWLINE ( _ NEWLINE ):* INDENT  {% d => null %}


# ================== Root ==================
Project ->
    OptCNL TopDef (OptCNL TopDef):* OptCNL
  {% d =>
      ({ type:"project",
         defs: list([ d[1], ...(d[2] ? d[2].map(x => x[1]) : []) ]) })
  %}


TopDefs -> TopDef (OptCNL TopDef):* OptCNL
  {% d => [ d[0], ...(d[1]||[]).map(x=>x[1]) ] %}


TopDef -> ImportDef
        | ExportDef
        | ScreenDef
        | TemplateDef
        | DataDef
        | I18nDef
        | AbDef

# ==== RefPath с индексами: a.b[0].c ====
RefPath ->
    ident RefSeg:*   {% d => [d[0], ...(d[1]||[])].join("") %}

#RefSeg ->
#    "." ident        {% d => "." + d[1] %}
#  | "[" number "]"   {% d => "[" + d[1] + "]" %}

RefSeg ->
    "." ident              {% d => "." + d[1] %}
  | lbrack number rbrack   {% d => "[" + d[1] + "]" %}


# ================== import / export / include ==================
ImportDef -> %IMPORT _ string ImportAlias:? {% d => ({ type:"import", path:d[2], alias: d[3] || null }) %}

ImportAlias -> _ %AS _ ident {% d => d[3] %}

ExportDef -> ExportTemplate | ExportBlock

ExportTemplate -> %EXPORT _ %TEMPLATE _ ident _ ":" _ BlockOpen TemplateItems DEDENT
  {% d => ({ type:"export_template", name:d[4], items:list(d[9]) }) %}

ExportBlock -> %EXPORT _ %COMPONENT _ ident _ ":" _ BlockOpen ComponentItems DEDENT
  {% d => ({ type:"export_block", name:d[4], items:list(d[9]) }) %}

#IncludeLine -> %INCLUDE _ IncludeRef {% d => ({ type:"include", ref:d[2] }) %}

#IncludeRef -> key {% d => d[0] %}

#IncludeLine ->
#    %INCLUDE _ IncludeRef IncludeWithOpt:?
#  {% d => {
#      const node = { type:"include", ref:d[2] };
#      if (d[3]) node.locals = d[3];   # { product:{ref:"..."}, ... }
#      return node;
#  } %}

IncludeLine ->
    %INCLUDE _ IncludeRef IncludeWithOpt:?
  {% d => {
      const node = { type:"include", ref:d[2] };
      if (d[3]) node.locals = d[3];   // { product:{ref:"..."}, ... }
      return node;
  } %}


IncludeRef -> key {% d => d[0] %}

# опциональный хвост "with: ..."
IncludeWithOpt ->
    _ %WITH _ ":" _ ( IncludeWithBlock | IncludeWithInline )
  {% d => d[5] %}

# многострочный блок под отступом
IncludeWithBlock ->
    BlockOpen OptCNL IncludeEntryLines:? OptCNL DEDENT
  {% d => toObj(d[2] || []) %}   # вернёт { key: {ref|value}, ... }

# однострочно (CSV)
IncludeWithInline ->
    IncludeInlinePairs
  {% d => toObj(d[0]) %}

# --- пары для многострочного блока ---
IncludeEntryLines ->
    IncludeEntryLine ( OptCNL IncludeEntryLine ):* OptCNL
  {% d => [ d[0], ...(d[1] ? d[1].map(x=>x[1]) : []) ] %}

IncludeEntryLine ->
    key _ ":" _ IncludeVal _
  {% d => ({ key:d[0], value:d[4] }) %}

# --- пары для инлайн-формы ---
IncludeInlinePairs ->
    IncludeInlinePair ( _ "," _ IncludeInlinePair ):* ( _ "," ):?
  {% d => [ d[0], ...(d[1] ? d[1].map(x=>x[3]) : []) ] %}

IncludeInlinePair ->
    key _ ":" _ IncludeVal
  {% d => [ d[0], d[4] ] %}

# Значение в with: либо RefPath (=> {ref}), либо обычный Value (=> {value})
IncludeVal ->
    RefPath   {% d => ({ ref: d[0] }) %}
  | Value     {% d => ({ value: unwrapDeep(d[0]) }) %}



# ================== i18n ==================
I18nDef -> %I18N _ locale _ ":" _ BlockOpen I18nEntries DEDENT
  {% d => ({ type:"i18n", locale:d[2], entries:d[7] }) %}

I18nEntries -> I18nEntryList:? {% d => d[0] || [] %}

I18nEntryList -> I18nEntry (CNLs I18nEntry):* OptCNL
  {% d => [ d[0], ...(d[1]||[]).map(x=>x[1]) ] %}

I18nEntry -> key _ ":" _ string
  {% d => ({ key:d[0], value:d[4] }) %}


# ================== data ==================
DataDef -> %DATA _ ident _ ":" _ BlockOpen DataSource DEDENT
  {% d => ({ type:"data", name:d[2], source:d[7] }) %}

DataSource ->
    "endpoint" _ ":" _ string                 {% d => ({ kind:"endpoint", url:d[4] }) %}
  | "inline"   _ ":" _ ( ObjBlock | object )  {% d => ({ kind:"inline",   value: unwrapDeep(d[4]) }) %}
  | "fixture"  _ ":" _ ObjBlock               {% d => ({ kind:"fixture",  value:d[4] }) %}


# ================== ab / variant ==================
AbDef -> %AB _ ident _ ":" _ BlockOpen VariantDefs DEDENT
  {% d => normalizeAbNode({ type:"ab", name:d[2], variants:d[7] }) %}

VariantDefs -> VariantDefList:? {% d => d[0] || [] %}

VariantDefList -> VariantDef (OptCNL VariantDef):* OptCNL
  {% d => [ d[0], ...(d[1]||[]).map(x=>x[1]) ] %}

VariantDef -> %VARIANT _ ident _ Weight:? _ ":" _ NEWLINE INDENT VariantItems DEDENT
  {% d => ({ type:"variant", name:d[2], weight:(d[4] ?? null), items:list(d[10]) }) %}

Weight ->
    number %percent                      {% d => ({ kind:"percent", value:d[0] }) %}
  | "(" _ number %percent _ ")"         {% d => ({ kind:"percent", value:d[2] }) %}
  | number                         {% d => ({ kind:"share",   value:d[0] }) %}
  | "(" _ number _ ")"             {% d => ({ kind:"share",   value:d[2] }) %}


# список, возможно пустой
VariantItems -> VariantItemList:? {% d => list(d[0]) %}

VariantItemList -> VariantItem (OptCNL VariantItem):* OptCNL
  {% d => list([ d[0], ...(d[1] ? d[1].map(x=>x[1]) : []) ]) %}

#VariantItem -> I18nDef | PropLine
VariantItem ->
    ComponentDef
  | AreaDef
  | WhenBlock
  | OnBlock
  | Track
  | PropLine
  | IncludeLine
  | I18nDef

# ============= template / area ==============
TemplateDef -> %TEMPLATE _ ident _ ":" _ BlockOpen TemplateItems DEDENT
  {% d => ({ type:"template", name:d[2], items:list(d[7]) }) %}

TemplateItems ->
    (OptCNL TemplateItem):+ OptCNL
  {% d => list((d[0] || []).map(x => x[1])) %}

TemplateItem ->
    AreaDef
  | ComponentDef
  | WhenBlock
  | OnBlock
  | Track
  | IncludeLine
  | AbDef


AreaDefs -> AreaDefList:? {% d => list(d[0]) %}


AreaDefList -> AreaDef (CNLs AreaDef):* OptCNL
  {% d => list([ d[0], ...(d[1] ? d[1].map(x=>x[1]) : []) ]) %}


# ================== screen ==================

ScreenDef ->
    %SCREEN _ ident ":" _ NLs:? INDENT ScreenItems DEDENT
  {% d => ({ type:"screen", name:d[2], items:list(d[7]) }) %}

ScreenExt -> _ %EXTENDS _ ident {% d => d[3] %}

ScreenBody -> NLs:? INDENT ScreenItems DEDENT

ScreenItems ->
    (OptCNL ScreenItem):+ OptCNL
  {% d => list((d[0] || []).map(x => x[1])) %}

ScreenItemList -> (ScreenItem OptNL ):* {% d => d.map(x=>x[0]) %}

ScreenItem ->
    AreaDef
  | ComponentDef
  | WhenBlock
  | OnBlock
  | Track
  | ParamLine
  | UseData
  | IncludeLine
  | AbDef

UseData -> %USE _ %DATA _ IdList {% d => ({ type:"useData", names:d[4] }) %}

ParamLine -> %PARAM _ ident {% d => ({ type:"param", name:d[2] }) %}


# ================== area ==================
AreaDef -> %AREA _ ident _ ":" _ Layout:? BlockOpen AreaItems DEDENT
  {% d => ({ type:"area", name:d[2], layout:(d[6] ?? null), items:list(d[8]) }) %}


Layout ->
    %ROW {% d => ({ kind:"row" }) %}
  | %COL {% d => ({ kind:"col" }) %}
  | %GRID "(" "cols" "=" number ( "," "gap" "=" number ):? ")" {% d => ({ kind:"grid", cols:d[5], gap:(d[7]?d[7][3]:null) }) %}

AreaItems -> AreaItemList:? {% d => list(d[0]) %}
AreaItemList -> (OptCNL AreaItem):* OptCNL
  {% d => list(((d[0] || [])).map(x => x[1])) %}


AreaItem ->
    ComponentDef
  | AreaDef
  | WhenBlock
  | Track
  | OnBlock
  | PropLine
  | IncludeLine
  | AbDef


# ================== component ==================
# Тип компонента: идентификатор + спец-токены лэйаута
TypeName ->
    ident        {% d => d[0] %}
  | %ROW         {% d => "row" %}
  | %COL         {% d => "col" %}
  | %GRID        {% d => "grid" %}

ComponentDef ->
  %COMPONENT _ TypeName _ ident:? _ ":" _ BlockOpen ComponentItems DEDENT
  {% d => ({ type:"component", ctype:d[2], cid:(d[4]||null), items:list(d[9]) }) %}

ComponentItems -> ComponentItemList:? {% d => list(d[0]) %}
ComponentItemList -> (OptCNL ComponentItem):* OptCNL
  {% d => list(((d[0] || [])).map(x => x[1])) %}

ComponentItem ->
    PropLine
  | BindBlock
  | WhenBlock
  | OnBlock
  | Track
  | AreaDef
  | IncludeLine
  | ComponentDef


PropLine ->
  "prop" _ ident _ ":" _ Value   {% d => ({ kind:"prop", key:d[2], value:d[6] }) %}
  | ident  _ ":"   _ Value         {% d => ({ kind:"prop", key:d[0], value:d[4] }) %}

# ---------- Bind lines ----------
BindBlock -> BindBlockLines | BindBlockObj | BindBlockCsv

# 1) основной — многострочные пары key: <BindValue>
BindBlockLines ->
  %BIND _ ":" _ BlockOpen OptCNL BindEntryList:? OptCNL DEDENT
  {% d => ({
    kind: "bind",
    entries: toObj(d[6] || [])
  }) %}


BindEntryList ->
  BindEntry ( OptCNL BindEntry ):* OptCNL
  {% d => [ d[0], ...(d[1]||[]).map(x=>x[1]) ] %}

BindEntry -> BindEntryBlock | BindEntryInline

# key: <…> где <…> — спец. bind-объект (ref/mode/value) под отступом
BindEntryBlock ->
  key _ ":" _ BindObjBlock _
  {% d => ({ key:d[0], value:d[4] }) %}

# key: <Inline> — для простых значений (строка/число/булево)
BindEntryInline ->
  key _ ":" _ BindInlineVal (_ NEWLINE):?
  {% d => ({ key:d[0], value:d[4] }) %}

# допустимые инлайн-значения в bind
BindInlineVal ->
    string  {% d => d[0] %}
  | number  {% d => d[0] %}
  | bool    {% d => d[0] %}
  | Ref     {% d => d[0] %}       # позволяем text: i18n.cart_title / items: cart.items

# Специализированный блок именно для bind-объектов (ref/mode/value) в ЛЮБОМ порядке
BindObjBlock ->
  BlockOpen BindObjLines:? OptCNL DEDENT
  {% d => toObj(d[1] || []) %}

BindObjLines ->
  BindObjLine (CNLs BindObjLine):* OptCNL
  {% d => [ d[0], ...(d[1]||[]).map(x=>x[1]) ] %}


# ВАЖНО: здесь "ref" берём как key-строку, БЕЗ generic Value → это развязка от Track и прочего
BindObjLine ->
#    "ref"   _ ":" _ key    {% d => ["ref", d[4]] %}
    "ref"   _ ":" _ RefPath    {% d => ["ref", d[4]] %}
#  | "mode"  _ ":" _ (string | ident)  {% d => ["mode", unwrap(d[4])] %}
  | "mode"  _ ":" _ (string | ident)  {% d => ["mode", unwrapDeep(d[4])] %}
  | "value" _ ":" _ (string | number | bool | object | array) {% d => ["value", d[4]] %}

# 2) Объект целиком: bind: { ... } — редко нужно, но оставим
BindBlockObj ->
  %BIND _ ":" _ lbrace _ BindObjPairs:? _ rbrace
  {% d => ({ kind:"bind", entries: toObj(d[6] || []) }) %}

BindObjPairs ->
  BindObjPair ( _ "," _ BindObjPair ):* ( _ "," ):?
  {% d => [ d[0], ...(d[1] ? d[1].map(x=>x[3]) : []) ] %}

# пары верхнего уровня для bind: { text: "...", items: { ref: a.b, mode: "stream" } }
BindObjPair ->
    key _ ":" _ BindInlineVal       {% d => [ d[0], d[4] ] %}
  | key _ ":" _ lbrace _ BindObjPairs:? _ rbrace
    {% d => [ d[0], Object.fromEntries(d[6] || []) ] %}
  | key _ ":" _ BindObjBlock        {% d => [ d[0], d[4] ] %}


# 3) CSV на одной строке: bind: text: "hi", user: { ... }
BindBlockCsv ->
  %BIND _ ":" _ BindCsvPairs
  {% d => ({ kind:"bind", entries: toObj(d[4]) }) %}

BindCsvPairs ->
  BindCsvPair ( _ "," _ BindCsvPair ):* ( _ "," ):?
  {% d => [ d[0], ...(d[1] ? d[1].map(x=>x[3]) : []) ] %}

BindCsvPair ->
    key _ ":" _ BindInlineVal   {% d => [ d[0], d[4] ] %}
  | key _ ":" _ BindObjBlock    {% d => [ d[0], d[4] ] %}



WhenBlock -> %WHEN _ Expr _ ":" _ BlockOpen WhenItems DEDENT
  {% d => ({ kind:"when", expr:d[2], items:list(d[7]) }) %}

WhenItems -> WhenItemList:? {% d => list(d[0]) %}

WhenItemList -> (OptCNL WhenItem):* OptCNL
  {% d => list(((d[0] || [])).map(x => x[1])) %}

WhenItem ->
    ComponentDef
  | AreaDef
  | PropLine
  | OnBlock
  | Track
  | IncludeLine

OnBlock -> %ON _ ident _ ":" _ BlockOpen ActionLines DEDENT
  {% d => ({ kind:"on", event:d[2], actions:d[7] }) %}

ActionLines ->
    ActionLine (CNLs ActionLine):* OptCNL
  {% d => list([ d[0], ...((d[1]||[]).map(x => x[1])) ]) %}


ActionLine ->
    "navigate" "(" NavigateArgs ")"   {% d => ({ type:"navigate", args: normNav(d[2]) }) %}
  | "record"   "(" KeyVals ")"        {% d => ({ type:"record",   args:d[2] }) %}
  | "record"   "(" Value  ")"         {% d => ({ type:"record",   args:{ event: d[2] } }) %}
  | "emit"     "(" KeyVals ")"        {% d => ({ type:"emit",     args:d[2] }) %}


# === NAVIGATE =====================================================
# Ровно один из кейсов ниже:
NavigateArgs ->
    NavigateToArgs
  | NavigateBackArgs
  | NavigatePopToArgs
  | NavigateResetArgs
  | NavigateDismissArgs
  | NavigateTabArgs

# --- to: "Screen" (+ модификаторы) --------------------------------
NavigateToArgs ->
    ToArg ( _ "," _ NavMod ):*
  {% d => Object.assign({}, d[0], ...((d[1]||[]).map(x=>x[3]))) %}

ToArg -> "to" _ ":" _ ScreenRef  {% d => ({ to: d[4] }) %}

# Допустимые модификаторы для to:
NavMod ->
    ParamsArg
  | ReplaceArg
  | ModeArg
  | TransitionArg
  | ExpectResultArg

ParamsArg        -> "params"        _ ":" _ object {% d => ({ params: d[4] }) %}
ReplaceArg       -> "replace"       _ ":" _ bool   {% d => ({ replace: d[4] }) %}
ModeArg          -> "mode"          _ ":" _ Mode   {% d => ({ mode: d[4] }) %}
TransitionArg    -> "transition"    _ ":" _ string {% d => ({ transition: d[4] }) %}
ExpectResultArg  -> "expect_result" _ ":" _ bool   {% d => ({ expect_result: d[4] }) %}

Mode -> "modal" | "push" {% d => d[0] %}

ScreenRef -> ident | string {% d => d[0] %}

# --- back/pop_to/reset/dismiss/tab --------------------------------
NavigateBackArgs   -> BackArg   {% d => d[0] %}
BackArg            -> "back"    _ ":" _ number {% d => ({ back: d[4] }) %}

NavigatePopToArgs  -> PopToArg  {% d => d[0] %}
PopToArg           -> "pop_to"  _ ":" _ ScreenRef {% d => ({ pop_to: d[4] }) %}

NavigateResetArgs  -> ResetArg  {% d => d[0] %}
ResetArg         -> "reset"         _ ":" _ bool   {% d => ({ reset: d[4] }) %}

NavigateDismissArgs-> DismissArg {% d => d[0] %}
DismissArg       -> "dismiss"       _ ":" _ bool   {% d => ({ dismiss: d[4] }) %}

NavigateTabArgs    -> TabArg    {% d => d[0] %}
TabArg             -> "tab"     _ ":" _ ScreenRef {% d => ({ tab: d[4] }) %}

# единая точка входа трекинга
Track -> TrackBlock | TrackInline | TrackHeadBlock | TrackHeadInline

#TrackEvent  -> ident | string {% d => d[0] %}
TrackEvent -> key | string {% d => d[0] %}
HeadExtras  -> "(" _ KeyValList _ ")"   {% d => toObj(d[2]) %}

# props-пэйлоад (все три формы)
TrackProps ->
    KeyValList      {% d => toObj(d[0]) %}
  | KeyValLineList  {% d => toObj(d[0]) %}
  | ObjBlock        {% d => d[0] %}

# многострочный блок

TrackBlock -> %TRACK _ ":" _ BlockOpen OptNL KeyValLines:? OptNL DEDENT
  {% d => normTrack(d[6]) %}


# head-однострочная
TrackHeadInline ->
    %TRACK _ TrackEvent HeadExtras:? _ ":" _ TrackProps
  {% d => ({ kind:"track", event:asEvent(d[2]), props:d[7], ...(d[3] || {}) }) %}

# head-многострочная
TrackHeadBlock ->
    %TRACK _ TrackEvent HeadExtras:? _ ":" _ BlockOpen OptNL HeadKeyValLineList:? OptNL DEDENT
  {% d => ({
    kind:"track",
    event: asEvent(d[2]),
    props: toObj(d[9] || []),
    ...(d[3] || {})
  }) %}

# Значение в head-block: без «голого ident», чтобы ссылки шли через Ref -> key
ValueNoIdent ->
    string  {% d => d[0] %}
  | number  {% d => d[0] %}
  | bool    {% d => d[0] %}
  | object  {% d => d[0] %}
  | array   {% d => d[0] %}
  | Ref     {% d => d[0] %}

# Линия k: v для head-block
HeadKeyValLine ->
  key _ ":" _ ( ValueNoIdent | KeyValList | ObjBlock ) _
  {% d => {
      const v = unwrapDeep(d[4]);                 // <— СНИМАЕМ обёртку subexpression
      const val = Array.isArray(v) && isPairsArray(v) ? toObj(v) : plain(v);
      return { key: d[0], value: val };
  } %}


HeadKeyValLineList ->
  HeadKeyValLine (OptCNL HeadKeyValLine):* OptCNL
  {% d => list([ d[0], ...(d[1] ? d[1].map(x=>x[1]) : []) ]) %}


# однострочный:
#  - поддерживает CSV через запятые: TRACK: event: "view", channel: "ga4"
#  - поддерживает список в несколько пар, но через переносы в той же строке правила (KeyValLineList)

# однострочный: CSV или переносы в той же строке правила

TrackInline -> %TRACK _ ":" _ TrackKVs
  {% d => normTrack(d[4]) %}


# --- CSV-пары для TRACK (разрешаем вложенный список k:v) ---
TrackKVs ->
    TrackPairs         {% d => d[0] %}
  | KeyValLineList     {% d => d[0] %}

TrackPairs ->
    TrackPair ( _ "," _ TrackPair ):* ( _ "," ):?
  {% d => [ d[0], ...(d[1] ? d[1].map(x => x[3]) : []) ] %}

TrackPair -> key _ ":" _ TrackValue
  {% d => ({ key: d[0], value: d[4] }) %}

TrackValue ->
#    Value        {% d => unwrap(d[0]) %}
    Value        {% d => unwrapDeep(d[0]) %}
  | KeyValList   {% d => toObj(d[0]) %}
  | ObjBlock     {% d => d[0] %}

KeyValLines -> KeyValLineList:? {% d => d[0] || [] %}

KeyValLineList -> KeyValLine (OptCNL KeyValLine):* OptCNL
  {% d => list([ d[0], ...(d[1] ? d[1].map(x=>x[1]) : []) ]) %}

# блок под двоеточием (многострочно)
ObjBlock -> BlockOpen KeyValLineList:? OptNL DEDENT
  {% d => toObj(d[1] || []) %}

# для строки «props: …» позволяем 3 формы значения:
#  - обычный Value (в т.ч. {…})
#  - KeyValList  → inline «k1: v1, k2: v2»
#  - ObjBlock    → многострочно под отступом
KeyValLine ->
  key _ ":" _ ( Value | KeyValList | ObjBlock ) _
  {% d => {
       const v = unwrapDeep(d[4]);
       const val = Array.isArray(v) && isPairsArray(v) ? toObj(v) : plain(v);
       return { key: d[0], value: val };
  } %}


#  {% d => {
#      const v = unwrap(d[4]);                 // <— СНИМАЕМ обёртку subexpression
#      return { key: d[0], value: Array.isArray(v) ? toObj(v) : plain(v) };
#  } %}

# ---------- key: value, key: value  внутри скобок (navigate(...), track(...), emit(...)) ----------
KeyVals -> KeyValList:? {% d => toObj(d[0] || []) %}

KeyValList -> KeyVal ( _ "," _ KeyVal ):* ( _ "," ):?
  {% d => [ d[0], ...(d[1] ? d[1].map(x=>x[3]) : []) ] %}

KeyVal -> key _ ":" _ Value
#  {% d => [ d[0], unwrap(d[4]) ] %}
   {% d => [ d[0], unwrapDeep(d[4]) ] %}


# ================== Values & Expr ==================
Value ->
    string  {% d => d[0] %}
  | number  {% d => d[0] %}
  | bool    {% d => d[0] %}
  | object  {% d => d[0] %}
  | array   {% d => d[0] %}
  | Ref     {% d => d[0] %}
  | ident   {% d => ({ ref:d[0] }) %}
  | ObjBlock
  | ArrBlock

Expr -> OrExpr {% d => d[0] %}

OrExpr -> AndExpr ( _ "||" _ AndExpr ):* {% d => d[1] ? d[1].reduce((acc,c)=>({op:"||",left:acc,right:c[3]}), d[0]) : d[0] %}

AndExpr -> CmpExpr ( _ "&&" _ CmpExpr ):* {% d => d[1] ? d[1].reduce((acc,c)=>({op:"&&",left:acc,right:c[3]}), d[0]) : d[0] %}

CmpExpr -> AddExpr ( _ CmpOp _ AddExpr ):* {% d => d[1] ? d[1].reduce((acc,c)=>({op:c[1],left:acc,right:c[3]}), d[0]) : d[0] %}

#CmpOp -> "==" | "!=" | ">=" | "<=" | ">" | "<" {% d => d[0] %}
CmpEq -> %eq %eq            {% d => "==" %}
CmpNe -> "!" %eq            {% d => "!=" %}
CmpGe -> ">" %eq            {% d => ">=" %}
CmpLe -> "<" %eq            {% d => "<=" %}

CmpOp ->
    "=="   {% d => d[0] %}
  | CmpEq  {% d => d[0] %}
  | "!="   {% d => d[0] %}
  | CmpNe  {% d => d[0] %}
  | ">="   {% d => d[0] %}
  | CmpGe  {% d => d[0] %}
  | "<="   {% d => d[0] %}
  | CmpLe  {% d => d[0] %}
  | ">"    {% d => d[0] %}
  | "<"    {% d => d[0] %}


AddExpr -> MulExpr ( _ AddOp _ MulExpr ):* {% d => d[1] ? d[1].reduce((acc,c)=>({op:c[2],left:acc,right:c[4]}), d[0]) : d[0] %}

AddOp -> "+" | "-" {% d => d[0] %}

MulExpr -> Primary ( _ MulOp _ Primary ):* {% d => d[1] ? d[1].reduce((acc,c)=>({op:c[2],left:acc,right:c[4]}), d[0]) : d[0] %}

MulOp -> "*" | "/" {% d => d[0] %}

Primary ->
    Value
  | "(" _ Expr _ ")" {% d => d[2] %}

#object -> lbrace _ ObjPairs:? _ rbrace {% d => Object.fromEntries(d[2] || []) %}
object -> lbrace _ OptNL ObjPairsNL:? OptNL _ rbrace {% d => Object.fromEntries(d[3] || []) %}

ObjPairsNL ->
  ObjPair ( _ "," _ OptNL ObjPair ):* ( _ "," OptNL ):?
  {% d => [ d[0], ...(d[1] ? d[1].map(x=>x[4]) : []) ] %}


ObjPairs ->
    ObjPair ( _ "," _ ObjPair ):* ( _ "," ):?
  {% d => [ d[0], ...(d[1] ? d[1].map(x=>x[3]) : []) ] %}

ObjPair -> key _ ":" _ Value {% d => [d[0], d[4]] %}

#array -> lbrack _ ArrVals:? _ rbrack {% d => d[2] || [] %}
array -> lbrack _ OptNL ArrValsNL:? OptNL _ rbrack {% d => d[3] || [] %}

 ArrValsNL ->
   Value ( _ "," _ OptNL Value ):* ( _ "," OptNL ):?
   {% d => [ d[0], ...(d[1] ? d[1].map(x=>x[4]) : []) ] %}

ArrBlock ->
   BlockOpen OptCNL ArrItems:? OptCNL DEDENT
   {% d => normalizeArrItems(unwrapDeep(d[2]) || []) %}

ArrItems ->
   ArrItem (OptCNL ArrItem):* OptCNL
   {% d => [ d[0], ...(d[1] ? d[1].map(x=>x[1]) : []) ] %}


ArrItem ->
     ArrObj
   | Value

# «Запись» без {}: голова и, опционально, хвост под отступом
ArrObj ->
   ArrObjHead ArrObjTail:?
   {% d => {
     const headPairs = d[0];          // [[k,v], ...]
     const tailPairs = d[1] || [];    // [{key, value}, ...] либо []
     const entries = [];
     // из головы уже пары-массивы:
     for (const kv of headPairs) entries.push(kv);
     // хвост: KeyValLine -> {key, value}
     for (const kv of tailPairs) entries.push([kv.key, plain(kv.value)]);
     return Object.fromEntries(entries.map(([k, v]) => [k, plain(v)]));
   } %}


# Голова записи: обязательное «k: v», плюс можно добить через CSV
ArrObjHead ->
   key _ ":" _ Value ( _ "," _ KeyValList ):?
   {% d => {
     const head = [ d[0], unwrap(d[4]) ];        // [k,v]
     const csv  = d[5] ? d[5][3] : [];           // KeyValList → [[k,v],...]
     return [ head, ...csv ];
   } %}

# Хвост записи: перенос на новую строку под отступ,
# разрешаем опциональную запятую на конце строки головы
ArrObjTail ->
   ( _ "," ):? _ NEWLINE INDENT KeyValLineList DEDENT
   {% d => d[4] %}


ArrVals ->
    Value ( _ "," _ Value ):* ( _ "," ):?
  {% d => [ d[0], ...(d[1] ? d[1].map(x=>x[3]) : []) ] %}


# ================== Atoms & tokens ==================
key -> ident ( "." ident ):* {% d => d[1] ? d[1].reduce((acc,cur)=>acc+"."+cur[1], d[0]) : d[0] %}

IdList -> ident ( _ "," _ ident ):* {% d => [ d[0], ...(d[1]? d[1].map(x=>x[3]):[]) ] %}

ident  -> %ident  {% d => d[0].value %}
number -> %number {% d => Number(d[0].value) %}
# если лексер выдаёт один токен string и он уже с кавычками:
string -> %string {% d => JSON.parse(d[0].value[0]==="'" ? d[0].value.replace(/^'/,'"').replace(/'$/,'"') : d[0].value) %}
bool   -> %bool   {% d => d[0].value === "true" %}
Ref    -> RefPath {% d => ({ ref: d[0] }) %}
#Ref    -> key     {% d => ({ ref: d[0] }) %}

locale -> ident

lbrace -> %lbrace {% d => d[0].value %}
rbrace -> %rbrace {% d => d[0].value %}
lbrack -> %lbrack {% d => d[0].value %}
rbrack -> %rbrack {% d => d[0].value %}

NEWLINE -> %NEWLINE {% d => d[0] %}
INDENT  -> %INDENT  {% d => d[0] %}
DEDENT  -> %DEDENT  {% d => d[0] %}

# inline whitespace/comments
_ -> (%ws | %comment ):* {% d => null %}