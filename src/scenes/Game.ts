import * as Phaser from 'phaser';
import {
    BCOLS, BROWS, BULLET_V, FEATURES, FIRE_CD, FONT, GAP, H, HUD_H, PAL, SLOTS, STALL_MAX, W, ZOOM, hex, loadLevels, type Feature
} from '../game/data';
import { dashCircle, dashLine, drawBullet, drawPlane, fillRR, gradRR, panel, strokeRR } from '../game/art';
import { TextPool } from '../game/TextPool';
import { Popups } from '../ui/Popups';

import { generateLevel, type Form, type Grid, type QPlane, type Target } from '../game/levelgen';

/** A plane in the air. */
interface Plane {
    c: string; ammo: number; x: number; y: number; hx: number; hy: number; slot: number;
    st: 'enter' | 'idle' | 'attack' | 'leave'; cd: number; idle: number; tgt: Target | null; alpha: number; kick: number;
}
interface Bullet { x: number; y: number; c: string; fi: number; r: number; cc: number; hitRow: number }
interface Part { x: number; y: number; vx: number; vy: number; s: number; life: number; c: string }
interface Rect { x: number; y: number; w: number; h: number }

type Mode = 'menu' | 'play' | 'win' | 'lose';

/** Haptics; off during the editor's autoplay (nobody is holding the phone, and browsers block it without a tap). */
const QUIET = new URLSearchParams(location.search).get('autoplay') === '1';
const vib = (ms: number | number[]) => { if (QUIET) return; try { navigator.vibrate?.(ms); } catch { /* not supported */ } };

export class Game extends Phaser.Scene {
    // layout
    private cell = 0; private gridX = 0; private gridY = 0; private boardH = 0; private floorY = 0;
    private card: Rect = { x: 0, y: 0, w: 0, h: 0 };
    private sky: Rect = { x: 0, y: 0, w: 0, h: 0 };
    private queueR: Rect = { x: 0, y: 0, w: 0, h: 0 };
    private planeSize = 30; private qSize = 28;
    private tSlot: { x: number; y: number }[] = [];

    // state
    private forms: Form[] = [];
    private remaining = 0; private total = 1;
    private remColor: Record<string, number> = {};
    private reserved: Record<string, number> = {}; // 'form:row:col' -> bullets on their way
    private nColors = 0;
    private queues: QPlane[][] = [[], [], []];
    private slots: (Plane | null)[] = new Array(SLOTS).fill(null);
    private flying: Plane[] = []; private bullets: Bullet[] = []; private parts: Part[] = [];
    private ripples: { x: number; y: number; t: number }[] = [];
    private hitFlash: { fi: number; r: number; c: number; t: number }[] = [];
    private stars: { x: number; y: number; r: number; a: number; t: number }[] = [];
    private press = [0, 0, 0];
    private level = 0; private mode: Mode = 'menu'; private shake = 0; private clock = 0;
    /** Rows the whole formation has stepped down; it only steps when the bottom row is cleared. */
    private shift = 0; private shiftTarget = 0;
    private boost = 1; // x2 once all three hangars are empty
    private stall = 0;
    private paused = false;
    private seenFeature: Record<string, boolean> = {};
    private skin = 0; private ammoFx = 0;
    private levels = loadLevels();
    /** ?autoplay=1: a bot taps the hangars (used by the level editor). */
    private autoplay = false;
    private botT = 0;

    // display
    private gBg!: Phaser.GameObjects.Graphics;
    private world!: Phaser.GameObjects.Container;
    private gBack!: Phaser.GameObjects.Graphics;
    private gBoard!: Phaser.GameObjects.Graphics;
    private gFront!: Phaser.GameObjects.Graphics;
    private textA!: TextPool;
    private textB!: TextPool;
    private popups!: Popups;
    private hud!: { lv: Phaser.GameObjects.Text; name: Phaser.GameObjects.Text; left: Phaser.GameObjects.Text; fill: Phaser.GameObjects.Graphics; fillW: number; fillMax: number };

    constructor() {
        super('Game');
    }

    create() {
        this.cameras.main.setZoom(ZOOM).centerOn(W / 2, H / 2);
        try {
            const sv = localStorage.getItem('ps_skin'), av = localStorage.getItem('ps_ammo');
            if (sv !== null) this.skin = Phaser.Math.Clamp(+sv || 0, 0, 4);
            if (av !== null) this.ammoFx = Phaser.Math.Clamp(+av || 0, 0, 4);
        } catch { /* storage blocked */ }

        this.gBg = this.add.graphics().setDepth(0);
        this.world = this.add.container(0, 0).setDepth(1);
        this.gBack = this.add.graphics();
        this.gBoard = this.add.graphics();
        this.gFront = this.add.graphics();
        const tA = this.add.container(0, 0), tB = this.add.container(0, 0);
        this.world.add([this.gBack, this.gBoard, tA, this.gFront, tB]);
        this.textA = new TextPool(this, tA, 3);
        this.textB = new TextPool(this, tB, 3);
        this.buildHud();
        this.popups = new Popups(this);
        this.makeStars();

        this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
            if (over.length) return; // a button or a popup took it
            this.onTap(p.worldX, p.worldY);
        });

        // ?level=N (1-based) jumps straight into a level; ?autoplay=1 lets a bot play it. Both come from the level editor.
        const q = new URLSearchParams(location.search);
        this.autoplay = q.get('autoplay') === '1';
        if (this.autoplay) Object.keys(FEATURES).forEach((k) => { this.seenFeature[k] = true; }); // nobody to tap "ĐÃ HIỂU"
        const start = Math.max(0, (parseInt(q.get('level') ?? '', 10) || 0) - 1);
        if (q.has('level')) {
            this.loadLevel(start);
            this.mode = 'play';
            if (this.autoplay) this.popups.toast('AUTO PLAY: bot đang chơi');
            return;
        }
        this.loadLevel(0);
        this.popups.showOverlay({
            icon: '✈️', title: 'PIXEL SQUADRON', levels: this.levels.length, lit: -1, button: 'BẮT ĐẦU',
            text: 'Chạm vào một khoang chứa ở dưới để cho máy bay bay lên. Nó tự bắn khối pixel cùng màu đang lộ ra ở đáy (khối có viền sáng).\n\n' +
                'Board hiện 10 hàng khối và không tự trôi: mỗi lần hàng dưới cùng bị phá sạch, cả đội hình bước xuống 1 hàng và hàng mới hiện ra ở trên.\n\n' +
                'Vùng chiến đấu chứa tối đa 5 máy bay. Đầy 5 mà 5 giây không phá được khối nào là thua.',
            onButton: () => { this.loadLevel(this.level); this.mode = 'play'; vib(15); }
        });
    }

    update(_time: number, delta: number) {
        const dt = Math.min(0.05, delta / 1000);
        if (!this.paused) this.step(dt);
        this.draw();
    }

    /* ---------- HUD ---------- */
    private buildHud() {
        const c = this.add.container(0, 0).setDepth(50);
        const g = this.add.graphics();
        c.add(g);
        const y = 9, h = HUD_H - 18;
        const glass = (x: number, w: number) => {
            gradRR(g, x, y, w, h, 15, 0xffffff, 0.11, 0xffffff, 0.045);
            g.lineStyle(1, 0xffffff, 0.13); strokeRR(g, x + 0.5, y + 0.5, w - 1, h - 1, 15);
        };
        const txt = (x: number, ty: number, s: string, size: number, weight: number, ox = 0.5) =>
            this.add.text(x, ty, s, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: String(weight), color: '#eaf0ff', resolution: 3 }).setOrigin(ox, 0.5);

        // level badge
        const bx = 11;
        glass(bx, 46);
        const lvl = txt(bx + 23, y + 13, 'MÀN', 7, 700).setAlpha(0.6).setLetterSpacing(0.8);
        const lv = txt(bx + 23, y + 28, '1', 19, 700);
        // three buttons on the right
        const btnW = 36, gap = 7, right = W - 11;
        const bxs = [right - btnW * 3 - gap * 2, right - btnW * 2 - gap, right - btnW];
        const icons = ['↻', '🎨', '▦'];
        const actions = [() => this.replay(), () => this.openCustom(), () => this.openLevels()];
        // progress meter between the badge and the buttons
        const mx = bx + 46 + gap, mw = bxs[0] - gap - mx;
        glass(mx, mw);
        const name = txt(mx + 11, y + 14, '', 11, 700, 0);
        const left = txt(mx + mw - 11, y + 14, '', 10, 400, 1).setAlpha(0.65);
        g.fillStyle(0x000000, 0.4); fillRR(g, mx + 11, y + 26, mw - 22, 6, 3);
        const fill = this.add.graphics();
        c.add([lvl, lv, name, left, fill]);
        bxs.forEach((x, i) => {
            glass(x, btnW);
            const t = txt(x + btnW / 2, y + h / 2, icons[i], 18, 400);
            const hit = this.add.zone(x + btnW / 2, y + h / 2, btnW, h).setInteractive({ useHandCursor: true });
            hit.on('pointerdown', () => t.setScale(0.92));
            hit.on('pointerout', () => t.setScale(1));
            hit.on('pointerup', () => { t.setScale(1); actions[i](); vib(10); });
            c.add([t, hit]);
        });
        fill.setPosition(mx + 11, y + 26);
        this.hud = { lv, name, left, fill, fillW: 0, fillMax: mw - 22 };
    }

    private updateHud() {
        this.hud.left.setText(`còn ${this.remaining} khối`);
        const target = Math.round((1 - this.remaining / this.total) * this.hud.fillMax);
        this.tweens.addCounter({
            from: this.hud.fillW, to: target, duration: 300, ease: 'Sine.Out',
            onUpdate: (tw) => {
                const w = tw.getValue() ?? 0;
                this.hud.fillW = w;
                const f = this.hud.fill;
                f.clear();
                if (w < 1) return;
                f.fillStyle(0x38bdf8, 0.3); fillRR(f, -1, -2, w + 2, 10, 5);
                f.fillGradientStyle(0x4ade80, 0x38bdf8, 0x4ade80, 0x38bdf8, 1);
                f.fillRect(0, 0, w, 6);
            }
        });
    }

    private replay() {
        this.popups.close();
        this.paused = false;
        this.loadLevel(this.level);
        this.mode = 'play'; vib(12);
        this.popups.toast(`Chơi lại màn ${(this.level % this.levels.length) + 1}`);
    }

    private openLevels() {
        this.paused = true;
        const info = this.levels.map((L) => {
            const cs = new Set<string>();
            L.waves.forEach((w) => w.art.forEach((r) => [...r].forEach((ch) => { if (ch !== '.') cs.add(ch); })));
            return { name: L.name, colors: cs.size };
        });
        this.popups.showLevels(info, this.level,
            (i) => { this.paused = false; this.loadLevel(i); this.mode = 'play'; vib(15); },
            () => { this.paused = false; });
    }

    private openCustom() {
        this.paused = true;
        this.popups.showCustom(this.skin, this.ammoFx, (s, a) => {
            this.skin = s; this.ammoFx = a; vib(10);
            try { localStorage.setItem('ps_skin', String(s)); localStorage.setItem('ps_ammo', String(a)); } catch { /* storage blocked */ }
        }, () => { this.paused = false; });
    }

    private showFeature(f: Feature) {
        if (this.seenFeature[f.key]) return;
        this.seenFeature[f.key] = true;
        this.paused = true;
        this.popups.showFeature(f, () => { this.paused = false; vib(12); });
    }

    /* ---------- layout ---------- */
    private makeStars() {
        const n = Math.round((W * H) / 14000);
        for (let i = 0; i < n; i++) this.stars.push({
            x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.3 + 0.35, a: Math.random() * 0.5 + 0.12, t: Math.random() * 6
        });
    }

    private layout() {
        const topY = HUD_H + 4;
        const qh = Math.max(120, Math.min(200, H * 0.25));
        const qTop = H - qh - 6;
        const HEAD = this.nColors > 6 ? 50 : 32, PADB = 10; // colour chips header (2 rows when many colours)
        const picMaxH = (qTop - topY) * 0.62 - HEAD - PADB;
        const cell = this.cell = Math.max(6, Math.floor(Math.min((W - 40) / BCOLS, picMaxH / (BROWS + GAP))));
        this.boardH = cell * (BROWS + GAP);
        this.card = { x: 14, y: topY, w: W - 28, h: HEAD + this.boardH + PADB };
        this.gridX = Math.round((W - cell * BCOLS) / 2);
        this.gridY = Math.round(this.card.y + HEAD);
        this.floorY = this.gridY + this.boardH;
        this.sky = { x: 14, y: this.card.y + this.card.h + 12, w: W - 28, h: qTop - (this.card.y + this.card.h) - 24 };
        this.queueR = { x: 12, y: qTop, w: W - 24, h: qh - 8 };
        this.planeSize = Math.min(38, this.sky.w / 6.4, this.sky.h * 0.42);
        this.qSize = Math.min(42, (this.queueR.w / 3) * 0.5, (this.queueR.h - 26) / 4.1);
        this.tSlot = [];
        for (let i = 0; i < SLOTS; i++) this.tSlot.push({
            x: this.sky.x + ((i + 0.5) * this.sky.w) / SLOTS,
            y: this.sky.y + this.sky.h * 0.56 + (i % 2 ? this.sky.h * 0.17 : -this.sky.h * 0.1)
        });
    }

    /* ---------- level setup ---------- */
    private loadLevel(i: number) {
        const levels = this.levels;
        this.level = i % levels.length;
        const L = levels[this.level];
        const gen = generateLevel(L);
        this.forms = gen.forms;
        this.remaining = this.total = gen.remaining;
        this.remColor = { ...gen.count };
        this.nColors = Object.keys(gen.count).length;
        this.queues = gen.queues;
        this.reserved = {}; this.slots.fill(null);
        this.flying = []; this.bullets = []; this.parts = []; this.ripples = []; this.hitFlash = []; this.press = [0, 0, 0];
        this.stall = 0;
        this.shift = this.shiftTarget = BROWS - 1 - this.maxAbsRow(); // lowest block row sits on the board's bottom row
        this.hud.lv.setText(String(this.level + 1));
        this.hud.name.setText(L.name);
        if (L.feature && FEATURES[L.feature]) this.showFeature(FEATURES[L.feature]);
        this.layout();
        this.updateHud();
    }

    private activeCount() { let n = 0; this.flying.forEach((p) => { if (p.slot >= 0) n++; }); return n; }

    /* ---------- interaction ---------- */
    /** Send the head plane of hangar ci to slot slotIdx. Once airborne it is independent. */
    private sendPlane(ci: number, slotIdx: number) {
        const src = this.queueSlotPos(ci, 0);
        const d = this.queues[ci].shift()!;
        const p: Plane = { c: d.c, ammo: d.a, x: src.x, y: src.y, hx: this.tSlot[slotIdx].x, hy: this.tSlot[slotIdx].y, slot: slotIdx,
            st: 'enter', cd: 0, idle: 0, tgt: null, alpha: 1, kick: 0 };
        this.slots[slotIdx] = p;
        this.flying.push(p);
    }

    private freeSlots() { const a: number[] = []; this.slots.forEach((s, i) => { if (!s) a.push(i); }); return a; }

    /** Can hangar ci launch its head plane right now (linked-pair rule and free slots)? */
    private canLaunch(ci: number) {
        const q = this.queues, h = q[ci][0], fs = this.freeSlots().length;
        if (!h) return false;
        if (h.link) {
            const sameCol = q[ci][1] && q[ci][1].link === h.link;
            const oi = q.findIndex((qq, j) => j !== ci && qq.length > 0 && qq[0].link === h.link);
            return (sameCol || oi >= 0) && fs >= 2;
        }
        return fs >= 1;
    }

    /** Is there a launch that could hit a block immediately? */
    private canLaunchUseful() {
        for (let c = 0; c < 3; c++) if (this.canLaunch(c) && this.findTarget(this.queues[c][0].c)) return true;
        return false;
    }

    private launch(ci: number) {
        if (this.mode !== 'play') return;
        this.press[ci] = 1;
        const q = this.queues[ci];
        if (!q.length) { this.popups.toast('Khoang này đã hết máy bay'); return; }
        const head = q[0], fs = this.freeSlots();
        if (head.link) { // Connected Plane: both go together
            const sameCol = q[1] && q[1].link === head.link;
            const oi = this.queues.findIndex((qq, j) => j !== ci && qq.length > 0 && qq[0].link === head.link);
            if (!sameCol && oi < 0) { this.popups.toast('Cặp nối đôi: chiếc còn lại chưa lên đầu hàng'); vib(25); return; }
            if (fs.length < 2) { this.popups.toast('Cặp nối đôi cần 2 chỗ trống'); vib(25); return; }
            this.sendPlane(ci, fs[0]); this.sendPlane(sameCol ? ci : oi, fs[1]);
            vib([12, 40, 12]); return;
        }
        if (!fs.length) { this.popups.toast('Vùng chiến đấu đã đầy 5 máy bay!'); vib(30); return; }
        this.sendPlane(ci, fs[0]); vib(12);
    }

    private queueSlotPos(ci: number, k: number) {
        const colW = this.queueR.w / 3;
        return { x: this.queueR.x + colW * (ci + 0.5), y: this.queueR.y + this.qSize * 0.88 + k * this.qSize };
    }

    private onTap(px: number, py: number) {
        if (this.mode !== 'play' || this.paused) return;
        this.ripples.push({ x: px, y: py, t: 0 });
        if (py >= this.queueR.y - 8) {
            const ci = Math.floor((px - this.queueR.x) / (this.queueR.w / 3));
            if (ci >= 0 && ci < 3) this.launch(ci);
        }
    }

    /* ---------- formation position ---------- */
    private formTop(f: Form) { return this.gridY + (f.dy + this.shift) * this.cell; }
    private formLowest(f: Form) {
        for (let r = f.h - 1; r >= 0; r--) for (let c = 0; c < f.w; c++) if (f.cells[r][c]) return r;
        return -1;
    }
    /** Lowest (absolute) row that still has a block. */
    private maxAbsRow() {
        let m = -1e9;
        this.forms.forEach((f) => { const lr = this.formLowest(f); if (lr >= 0) m = Math.max(m, f.dy + lr); });
        return m;
    }
    /** When the bottom row is cleared the formation slides down until the lowest block is on the bottom row again. */
    private updateShift(dt: number) {
        const m = this.maxAbsRow();
        if (m < -1e8) return;
        this.shiftTarget = BROWS - 1 - m;
        if (this.shift < this.shiftTarget) this.shift = Math.min(this.shiftTarget, this.shift + dt * 6);
        else if (this.shift > this.shiftTarget) this.shift = this.shiftTarget;
    }
    private cellXY(fi: number, r: number, c: number) {
        const f = this.forms[fi], v = f.cells[r] && f.cells[r][c], w = (v && v.w) || 1, h = (v && v.h) || 1;
        return { x: this.gridX + (f.ox + c + w / 2) * this.cell, y: this.formTop(f) + (r + h / 2) * this.cell };
    }

    /* ---------- targeting ---------- */
    private rKey(fi: number, r: number, c: number) { return `${fi}:${r}:${c}`; }
    private resCount(fi: number, r: number, c: number) { return this.reserved[this.rKey(fi, r, c)] || 0; }
    private reserve(fi: number, r: number, c: number) { const k = this.rKey(fi, r, c); this.reserved[k] = (this.reserved[k] || 0) + 1; }
    private unreserve(fi: number, r: number, c: number) {
        const k = this.rKey(fi, r, c);
        if (this.reserved[k] > 1) this.reserved[k]--; else delete this.reserved[k];
    }

    /**
     * The "exposed" block of a board column: the lowest block in that column across all forms.
     * cellsOf lets the level generator run this on a copy of the board.
     */
    private exposedAt(bcol: number, cellsOf: (fi: number) => Grid, skipReserved: boolean, requireInside: boolean): Target | null {
        let best: Target | null = null;
        for (let fi = 0; fi < this.forms.length; fi++) {
            const f = this.forms[fi], c = bcol - f.ox;
            if (c < 0 || c >= f.w) continue;
            const cs = cellsOf(fi);
            for (let r = f.h - 1; r >= 0; r--) {
                const v = cs[r][c];
                if (!v) continue;
                const ar = v.a ? v.a[0] : r, ac = v.a ? v.a[1] : c, av = cs[ar][ac]!, hp = av.hp || 1;
                if (skipReserved && this.resCount(fi, ar, ac) >= hp) continue; // enough bullets already on the way
                const key = f.dy + r; // larger = lower on screen
                if (requireInside && key + this.shiftTarget < 0) break; // not on the board yet
                if (!best || key > best.key) best = { fi, r: ar, c: ac, bcol, key, col: av.c!, hitRow: r };
                break;
            }
        }
        return best;
    }
    private exposedCell(bcol: number) { return this.exposedAt(bcol, (fi) => this.forms[fi].cells, true, true); }
    private anyTarget() { for (let bc = 0; bc < BCOLS; bc++) if (this.exposedCell(bc)) return true; return false; }
    /** Lowest exposed block of a colour; ties go to the left. */
    private findTarget(color: string) {
        let best: Target | null = null;
        for (let bc = 0; bc < BCOLS; bc++) {
            const e = this.exposedCell(bc);
            if (!e || e.col !== color) continue;
            if (!best || e.key > best.key) best = e;
        }
        return best;
    }

    /* ---------- simulation ---------- */
    /** Editor bot: every 0.15 s launch a head plane that can shoot right away; if nothing is in the air, launch anything. */
    private bot(dt: number) {
        this.botT += dt;
        if (this.botT < 0.15 || this.mode !== 'play') return;
        this.botT = 0;
        for (let c = 0; c < 3; c++) {
            const h = this.queues[c][0];
            if (h && this.canLaunch(c) && this.findTarget(h.c)) { this.launch(c); return; }
        }
        if (this.activeCount() === 0) for (let c = 0; c < 3; c++) if (this.canLaunch(c)) { this.launch(c); return; }
    }

    private step(dt: number) {
        this.clock += dt;
        if (this.autoplay) this.bot(dt);
        if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 3);
        for (let i = 0; i < 3; i++) if (this.press[i] > 0) this.press[i] = Math.max(0, this.press[i] - dt * 5);
        for (let i = this.ripples.length - 1; i >= 0; i--) { this.ripples[i].t += dt; if (this.ripples[i].t > 0.5) this.ripples.splice(i, 1); }
        for (let i = this.hitFlash.length - 1; i >= 0; i--) { this.hitFlash[i].t += dt; if (this.hitFlash[i].t > 0.25) this.hitFlash.splice(i, 1); }

        // blocks never scroll on their own; the formation only steps down when the bottom row is cleared
        if (this.mode === 'play' || this.mode === 'win') this.updateShift(dt);

        // lose: 5 planes up and no block destroyed for STALL_MAX seconds (or nothing useful can happen at all)
        if (this.mode === 'play') {
            const noMove = this.bullets.length === 0 && !this.canLaunchUseful() &&
                this.flying.every((p) => p.slot < 0 || p.ammo <= 0 || !this.findTarget(p.c));
            const waiting = !this.anyTarget(); // board empty while the next wave scrolls in: not a stall
            const active = this.activeCount();
            // out of planes with blocks left (possible with hand-placed hangars whose ammo does not add up)
            const outOfPlanes = active === 0 && this.queues.every((q) => !q.length) && this.bullets.length === 0;
            if (!waiting && (active >= SLOTS || (noMove && active > 0) || outOfPlanes)) {
                const before = Math.ceil(STALL_MAX - this.stall);
                this.stall += dt;
                const s = Math.max(0, Math.ceil(STALL_MAX - this.stall));
                if (s !== before && s <= 3) vib(18);
                if (this.stall >= STALL_MAX) this.gameOver(outOfPlanes);
            } else this.stall = 0;
        }

        // a hidden plane reaching the head of its hangar reveals itself
        this.queues.forEach((q) => { if (q.length && q[0].hidden) { q[0].hidden = false; q[0].reveal = 0.5; vib(8); } });
        this.queues.forEach((q) => q.forEach((p) => { if (p.reveal) p.reveal = Math.max(0, p.reveal - dt); }));

        // all hangars empty: the remaining planes fly and shoot twice as fast
        this.boost = this.queues.every((q) => !q.length) ? 2 : 1;
        const boost = this.boost;

        for (let i = this.flying.length - 1; i >= 0; i--) {
            const p = this.flying[i];
            // done (out of ammo, or its colour is gone): fly back down, never through the picture
            if (p.st === 'leave') { p.y += 430 * boost * dt; p.alpha -= dt * 1.5; if (p.alpha <= 0) this.flying.splice(i, 1); continue; }

            const atk = p.st === 'attack' && p.tgt;
            const tx = atk ? this.gridX + (p.tgt!.bcol + 0.5) * this.cell : p.hx;
            const ty = p.hy;
            // attacking: chase fast; waiting: drift slowly back to the slot
            const k = Math.min(1, dt * (p.st === 'idle' ? 1.3 : 7) * boost);
            p.x += (tx - p.x) * k; p.y += (ty - p.y) * k;
            p.cd = Math.max(0, p.cd - dt);

            if (p.st === 'enter' && Math.abs(p.x - p.hx) < 3 && Math.abs(p.y - p.hy) < 3) p.st = 'idle';
            if (p.st === 'idle') {
                const t = p.ammo > 0 ? this.findTarget(p.c) : null;
                if (t) { p.tgt = t; p.st = 'attack'; this.reserve(t.fi, t.r, t.c); p.idle = 0; }
                else if (this.planeDone(p)) { this.releaseSlot(p); p.st = 'leave'; }
                else p.idle += dt; // no block of its colour exposed: wait, still holding the slot
            } else if (p.st === 'attack' && p.tgt) {
                const tg = p.tgt;
                if (!this.forms[tg.fi].cells[tg.r][tg.c]) { // another plane destroyed it
                    this.unreserve(tg.fi, tg.r, tg.c); p.tgt = null; p.st = 'idle'; continue;
                }
                if (Math.abs(p.x - (this.gridX + (tg.bcol + 0.5) * this.cell)) < 4 && p.cd <= 0) {
                    this.bullets.push({ x: p.x, y: p.y - this.planeSize * 0.6, c: p.c, fi: tg.fi, r: tg.r, cc: tg.c, hitRow: tg.hitRow });
                    p.ammo--; p.cd = FIRE_CD / boost; p.tgt = null; p.kick = 1;
                    if (p.ammo <= 0) { this.releaseSlot(p); p.st = 'leave'; }
                    else { // lock the next target now so the plane is not pulled back to its slot
                        const t2 = this.findTarget(p.c);
                        if (t2) { p.tgt = t2; p.st = 'attack'; this.reserve(t2.fi, t2.r, t2.c); p.idle = 0; }
                        else p.st = 'idle';
                    }
                }
            }
            if (p.kick) p.kick = Math.max(0, p.kick - dt * 6);
        }

        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            b.y -= BULLET_V * dt;
            const bf = this.forms[b.fi];
            if (b.y <= this.formTop(bf) + (b.hitRow + 0.55) * this.cell) { // target may be moving: recheck every frame
                this.unreserve(b.fi, b.r, b.cc);
                const g = bf.cells[b.r][b.cc];
                if (g) {
                    this.remaining--; this.shake = 0.5;
                    this.remColor[g.c!] = (this.remColor[g.c!] || 1) - 1;
                    if (this.remColor[g.c!] <= 0) // colour finished: drop its spare planes from the hangars
                        this.queues = this.queues.map((q) => q.filter((x) => x.c !== g.c));
                    this.stall = 0;
                    const q = this.cellXY(b.fi, b.r, b.cc);
                    if (g.hp && g.hp > 1) { // Big Block: lose durability only
                        g.hp--;
                        this.hitFlash.push({ fi: b.fi, r: b.r, c: b.cc, t: 0 });
                        this.burst(q.x, q.y, PAL[g.c!]); vib(8);
                    } else {
                        if (g.big) { // clear the whole area the big block covered
                            for (let a = 0; a < g.h!; a++) for (let c = 0; c < g.w!; c++) bf.cells[b.r + a][b.cc + c] = null;
                            for (let n = 0; n < 10; n++) this.burst(q.x, q.y, PAL[g.c!]);
                            this.shake = 1; vib(20);
                        } else {
                            bf.cells[b.r][b.cc] = null; this.burst(q.x, q.y, PAL[g.c!]); vib(10);
                        }
                        this.hitFlash.push({ fi: b.fi, r: b.r, c: b.cc, t: 0 });
                    }
                    this.updateHud();
                    if (this.remaining <= 0) this.win();
                }
                this.bullets.splice(i, 1);
            }
        }

        for (let i = this.parts.length - 1; i >= 0; i--) {
            const q = this.parts[i];
            q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 900 * dt; q.life -= dt;
            if (q.life <= 0) this.parts.splice(i, 1);
        }
    }

    /** A plane is done when it is out of ammo or its colour has no blocks left anywhere. */
    private planeDone(p: Plane) { return p.ammo <= 0 || !this.remColor[p.c]; }
    private releaseSlot(p: Plane) { if (p.slot >= 0) { this.slots[p.slot] = null; p.slot = -1; } }
    private burst(x: number, y: number, col: string) {
        for (let i = 0; i < 9; i++) this.parts.push({ x, y, vx: (Math.random() - 0.5) * 280, vy: -Math.random() * 270 - 40,
            s: this.cell * 0.3, life: 0.45 + Math.random() * 0.3, c: col });
    }

    /* ---------- flow ---------- */
    private win() {
        if (this.mode !== 'play') return;
        this.mode = 'win'; vib([20, 50, 30]);
        this.time.delayedCall(700, () => {
            const last = this.level >= this.levels.length - 1;
            this.popups.showOverlay({
                icon: last ? '🏆' : '⭐', title: 'HOÀN THÀNH!', levels: this.levels.length, lit: this.level,
                text: `Bạn đã xoá sạch ${this.levels[this.level].name}.` + (last ? '\n\nĐã hết màn — chơi lại từ đầu nhé!' : ''),
                button: last ? 'CHƠI LẠI TỪ ĐẦU' : 'MÀN TIẾP THEO ›',
                onButton: () => { this.loadLevel(last ? 0 : this.level + 1); this.mode = 'play'; vib(15); }
            });
        });
    }

    private gameOver(outOfPlanes = false) {
        if (this.mode !== 'play') return;
        this.mode = 'lose'; this.shake = 1; vib([40, 60, 40]);
        this.time.delayedCall(900, () => {
            this.popups.showOverlay({
                icon: '🚧', title: outOfPlanes ? 'HẾT MÁY BAY!' : 'BẾ TẮC!', levels: this.levels.length, lit: this.level - 1,
                text: outOfPlanes ? 'Cả ba khoang đã hết máy bay nhưng tranh vẫn còn khối.\n\nTổng số đạn của màn này chưa khớp với số khối (kiểm tra lại phần xếp tay trong Level Editor).' :
                    'Vùng chiến đấu đã đầy 5 máy bay và suốt 5 giây không phá được khối nào.\n\n' +
                    'Mẹo: chỉ cho bay lên khi khối cùng màu đang lộ ra ở đáy (khối có viền sáng nhấp nháy).',
                button: 'THỬ LẠI',
                onButton: () => { this.loadLevel(this.level); this.mode = 'play'; vib(15); }
            });
        });
    }

    /* ---------- render ---------- */
    private colorCounts() {
        const m: Record<string, number> = {};
        this.forms.forEach((f) => { for (const row of f.cells) for (const v of row) if (v && !v.a) m[v.c!] = (m[v.c!] || 0) + (v.hp || 1); });
        return m;
    }

    private draw() {
        const { clock, cell, card, sky, queueR, gridX, gridY, floorY, boardH } = this;
        const bg = this.gBg, gb = this.gBack, gd = this.gBoard, gf = this.gFront, tA = this.textA, tB = this.textB;
        bg.clear(); gb.clear(); gd.clear(); gf.clear(); tA.begin(); tB.begin();

        // background + twinkling stars
        bg.fillGradientStyle(0x161f45, 0x161f45, 0x0c1229, 0x0c1229, 1);
        bg.fillRect(0, 0, W, H * 0.45);
        bg.fillGradientStyle(0x0c1229, 0x0c1229, 0x070a16, 0x070a16, 1);
        bg.fillRect(0, H * 0.45, W, H * 0.55);
        for (let i = 0; i < 12; i++) { // soft radial glow at the top
            bg.fillStyle(0x5878ff, 0.016);
            bg.fillCircle(W * 0.5, H * 0.12, W * 0.9 * (1 - i / 12));
        }
        for (const s of this.stars) {
            bg.fillStyle(0xdce6ff, s.a * (0.55 + 0.45 * Math.sin(clock * 1.6 + s.t)));
            bg.fillCircle(s.x, s.y, s.r);
        }
        if (!this.forms.length) { tA.end(); tB.end(); return; }
        this.world.setPosition(this.shake > 0 ? (Math.random() - 0.5) * this.shake * 4 : 0, this.shake > 0 ? (Math.random() - 0.5) * this.shake * 4 : 0);

        const exposed: Target[] = [];
        const hot: Record<string, boolean> = {}; // colours exposed at the bottom: shootable now
        for (let bc = 0; bc < BCOLS; bc++) { const e = this.exposedCell(bc); if (e) { exposed.push(e); hot[e.col] = true; } }

        /* --- picture card + remaining-colour chips --- */
        panel(gb, card.x, card.y, card.w, card.h, 22, 0xffffff, 0.075, 0.03);
        const cc = this.colorCounts();
        let cx = card.x + 14, chRow = 0;
        const chy = card.y + 9, chh = 17;
        for (const k in cc) {
            const label = String(cc[k]);
            const t = tA.put(0, 0, label, { size: 10.5, weight: 700, originX: 0 });
            const wpx = t.width + 26;
            if (cx + wpx > card.x + card.w - 12) { // out of room: second chip row
                if (chRow > 0) { t.setVisible(false); break; }
                chRow = 1; cx = card.x + 14;
            }
            const cy = chy + chRow * 19, on = hot[k], a = on ? 1 : 0.42;
            gb.fillStyle(on ? 0xffffff : 0x000000, (on ? 0.14 : 0.28) * a); fillRR(gb, cx, cy, wpx, chh, 8.5);
            if (on) { gb.lineStyle(1.2, 0xffffff, 0.45 + 0.3 * Math.sin(clock * 4)); strokeRR(gb, cx + 0.6, cy + 0.6, wpx - 1.2, chh - 1.2, 8.5); }
            gb.fillStyle(hex(PAL[k]), a); fillRR(gb, cx + 5, cy + chh / 2 - 3.5, 7, 7, 2);
            t.setPosition(cx + 17, cy + chh / 2 + 0.5).setAlpha(0.9 * a);
            cx += wpx + 5;
        }

        /* --- board: blocks clipped to the 10 visible rows --- */
        const clipTop = gridY, clipBot = gridY + boardH;
        const clipped = (x: number, y: number, w: number, h: number, r: number) => {
            const y0 = Math.max(y, clipTop), y1 = Math.min(y + h, clipBot);
            if (y1 - y0 < 0.5) return;
            fillRR(gd, x, y0, w, y1 - y0, y0 > y || y1 < y + h ? Math.min(r, (y1 - y0) / 2) : r);
        };
        const rad = Math.max(1.5, cell * 0.2);
        /** Vertical alpha ramp between y0 and y1, clipped to the board. */
        const shade = (x: number, w: number, y0: number, y1: number, col: number, a0: number, a1: number) => {
            const c0 = Math.max(y0, clipTop), c1 = Math.min(y1, clipBot);
            if (c1 - c0 < 0.5) return;
            const at = (yy: number) => a0 + ((a1 - a0) * (yy - y0)) / (y1 - y0);
            gd.fillGradientStyle(col, col, col, col, at(c0), at(c0), at(c1), at(c1));
            gd.fillRect(x, c0, w, c1 - c0);
        };
        this.forms.forEach((f) => {
            const fy = this.formTop(f);
            if (fy > floorY || fy + f.h * cell < gridY - cell) return; // off the board
            for (let r = 0; r < f.h; r++) for (let c = 0; c < f.w; c++) {
                const v = f.cells[r][c];
                if (!v || v.a) continue;
                const bw = (v.w || 1) * cell, bh = (v.h || 1) * cell;
                const x = gridX + (f.ox + c) * cell, y = fy + r * cell;
                if (y + bh < clipTop || y > clipBot) continue;
                gd.fillStyle(hex(PAL[v.c!]), 1); clipped(x + 1, y + 1, bw - 2, bh - 2, rad);
                // sheen: white .26 at the top fading out by 55%, then a shade to black .18 at the bottom
                shade(x + 1 + rad * 0.3, bw - 2 - rad * 0.6, y + 1, y + 1 + (bh - 2) * 0.55, 0xffffff, 0.26, 0);
                shade(x + 1 + rad * 0.3, bw - 2 - rad * 0.6, y + 1 + (bh - 2) * 0.55, y + bh - 1, 0x000000, 0, 0.18);
                if (v.big) { // durability number
                    if (y + 2 >= clipTop && y + bh - 2 <= clipBot) {
                        gd.lineStyle(2, 0x000000, 0.28); strokeRR(gd, x + 2, y + 2, bw - 4, bh - 4, rad);
                    }
                    const cyy = y + bh / 2;
                    if (cyy > clipTop + 4 && cyy < clipBot - 4) {
                        const fs = Math.round(cell * 0.72);
                        tA.put(x + bw / 2, cyy + 1.5, String(v.hp), { size: fs, weight: 900, color: '#000000', alpha: 0.45 });
                        tA.put(x + bw / 2, cyy, String(v.hp), { size: fs, weight: 900 });
                    }
                }
            }
        });
        // pulsing outline on exposed (shootable) blocks
        gd.lineStyle(2, 0xffffff, 0.45 + 0.35 * Math.sin(clock * 4));
        for (const e of exposed) {
            const f2 = this.forms[e.fi], v2 = f2.cells[e.r][e.c];
            const bw2 = ((v2 && v2.w) || 1) * cell, bh2 = ((v2 && v2.h) || 1) * cell;
            const x = gridX + (f2.ox + e.c) * cell + 1.5, y = this.formTop(f2) + e.r * cell + 1.5;
            if (y >= clipTop - 1 && y + bh2 - 3 <= clipBot + 1) strokeRR(gd, x, y, bw2 - 3, bh2 - 3, rad);
        }
        for (const h of this.hitFlash) {
            const a = 1 - h.t / 0.25, gr = cell * (0.5 + a * 0.35), q = this.cellXY(h.fi, h.r, h.c);
            if (q.y < clipTop || q.y > clipBot) continue;
            gd.fillStyle(0xffffff, a * 0.9); fillRR(gd, q.x - gr / 2, q.y - gr / 2, gr, gr, gr * 0.28);
        }
        // board floor: every time this row is cleared the formation steps down
        gb.lineStyle(1.5, 0xffffff, 0.16);
        dashLine(gb, card.x + 10, floorY + 1, card.x + card.w - 10, floorY + 1, 7, 6);

        /* --- combat zone ("sky") --- */
        const full = this.activeCount() >= SLOTS;
        panel(gb, sky.x, sky.y, sky.w, sky.h, 22, 0x5a8cff, 0.1, 0.03, full ? 0xff5c72 : 0xffffff, full ? 0.75 : 0.1);
        gb.lineStyle(1, 0xffffff, 0.05);
        for (let i = 1; i < SLOTS; i++) { const x = sky.x + (i * sky.w) / SLOTS; dashLine(gb, x, sky.y + 8, x, sky.y + sky.h - 8, 5, 9); }
        for (let i = 0; i < SLOTS; i++) {
            const s = this.tSlot[i];
            gb.lineStyle(1.5, 0xffffff, this.slots[i] ? 0.14 : 0.09);
            dashCircle(gb, s.x, s.y, this.planeSize * 0.6, 3, 4);
        }
        // full: red tint + countdown bar + seconds left
        if (full && this.mode === 'play') {
            const p = Math.max(0, 1 - this.stall / STALL_MAX);
            gb.fillStyle(0xff5c72, 0.18); fillRR(gb, sky.x, sky.y, sky.w, sky.h, 22);
            gb.fillStyle(0xff5c72, 1); fillRR(gb, sky.x + 10, sky.y + 8, (sky.w - 20) * p, 4, 2);
            const sec = Math.max(0, Math.ceil(STALL_MAX - this.stall));
            tB.put(sky.x + sky.w - 12, sky.y + 16, `ĐẦY 5 · ${sec}s`, { size: 12, weight: 800, color: '#ff5c72',
                alpha: 0.7 + 0.3 * Math.abs(Math.sin(clock * 7)), originX: 1, originY: 0 });
        }
        if (this.boost > 1 && this.mode === 'play') {
            tB.put(sky.x + 12, sky.y + 14, 'TĂNG TỐC ×2', { size: 11, weight: 800, color: '#6ef0ad',
                alpha: 0.65 + 0.3 * Math.abs(Math.sin(clock * 5)), originX: 0, originY: 0 });
        }

        // bullets, debris, planes in the air
        for (const b of this.bullets) drawBullet(gf, b.x, b.y, hex(PAL[b.c]), this.ammoFx);
        for (const q of this.parts) {
            gf.fillStyle(hex(q.c), Math.max(0, Math.min(1, q.life * 2.4)));
            gf.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s);
        }
        const plane = (x: number, y: number, s: number, col: number, label: string | null, alpha: number, kick: number) => {
            const L = drawPlane(gf, x, y, s, col, alpha, kick, this.skin, label !== null, (label ?? '').length > 1);
            if (label !== null) tB.put(L.x, L.y, label, { size: L.size, weight: 800, alpha });
        };
        for (const p of this.flying) {
            let a = p.alpha, dx = 0;
            if (p.st === 'idle' && p.idle > 1.2) { // waiting with nothing to shoot
                dx = Math.sin(p.idle * 4) * this.planeSize * 0.07;
                a = p.alpha * (0.62 + 0.38 * Math.abs(Math.sin(p.idle * 2.2)));
            }
            plane(p.x + dx, p.y, this.planeSize, hex(PAL[p.c]), String(p.ammo), Math.max(0, a), p.kick);
        }

        /* --- hangars --- */
        const colW = queueR.w / 3;
        const vis = (q: QPlane[]) => Math.min(q.length, Math.max(1, Math.floor((queueR.h - 20) / this.qSize)));
        for (let ci = 0; ci < 3; ci++) {
            const pr = this.press[ci], sc = 1 - pr * 0.03;
            const bx = queueR.x + colW * ci + 4, bw = colW - 8;
            const ox = bx + bw / 2, oy = queueR.y + queueR.h / 2;
            const T = (x: number, y: number) => ({ x: ox + (x - ox) * sc, y: oy + (y - oy) * sc });
            const tl = T(bx, queueR.y);
            panel(gf, tl.x, tl.y, bw * sc, queueR.h * sc, 20, 0xffffff, 0.085 + pr * 0.06, 0.025);
            const q = this.queues[ci], n = vis(q);
            for (let k = n - 1; k >= 0; k--) {
                const pos = T(this.queueSlotPos(ci, k).x, this.queueSlotPos(ci, k).y);
                const qs = this.qSize * sc, hid = !!q[k].hidden;
                if (k === 0 && !hid) { // ring around the head: green = can shoot right away
                    const ready = !!hot[q[0].c];
                    gf.lineStyle(ready ? 2 : 1.5, ready ? 0x6ef0ad : 0xffffff, ready ? 0.55 + 0.35 * Math.sin(clock * 4) : 0.12);
                    gf.strokeCircle(pos.x, pos.y, qs * 0.72);
                }
                const fade = k === 0 ? 1 : (k === n - 1 && q.length > n ? 0.22 : 0.5); // last visible one hints at a longer queue
                if (q[k].link && !hid) { // yellow ring: part of a linked pair
                    gf.lineStyle(1.6, 0xffd666, k === 0 ? 0.8 : 0.4);
                    gf.strokeCircle(pos.x, pos.y, qs * (k === 0 ? 0.86 : 0.7));
                }
                plane(pos.x, pos.y, qs * (k === 0 ? 1 : 0.8), hid ? 0x4b5578 : hex(PAL[q[k].c]), hid ? '?' : String(q[k].a), fade, 0);
                if (q[k].reveal) { // flash when just revealed
                    const a = q[k].reveal! / 0.5;
                    gf.lineStyle(2, 0xffffff, a * 0.9);
                    gf.strokeCircle(pos.x, pos.y, qs * (0.72 + 0.5 * (1 - a)));
                }
            }
            if (!q.length) tB.put(ox, oy, 'trống', { size: 11, weight: 400, alpha: 0.28 });
        }
        // rope between the two planes of a linked pair
        const seen: Record<number, { x: number; y: number }> = {};
        for (let ci = 0; ci < 3; ci++) {
            const q = this.queues[ci];
            for (let k = 0; k < vis(q); k++) {
                const p = q[k];
                if (!p.link || p.hidden) continue;
                const b = this.queueSlotPos(ci, k);
                if (seen[p.link]) {
                    const a = seen[p.link];
                    gf.lineStyle(1.8, 0xffd666, 0.6); dashLine(gf, a.x, a.y, b.x, b.y, 4, 4);
                    gf.fillStyle(0xffd666, 0.9); gf.fillCircle(a.x, a.y, 2.4); gf.fillCircle(b.x, b.y, 2.4);
                } else seen[p.link] = b;
            }
        }
        // tap ripples
        for (const rp of this.ripples) {
            const a = 1 - rp.t / 0.5;
            gf.lineStyle(2 * a, 0xcfe0ff, a * 0.35);
            gf.strokeCircle(rp.x, rp.y, 10 + rp.t * 70);
        }
        tA.end(); tB.end();
    }
}

