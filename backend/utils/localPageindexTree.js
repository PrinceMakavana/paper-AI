function localNodeToTreeNode(raw) {
    const pageIndexField = raw?.page_index ?? raw?.start_index;
    let pageIndex = 1;

    if (typeof pageIndexField === 'number' && Number.isFinite(pageIndexField)) {
        pageIndex = pageIndexField;
    } else if (typeof pageIndexField === 'string' && /^\d+$/.test(pageIndexField)) {
        pageIndex = parseInt(pageIndexField, 10);
    }

    const childList = Array.isArray(raw?.nodes) ? raw.nodes : [];
    const nodes = childList.length > 0 ? childList.map(localNodeToTreeNode) : undefined;

    return {
        title: String(raw?.title ?? ''),
        node_id: String(raw?.node_id ?? ''),
        page_index: pageIndex,
        text: String(raw?.text ?? ''),
        summary: raw?.summary != null ? String(raw.summary) : undefined,
        nodes,
    };
}

function localStructureToTreeNodes(structure) {
    if (!Array.isArray(structure)) return undefined;
    return structure.map(localNodeToTreeNode);
}

export {
    localStructureToTreeNodes,
};
