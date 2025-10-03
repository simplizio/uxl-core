export function validateContract(contract) {
    if (!contract || contract.type !== "contract") {
        return { ok: false, errors: ["contract.type must be 'contract'"] };
    }
    if (!contract.screens || typeof contract.screens !== "object") {
        return { ok: false, errors: ["contract.screens must be an object"] };
    }
    // можно расширить: проверить, что ссылки ref/include уже развёрнуты, и т.п.
    return { ok: true };
}
