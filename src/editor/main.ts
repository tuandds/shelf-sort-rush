// Pixel Squadron level editor. Plain DOM; reads/writes the same level format the game uses (src/game/data.ts)
// and previews boards and planes with the game's own generator (src/game/levelgen.ts).
// Four columns: Colour Bank · Wave Editor · Plane Editor · Level Bank (+ an Organizer table view).
import { BCOLS, BROWS, COLOR_NAMES, EDITOR_KEY, LEVELS, PAL, PAL_GROUPS, SLOTS, type BigSpec, type Level, type ManualPlane, type Wave } from '../game/data';
import { generateLevel, splitAmmo, type Generated } from '../game/levelgen';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const KEYS = Object.keys(PAL); // 10 original colours (lower case) + 16 Marble Drop colours (upper case)
const BACKUP_KEY = 'ps_editor_backups';
const MAX_BACKUPS = 15;
type Tool = 'paint' | 'erase' | 'fill' | 'pick';

// ---------- state ----------
let levels: Level[] = load();
/** JSON of each level and of the whole list at the last save (drives the "unsaved" markers). */
let savedEach: string[] = levels.map((l) => JSON.stringify(l));
let savedAll = JSON.stringify(levels);
let cur = 0;
let wave = 0;
let colour = 'r';
let tool: Tool = 'paint';
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
    if (out.queues) out.queues = [0, 1, 2].map((h) => (out.queues![h] || []).map((p) => ({ ...p })));
    return out;
}

function blankWave(dy = 0): Wave { return { ox: 5, dy, art: Array.from({ length: 6 }, () => '.'.repeat(11)) }; }

const L = () => levels[cur];
const W = () => L().waves[wave];
const isDirty = () => JSON.stringify(levels) !== savedAll;
const unsaved = (i: number) => JSON.stringify(levels[i]) !== savedEach[i] || savedEach.length !== levels.length;

function save() {
    try {
        const json = JSON.stringify(levels);
        localStorage.setItem(EDITOR_KEY, json);
        // keep a rolling history so a bad save can be undone
        let backups: { t: number; levels: Level[] }[] = [];
        try { backups = JSON.parse(localStorage.getItem(BACKUP_KEY) || '[]'); } catch { backups = []; }
        if (!backups.length || JSON.stringify(backups[0].levels) !== json) {
            backups.unshift({ t: Date.now(), levels: clone(levels) });
            localStorage.setItem(BACKUP_KEY, JSON.stringify(backups.slice(0, MAX_BACKUPS)));
        }
        localStorage.setItem(EDITOR_KEY + '_at', String(Date.now()));
        savedAll = json;
        savedEach = levels.map((l) => JSON.stringify(l));
        renderDirty();
        return true;
    } catch {
        toast('Không lưu được: trình duyệt chặn bộ nhớ hoặc đã đầy');
        return false;
    }
}

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
    renderAll(true);
}

let toastTimer = 0;
function toast(msg: string) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => t.classList.remove('show'), 1900);
}

// ---------- analysis ----------
interface Report { errors: string[]; warns: string[]; infos: string[]; counts: Record<string, number>; blocks: number }

function rawCounts(lv: Level) {
    const counts: Record<string, number> = {};
    let blocks = 0;
    for (const w of lv.waves) for (const row of w.art) for (const ch of row) if (PAL[ch]) { counts[ch] = (counts[ch] || 0) + 1; blocks++; }
    return { counts, blocks };
}

/** Deterministic random so the preview does not flicker on every edit; 🎲 changes the seed. */
function seeded(s: number) {
    return () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function sample(lv: Level, s = seed): Generated | null {
    try { return generateLevel(lv, seeded(s)); } catch { return null; }
}

/** Big blocks with a durability range make the hit count random, so hand-placed ammo can only match one roll. */
const randomHits = (lv: Level) => (lv.big || []).some((b) => b.hp[0] !== b.hp[1]);

/** Ammo the hangars carry per colour (hand-placed or generated). */
function ammoOf(lv: Level, gen: Generated | null) {
    const have: Record<string, number> = {};
    const qs = lv.queues ?? gen?.queues ?? [];
    qs.forEach((q) => q.forEach((p) => { have[p.c] = (have[p.c] || 0) + p.a; }));
    return have;
}

function validate(lv: Level): Report {
    const errors: string[] = [], warns: string[] = [], infos: string[] = [];
    const { counts, blocks } = rawCounts(lv);
    if (!blocks) errors.push('Màn chưa có khối nào.');
    let lo = 1e9, hi = -1e9;
    lv.waves.forEach((w) => { lo = Math.min(lo, w.ox ?? 0); hi = Math.max(hi, (w.ox ?? 0) + (w.art[0]?.length ?? 0)); });
    if (hi - lo > BCOLS) errors.push(`Đội hình rộng ${hi - lo} cột, board chỉ có ${BCOLS} cột.`);
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

    if (lv.queues) {
        // ---- hand-placed hangars ----
        const all = lv.queues.flat();
        if (!all.length) errors.push('Chế độ xếp tay nhưng chưa có máy bay nào.');
        const gen = sample(lv);
        const need = gen?.count ?? counts, have = ammoOf(lv, gen);
        for (const k of KEYS) {
            const n = need[k] || 0, h = have[k] || 0;
            if (n > h) warns.push(`${COLOR_NAMES[k]} thiếu ${n - h} đạn (${h}/${n}): màn sẽ không thể thắng.`);
            else if (h > n && n > 0) infos.push(`${COLOR_NAMES[k]} thừa ${h - n} đạn: máy bay cuối sẽ rời đi khi màu đã sạch.`);
            else if (h > 0 && n === 0) warns.push(`Có máy bay ${COLOR_NAMES[k]} nhưng tranh không có màu này.`);
        }
        if (randomHits(lv)) infos.push('Khối lớn có độ bền ngẫu nhiên: số đạn cần đổi mỗi lần chơi. Đặt độ bền min = max để khớp chính xác.');
        const links: Record<number, [number, number][]> = {};
        lv.queues.forEach((q, h) => q.forEach((p, k) => { if (p.link) (links[p.link] = links[p.link] || []).push([h, k]); }));
        for (const id in links) {
            const at = links[id];
            if (at.length !== 2) errors.push(`Cặp nối đôi 🔗${id} có ${at.length} máy bay (phải đúng 2).`);
            else if (at[0][0] === at[1][0] && Math.abs(at[0][1] - at[1][1]) !== 1) warns.push(`Cặp 🔗${id} cùng khoang nhưng không đứng liền nhau: sẽ không cất cánh được.`);
        }
        if (all.some((p) => p.a < 1)) errors.push('Có máy bay 0 đạn.');
    } else {
        for (const k of KEYS) {
            const n = counts[k] || 0;
            if (n > 0 && n < 10) warns.push(`${COLOR_NAMES[k]} chỉ có ${n} khối: máy bay thường mang 10–20 viên, chiếc này sẽ chỉ có ${n} viên.`);
        }
        if (lv.connected) {
            const planes = Object.values(counts).reduce((a, n) => a + splitAmmo(n).length, 0);
            if (planes < lv.connected * 2 + 2) warns.push(`Chỉ ~${planes} máy bay, khó tạo đủ ${lv.connected} cặp nối đôi.`);
        }
    }
    const mech = lv.hidden || lv.connected || lv.big?.length || lv.queues?.flat().some((p) => p.hidden || p.link);
    if (mech && !lv.feature) infos.push('Màn có cơ chế đặc biệt nhưng chưa chọn popup tính năng mới (chỉ cần ở màn đầu tiên có cơ chế đó).');
    return { errors, warns, infos, counts, blocks };
}

// ---------- 1. colour bank ----------
/** Colours in the Active Palette: every colour the level uses, plus the selected one. Keys 1-0 pick from it. */
function activeKeys() {
    const { counts } = rawCounts(L());
    const used = KEYS.filter((k) => counts[k]);
    if (!used.includes(colour)) used.push(colour);
    return used;
}

function renderPalette() {
    const { counts } = rawCounts(L());
    const active = activeKeys();
    const swatch = (k: string, i: number) => `<button class="swatch${k === colour && tool !== 'erase' ? ' on' : ''}" data-k="${k}" title="${COLOR_NAMES[k]} (${k})${i < 10 ? ` · phím ${(i + 1) % 10}` : ''}">
        <i style="background:${PAL[k]}"></i><span>${COLOR_NAMES[k]}<em>${counts[k] || 0}</em></span></button>`;
    $('palette').innerHTML = `<div class="elabel" style="margin-top:0">Active Palette</div>${active.map(swatch).join('')}
        <div class="elabel">Bank</div>${PAL_GROUPS.map((g) => `<div class="bank-group">${g.name}</div><div class="bank-grid">${g.keys.map((k) =>
            `<button class="bank-sw${k === colour ? ' on' : ''}${counts[k] ? ' used' : ''}" data-k="${k}" title="${COLOR_NAMES[k]} (${k})${counts[k] ? ` · ${counts[k]} khối` : ''}" style="background:${PAL[k]}"></button>`).join('')}</div>`).join('')}`;
    $('palette').querySelectorAll<HTMLButtonElement>('[data-k]').forEach((b) => b.onclick = () => {
        colour = b.dataset.k!;
        if (tool === 'erase' || tool === 'pick') tool = 'paint';
        renderPalette(); renderTools();
        if (L().queues) refreshDerived(); // the "＋" buttons in the Plane Editor use this colour
    });
}

const TOOLS: [Tool, string, string][] = [['paint', '✏️', 'Vẽ (B)'], ['erase', '🧽', 'Tẩy (E)'], ['fill', '🪣', 'Đổ màu (G)'], ['pick', '💧', 'Hút màu (I)']];
function renderTools() {
    $('tools').innerHTML = TOOLS.map(([t, icon, tip]) => `<button class="tool${t === tool ? ' on' : ''}" data-t="${t}" title="${tip}">${icon}</button>`).join('');
    $('tools').querySelectorAll<HTMLButtonElement>('.tool').forEach((b) => b.onclick = () => { tool = b.dataset.t as Tool; renderTools(); renderPalette(); });
}

// ---------- 2. wave editor ----------
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
        ? KEYS.filter((k) => rep.counts[k]).map((k) => `<span class="chip${!L().queues && rep.counts[k] < 10 ? ' bad' : ''}"><i style="background:${PAL[k]}"></i>${rep.counts[k]}</span>`).join('')
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
    grid.style.gridTemplateColumns = `repeat(${w.art[0]?.length ?? 1}, 22px)`;
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
    const el = $('grid').children[r * W().art[0].length + c] as HTMLElement | undefined;
    if (!el) return;
    const ch = W().art[r][c];
    el.className = 'cell' + (PAL[ch] ? ' f' : '');
    el.style.background = PAL[ch] || '';
}

function setCh(r: number, c: number, ch: string) {
    const art = W().art;
    if (art[r][c] === ch) return;
    art[r] = art[r].slice(0, c) + ch + art[r].slice(c + 1);
    paintCellEl(r, c);
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
        if (painting) applyTool(document.elementFromPoint(e.clientX, e.clientY), erase);
    });
    const end = () => { if (painting) { painting = false; refreshDerived(); } };
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
    renderAll(true);
}

function shiftWave(dr: number, dc: number) {
    snapshot();
    const w = W(), h = w.art.length, wd = w.art[0].length;
    w.art = Array.from({ length: h }, (_, r) => Array.from({ length: wd }, (_, c) => {
        const sr = r - dr, sc = c - dc;
        return sr >= 0 && sr < h && sc >= 0 && sc < wd ? w.art[sr][sc] : '.';
    }).join(''));
    renderAll(true);
}

function wireWaveControls() {
    $('wave-add').onclick = () => {
        snapshot();
        const minDy = Math.min(...L().waves.map((w) => w.dy || 0));
        const top = Math.min(...L().waves.filter((w) => (w.dy || 0) === minDy).map((w) => w.art.length));
        L().waves.push(blankWave(minDy - Math.max(4, top)));
        wave = L().waves.length - 1;
        renderAll(true);
    };
    $('wave-dup').onclick = () => {
        snapshot();
        const w = clone(W());
        w.dy = Math.min(...L().waves.map((x) => x.dy || 0)) - w.art.length;
        L().waves.push(w);
        wave = L().waves.length - 1;
        renderAll(true);
    };
    $('wave-del').onclick = () => {
        if (L().waves.length <= 1) return;
        snapshot();
        L().waves.splice(wave, 1);
        wave = Math.max(0, wave - 1);
        renderAll(true);
    };
    const num = (id: string) => +(($(id) as HTMLInputElement).value || 0);
    $('w-width').onchange = () => resizeWave(num('w-width'), W().art.length);
    $('w-height').onchange = () => resizeWave(W().art[0].length, num('w-height'));
    $('w-ox').onchange = () => { snapshot(); W().ox = Math.max(0, Math.min(BCOLS - 1, num('w-ox'))); renderAll(false); };
    $('w-dy').onchange = () => { snapshot(); W().dy = Math.min(0, num('w-dy')); renderAll(false); };
    $('w-flip').onclick = () => { snapshot(); W().art = W().art.map((r) => [...r].reverse().join('')); renderAll(true); };
    $('w-up').onclick = () => shiftWave(-1, 0);
    $('w-down').onclick = () => shiftWave(1, 0);
    $('w-left').onclick = () => shiftWave(0, -1);
    $('w-right').onclick = () => shiftWave(0, 1);
    $('w-clear').onclick = () => { snapshot(); W().art = W().art.map((r) => '.'.repeat(r.length)); renderAll(true); };
    $('btn-undo').onclick = undo;
    $('s-name').onfocus = () => snapshot();
    $('s-name').oninput = () => { L().name = ($('s-name') as HTMLInputElement).value; renderHeader(); renderBank(); renderDirty(); };
    $('s-feature').onchange = () => {
        snapshot();
        const v = ($('s-feature') as HTMLSelectElement).value;
        if (v) L().feature = v; else delete L().feature;
        renderAll(false);
    };
}

// ---------- mechanics ----------
const BOSS_CORE: BigSpec = { n: 1, hp: [20, 20], size: 5 };
const isBoss = (b: BigSpec) => b.size === 5;

function renderMech() {
    const lv = L(), manual = !!lv.queues;
    const big = lv.big || [];
    const on = { hidden: !!lv.hidden, linked: !!lv.connected, big: big.some((b) => !isBoss(b)), boss: big.some(isBoss) };
    const btns: [keyof typeof on, string, string, string][] = [
        ['hidden', '❓', 'ẨN', 'Máy bay ẩn: chiếc dưới đầu hàng giấu màu và số đạn (chế độ Ngẫu nhiên)'],
        ['linked', '🔗', 'NỐI ĐÔI', 'Cặp máy bay ở hai khoang, chỉ cất cánh cùng nhau (chế độ Ngẫu nhiên)'],
        ['big', '🧱', 'KHỐI LỚN', 'Khối lớn 2×2…4×4 với độ bền 5–10'],
        ['boss', '👑', 'LÕI TRÙM', 'Một khối 5×5 độ bền 20 trên mỗi mảng đủ lớn']
    ];
    $('mech').innerHTML = btns.map(([k, icon, label, tip]) => {
        const off = manual && (k === 'hidden' || k === 'linked');
        return `<button class="mech-btn${on[k] ? ' on' : ''}" data-k="${k}" title="${tip}"${off ? ' style="opacity:.35"' : ''}>${icon}<small>${label}</small></button>`;
    }).join('');
    $('mech').querySelectorAll<HTMLButtonElement>('.mech-btn').forEach((b) => b.onclick = () => {
        const k = b.dataset.k as keyof typeof on;
        if (manual && (k === 'hidden' || k === 'linked')) { toast('Đang xếp tay: đặt ẩn / nối đôi trên từng máy bay ở Plane Editor'); return; }
        snapshot();
        if (k === 'hidden') lv.hidden = on.hidden ? undefined : 0.4;
        if (k === 'linked') lv.connected = on.linked ? undefined : 3;
        if (k === 'big') lv.big = on.big ? big.filter(isBoss) : [...big, { n: 2, hp: [5, 10] }];
        if (k === 'boss') lv.big = on.boss ? big.filter((x) => !isBoss(x)) : [clone(BOSS_CORE), ...big];
        if (lv.big && !lv.big.length) delete lv.big;
        if (!lv.hidden) delete lv.hidden;
        if (!lv.connected) delete lv.connected;
        renderAll(false);
    });

    const parts: string[] = [];
    if (lv.hidden && !manual) parts.push(`<div class="setting-row"><label>Tỉ lệ máy bay ẩn</label>
        <input type="range" id="m-hidden" min="5" max="80" step="5" value="${Math.round(lv.hidden * 100)}"><span class="setting-val">${Math.round(lv.hidden * 100)}%</span></div>`);
    if (lv.connected && !manual) parts.push(`<div class="setting-row"><label>Số cặp nối đôi</label>
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
    if (hid) { hid.onpointerdown = () => snapshot(); hid.oninput = () => { lv.hidden = +hid.value / 100; (hid.nextElementSibling as HTMLElement).textContent = `${hid.value}%`; refreshDerived(); }; }
    const lk = $('m-linked') as HTMLInputElement | null;
    if (lk) { lk.onpointerdown = () => snapshot(); lk.oninput = () => { lv.connected = +lk.value; (lk.nextElementSibling as HTMLElement).textContent = lk.value; refreshDerived(); }; }
    $('mech-settings').querySelectorAll<HTMLElement>('.big-row').forEach((row) => {
        const i = +row.dataset.i!;
        row.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input,select').forEach((inp) => inp.onchange = () => {
            snapshot();
            const b = lv.big![i], v = inp.value;
            if (inp.dataset.f === 'n') b.n = Math.max(1, +v || 1);
            if (inp.dataset.f === 'lo') b.hp = [Math.max(2, +v || 2), Math.max(b.hp[1], +v || 2)];
            if (inp.dataset.f === 'hi') b.hp = [Math.min(b.hp[0], +v || 2), Math.max(2, +v || 2)];
            if (inp.dataset.f === 'size') { if (v) b.size = +v; else delete b.size; }
            renderAll(false);
        });
        (row.querySelector('[data-f=del]') as HTMLButtonElement).onclick = () => {
            snapshot();
            lv.big!.splice(i, 1);
            if (!lv.big!.length) delete lv.big;
            renderAll(false);
        };
    });
    const add = $('m-big-add');
    if (add) add.onclick = () => { snapshot(); lv.big!.push({ n: 1, hp: [5, 10] }); renderAll(false); };
}

// ---------- board preview (inside the wave editor) ----------
const CELL = 14;
let boardGeom = { minRow: 0, off: 0 };
function renderBoard(gen: Generated | null) {
    const lv = L(), cv = $('board') as HTMLCanvasElement;
    let lo = 1e9, hi = -1e9, minRow = 1e9, maxRow = -1e9;
    lv.waves.forEach((w) => {
        lo = Math.min(lo, w.ox ?? 0); hi = Math.max(hi, (w.ox ?? 0) + w.art[0].length);
        minRow = Math.min(minRow, w.dy || 0); maxRow = Math.max(maxRow, (w.dy || 0) + w.art.length - 1);
    });
    const off = Math.floor((BCOLS - (hi - lo)) / 2) - lo; // centred exactly like the game
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
    const top10 = lowest - BROWS + 1;
    g.fillStyle = 'rgba(74,222,128,.07)'; g.fillRect(X(0), Y(top10), BCOLS * CELL, BROWS * CELL);
    g.strokeStyle = 'rgba(74,222,128,.55)'; g.setLineDash([5, 4]); g.lineWidth = 1.5;
    g.strokeRect(X(0) + .5, Y(top10) + .5, BCOLS * CELL - 1, BROWS * CELL - 1); g.setLineDash([]);
    g.strokeStyle = 'rgba(255,255,255,.035)'; g.lineWidth = 1;
    for (let c = 0; c <= BCOLS; c++) { g.beginPath(); g.moveTo(X(c) + .5, pad); g.lineTo(X(c) + .5, hpx - pad); g.stroke(); }
    const occupied = new Map<string, number>();
    lv.waves.forEach((w) => w.art.forEach((row, r) => [...row].forEach((ch, c) => {
        if (!PAL[ch]) return;
        const k = `${(w.dy || 0) + r}:${(w.ox ?? 0) + c + off}`;
        occupied.set(k, (occupied.get(k) || 0) + 1);
    })));
    // the generated board, so big blocks show up
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
    g.strokeStyle = '#ef4444'; g.lineWidth = 2;
    occupied.forEach((n, k) => {
        if (n < 2) return;
        const [r, c] = k.split(':').map(Number);
        g.beginPath(); g.moveTo(X(c) + 3, Y(r) + 3); g.lineTo(X(c) + CELL - 3, Y(r) + CELL - 3);
        g.moveTo(X(c) + CELL - 3, Y(r) + 3); g.lineTo(X(c) + 3, Y(r) + CELL - 3); g.stroke();
    });
    const w = W();
    g.strokeStyle = '#fbbf24'; g.lineWidth = 2;
    g.strokeRect(X((w.ox ?? 0) + off) + 1, Y(w.dy || 0) + 1, w.art[0].length * CELL - 2, w.art.length * CELL - 2);
    g.fillStyle = '#fbbf24'; g.font = '800 10px -apple-system,sans-serif'; g.textAlign = 'left'; g.textBaseline = 'top';
    g.fillText(`W${wave + 1}`, X((w.ox ?? 0) + off) + 3, Y(w.dy || 0) + 2);
    const wrap = $('board-wrap');
    if (!wrap.dataset.scrolled) { wrap.scrollTop = wrap.scrollHeight; wrap.dataset.scrolled = '1'; }
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
        const hits = L().waves.map((w, i) => ({ w, i })).filter(({ w }) => r >= (w.dy || 0) && r < (w.dy || 0) + w.art.length && c >= (w.ox ?? 0) && c < (w.ox ?? 0) + w.art[0].length);
        const solid = hits.find(({ w }) => PAL[w.art[r - (w.dy || 0)][c - (w.ox ?? 0)]]);
        const pick = solid ?? hits[0];
        if (pick) selectWave(pick.i);
    });
}

// ---------- 3. plane editor ----------
function toManual(gen: Generated | null): ManualPlane[][] {
    return [0, 1, 2].map((h) => (gen?.queues[h] || []).map((p) => {
        const m: ManualPlane = { c: p.c, a: p.a };
        if (p.hidden) m.hidden = true;
        if (p.link) m.link = p.link;
        return m;
    }));
}

function renderPlanes(gen: Generated | null) {
    const lv = L(), manual = !!lv.queues;
    $('plane-mode').querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.classList.toggle('on', (b.dataset.m === 'manual') === manual));
    $('plane-mode-hint').textContent = manual
        ? 'Bạn tự quyết định từng máy bay: màu, số đạn, ẩn, nối đôi và thứ tự cất cánh. Kéo thả để đổi chỗ, kể cả sang khoang khác.'
        : 'Game tự chia đạn 10–20 viên mỗi máy bay theo thứ tự khối sẽ bị phá, rồi chia lần lượt vào 3 khoang. Mỗi lần chơi có xáo trộn nhẹ.';
    const qs = manual ? lv.queues! : gen?.queues ?? [[], [], []];
    const planes = qs.reduce((a, q) => a + q.length, 0);
    const { counts } = rawCounts(lv);
    $('stats').innerHTML = [[gen?.remaining ?? 0, 'Lượt bắn'], [Object.keys(counts).length, 'Màu'], [planes, 'Máy bay'], [lv.waves.length, 'Mảng']]
        .map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('');

    // ammo balance per colour
    const need = gen?.count ?? counts, have = ammoOf(lv, gen);
    const approx = randomHits(lv) ? '~' : '';
    $('balance').innerHTML = KEYS.filter((k) => need[k] || have[k]).map((k) => {
        const n = need[k] || 0, h = have[k] || 0;
        const cls = h < n ? ' short' : h > n ? ' over' : '';
        return `<span class="bal${cls}" title="${COLOR_NAMES[k]}: máy bay mang ${h} đạn, cần ${approx}${n}"><i style="background:${PAL[k]}"></i>${h}/${approx}${n}</span>`;
    }).join('') || '<span class="hint">Chưa có khối nào</span>';

    // actions
    $('plane-actions').innerHTML = manual
        ? '<button class="btn" id="pa-regen" title="Thay bằng một bản sinh ngẫu nhiên">↺ Lấy từ bản sinh</button><button class="btn danger" id="pa-clear">🧹 Xoá hết</button>'
        : '<button class="btn" id="pa-reroll">🎲 Sinh lại</button><button class="btn" id="pa-take" title="Chuyển sang xếp tay, bắt đầu từ bản sinh này">✋ Sửa bản này</button>';
    if (manual) {
        $('pa-regen').onclick = () => { if (!confirm('Thay toàn bộ máy bay đang xếp bằng một bản sinh ngẫu nhiên?')) return; snapshot(); seed++; lv.queues = toManual(generateLevel({ ...lv, queues: undefined }, seeded(seed))); renderAll(false); };
        $('pa-clear').onclick = () => { if (!confirm('Xoá hết máy bay trong cả 3 khoang?')) return; snapshot(); lv.queues = [[], [], []]; renderAll(false); };
    } else {
        $('pa-reroll').onclick = () => { seed++; refreshDerived(); };
        $('pa-take').onclick = () => setPlaneMode('manual');
    }

    // hangars
    const host = $('hangars');
    if (!manual) {
        host.innerHTML = qs.map((q, i) => `<div class="hangar"><h4>KHOANG ${i + 1} · ${q.length}</h4>${q.map((p) =>
            `<div class="plane${p.hidden ? ' hidden' : ''}${p.link ? ' link' : ''}"><i style="background:${PAL[p.c]}"></i>${p.hidden ? '?' : p.a}${p.link ? `<u>🔗${p.link}</u>` : ''}</div>`).join('')}</div>`).join('');
        $('plane-hint').textContent = 'Bản sinh thử bằng chính bộ sinh của game. Khi chơi thật, máy bay ẩn và cặp nối đôi có thể khác bản này.';
        return;
    }
    host.innerHTML = '';
    lv.queues!.forEach((q, h) => {
        const box = document.createElement('div');
        box.className = 'hangar';
        box.dataset.h = String(h);
        box.innerHTML = `<h4>KHOANG ${h + 1} · ${q.length}</h4>`;
        q.forEach((p, k) => {
            const row = document.createElement('div');
            row.className = 'mplane' + (p.link ? ' link' : '') + (k === 0 ? ' head' : '');
            row.draggable = true;
            row.dataset.h = String(h); row.dataset.k = String(k);
            row.title = k === 0 ? 'Đầu hàng: cất cánh trước' : `Thứ ${k + 1} trong khoang`;
            row.innerHTML = `<button class="sw" style="background:${PAL[p.c] || '#333'}" title="Đổi màu"></button>
                <input type="number" min="1" max="99" value="${p.a}" title="Số đạn">
                <button class="ic${p.hidden ? ' on' : ''}" title="Ẩn màu và số đạn cho tới khi lên đầu hàng">?</button>
                <input class="lk" type="number" min="0" max="99" value="${p.link || ''}" placeholder="🔗" title="Số cặp nối đôi: hai máy bay cùng số cất cánh cùng nhau">
                <button class="x" title="Xoá">✕</button>`;
            const [sw, ammo, hidBtn, link, del] = [...row.children] as HTMLElement[];
            sw.onclick = (e) => { e.stopPropagation(); colourPopover(sw, (c) => { snapshot(); p.c = c; renderAll(false); }); };
            (ammo as HTMLInputElement).onchange = () => { snapshot(); p.a = Math.max(1, Math.min(99, +(ammo as HTMLInputElement).value || 1)); renderAll(false); };
            hidBtn.onclick = () => { snapshot(); if (p.hidden) delete p.hidden; else p.hidden = true; renderAll(false); };
            (link as HTMLInputElement).onchange = () => { snapshot(); const v = +(link as HTMLInputElement).value || 0; if (v) p.link = v; else delete p.link; renderAll(false); };
            del.onclick = () => { snapshot(); q.splice(k, 1); renderAll(false); };
            row.addEventListener('dragstart', (e) => { e.dataTransfer!.setData('text/plain', `${h}:${k}`); row.classList.add('dragging'); });
            row.addEventListener('dragend', () => row.classList.remove('dragging'));
            box.appendChild(row);
        });
        const add = document.createElement('button');
        add.className = 'add-plane';
        add.innerHTML = `＋ <span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${PAL[colour]}"></span> ${COLOR_NAMES[colour]}`;
        add.title = 'Thêm máy bay màu đang chọn ở Colour Bank';
        add.onclick = () => {
            snapshot();
            const need2 = (gen?.count[colour] || 0) - (ammoOf(lv, gen)[colour] || 0);
            q.push({ c: colour, a: Math.max(1, Math.min(20, need2 > 0 ? need2 : 10)) });
            renderAll(false);
        };
        box.appendChild(add);
        // drop: insert before the row under the cursor, or at the end
        box.addEventListener('dragover', (e) => { e.preventDefault(); box.classList.add('drop'); });
        box.addEventListener('dragleave', () => box.classList.remove('drop'));
        box.addEventListener('drop', (e) => {
            e.preventDefault(); box.classList.remove('drop');
            const [fh, fk] = (e.dataTransfer!.getData('text/plain') || '').split(':').map(Number);
            if (!Number.isFinite(fh) || !lv.queues![fh]?.[fk]) return;
            const rows = [...box.querySelectorAll<HTMLElement>('.mplane')];
            let at = rows.findIndex((r) => e.clientY < r.getBoundingClientRect().top + r.offsetHeight / 2);
            if (at < 0) at = rows.length;
            snapshot();
            const [p] = lv.queues![fh].splice(fk, 1);
            if (fh === h && fk < at) at--;
            lv.queues![h].splice(at, 0, p);
            renderAll(false);
        });
        host.appendChild(box);
    });
    $('plane-hint').innerHTML = 'Hàng trên cùng là chiếc cất cánh đầu tiên (vạch xanh). <b>?</b> = máy bay ẩn (chiếc đầu hàng lúc bắt đầu luôn hiện). Hai máy bay cùng số 🔗 là một cặp nối đôi: phải đứng đầu hai khoang, hoặc liền nhau trong một khoang.';
}

function setPlaneMode(m: 'random' | 'manual') {
    const lv = L();
    if (m === 'manual' && !lv.queues) {
        snapshot();
        lv.queues = toManual(sample({ ...lv, queues: undefined }));
    } else if (m === 'random' && lv.queues) {
        if (!confirm('Bỏ thứ tự xếp tay và để game tự sinh máy bay?')) return;
        snapshot();
        delete lv.queues;
    }
    renderAll(false);
}

let popover: HTMLElement | null = null;
function colourPopover(anchor: HTMLElement, pick: (c: string) => void) {
    popover?.remove();
    const { counts } = rawCounts(L());
    const order = [...KEYS.filter((k) => counts[k]), ...KEYS.filter((k) => !counts[k])]; // level colours first
    const el = document.createElement('div');
    el.className = 'popover';
    el.innerHTML = order.map((k) => `<button data-k="${k}" title="${COLOR_NAMES[k]}" style="background:${PAL[k]};${counts[k] ? '' : 'opacity:.45'}"></button>`).join('');
    const r = anchor.getBoundingClientRect();
    el.style.left = `${Math.min(innerWidth - 150, r.left)}px`;
    el.style.top = `${r.bottom + 4}px`;
    el.querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.onclick = () => { el.remove(); popover = null; pick(b.dataset.k!); });
    document.body.appendChild(el);
    popover = el;
}
document.addEventListener('click', (e) => { if (popover && !popover.contains(e.target as Node)) { popover.remove(); popover = null; } });

function wirePlanes() {
    $('plane-mode').querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.onclick = () => setPlaneMode(b.dataset.m as 'random' | 'manual'));
}

// ---------- 4. level bank ----------
function thumb(lv: Level, s: number, maxH: number) {
    const cv = document.createElement('canvas');
    const rows: number[] = [];
    lv.waves.forEach((w) => { rows.push(w.dy || 0, (w.dy || 0) + w.art.length); });
    const minR = Math.min(...rows), maxR = Math.max(...rows);
    let lo = 1e9; lv.waves.forEach((w) => { lo = Math.min(lo, w.ox ?? 0); });
    cv.width = BCOLS * s; cv.height = Math.max(s, Math.min(maxH, (maxR - minR) * s));
    const g = cv.getContext('2d')!;
    // bottom-up so the part the player sees first is always visible
    lv.waves.forEach((w) => w.art.forEach((row, r) => [...row].forEach((ch, c) => {
        if (!PAL[ch]) return;
        g.fillStyle = PAL[ch];
        g.fillRect(((w.ox ?? 0) - lo + c) * s, cv.height - (maxR - ((w.dy || 0) + r)) * s, s, s);
    })));
    return cv;
}

function statusOf(lv: Level) {
    const rep = validate(lv);
    return { rep, colour: rep.errors.length ? '#f87171' : rep.warns.length ? '#fbbf24' : '#4ade80' };
}

function renderBank() {
    const list = $('bank-list');
    list.innerHTML = '';
    levels.forEach((lv, i) => {
        const { rep, colour: dot } = statusOf(lv);
        const card = document.createElement('div');
        card.className = 'lvcard' + (i === cur ? ' on' : '');
        card.innerHTML = `<span class="num">${i + 1}</span><span class="th"></span>
            <div class="meta"><b>${unsaved(i) ? '<span class="dot" style="background:#fbbf24" title="Chưa lưu"></span>' : ''}${escapeHtml(lv.name)}</b>
            <span><span class="dot" style="background:${dot}"></span>${Object.keys(rep.counts).length} màu · ${rep.blocks} khối · ${lv.queues ? '✋' : '🎲'}${lv.hidden ? ' ❓' : ''}${lv.connected ? ' 🔗' : ''}${lv.big?.length ? ' 🧱' : ''}</span></div>
            <div class="acts"><button data-a="up" title="Lên">↑</button><button data-a="down" title="Xuống">↓</button></div>`;
        card.querySelector('.th')!.appendChild(thumb(lv, 2, 44));
        card.onclick = (e) => {
            const a = (e.target as HTMLElement).dataset.a;
            if (a) { e.stopPropagation(); move(i, a === 'up' ? -1 : 1); return; }
            if (i !== cur) openLevel(i);
        };
        list.appendChild(card);
    });
    const at = +(localStorage.getItem(EDITOR_KEY + '_at') || 0);
    $('saved-at').textContent = at ? `Lưu lần cuối: ${new Date(at).toLocaleString('vi-VN')}` : 'Chưa lưu lần nào (đang dùng 10 màn gốc).';
}

function move(i: number, d: number) {
    const j = i + d;
    if (j < 0 || j >= levels.length) return;
    [levels[i], levels[j]] = [levels[j], levels[i]];
    [savedEach[i], savedEach[j]] = [savedEach[j], savedEach[i]];
    if (cur === i) cur = j; else if (cur === j) cur = i;
    renderBank(); renderHeader(); renderDirty();
    if (mode === 'organizer') renderOrganizer();
}

function addLevel(lv: Level, at = levels.length) {
    levels.splice(at, 0, lv);
    savedEach.splice(at, 0, '');
    openLevel(at);
}

function deleteLevel(i: number) {
    if (levels.length <= 1) { toast('Phải còn ít nhất 1 màn'); return; }
    if (!confirm(`Xoá màn ${i + 1} "${levels[i].name}"? (Có thể lấy lại từ Bản sao lưu nếu đã lưu trước đó.)`)) return;
    levels.splice(i, 1);
    savedEach.splice(i, 1);
    openLevel(Math.min(cur, levels.length - 1));
}

function renderBackups() {
    let backups: { t: number; levels: Level[] }[] = [];
    try { backups = JSON.parse(localStorage.getItem(BACKUP_KEY) || '[]'); } catch { backups = []; }
    $('backup-list').innerHTML = backups.length
        ? backups.map((b, i) => `<div class="bk"><span><b>${new Date(b.t).toLocaleString('vi-VN')}</b><br><span class="hint" style="margin:0">${b.levels.length} màn: ${b.levels.slice(0, 4).map((l) => escapeHtml(l.name)).join(', ')}${b.levels.length > 4 ? '…' : ''}</span></span>
            <button class="btn" data-i="${i}" data-a="dl">⬇</button><button class="btn" data-i="${i}" data-a="restore">Khôi phục</button></div>`).join('')
        : '<div class="hint">Chưa có bản sao lưu. Mỗi lần bấm Lưu, editor giữ lại một bản (tối đa 15 bản gần nhất).</div>';
    $('backup-list').querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.onclick = () => {
        const bk = backups[+b.dataset.i!];
        if (b.dataset.a === 'dl') { download(`pixel-squadron-backup-${bk.t}.json`, JSON.stringify({ levels: bk.levels }, null, 2)); return; }
        if (!confirm('Thay danh sách đang sửa bằng bản sao lưu này? (Thay đổi chưa lưu sẽ mất.)')) return;
        levels = bk.levels.map(normalize);
        savedEach = levels.map(() => '');
        $('backups').classList.remove('show');
        openLevel(0);
        toast('Đã khôi phục, bấm Lưu để giữ');
    });
}

function wireBank() {
    $('bank-new').onclick = () => addLevel({ name: `Màn mới ${levels.length + 1}`, waves: [blankWave()] });
    $('bank-dup').onclick = () => { const c = clone(L()); c.name += ' (bản sao)'; addLevel(c, cur + 1); };
    $('bank-del').onclick = () => deleteLevel(cur);
    $('bank-save').onclick = () => { if (save()) toast('Đã lưu vào trình duyệt'); };
    $('bank-export').onclick = () => download('pixel-squadron-levels.json', JSON.stringify({ levels }, null, 2));
    $('bank-import').onclick = () => $('upload-input').click();
    $('bank-backups').onclick = () => { renderBackups(); $('backups').classList.add('show'); };
    $('backups-close').onclick = () => $('backups').classList.remove('show');
    $('bank-copy-ts').onclick = async () => {
        const ts = `export const LEVELS: Level[] = ${JSON.stringify(levels, null, 4)};\n`;
        try { await navigator.clipboard.writeText(ts); toast('Đã copy, dán vào LEVELS trong src/game/data.ts'); }
        catch { download('levels.ts', ts); }
    };
    $('bank-reset').onclick = () => {
        if (!confirm('Thay toàn bộ danh sách bằng 10 màn gốc? (Bản đang lưu vẫn còn trong Bản sao lưu.)')) return;
        levels = clone(LEVELS).map(normalize);
        savedEach = levels.map(() => '');
        openLevel(0);
    };
}

// ---------- organizer ----------
function renderOrganizer() {
    const body = $('org-body');
    body.innerHTML = '';
    levels.forEach((lv, i) => {
        const rep = validate(lv);
        const tr = document.createElement('tr');
        if (i === cur) tr.className = 'cur';
        const planes = lv.queues ? lv.queues.flat().length : Object.values(rep.counts).reduce((a, n) => a + splitAmmo(n).length, 0);
        const mech = [lv.hidden ? `❓ ${Math.round(lv.hidden * 100)}%` : '', lv.connected ? `🔗 ${lv.connected}` : '',
            ...(lv.big || []).map((b) => (b.size === 5 ? '👑 lõi' : `🧱 ${b.n}× ${b.hp[0]}–${b.hp[1]}`))].filter(Boolean);
        tr.innerHTML = `<td><b>${i + 1}</b></td><td class="th"></td><td><b>${escapeHtml(lv.name)}</b>${lv.feature ? `<div class="hint" style="margin:0">popup: ${lv.feature}</div>` : ''}</td>
            <td>${Object.keys(rep.counts).length}</td><td>${rep.blocks}${lv.big ? '+' : ''}</td><td>${lv.queues ? '' : '~'}${planes}</td><td>${lv.waves.length}</td>
            <td>${mech.map((m) => `<span class="tag">${m}</span>`).join('') || '—'}</td><td>${lv.queues ? '✋ xếp tay' : '🎲 ngẫu nhiên'}</td>
            <td>${rep.errors.length ? `<span style="color:var(--red)">⛔ ${rep.errors.length}</span>` : rep.warns.length ? `<span style="color:var(--amber)">⚠️ ${rep.warns.length}</span>` : '<span style="color:var(--green)">✅</span>'}</td>
            <td><div class="row" style="flex-wrap:nowrap">
              <button class="btn" data-a="edit" title="Sửa">✎</button><button class="btn" data-a="play" title="Chơi thử">▶</button>
              <button class="btn" data-a="up" title="Lên">↑</button><button class="btn" data-a="down" title="Xuống">↓</button>
              <button class="btn" data-a="dup" title="Nhân bản">⧉</button><button class="btn danger" data-a="del" title="Xoá">🗑</button></div></td>`;
        tr.querySelector('.th')!.appendChild(thumb(lv, 3, 120));
        tr.querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.onclick = () => orgAction(b.dataset.a!, i));
        body.appendChild(tr);
    });
}

function orgAction(a: string, i: number) {
    if (a === 'edit') { openLevel(i); setMode('editor'); return; }
    if (a === 'play') { openLevel(i); play(false); return; }
    if (a === 'up') move(i, -1);
    if (a === 'down') move(i, 1);
    if (a === 'dup') { const c = clone(levels[i]); c.name += ' (bản sao)'; addLevel(c, i + 1); }
    if (a === 'del') deleteLevel(i);
    renderOrganizer();
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
    if (validate(L()).errors.length) { toast('Màn đang có lỗi ⛔, sửa trước khi chơi thử'); return; }
    if (!save()) return; // the game reads the saved list
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
        const replace = confirm(`File có ${ok.length} màn.\n\nOK = thay cả danh sách hiện tại\nCancel = thêm vào cuối danh sách`);
        if (replace) { levels = ok.map(normalize); savedEach = levels.map(() => ''); openLevel(0); }
        else { const at = levels.length; ok.forEach((l) => { levels.push(normalize(l)); savedEach.push(''); }); openLevel(at); }
    } else if (valid(data)) {
        const replace = confirm(`OK = thay màn ${cur + 1} "${L().name}" bằng "${data.name}"\nCancel = thêm "${data.name}" thành màn mới`);
        if (replace) { snapshot(); levels[cur] = normalize(data); wave = 0; renderAll(true); }
        else addLevel(normalize(data));
    } else { toast('File không đúng định dạng màn Pixel Squadron'); return; }
    if (mode === 'organizer') renderOrganizer();
    toast('Đã nhập, bấm Lưu để giữ');
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
    window.addEventListener('beforeunload', (e) => { if (isDirty()) e.preventDefault(); });
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
        if (e.key === 'Escape') { $('backups').classList.remove('show'); popover?.remove(); popover = null; }
        const typing = (e.target as HTMLElement).matches('input,select,textarea');
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (save()) toast('Đã lưu vào trình duyệt'); return; }
        if (typing) return;
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
        if (mode !== 'editor') return;
        const n = '1234567890'.indexOf(e.key);
        const act = activeKeys();
        if (n >= 0 && n < act.length) { colour = act[n]; if (tool === 'erase' || tool === 'pick') tool = 'paint'; renderPalette(); renderTools(); if (L().queues) refreshDerived(); return; }
        const t = ({ b: 'paint', e: 'erase', g: 'fill', i: 'pick' } as Record<string, Tool>)[e.key.toLowerCase()];
        if (t) { tool = t; renderTools(); renderPalette(); }
    });
}

function wireResizers() {
    document.querySelectorAll<HTMLElement>('.panel-resizer').forEach((r) => {
        const target = $(r.dataset.target!), sign = +r.dataset.sign!;
        r.addEventListener('dblclick', () => { target.style.flexBasis = ''; });
        r.addEventListener('pointerdown', (e) => {
            const x0 = e.clientX, w0 = target.getBoundingClientRect().width;
            r.setPointerCapture(e.pointerId);
            const mv = (ev: PointerEvent) => { target.style.flexBasis = `${Math.max(170, w0 + sign * (ev.clientX - x0))}px`; };
            const up = () => { r.removeEventListener('pointermove', mv); r.removeEventListener('pointerup', up); };
            r.addEventListener('pointermove', mv);
            r.addEventListener('pointerup', up);
        });
    });
}

// ---------- render ----------
function renderHeader() {
    $('lvl-num').textContent = String(cur + 1);
    $('lvl-name').textContent = L().name;
}

function renderDirty() {
    $('dirty').classList.toggle('on', isDirty());
}

/** Everything that depends on the level data but not on the wave grid's DOM. */
function refreshDerived() {
    const gen = sample(L());
    renderPalette();
    renderValidation();
    renderBoard(gen);
    renderPlanes(gen);
    renderBank();
    renderDirty();
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
wirePlanes();
wireBank();
wireKeys();
wireResizers();
const startAt = parseInt(new URLSearchParams(location.search).get('level') ?? '', 10);
openLevel(Number.isFinite(startAt) ? startAt - 1 : 0);
