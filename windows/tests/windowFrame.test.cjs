const { test } = require('node:test'), assert = require('node:assert/strict'), { contentBounds, resizeBounds } = require('../windowFrame.cjs');
test('content has a separate viewport below chrome', () => { assert.deepEqual(contentBounds(1400, 900), { x: 6, y: 36, width: 1388, height: 858 }); assert.deepEqual(contentBounds(1400, 900, true), { x: 0, y: 36, width: 1400, height: 864 }); });
test('all eight resize edges preserve opposite sides', () => { const b = { x: 100, y: 100, width: 1400, height: 900 }; for (const edge of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']) {
    const r = resizeBounds(b, edge, 30, 40);
    if (edge.includes('e'))
        assert.equal(r.width, 1430);
    if (edge.includes('s'))
        assert.equal(r.height, 940);
    if (edge.includes('w')) {
        assert.equal(r.width, 1370);
        assert.equal(r.x + r.width, 1500);
    }
    if (edge.includes('n')) {
        assert.equal(r.height, 860);
        assert.equal(r.y + r.height, 1000);
    }
} });
test('minima clamp and malformed resize cannot set bounds', () => { assert.deepEqual(resizeBounds({ x: 100, y: 100, width: 400, height: 700 }, 'nw', 500, 500), { x: 140, y: 160, width: 360, height: 640 }); assert.throws(() => resizeBounds({}, 'bad', 1, 1)); assert.throws(() => resizeBounds({}, 'e', NaN, 1)); });
