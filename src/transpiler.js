// Очень простой проход по AST из grammar.ne:
// program.defs -> { screens, templates, data, i18n, ab }
export function transpile(ast) {
    const out = {
        type: "contract",
        version: "0.1.0",
        screens: {},
        templates: {},
        data: {},
        i18n: {},
        ab: {}
    };

    for (const def of ast.defs || []) {
        switch (def.type) {
            case "template":
                out.templates[def.name] = serializeAreas(def.areas);
                break;

            case "screen":
                out.screens[def.name] = {
                    extends: def.extends || null,
                    items: serializeScreenItems(def.items)
                };
                break;

            case "data":
                out.data[def.name] = def.source; // {kind:"endpoint", url:"..."}
                break;

            case "i18n":
                out.i18n[def.locale] = Object.fromEntries(
                    (def.entries || []).map(e => [e.key, e.value])
                );
                break;

            case "ab":
                out.ab[def.name] = Object.fromEntries(
                    (def.variants || []).map(v => [v.name, v.weight || null])
                );
                break;

            case "export_template":
                // на уровне контракта экспортов нет — они разворачиваются линкером выше.
                break;

            case "export_block":
                // блоки/инклюды тоже должны быть развёрнуты до этого шага.
                break;

            default:
                // ignore/import/useData/param и прочее — часть резолвинга делается до транспиляции.
                break;
        }
    }

    return out;
}

function serializeAreas(areas = []) {
    return areas.map(a => ({
        type: "area",
        name: a.name,
        layout: a.layout || null,
        items: serializeAreaItems(a.items || [])
    }));
}

function serializeScreenItems(items) {
    return items.map(serializeScreenItem).filter(Boolean);
}

function serializeScreenItem(it) {
    if (!it) return null;
    switch (it.type) {
        case "area": return {
            type: "area",
            name: it.name,
            layout: it.layout || null,
            items: serializeAreaItems(it.items || [])
        };
        case "component": return serializeComponent(it);
        default:
            // when/on/track/param/useData/include попадают внутрь соответствующих узлов (area/component)
            return serializeGeneric(it);
    }
}

function serializeAreaItems(items) {
    return items.map(it => {
        if (it.type === "area") return serializeScreenItem(it);
        if (it.type === "component") return serializeComponent(it);
        if (it.kind === "when") return serializeWhen(it);
        if (it.kind === "track") return serializeTrackBlock(it);
        if (it.kind === "on") return serializeOnBlock(it);
        if (it.kind === "prop") return { type: "prop", key: it.key, value: it.value };
        if (it.type === "include") return { type: "include", ref: it.ref }; // Должно быть развёрнуто линкером
        return null;
    }).filter(Boolean);
}

function serializeComponent(c) {
    const node = { type: "component", ctype: c.ctype, cid: c.cid || null, bind: {}, props: {}, when: [], on: [], track: [] };
    for (const item of c.items || []) {
        if (item.kind === "bind") {
            for (const e of item.entries || []) node.bind[e.key] = e.expr;
        } else if (item.kind === "prop") {
            node.props[item.key] = item.value;
        } else if (item.kind === "when") {
            node.when.push(serializeWhen(item));
        } else if (item.kind === "on") {
            node.on.push(serializeOnBlock(item));
        } else if (item.kind === "track") {
            node.track.push(serializeTrackBlock(item));
        } else if (item.type === "area") {
            // компонент-контейнер
            node.children = node.children || [];
            node.children.push(serializeScreenItem(item));
        } else if (item.type === "include") {
            // ожидаем, что линкер уже вставил реальные ноды
            node.children = node.children || [];
            node.children.push({ type: "include", ref: item.ref });
        }
    }
    return node;
}

function serializeWhen(w) {
    return { type: "when", expr: w.expr, items: serializeAreaItems(w.items || []) };
}

function serializeOnBlock(ob) {
    return { type: "on", event: ob.event, actions: (ob.actions || []).map(serializeAction) };
}

function serializeAction(a) {
    // {type:"navigate"/"record"/"emit", args:{...}}
    // Гарантируем shape и не допускаем лишних полей
    return {
        type: a.type,            // ожидаем 'navigate' | 'record' | 'emit'
        args: a.args ?? {}
    };
}

function serializeTrackBlock(tb) {
    const obj = {};
    for (const e of tb.entries || []) obj[e.key] = e.value;
    return { type: "track", data: obj };
}

function serializeGeneric(it) {
    if (it.kind === "when") return serializeWhen(it);
    if (it.kind === "on") return serializeOnBlock(it);
    if (it.kind === "track") return serializeTrackBlock(it);
    if (it.type === "include") return { type: "include", ref: it.ref };
    return null;
}
