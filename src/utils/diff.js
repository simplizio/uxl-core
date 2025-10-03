// Очень простой diff: сравнение списков компонентов по (ctype,cid).
// Позже заменим на nodeId = hash(path+type+name)
export function diffAST(astA, astB) {
    const flatA = flatten(astA);
    const flatB = flatten(astB);
    const indexA = new Map(flatA.map(n => [keyOf(n), n]));
    const indexB = new Map(flatB.map(n => [keyOf(n), n]));

    const changes = [];
    for (const k of indexB.keys()) if (!indexA.has(k)) changes.push({ type: "ADD_NODE", id: k });
    for (const k of indexA.keys()) if (!indexB.has(k)) changes.push({ type: "REMOVE_NODE", id: k });

    // простейший CHANGE_PROP для общих ключей
    for (const k of indexA.keys()) {
        if (indexB.has(k)) {
            const a = indexA.get(k), b = indexB.get(k);
            const propDiff = shallowPropsDiff(a, b);
            if (propDiff.length) changes.push({ type: "CHANGE_PROP", id: k, changes: propDiff });
        }
    }
    return changes;
}

function keyOf(n) {
    // ключ упрощённый, для MVP
    if (n.type === "component") return `cmp:${n.ctype}:${n.cid ?? ""}`;
    if (n.type === "area") return `area:${n.name}`;
    if (n.type === "screen") return `screen:${n.name}`;
    return `${n.type}:${n.name ?? ""}`;
}

function flatten(ast) {
    const out = [];
    function walk(node) {
        if (!node || typeof node !== "object") return;
        if (node.type) out.push(node);
        for (const k in node) {
            const v = node[k];
            if (Array.isArray(v)) v.forEach(walk);
            else if (v && typeof v === "object") walk(v);
        }
    }
    walk(ast);
    return out;
}

function shallowPropsDiff(a, b) {
    const res = [];
    const propsA = a.props || {};
    const propsB = b.props || {};
    const keys = new Set([...Object.keys(propsA), ...Object.keys(propsB)]);
    for (const k of keys) {
        if (JSON.stringify(propsA[k]) !== JSON.stringify(propsB[k])) {
            res.push({ key: k, from: propsA[k], to: propsB[k] });
        }
    }
    return res;
}
