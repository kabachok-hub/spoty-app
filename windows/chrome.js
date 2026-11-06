'use strict';
for (const action of ['minimize', 'maximize', 'close'])
    document.getElementById(action).addEventListener('click', () => window.SpotyWindow.action(action));
let edge = null;
for (const element of document.querySelectorAll('[data-edge]'))
    element.addEventListener('pointerdown', event => { if (event.button !== 0)
        return; edge = element.dataset.edge; element.setPointerCapture(event.pointerId); window.SpotyWindow.resize('start', edge); });
window.addEventListener('pointermove', () => { if (edge)
    window.SpotyWindow.resize('move', edge); });
function end() { if (edge) {
    window.SpotyWindow.resize('end', edge);
    edge = null;
} }
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture', 'blur'])
    window.addEventListener(name, end);
window.SpotyWindow.listen(state => { document.documentElement.classList.toggle('maximized', state.maximized); document.getElementById('version').textContent = state.version; document.getElementById('maximize').title = state.maximized ? 'Восстановить размер' : 'Развернуть'; });
