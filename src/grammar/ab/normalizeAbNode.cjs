// src/passes/ab-weights.cjs
function normalizeAbNode(ab) {
    const vs = Array.isArray(ab.variants) ? ab.variants : [];

    // разберём варианты на «проценты» и «доли»
    const perc = [];
    const shares = [];
    for (const v of vs) {
        const w = v?.weight ?? null;

        if (w && w.kind === "percent") {
            const val = Number.isFinite(+w.value) ? Math.max(0, +w.value) : 0;
            perc.push({ v, val });
        } else {
            // share или null → трактуем как доли
            const raw = w ? +w.value : 1;          // null → 1 доля
            const val = Number.isFinite(raw) ? Math.max(0, raw) : 1;
            shares.push({ v, val });
        }
    }

    // проверка суммы процентов
    const sumPerc = perc.reduce((s, x) => s + x.val, 0);
    if (sumPerc > 100 + 1e-9) {
        const name = ab.name || "(anonymous ab)";
        throw new Error(`AB "${name}": сумма процентов ${sumPerc}% > 100%`);
    }

    // раздаём «остаток» по долям
    const leftover = Math.max(0, 100 - sumPerc);
    const sumShares = shares.reduce((s, x) => s + x.val, 0);

    const weights = new Map();
    for (const x of perc) weights.set(x.v, x.val);

    if (shares.length) {
        const factor = sumShares > 0 ? leftover / sumShares : 0;
        for (const x of shares) {
            weights.set(x.v, sumShares ? x.val * factor : 0);
        }
    }

    // если почему-то всё нули — делим поровну
    if (vs.length && [...weights.values()].every(v => v === 0)) {
        const eq = 100 / vs.length;
        vs.forEach(v => weights.set(v, eq));
    }

    // компенсация fp-ошибки — чтобы сумма была ровно 100
    const total = [...weights.values()].reduce((s, x) => s + x, 0);
    const diff = 100 - total;
    if (Math.abs(diff) > 1e-6 && vs.length) {
        const first = vs[0];
        weights.set(first, (weights.get(first) || 0) + diff);
    }

    return {
        ...ab,
        variants: vs.map(v => ({ ...v, weight_norm: weights.get(v) }))
    };
}

module.exports = { normalizeAbNode };
