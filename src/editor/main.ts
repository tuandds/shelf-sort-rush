// Pixel Squadron level editor. Plain DOM; reads/writes the same level format the game uses (src/game/data.ts)
// and previews boards and planes with the game's own generator (src/game/levelgen.ts).
import { BCOLS, BROWS, EDITOR_KEY, LEVELS, PAL, SLOTS, type BigSpec, type Level, type Wave } from '../game/data';
import { generateLevel, splitAmmo, type Generated } from '../game/levelgen';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const COLOR_NAMES: Record<string, string> = {
    r: 'Đỏ', p: 'Hồng', y: 'Vàng', k: 'Xám xanh', w: 'Trắng', g: 'Xanh lá', c: 'Xanh ngọc', o: 'Cam', b: 'Xanh dương', v: 'Tím'
};
const KEYS = Object.keys(PAL); // r p y k w g c o b v
type Tool = 'paint' | 'erase' | 'fill' | 'pick';

// ---------- state ----------
let levels: Level[] = load();
let cur = 0;
let wave = 0;
let colour = 'r';
let tool: Tool = 'paint';
let dirty = false;
let seed = 1;
let undoStack: string[] = [];
let mode: 'editor' | 'organizer' = 'editor';

function load(): Level[] {
    try {
        const raw = localStorage.getItem(EDITOR_KEY);
        const list = raw ? JSON.parse(raw) : null;
        if (Array.isArray(list) && list.length) return list.map(normalize);
    } catch { /* storage blocked or corrupt: start from the built-in levels */ }
    return clone(LEVELS).map(normalize);
}

/** Make every wave rectangular with explicit ox/dy so the editor can work on it. */
function normalize(L: Level): Level {
    const out: Level = { ...clone(L), name: L.name || 'Màn mới', waves: [] };
    for (const w of L.waves || []) {
        const width = Math.max(1, ...w.art.map((r) => r.length));
        out.waves.push({ ox: w.ox ?? Math.floor((BCOLS - width) / 2), dy: w.dy || 0, art: w.art.map((r) => r.padEnd(width, '.')) });
    }
    if (!out.waves.length) out.waves.push(blankWave());
    return out;
}

function blankWave(dy = 0): Wave { return { ox: 5, dy, art: Array.from({ length: 6 }, () => '.'.repeat(11)) }; }

const L = () => levels[cur];
const W = () => L().waves[wave];

function save() {
    try {
        localStorage.setItem(EDITOR_KEY, JSON.stringify(levels));
        setDirty(false);
        return true;
    } catch {
        toast('Không lưu được: trình duyệt chặn bộ nhớ');
        return false;
    }
}

function setDirty(on: boolean) { dirty = on; $('dirty').classList.toggle('on', on); }

/** Call before changing the current level: records an undo point. */
function snapshot() {
    undoStack.push(JSON.stringify(L()));
    if (undoStack.length > 150) undoStack.shift();
    ($('btn-undo') as HTMLButtonElement).disabled = false;
}

function undo() {
    const s = undoStack.pop();
    if (!s) return;
    levels[cur] = JSON.parse(s);
    wave = Math.min(wave, L().waves.length - 1);
    ($('btn-undo') as HTMLButtonElement).disabled = !undoStack.length;
    changed(true);
}

/** Something in the current level changed: mark dirty and refresh everything that depends on it. */
function changed(rebuildGrid = false) {
    setDirty(true);
    renderAll(rebuildGrid);
}

let toastTimer = 0;
function toast(msg: string) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => t.classList.remove('show'), 1800);
}

// ---------- analysis ----------
interface Report { errors: string[]; warns: string[]; infos: string[]; counts: Record<string, number>; blocks: number }

function rawCounts(lv: Level) {
    const counts: Record<string, number> = {};
    let blocks = 0;
    for (const w of lv.waves) for (const row of w.art) for (const ch of row) if (PAL[ch]) { counts[ch] = (counts[ch] || 0) + 1; blocks++; }
    return { counts, blocks };
}

function validate(lv: Level): Report {
    const errors: string[] = [], warns: string[] = [], infos: string[] = [];
    const { counts, blocks } = rawCounts(lv);
    if (!blocks) errors.push('Màn chưa có khối nào.');
    let lo = 1e9, hi = -1e9;
    lv.waves.forEach((w) => { lo = Math.min(lo, w.ox ?? 0); hi = Math.max(hi, (w.ox ?? 0) + (w.art[0]?.length ?? 0)); });
    if (hi - lo > BCOLS) errors.push(`Đội hình rộng ${hi - lo} cột, board chỉ có ${BCOLS} cột.`);
    for (const k of KEYS) {
        const n = counts[k] || 0;
        if (n > 0 && n < 10) warns.push(`${COLOR_NAMES[k]} chỉ có ${n} khối: máy bay thường mang 10–20 viên, chiếc này sẽ chỉ có ${n} viên.`);
    }
    // two waves covering the same board cell
    const seen = new Map<string, number>();
    let overlaps = 0;
    lv.waves.forEach((w) => w.art.forEach((row, r) => [...row].forEach((ch, c) => {
        if (!PAL[ch]) return;
        const key = `${(w.dy || 0) + r}:${(w.ox ?? 0) + c}`;
        seen.set(key, (seen.get(key) || 0) + 1);
        if (seen.get(key) === 2) overlaps++;
    })));
    if (overlaps) warns.push(`${overlaps} ô bị hai mảng hình chồng lên nhau.`);
    lv.waves.forEach((w, i) => { if (!w.art.some((r) => /[^.]/.test(r))) warns.push(`Mảng ${i + 1} đang trống.`); });
    const colours = Object.keys(counts).length;
    if (colours > SLOTS) infos.push(`${colours} màu cả màn, nhiều hơn ${SLOTS} chỗ trên trời: nên để các màu xuất hiện lần lượt.`);
    if (lv.connected) {
        const planes = Object.values(counts).reduce((a, n) => a + splitAmmo(n).length, 0);
        if (planes < lv.connected * 2 + 2) warns.push(`Chỉ ~${planes} máy bay, khó tạo đủ ${lv.connected} cặp nối đôi.`);
    }
    const mech = (lv.hidden ? 'hidden' : '') || (lv.connected ? 'linked' : '') || (lv.big?.length ? 'big' : '');
    if (mech && !lv.feature) infos.push('Màn có cơ chế đặc biệt nhưng chưa chọn popup tính năng mới (chỉ cần ở màn đầu tiên có cơ chế đó).');
    return { errors, warns, infos, counts, blocks };
}

/** Deterministic random so the preview does not flicker on every edit; 🎲 changes the seed. */
function seeded(s: number) {
    return () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function sample(lv: Level): Generated | null {
    try { return generateLevel(lv, seeded(seed)); } catch { return null; }
}

// ---------- colour bank ----------
function renderPalette() {
    const { counts } = rawCounts(L());
    $('palette').innerHTML = KEYS.map((k, i) => `<button class="swatch${k === colour && tool !== 'erase' ? ' on' : ''}" data-k="${k}" title="Phím ${(i + 1) % 10}">
        <i style="background:${PAL[k]}"></i><span>${COLOR_NAMES[k]}<em>${k} · ${counts[k] || 0} khối</em></span></button>`).join('');
    $('palette').querySelectorAll<HTMLButtonElement>('.swatch').forEach((b) => b.onclick = () => {
        colour = b.dataset.k!;
        if (tool === 'erase' || tool === 'pick') tool = 'paint';
        renderPalette(); renderTools();
    });
}

const TOOLS: [Tool, string, string][] = [['paint', '✏️', 'Vẽ (B)'], ['erase', '🧽', 'Tẩy (E)'], ['fill', '🪣', 'Đổ màu (G)'], ['pick', '💧', 'Hút màu (I)']];
function renderTools() {
    $('tools').innerHTML = TOOLS.map(([t, icon, tip]) => `<button class="tool${t === tool ? ' on' : ''}" data-t="${t}" title="${tip}">${icon}</button>`).join('');
    $('tools').querySelectorAll<HTMLButtonElement>('.tool').forEach((b) => b.onclick = () => { tool = b.dataset.t as Tool; renderTools(); renderPalette(); });
}

// ---------- wave editor ----------
function renderValidation() {
    const rep = validate(L());
    const box = $('validation');
    box.className = 'validation ' + (rep.errors.length ? 'err' : rep.warns.length ? 'warn' : 'ok');
    const lines = [
        ...rep.errors.map((e) => `<div>⛔ ${e}</div>`),
        ...rep.warns.map((e) => `<div>⚠️ ${e}</div>`),
        ...rep.infos.map((e) => `<div>ℹ️ ${e}</div>`)
    ];
    box.innerHTML = lines.length ? lines.join('') : `<div>✅ Hợp lệ · ${rep.blocks} khối · ${Object.keys(rep.counts).length} màu</div>`;
    $('counts').innerHTML = Object.keys(rep.counts).length
        ? KEYS.filter((k) => rep.counts[k]).map((k) => `<span class="chip${rep.counts[k] < 10 ? ' bad' : ''}"><i style="background:${PAL[k]}"></i>${rep.counts[k]}</span>`).join('')
        : '<span class="hint">Chưa có khối nào</span>';
}

function renderWaveTabs() {
    $('wave-tabs').innerHTML = L().waves.map((w, i) => `<button class="wave-tab${i === wave ? ' on' : ''}" data-i="${i}" title="dy ${w.dy}">W${i + 1}</button>`).join('');
    $('wave-tabs').querySelectorAll<HTMLButtonElement>('.wave-tab').forEach((b) => b.onclick = () => selectWave(+b.dataset.i!));
    const w = W();
    ($('w-width') as HTMLInputElement).value = String(w.art[0]?.length ?? 1);
    ($('w-height') as HTMLInputElement).value = String(w.art.length);
    ($('w-ox') as HTMLInputElement).value = String(w.ox ?? 0);
    ($('w-dy') as HTMLInputElement).value = String(w.dy || 0);
    ($('wave-del') as HTMLButtonElement).disabled = L().waves.length <= 1;
}

function selectWave(i: number) {
    wave = Math.max(0, Math.min(i, L().waves.length - 1));
    renderAll(true);
}

let painting = false;
function buildGrid() {
    const w = W(), grid = $('grid');
    const cols = w.art[0]?.length ?? 1;
    grid.style.gridTemplateColumns = `repeat(${cols}, 22px)`;
    grid.innerHTML = '';
    w.art.forEach((row, r) => [...row].forEach((ch, c) => {
        const d = document.createElement('div');
        d.className = 'cell' + (PAL[ch] ? ' f' : '');
        d.dataset.r = String(r); d.dataset.c = String(c);
        if (PAL[ch]) d.style.background = PAL[ch];
        grid.appendChild(d);
    }));
}

function paintCellEl(r: number, c: number) {
    const el = $('grid').children[r * (W().art[0].length) + c] as HTMLElement | undefined;
    if (!el) return;
    const ch = W().art[r][c];
    el.className = 'cell' + (PAL[ch] ? ' f' : '');
    el.style.background = PAL[ch] || '';
}

function setCh(r: number, c: number, ch: string) {
    const art = W().art;
    if (art[r][c] === ch) return false;
    art[r] = art[r].slice(0, c) + ch + art[r].slice(c + 1);
    paintCellEl(r, c);
    return true;
}

function flood(r0: number, c0: number, ch: string) {
    const art = W().art, from = art[r0][c0];
    if (from === ch) return;
    const st = [[r0, c0]];
    while (st.length) {
        const [r, c] = st.pop()!;
        if (r < 0 || c < 0 || r >= art.length || c >= art[0].length || art[r][c] !== from) continue;
        setCh(r, c, ch);
        st.push([r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]);
    }
}

function applyTool(el: Element | null, erase: boolean) {
    if (!(el instanceof HTMLElement) || !el.dataset.r) return;
    const r = +el.dataset.r, c = +el.dataset.c!;
    if (tool === 'pick') {
        const ch = W().art[r][c];
        if (PAL[ch]) { colour = ch; tool = 'paint'; renderPalette(); renderTools(); }
        return;
    }
    if (tool === 'fill' && !erase) { flood(r, c, colour); return; }
    setCh(r, c, erase || tool === 'erase' ? '.' : colour);
}

function wireGrid() {
    const grid = $('grid');
    let erase = false;
    grid.addEventListener('contextmenu', (e) => e.preventDefault());
    grid.addEventListener('pointerdown', (e) => {
        if (!(e.target as HTMLElement).dataset.r) return;
        e.preventDefault();
        snapshot();
        painting = true; erase = e.button === 2;
        grid.setPointerCapture(e.pointerId);
        applyTool(e.target as Element, erase);
        if (tool === 'fill' || tool === 'pick') painting = false;
        refreshDerived();
    });
    grid.addEventListener('pointermove', (e) => {
        if (!painting) return;
        applyTool(document.elementFromPoint(e.clientX, e.clientY), erase);
    });
    const end = () => { if (painting) { painting = false; setDirty(true); refreshDerived(); } };
    grid.addEventListener('pointerup', end);
    grid.addEventListener('pointercancel', end);
}

/** Resize the current wave's art, keeping existing pixels anchored top-left. */
function resizeWave(width: number, height: number) {
    width = Math.max(1, Math.min(BCOLS, width | 0)); height = Math.max(1, Math.min(40, height | 0));
    snapshot();
    const w = W();
    const art = w.art.slice(0, height).map((r) => r.slice(0, width).padEnd(width, '.'));
    while (art.length < height) art.push('.'.repeat(width));
    w.art = art;
    changed(true);
}

function shiftWave(dr: number, dc: number) {
    snapshot();
    const w = W(), h = w.art.length, wd = w.art[0].length;
    const next = Array.from({ length: h }, (_, r) => Array.from({ length: wd }, (_, c) => {
        const sr = r - dr, sc = c - dc;
        return sr >= 0 && sr < h && sc >= 0 && sc < wd ? w.art[sr][sc] : '.';
    }).join(''));
    w.art = next;
    changed(true);
}

function wireWaveControls() {
    $('wave-add').onclick = () => {
        snapshot();
        const minDy = Math.min(...L().waves.map((w) => w.dy || 0));
        const top = Math.min(...L().waves.filter((w) => (w.dy || 0) === minDy).map((w) => w.art.length));
        L().waves.push(blankWave(minDy - Math.max(4, top)));
        wave = L().waves.length - 1;
        changed(true);
    };
    $('wave-dup').onclick = () => {
        snapshot();
        const w = clone(W());
        const minDy = Math.min(...L().waves.map((x) => x.dy || 0));
        w.dy = minDy - w.art.length;
        L().waves.push(w);
        wave = L().waves.length - 1;
        changed(true);
    };
    $('wave-del').onclick = () => {
        if (L().waves.length <= 1) return;
        snapshot();
        L().waves.splice(wave, 1);
        wave = Math.max(0, wave - 1);
        changed(true);
    };
    const num = (id: string) => +(($(id) as HTMLInputElement).value || 0);
    $('w-width').onchange = () => resizeWave(num('w-width'), W().art.length);
    $('w-height').onchange = () => resizeWave(W().art[0].length, num('w-height'));
    $('w-ox').onchange = () => { snapshot(); W().ox = Math.max(0, Math.min(BCOLS - 1, num('w-ox'))); changed(); };
    $('w-dy').onchange = () => { snapshot(); W().dy = Math.min(0, num('w-dy')); changed(); };
    $('w-flip').onclick = () => { snapshot(); W().art = W().art.map((r) => [...r].reverse().join('')); changed(true); };
    $('w-up').onclick = () => shiftWave(-1, 0);
    $('w-down').onclick = () => shiftWave(1, 0);
    $('w-left').onclick = () => shiftWave(0, -1);
    $('w-right').onclick = () => shiftWave(0, 1);
    $('w-clear').onclick = () => { snapshot(); W().art = W().art.map((r) => '.'.repeat(r.length)); changed(true); };
    $('btn-undo').onclick = undo;
    $('s-name').oninput = () => { L().name = ($('s-name') as HTMLInputElement).value; setDirty(true); $('lvl-name').textContent = L().name; };
    $('s-name').onfocus = () => snapshot();
    $('s-feature').onchange = () => {
        snapshot();
        const v = ($('s-feature') as HTMLSelectElement).value;
        if (v) L().feature = v; else delete L().feature;
        changed();
    };
}

// ---------- mechanics ----------
const BOSS_CORE: BigSpec = { n: 1, hp: [20, 20], size: 5 };
const isBoss = (b: BigSpec) => b.size === 5;

function renderMech() {
    const lv = L();
    const big = lv.big || [];
    const on = { hidden: !!lv.hidden, linked: !!lv.connected, big: big.some((b) => !isBoss(b)), boss: big.some(isBoss) };
    const btns: [keyof typeof on, string, string, string][] = [
        ['hidden', '❓', 'ẨN', 'Máy bay ẩn: chiếc dưới đầu hàng giấu màu và số đạn'],
        ['linked', '🔗', 'NỐI ĐÔI', 'Cặp máy bay ở hai khoang, chỉ cất cánh cùng nhau'],
        ['big', '🧱', 'KHỐI LỚN', 'Khối lớn 2×2…4×4 với độ bền 5–10'],
        ['boss', '👑', 'LÕI TRÙM', 'Một khối 5×5 độ bền 20 trên mỗi mảng đủ lớn']
    ];
    $('mech').innerHTML = btns.map(([k, icon, label, tip]) => `<button class="mech-btn${on[k] ? ' on' : ''}" data-k="${k}" title="${tip}">${icon}<small>${label}</small></button>`).join('');
    $('mech').querySelectorAll<HTMLButtonElement>('.mech-btn').forEach((b) => b.onclick = () => {
        snapshot();
        const k = b.dataset.k as keyof typeof on;
        if (k === 'hidden') lv.hidden = on.hidden ? undefined : 0.4;
        if (k === 'linked') lv.connected = on.linked ? undefined : 3;
        if (k === 'big') lv.big = on.big ? big.filter(isBoss) : [...big, { n: 2, hp: [5, 10] }];
        if (k === 'boss') lv.big = on.boss ? big.filter((x) => !isBoss(x)) : [clone(BOSS_CORE), ...big];
        if (lv.big && !lv.big.length) delete lv.big;
        if (!lv.hidden) delete lv.hidden;
        if (!lv.connected) delete lv.connected;
        changed();
    });

    const parts: string[] = [];
    if (lv.hidden) parts.push(`<div class="setting-row"><label>Tỉ lệ máy bay ẩn</label>
        <input type="range" id="m-hidden" min="5" max="80" step="5" value="${Math.round(lv.hidden * 100)}"><span class="setting-val">${Math.round(lv.hidden * 100)}%</span></div>`);
    if (lv.connected) parts.push(`<div class="setting-row"><label>Số cặp nối đôi</label>
        <input type="range" id="m-linked" min="1" max="6" step="1" value="${lv.connected}"><span class="setting-val">${lv.connected}</span></div>`);
    if (lv.big?.length) {
        parts.push('<div class="setting-row" style="margin-top:10px;"><label>Khối lớn (mỗi mảng)</label><span class="hint" style="margin:0">số lượng · độ bền min–max · kích thước</span></div>');
        lv.big.forEach((b, i) => parts.push(`<div class="big-row" data-i="${i}" style="margin-left:160px;">
            <input type="number" data-f="n" min="1" max="6" value="${b.n}" title="Số khối mỗi mảng">
            <input type="number" data-f="lo" min="2" max="40" value="${b.hp[0]}" title="Độ bền tối thiểu">
            <input type="number" data-f="hi" min="2" max="40" value="${b.hp[1]}" title="Độ bền tối đa">
            <select data-f="size" title="Kích thước">${['', '2', '3', '4', '5'].map((s) => `<option value="${s}"${String(b.size ?? '') === s ? ' selected' : ''}>${s ? `${s}×${s}` : 'Theo độ bền'}</option>`).join('')}</select>
            <button class="btn danger" data-f="del">✕</button></div>`));
        parts.push('<div style="margin-left:160px;"><button class="btn" id="m-big-add">＋ Thêm loại khối lớn</button></div>');
    }
    $('mech-settings').innerHTML = parts.join('');
    const hid = $('m-hidden') as HTMLInputElement | null;
    if (hid) { hid.onpointerdown = () => snapshot(); hid.oninput = () => { lv.hidden = +hid.value / 100; (hid.nextElementSibling as HTMLElement).textContent = `${hid.value}%`; setDirty(true); refreshDerived(); }; }
    const lk = $('m-linked') as HTMLInputElement | null;
    if (lk) { lk.onpointerdown = () => snapshot(); lk.oninput = () => { lv.connected = +lk.value; (lk.nextElementSibling as HTMLElement).textContent = lk.value; setDirty(true); refreshDerived(); }; }
    $('mech-settings').querySelectorAll<HTMLElement>('.big-row').forEach((row) => {
        const i = +row.dataset.i!;
        row.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input,select').forEach((inp) => inp.onchange = () => {
            snapshot();
            const b = lv.big![i], v = inp.value;
            if (inp.dataset.f === 'n') b.n = Math.max(1, +v || 1);
            if (inp.dataset.f === 'lo') b.hp = [Math.max(2, +v || 2), Math.max(b.hp[1], +v || 2)];
            if (inp.dataset.f === 'hi') b.hp = [Math.min(b.hp[0], +v || 2), Math.max(2, +v || 2)];
            if (inp.dataset.f === 'size') { if (v) b.size = +v; else delete b.size; }
            changed();
        });
        (row.querySelector('[data-f=del]') as HTMLButtonElement).onclick = () => {
            snapshot();
            lv.big!.splice(i, 1);
            if (!lv.big!.length) delete lv.big;
            changed();
        };
    });
    const add = $('m-big-add');
    if (add) add.onclick = () => { snapshot(); lv.big!.push({ n: 1, hp: [5, 10] }); changed(); };
}

// ---------- board preview ----------
const CELL = 16;
let boardGeom = { minRow: 0, off: 0 };
function renderBoard() {
    const lv = L(), cv = $('board') as HTMLCanvasElement;
    const gen = sample(lv);
    // formation offset exactly like the game: centre the whole thing in 21 columns
    let lo = 1e9, hi = -1e9, minRow = 1e9, maxRow = -1e9;
    lv.waves.forEach((w) => {
        lo = Math.min(lo, w.ox ?? 0); hi = Math.max(hi, (w.ox ?? 0) + w.art[0].length);
        minRow = Math.min(minRow, w.dy || 0); maxRow = Math.max(maxRow, (w.dy || 0) + w.art.length - 1);
    });
    const off = Math.floor((BCOLS - (hi - lo)) / 2) - lo;
    // lowest row that actually has a block decides where the board's bottom is
    let lowest = -1e9;
    lv.waves.forEach((w) => w.art.forEach((row, r) => { if (/[^.]/.test(row)) lowest = Math.max(lowest, (w.dy || 0) + r); }));
    if (lowest < -1e8) lowest = maxRow;
    const rows = Math.max(lowest, maxRow) - minRow + 1;
    boardGeom = { minRow, off };
    const dpr = Math.min(2, devicePixelRatio || 1), pad = 6;
    const wpx = BCOLS * CELL + pad * 2, hpx = rows * CELL + pad * 2;
    cv.width = wpx * dpr; cv.height = hpx * dpr; cv.style.width = wpx + 'px'; cv.style.height = hpx + 'px';
    const g = cv.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#070b16'; g.fillRect(0, 0, wpx, hpx);
    const X = (c: number) => pad + c * CELL, Y = (r: number) => pad + (r - minRow) * CELL;
    // first screen: the 10 rows ending at the lowest block
    const top10 = lowest - BROWS + 1;
    g.fillStyle = 'rgba(74,222,128,.07)'; g.fillRect(X(0), Y(top10), BCOLS * CELL, BROWS * CELL);
    g.strokeStyle = 'rgba(74,222,128,.55)'; g.setLineDash([5, 4]); g.lineWidth = 1.5;
    g.strokeRect(X(0) + .5, Y(top10) + .5, BCOLS * CELL - 1, BROWS * CELL - 1); g.setLineDash([]);
    // column grid
    g.strokeStyle = 'rgba(255,255,255,.035)'; g.lineWidth = 1;
    for (let c = 0; c <= BCOLS; c++) { g.beginPath(); g.moveTo(X(c) + .5, pad); g.lineTo(X(c) + .5, hpx - pad); g.stroke(); }
    // blocks: draw the generated board so big blocks show up
    const occupied = new Map<string, number>();
    lv.waves.forEach((w) => w.art.forEach((row, r) => [...row].forEach((ch, c) => {
        if (!PAL[ch]) return;
        const k = `${(w.dy || 0) + r}:${(w.ox ?? 0) + c + off}`;
        occupied.set(k, (occupied.get(k) || 0) + 1);
    })));
    if (gen) gen.forms.forEach((f) => f.cells.forEach((row, r) => row.forEach((v, c) => {
        if (!v || v.a || !v.c) return;
        const x = X(f.ox + c), y = Y(f.dy + r), bw = (v.w || 1) * CELL, bh = (v.h || 1) * CELL;
        g.fillStyle = PAL[v.c]; roundRect(g, x + 1, y + 1, bw - 2, bh - 2, 3); g.fill();
        g.fillStyle = 'rgba(255,255,255,.22)'; roundRect(g, x + 1, y + 1, bw - 2, (bh - 2) * 0.4, 3); g.fill();
        if (v.big) {
            g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; roundRect(g, x + 2, y + 2, bw - 4, bh - 4, 3); g.stroke();
            g.fillStyle = '#fff'; g.font = `900 ${Math.round(CELL * 0.8)}px -apple-system,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
            g.fillText(String(v.hp), x + bw / 2, y + bh / 2 + 1);
        }
    })));
    // overlaps
    g.strokeStyle = '#ef4444'; g.lineWidth = 2;
    occupied.forEach((n, k) => {
        if (n < 2) return;
        const [r, c] = k.split(':').map(Number);
        g.beginPath(); g.moveTo(X(c) + 3, Y(r) + 3); g.lineTo(X(c) + CELL - 3, Y(r) + CELL - 3);
        g.moveTo(X(c) + CELL - 3, Y(r) + 3); g.lineTo(X(c) + 3, Y(r) + CELL - 3); g.stroke();
    });
    // selected wave outline
    const w = W();
    g.strokeStyle = '#fbbf24'; g.lineWidth = 2;
    g.strokeRect(X((w.ox ?? 0) + off) + 1, Y(w.dy || 0) + 1, w.art[0].length * CELL - 2, w.art.length * CELL - 2);
    g.fillStyle = '#fbbf24'; g.font = '800 10px -apple-system,sans-serif'; g.textAlign = 'left'; g.textBaseline = 'top';
    g.fillText(`W${wave + 1}`, X((w.ox ?? 0) + off) + 3, Y(w.dy || 0) + 2);
    // keep the bottom (what the player sees first) in view on first render
    const wrap = $('board-wrap');
    if (!wrap.dataset.scrolled) { wrap.scrollTop = wrap.scrollHeight; wrap.dataset.scrolled = '1'; }

    renderPlanes(gen);
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

function wireBoard() {
    $('board').addEventListener('click', (e) => {
        const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
        const c = Math.floor((e.clientX - rect.left - 6) / CELL) - boardGeom.off;
        const r = Math.floor((e.clientY - rect.top - 6) / CELL) + boardGeom.minRow;
        // prefer a wave with a block under the cursor, else any wave whose box contains it
        const hits = L().waves.map((w, i) => ({ w, i })).filter(({ w }) => r >= (w.dy || 0) && r < (w.dy || 0) + w.art.length && c >= (w.ox ?? 0) && c < (w.ox ?? 0) + w.art[0].length);
        const solid = hits.find(({ w }) => PAL[w.art[r - (w.dy || 0)][c - (w.ox ?? 0)]]);
        const pick = solid ?? hits[0];
        if (pick) selectWave(pick.i);
    });
    $('btn-reroll').onclick = () => { seed++; renderBoard(); };
}

function renderPlanes(gen: Generated | null) {
    const { counts, blocks } = rawCounts(L());
    const planes = gen ? gen.queues.reduce((a, q) => a + q.length, 0) : 0;
    $('stats').innerHTML = [
        [gen?.remaining ?? blocks, 'Lượt bắn'], [Object.keys(counts).length, 'Màu'], [planes, 'Máy bay'], [L().waves.length, 'Mảng']
    ].map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('');
    if (!gen) { $('hangars').innerHTML = ''; return; }
    $('hangars').innerHTML = gen.queues.map((q, i) => `<div class="hangar"><h4>KHOANG ${i + 1}</h4>${q.map((p) =>
        `<div class="plane${p.hidden ? ' hidden' : ''}${p.link ? ' link' : ''}"><i style="background:${PAL[p.c]}"></i>${p.hidden ? '?' : p.a}${p.link ? `<u>🔗${p.link}</u>` : ''}</div>`).join('')}</div>`).join('');
}

// ---------- organizer ----------
function thumb(lv: Level) {
    const cv = document.createElement('canvas');
    const rows: number[] = [];
    lv.waves.forEach((w) => { rows.push(w.dy || 0, (w.dy || 0) + w.art.length); });
    const minR = Math.min(...rows), maxR = Math.max(...rows), s = 3;
    let lo = 1e9; lv.waves.forEach((w) => { lo = Math.min(lo, w.ox ?? 0); });
    cv.width = BCOLS * s; cv.height = Math.min(120, (maxR - minR) * s);
    const g = cv.getContext('2d')!;
    // draw bottom-up so the part the player sees first is always visible
    lv.waves.forEach((w) => w.art.forEach((row, r) => [...row].forEach((ch, c) => {
        if (!PAL[ch]) return;
        g.fillStyle = PAL[ch];
        g.fillRect(((w.ox ?? 0) - lo + c) * s, cv.height - (maxR - ((w.dy || 0) + r)) * s, s, s);
    })));
    return cv;
}

function renderOrganizer() {
    const body = $('org-body');
    body.innerHTML = '';
    levels.forEach((lv, i) => {
        const rep = validate(lv);
        const tr = document.createElement('tr');
        if (i === cur) tr.className = 'cur';
        const planes = Object.values(rep.counts).reduce((a, n) => a + splitAmmo(n).length, 0);
        const mech = [lv.hidden ? `❓ ${Math.round(lv.hidden * 100)}%` : '', lv.connected ? `🔗 ${lv.connected}` : '',
            ...(lv.big || []).map((b) => (b.size === 5 ? '👑 lõi' : `🧱 ${b.n}× ${b.hp[0]}–${b.hp[1]}`))].filter(Boolean);
        tr.innerHTML = `<td><b>${i + 1}</b></td><td class="th"></td><td><b>${escapeHtml(lv.name)}</b>${lv.feature ? `<div class="hint" style="margin:0">popup: ${lv.feature}</div>` : ''}</td>
            <td>${Object.keys(rep.counts).length}</td><td>${rep.blocks}${lv.big ? '+' : ''}</td><td>~${planes}</td><td>${lv.waves.length}</td>
            <td>${mech.map((m) => `<span class="tag">${m}</span>`).join('') || '—'}</td>
            <td>${rep.errors.length ? `<span style="color:var(--red)">⛔ ${rep.errors.length}</span>` : rep.warns.length ? `<span style="color:var(--amber)">⚠️ ${rep.warns.length}</span>` : '<span style="color:var(--green)">✅</span>'}</td>
            <td><div class="row" style="flex-wrap:nowrap">
              <button class="btn" data-a="edit" title="Sửa">✎</button><button class="btn" data-a="play" title="Chơi thử">▶</button>
              <button class="btn" data-a="up" title="Lên">↑</button><button class="btn" data-a="down" title="Xuống">↓</button>
              <button class="btn" data-a="dup" title="Nhân bản">⧉</button><button class="btn danger" data-a="del" title="Xoá">🗑</button></div></td>`;
        tr.querySelector('.th')!.appendChild(thumb(lv));
        tr.querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.onclick = () => orgAction(b.dataset.a!, i));
        body.appendChild(tr);
    });
}

function orgAction(a: string, i: number) {
    if (a === 'edit') { openLevel(i); setMode('editor'); return; }
    if (a === 'play') { cur = i; play(false); return; }
    if (a === 'up' && i > 0) { [levels[i - 1], levels[i]] = [levels[i], levels[i - 1]]; if (cur === i) cur--; else if (cur === i - 1) cur++; }
    if (a === 'down' && i < levels.length - 1) { [levels[i + 1], levels[i]] = [levels[i], levels[i + 1]]; if (cur === i) cur++; else if (cur === i + 1) cur--; }
    if (a === 'dup') { const c = clone(levels[i]); c.name += ' (bản sao)'; levels.splice(i + 1, 0, c); }
    if (a === 'del') {
        if (levels.length <= 1) { toast('Phải còn ít nhất 1 màn'); return; }
        if (!confirm(`Xoá màn ${i + 1} "${levels[i].name}"?`)) return;
        levels.splice(i, 1);
        if (cur >= levels.length) cur = levels.length - 1;
    }
    undoStack = [];
    setDirty(true);
    renderOrganizer();
    renderHeader();
}

function wireOrganizer() {
    $('org-new').onclick = () => {
        levels.push({ name: `Màn mới ${levels.length + 1}`, waves: [blankWave()] });
        openLevel(levels.length - 1); setDirty(true); setMode('editor');
    };
    $('org-export').onclick = () => download(`pixel-squadron-levels.json`, JSON.stringify({ levels }, null, 2));
    $('org-import').onclick = () => $('upload-input').click();
    $('org-copy-ts').onclick = async () => {
        const ts = `export const LEVELS: Level[] = ${JSON.stringify(levels, null, 4)};\n`;
        try { await navigator.clipboard.writeText(ts); toast('Đã copy, dán vào LEVELS trong src/game/data.ts'); }
        catch { download('levels.ts', ts); }
    };
    $('org-reset').onclick = () => {
        if (!confirm('Thay toàn bộ danh sách bằng 10 màn gốc? Các màn đang sửa sẽ mất nếu chưa xuất JSON.')) return;
        levels = clone(LEVELS).map(normalize);
        openLevel(0); setDirty(true); renderOrganizer();
    };
}

function escapeHtml(s: string) { return s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!)); }

// ---------- header actions ----------
function download(name: string, text: string) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function play(auto: boolean) {
    if (validate(L()).errors.length) { toast('Màn đang có lỗi, sửa trước khi chơi thử'); return; }
    if (!save()) return;
    const url = `./?custom=1&level=${cur + 1}${auto ? '&autoplay=1' : ''}`;
    ($('play-frame') as HTMLIFrameElement).src = url;
    $('play-modal').classList.add('show');
    $('play-modal').dataset.url = url;
}

function closePlay() {
    $('play-modal').classList.remove('show');
    ($('play-frame') as HTMLIFrameElement).src = 'about:blank';
}

function importJson(text: string) {
    let data: unknown;
    try { data = JSON.parse(text); } catch { toast('File không phải JSON hợp lệ'); return; }
    const list = Array.isArray(data) ? data : (data as { levels?: unknown }).levels;
    const valid = (x: unknown): x is Level => !!x && typeof x === 'object' && Array.isArray((x as Level).waves);
    if (Array.isArray(list)) {
        const ok = list.filter(valid);
        if (!ok.length) { toast('Không tìm thấy màn nào trong file'); return; }
        if (!confirm(`Thay danh sách hiện tại bằng ${ok.length} màn trong file?`)) return;
        levels = ok.map(normalize);
        openLevel(0);
    } else if (valid(data)) {
        if (!confirm(`Thay màn ${cur + 1} "${L().name}" bằng màn "${data.name}" trong file?`)) return;
        snapshot();
        levels[cur] = normalize(data);
        wave = 0;
    } else { toast('File không đúng định dạng màn Pixel Squadron'); return; }
    changed(true);
    if (mode === 'organizer') renderOrganizer();
    toast('Đã nhập');
}

function wireHeader() {
    $('btn-home').onclick = () => { location.href = '../'; };
    $('btn-play').onclick = () => play(false);
    $('btn-auto').onclick = () => play(true);
    $('btn-save').onclick = () => { if (save()) toast('Đã lưu vào trình duyệt'); };
    $('btn-upload').onclick = () => $('upload-input').click();
    $('upload-input').onchange = async () => {
        const f = ($('upload-input') as HTMLInputElement).files?.[0];
        if (f) importJson(await f.text());
        ($('upload-input') as HTMLInputElement).value = '';
    };
    $('btn-download').onclick = () => {
        const lv = L();
        const slug = lv.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
        download(`pixel-squadron-${cur + 1}-${slug || 'level'}.json`, JSON.stringify(lv, null, 2));
    };
    $('mode-editor').onclick = () => setMode('editor');
    $('mode-organizer').onclick = () => setMode('organizer');
    $('play-close').onclick = closePlay;
    $('play-modal').addEventListener('click', (e) => { if (e.target === $('play-modal')) closePlay(); });
    // the game iframe keeps keyboard focus: listen for Esc inside it too (same origin)
    ($('play-frame') as HTMLIFrameElement).addEventListener('load', () => {
        try { ($('play-frame') as HTMLIFrameElement).contentWindow?.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePlay(); }); } catch { /* cross-origin */ }
    });
    $('play-reload').onclick = () => { ($('play-frame') as HTMLIFrameElement).src = $('play-modal').dataset.url!; };
    $('play-tab').onclick = () => { window.open($('play-modal').dataset.url!, '_blank'); };
    window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); } });
}

function setMode(m: 'editor' | 'organizer') {
    mode = m;
    $('mode-editor').classList.toggle('active', m === 'editor');
    $('mode-organizer').classList.toggle('active', m === 'organizer');
    $('editor').style.display = m === 'editor' ? 'flex' : 'none';
    $('organizer').style.display = m === 'organizer' ? 'block' : 'none';
    if (m === 'organizer') renderOrganizer(); else renderAll(true);
}

function openLevel(i: number) {
    cur = Math.max(0, Math.min(i, levels.length - 1));
    wave = 0; undoStack = []; seed = 1;
    ($('btn-undo') as HTMLButtonElement).disabled = true;
    delete $('board-wrap').dataset.scrolled;
    renderAll(true);
}

function wireKeys() {
    window.addEventListener('keydown', (e) => {
        if ($('play-modal').classList.contains('show')) { if (e.key === 'Escape') closePlay(); return; }
        const typing = (e.target as HTMLElement).matches('input,select,textarea');
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (save()) toast('Đã lưu vào trình duyệt'); return; }
        if (typing) return;
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
        if (mode !== 'editor') return;
        const n = '1234567890'.indexOf(e.key);
        if (n >= 0) { colour = KEYS[n]; if (tool === 'erase' || tool === 'pick') tool = 'paint'; renderPalette(); renderTools(); return; }
        const t = ({ b: 'paint', e: 'erase', g: 'fill', i: 'pick' } as Record<string, Tool>)[e.key.toLowerCase()];
        if (t) { tool = t; renderTools(); renderPalette(); }
    });
}

function wireResizers() {
    document.querySelectorAll<HTMLElement>('.panel-resizer').forEach((r) => {
        const target = r.dataset.resize === '0' ? $('panel-colour') : $('panel-board');
        const sign = r.dataset.resize === '0' ? 1 : -1;
        const initial = target.style.flexBasis;
        r.addEventListener('dblclick', () => { target.style.flexBasis = initial; });
        r.addEventListener('pointerdown', (e) => {
            const x0 = e.clientX, w0 = target.getBoundingClientRect().width;
            r.setPointerCapture(e.pointerId);
            const move = (ev: PointerEvent) => { target.style.flexBasis = `${Math.max(180, w0 + sign * (ev.clientX - x0))}px`; target.style.flexGrow = '0'; };
            const up = () => { r.removeEventListener('pointermove', move); r.removeEventListener('pointerup', up); };
            r.addEventListener('pointermove', move);
            r.addEventListener('pointerup', up);
        });
    });
}

// ---------- render ----------
function renderHeader() {
    $('lvl-num').textContent = String(cur + 1);
    $('lvl-name').textContent = L().name;
}

/** Things that depend on block data but not on the grid's DOM. */
function refreshDerived() {
    renderPalette();
    renderValidation();
    renderBoard();
}

function renderAll(rebuildGrid: boolean) {
    renderHeader();
    renderTools();
    renderWaveTabs();
    if (rebuildGrid) buildGrid();
    ($('s-name') as HTMLInputElement).value = L().name;
    ($('s-feature') as HTMLSelectElement).value = L().feature ?? '';
    renderMech();
    refreshDerived();
}

wireHeader();
wireGrid();
wireWaveControls();
wireBoard();
wireOrganizer();
wireKeys();
wireResizers();
const startAt = parseInt(new URLSearchParams(location.search).get('level') ?? '', 10);
openLevel(Number.isFinite(startAt) ? startAt - 1 : 0);
($('btn-undo') as HTMLButtonElement).disabled = true;
