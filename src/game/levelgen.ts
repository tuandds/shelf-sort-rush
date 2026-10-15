// Turns level data into a playable board and the planes for it. Pure (no Phaser), shared by the game and the level editor.
import { BCOLS, PAL, type Level } from './data';

/** A board cell: a normal block {c}, a big block {c,hp,w,h,big}, or a cell covered by a big block {a:[row,col]}. */
export interface Cell { c?: string; hp?: number; w?: number; h?: number; big?: boolean; a?: [number, number] }
export type Grid = (Cell | null)[][];
export interface Form { cells: Grid; w: number; h: number; ox: number; dy: number }
export interface Target { fi: number; r: number; c: number; bcol: number; key: number; col: string; hitRow: number }
/** A plane waiting in a hangar queue. */
export interface QPlane { c: string; a: number; key: number; hidden?: boolean; link?: number; reveal?: number }

export interface Generated {
    forms: Form[];
    /** Total hits needed (big blocks count their durability). */
    remaining: number;
    /** Hits needed per colour. */
    count: Record<string, number>;
    queues: QPlane[][];
}

export const bigSize = (hp: number) => (hp <= 6 ? 2 : hp <= 8 ? 3 : 4); // higher durability = bigger block

/**
 * Split one colour's block count into planes of 10..20 rounds whose ammo adds up exactly
 * (e.g. 25 -> 15+10, 33 -> 20+13, 48 -> 20+18+10).
 */
export function splitAmmo(n: number): number[] {
    const chunks: number[] = [];
    while (n >= 30) { chunks.push(20); n -= 20; }
    if (n >= 10 && n <= 20) chunks.push(n);
    else if (n > 20) { chunks.push(n - 10); chunks.push(10); } // 21..29
    else if (n > 0) chunks.push(n); // fewer than 10 blocks (should not happen)
    return chunks;
}

/**
 * The "exposed" block of a board column on a given grid copy: the lowest block in that column across all forms.
 * (The game has its own version that also skips reserved blocks and blocks still above the board.)
 */
export function exposedOn(forms: Form[], cellsOf: (fi: number) => Grid, bcol: number): Target | null {
    let best: Target | null = null;
    for (let fi = 0; fi < forms.length; fi++) {
        const f = forms[fi], c = bcol - f.ox;
        if (c < 0 || c >= f.w) continue;
        const cs = cellsOf(fi);
        for (let r = f.h - 1; r >= 0; r--) {
            const v = cs[r][c];
            if (!v) continue;
            const ar = v.a ? v.a[0] : r, ac = v.a ? v.a[1] : c, av = cs[ar][ac]!;
            const key = f.dy + r;
            if (!best || key > best.key) best = { fi, r: ar, c: ac, bcol, key, col: av.c!, hitRow: r };
            break;
        }
    }
    return best;
}

/** Build the board, big blocks and plane queues for a level. Uses `rnd` for every random choice. */
export function generateLevel(L: Level, rnd: () => number = Math.random): Generated {
    const forms: Form[] = [];
    let remaining = 0;
    const count: Record<string, number> = {};
    L.waves.forEach((w) => {
        const art = w.art, h = art.length, wd = Math.max(0, ...art.map((r) => r.length));
        const ox = w.ox === undefined ? Math.floor((BCOLS - wd) / 2) : w.ox;
        const cells: Grid = [];
        for (let r = 0; r < h; r++) {
            const row: (Cell | null)[] = [];
            for (let c = 0; c < wd; c++) {
                const ch = art[r][c] ?? '.';
                if (ch === '.' || !PAL[ch]) row.push(null);
                else { row.push({ c: ch }); remaining++; count[ch] = (count[ch] || 0) + 1; }
            }
            cells.push(row);
        }
        forms.push({ cells, w: wd, h, ox, dy: w.dy || 0 });
    });
    // centre the whole formation horizontally regardless of the hand-written ox values
    {
        let lo = 1e9, hi = -1e9;
        forms.forEach((f) => { lo = Math.min(lo, f.ox); hi = Math.max(hi, f.ox + f.w); });
        const off = Math.floor((BCOLS - (hi - lo)) / 2) - lo;
        if (off && forms.length) forms.forEach((f) => { f.ox += off; });
    }

    // Big Block: merge a square on the art into one block with high durability (5-6 -> 2x2, 7-8 -> 3x3, 9-10 -> 4x4).
    // The merged block takes the area's majority colour.
    if (L.big) {
        forms.forEach((f) => {
            L.big!.forEach((spec) => {
                for (let n = 0; n < spec.n; n++) {
                    const [lo, hi] = spec.hp;
                    const hp = lo + Math.floor(rnd() * (hi - lo + 1));
                    const sz = spec.size || bigSize(hp);
                    if (sz > f.w || sz > f.h) continue;
                    type Spot = { r: number; c: number; col: string };
                    let put: Spot | null = null, fallback: Spot | null = null;
                    for (let t = 0; t < 120 && !put; t++) {
                        const r = Math.floor(rnd() * (f.h - sz + 1)), c = Math.floor(rnd() * (f.w - sz + 1));
                        const tally: Record<string, number> = {}; let ok = true;
                        for (let a = 0; a < sz && ok; a++) for (let b = 0; b < sz && ok; b++) {
                            const v = f.cells[r + a][c + b];
                            if (!v || v.a || v.big) { ok = false; break; } // a hole, or already a big block
                            tally[v.c!] = (tally[v.c!] || 0) + 1;
                        }
                        if (!ok) continue;
                        let col = '', mx = 0;
                        for (const k in tally) if (tally[k] > mx) { mx = tally[k]; col = k; }
                        // never leave a colour with 1..9 blocks (a plane carries at least 10 rounds)
                        let safe = true;
                        for (const k in tally) {
                            const left = count[k] - tally[k] + (k === col ? hp : 0);
                            if (left > 0 && left < 10) { safe = false; break; }
                        }
                        if (!safe) continue;
                        const cand = { r, c, col };
                        if (mx >= sz * sz * 0.6) put = cand; // mostly one colour already: looks best
                        else if (!fallback) fallback = cand;
                    }
                    put = put || fallback;
                    if (!put) continue;
                    const { r, c, col } = put;
                    for (let a = 0; a < sz; a++) for (let b = 0; b < sz; b++) { // give back the old cells' counts
                        const v = f.cells[r + a][c + b]!;
                        remaining--; count[v.c!]--;
                        if (count[v.c!] <= 0) delete count[v.c!];
                    }
                    remaining += hp; count[col] = (count[col] || 0) + hp; // one block that needs hp hits
                    f.cells[r][c] = { c: col, hp, w: sz, h: sz, big: true };
                    for (let a = 0; a < sz; a++) for (let b = 0; b < sz; b++) if (a || b) f.cells[r + a][c + b] = { a: [r, c] };
                }
            });
        });
    }

    // ---- planes ----
    // 1) simulate the order blocks will be destroyed (lowest first, left to right, across all forms)
    const order: string[] = [];
    {
        const copy: Grid[] = forms.map((f) => f.cells.map((row) => row.map((v) => (v ? { ...v } : null))));
        for (;;) {
            let best: Target | null = null;
            for (let bc = 0; bc < BCOLS; bc++) {
                const e = exposedOn(forms, (fi) => copy[fi], bc);
                if (e && (!best || e.key > best.key)) best = e; // bc ascends -> ties keep the left one
            }
            if (!best) break;
            const cell0 = copy[best.fi][best.r][best.c]!;
            order.push(best.col);
            if ((cell0.hp || 1) > 1) cell0.hp!--; // big block: lose durability, not broken yet
            else if (cell0.big) {
                for (let a = 0; a < cell0.h!; a++) for (let b = 0; b < cell0.w!; b++) copy[best.fi][best.r + a][best.c + b] = null;
            } else copy[best.fi][best.r][best.c] = null;
        }
    }
    const posOf: Record<string, number[]> = {};
    order.forEach((k, j) => { (posOf[k] = posOf[k] || []).push(j); });

    // 2) split each colour into planes; total ammo === block count exactly
    const pool: QPlane[] = [];
    for (const k in count) {
        let j = 0;
        splitAmmo(count[k]).forEach((a) => {
            pool.push({ c: k, a, key: posOf[k][Math.min(j, count[k] - 1)] });
            j += a;
        });
    }
    pool.sort((x, y) => x.key - y.key);
    for (let j = 0; j < pool.length - 1; j++) if (rnd() < 0.3) { const t = pool[j]; pool[j] = pool[j + 1]; pool[j + 1] = t; }

    // 3) deal round-robin into the 3 hangars
    const queues: QPlane[][] = [[], [], []];
    pool.forEach((p, j) => queues[j % 3].push(p));
    // Hidden Plane: some planes below the head hide their colour and ammo until they reach the head.
    if (L.hidden) queues.forEach((q) => q.forEach((p, k) => { if (k > 0 && rnd() < L.hidden!) p.hidden = true; }));
    // Connected Plane: pairs in two different hangars at the same depth; similar ammo, different colours.
    if (L.connected) {
        let id = 1;
        for (let n = 0; n < L.connected; n++) {
            const c1 = (n * 2) % 3, c2 = (n * 2 + 1) % 3, k = n; // each pair one step deeper than the last
            if (c1 === c2) continue;
            const a = queues[c1][k];
            if (!a || a.link || queues[c2].length <= k) continue;
            let j = -1, bestD = 1e9;
            for (let t = k; t < queues[c2].length; t++) {
                const p = queues[c2][t];
                if (p.link || p.c === a.c) continue;
                const d2 = Math.abs(p.a - a.a);
                if (d2 < bestD) { bestD = d2; j = t; if (d2 === 0) break; }
            }
            if (j < 0) continue;
            if (j !== k) { const tmp = queues[c2][k]; queues[c2][k] = queues[c2][j]; queues[c2][j] = tmp; }
            const b = queues[c2][k];
            a.link = b.link = id++; a.hidden = b.hidden = false;
        }
    }
    return { forms, remaining, count, queues };
}
