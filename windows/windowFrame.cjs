const BORDER = 6, TITLE = 36, EDGES = new Set(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']);
function contentBounds(width, height, maximized = false) { const b = maximized ? 0 : BORDER; return { x: b, y: TITLE, width: Math.max(1, width - b * 2), height: Math.max(1, height - TITLE - b) }; }
function resizeBounds(start, edge, dx, dy, minWidth = 360, minHeight = 640) {
    if (!EDGES.has(edge) || !Number.isFinite(dx) || !Number.isFinite(dy))
        throw Error('Invalid resize');
    const b = { ...start };
    if (edge.includes('e'))
        b.width = Math.max(minWidth, Math.min(8000, start.width + dx));
    if (edge.includes('s'))
        b.height = Math.max(minHeight, Math.min(8000, start.height + dy));
    if (edge.includes('w')) {
        b.width = Math.max(minWidth, Math.min(8000, start.width - dx));
        b.x = start.x + start.width - b.width;
    }
    if (edge.includes('n')) {
        b.height = Math.max(minHeight, Math.min(8000, start.height - dy));
        b.y = start.y + start.height - b.height;
    }
    return Object.fromEntries(Object.entries(b).map(([k, v]) => [k, Math.round(v)]));
}
module.exports = { contentBounds, resizeBounds, EDGES };
