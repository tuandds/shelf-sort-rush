// Level data, palette and tuning numbers. Ported 1:1 from the original HTML prototype.

/**
 * Palette: one letter per block colour. These are the Marble Drop editor's 16 colours. The first ten letters are the
 * ones the original levels use (each mapped to the closest Marble Drop colour), so level data did not change.
 */
export const PAL: Record<string, string> = {
    r: '#f2447b', p: '#fccefd', y: '#fcfc10', k: '#5d5765', w: '#ffffff',
    g: '#44f245', c: '#29c3fc', o: '#f5ae0b', b: '#3657f9', v: '#db7afa',
    l: '#b7fd33', u: '#aa44f6', n: '#c25e47', m: '#bd194a', d: '#27993c', s: '#75fefd'
};

/** Colour names, as in the Marble Drop editor. */
export const COLOR_NAMES: Record<string, string> = {
    r: 'red', p: 'pink', y: 'yellow', k: 'black', w: 'white', g: 'green', c: 'blue2', o: 'orange', b: 'darkBlue', v: 'lightpurple',
    l: 'lime', u: 'purple', n: 'brown', m: 'crimson', d: 'darkgreen', s: 'lightblue'
};

/** Upper-case letters used briefly by the editor for the Marble Drop colours, mapped to the single palette. */
const LEGACY: Record<string, string> = {
    Y: 'y', P: 'p', R: 'r', L: 'l', B: 'b', U: 'u', X: 'k', E: 'c', N: 'n', C: 'm', D: 'd', G: 'g', S: 's', Q: 'v', O: 'o', W: 'w'
};

/** Rewrite legacy colour letters in a level (art and hand-placed planes) to the single palette. */
export function migrateLevel(L: Level): Level {
    const fix = (ch: string) => LEGACY[ch] ?? ch;
    L.waves.forEach((w) => { w.art = w.art.map((row) => [...row].map(fix).join('')); });
    L.queues?.forEach((q) => q.forEach((p) => { p.c = fix(p.c); }));
    return L;
}

export interface Feature {
    key: string;
    icon: string;
    title: string;
    demo: [string, string][];
    text: string;
}

export interface Wave {
    /** Board column of the art's left edge (centred when omitted). */
    ox?: number;
    /** Starting row offset; negative = still above the board, scrolls in later. */
    dy: number;
    art: string[];
}

export interface BigSpec {
    n: number;
    hp: [number, number];
    size?: number;
}

export interface Level {
    name: string;
    waves: Wave[];
    /** Chance (0..1) that a plane below the queue head starts hidden. */
    hidden?: number;
    /** Number of linked pairs placed in the queues. */
    connected?: number;
    big?: BigSpec[];
    /** Key into FEATURES: popup shown the first time this mechanic appears. */
    feature?: string;
    /**
     * Hand-placed hangar queues (3 lists, head first). When set, planes are not generated: `hidden` and
     * `connected` are ignored and each plane carries its own hidden/link flags. Ammo per colour should equal
     * that colour's hits, otherwise the level cannot be finished.
     */
    queues?: ManualPlane[][];
}

export interface ManualPlane {
    /** Colour letter. */
    c: string;
    /** Rounds. */
    a: number;
    hidden?: boolean;
    /** Linked-pair id: the two planes with the same id take off together. */
    link?: number;
}

export const F_HIDDEN: Feature = {
    key: 'hidden', icon: '❓', title: 'MÁY BAY ẨN',
    demo: [['?', 'ĐANG ẨN'], ['→', 'LÊN ĐẦU'], ['20', 'LỘ RA']],
    text: 'Một số máy bay nằm dưới hàng chờ bị ẩn màu và số đạn hiện dấu ?.\n\n' +
        'Chỉ khi lên đầu hàng nó mới lộ màu và số đạn thật. Hãy tính trước: đẩy một chiếc lên là bạn đang mở một lá bài.'
};
export const F_LINKED: Feature = {
    key: 'linked', icon: '🔗', title: 'MÁY BAY NỐI ĐÔI',
    demo: [['🔗', 'NỐI ĐÔI'], ['2', 'CHỖ TRỐNG'], ['✂️', 'LÊN LÀ TÁCH']],
    text: 'Hai máy bay ở hai hàng khác nhau bị nối với nhau bằng dây vàng: chúng chỉ cất cánh cùng nhau, khi cả hai đã ở đầu hàng và còn 2 chỗ trống.\n\n' +
        'Lên tới vùng chiến đấu thì dây đứt — hai chiếc hoạt động độc lập như bình thường.'
};

export const F_BIG: Feature = { key: 'big', icon: '🧱', title: 'KHỐI LỚN',
            demo: [['▣', 'ĐỘ BỀN CAO'], ['→', 'MỖI PHÁT −1'], ['💥', 'VỀ 0 THÌ VỠ']],
            text: 'Một số khối có kích thước lớn và mang số độ bền 5–10 ở giữa — càng bền thì khối càng to (2×2, 3×3, 4×4).\n\n' +
                'Mỗi phát đạn trúng chỉ trừ 1 độ bền; khi về 0 khối mới vỡ. Khối lớn chắn đường như khối thường, có thể khoá cả mấy cột một lúc.' };
export const F_BOSS: Feature = { key: 'boss', icon: '👑', title: 'TRÙM CUỐI',
            demo: [['20', 'LÕI TRÙM'], ['?', 'ẨN'], ['🔗', 'NỐI ĐÔI']],
            text: 'Màn cuối gom cả ba thử thách: lõi trùm là khối lớn 5×5 với 20 độ bền, quanh nó là các khối lớn nhỏ hơn.\n\n' +
                'Hàng chờ vừa có máy bay ẩn vừa có cặp nối đôi — hãy tính kỹ từng lượt cất cánh.' };

/** Feature intro popups by key. */
export const FEATURES: Record<string, Feature> = { hidden: F_HIDDEN, linked: F_LINKED, big: F_BIG, boss: F_BOSS };

export const LEVELS: Level[] = [
    { name: 'Trái tim', waves: (() => { // 2 colours
        const A = ['..rr...rr..', '.rppr.rrrr.', 'rpprrrrrrrr', 'rprrrrrrrrr', 'rrrrrrrrrrr',
            '.rrrrrrrrr.', '..rrrrrrr..', '...rrrrr...', '....rrr....', '.....r.....'];
        return [{ dy: 0, art: A }, { dy: -10, art: A }, { dy: -20, art: A }];
    })() },
    { name: 'Mặt cười', waves: (() => { // 3 colours
        const A = ['...ooooo...', '..oyyyyyo..', '.oyyyyyyyo.', 'oyykyyykyyo', 'oyykyyykyyo',
            'oyyyyyyyyyo', 'oykyyyyykyo', '.oykkkkkyo.', '..oyyyyyo..', '...ooooo...'];
        return [{ dy: 0, art: A }, { dy: -10, art: A }, { dy: -20, art: A }];
    })() },
    { name: 'Đàn nấm', waves: (() => { // 4 colours, 2 columns x 5 staggered tiers
        const A = ['..rr..', '.rwwr.', 'rrwwrr', 'rwkkwr', '.wkkw.', '.oooo.'];
        const out: Wave[] = [];
        for (let t = 0; t < 5; t++) {
            out.push({ ox: 0, dy: -t * 6, art: A });
            out.push({ ox: 7, dy: -t * 6 - 3, art: A });
        }
        return out;
    })() },
    { name: 'Đội hoa', hidden: 0.45, feature: 'hidden', waves: (() => { // 5 colours + hidden planes
        // Colours run in vertical stripes so every colour is exposed often and no plane idles for long.
        const F = ['wycvpw', '.ycvp.', 'wycvpw', 'wycvpw', '.ycvp.'];
        const G = ['wpvcyw', '.pvcy.', 'wpvcyw', 'wpvcyw', '.pvcy.'];
        const out: Wave[] = [];
        for (let t = 0; t < 5; t++) {
            out.push({ ox: 0, dy: -t * 5, art: t % 2 ? G : F });
            out.push({ ox: 7, dy: -t * 5 - 2, art: t % 2 ? F : G });
        }
        return out;
    })() },
    { name: 'Hạm sọc', hidden: 0.4, feature: 'hidden', waves: (() => { // 6 colours total, at most 4 at once
        // The colour set rotates per tier: an old colour disappears completely before a new one arrives.
        const SETS = [['r', 'o', 'y', 'g'], ['r', 'o', 'y', 'g'], ['y', 'g', 'c', 'v'], ['y', 'g', 'c', 'v'], ['c', 'v', 'y', 'g']];
        const wave = (t: number) => {
            const s = SETS[t], cs = [s[0], s[1], s[2], s[3], s[0], s[1]];
            const full = cs.join('');
            const notch = '.' + cs.slice(1, 5).join('') + '.';
            return [full, full, notch, full, full];
        };
        const out: Wave[] = [];
        for (let t = 0; t < 5; t++) {
            out.push({ ox: 0, dy: -t * 5, art: wave(t) });
            out.push({ ox: 7, dy: -t * 5 - 2, art: wave(t) });
        }
        return out;
    })() },
    // ---- hard levels: the board splits into several "lanes", each colour appears in two far-apart places ----
    { name: 'Tổ ong', connected: 4, feature: 'linked', waves: (() => { // 9 colours, 3 lanes
        const G = [['r', 'o', 'r', 'y', 'o', 'y'], ['g', 'c', 'g', 'b', 'c', 'b'], ['v', 'p', 'v', 'w', 'p', 'w']];
        const box = (col: string) => { const o: string[] = []; for (let r = 0; r < 4; r++) o.push(col.repeat(4)); return o; };
        const out: Wave[] = [], ox = [0, 5, 9];
        for (let g = 0; g < 3; g++) for (let t = 0; t < 6; t++) out.push({ ox: ox[g], dy: -t * 4 - g, art: box(G[g][t]) });
        return out;
    })() },
    { name: 'Mê cung', connected: 3, feature: 'linked', waves: (() => {
        // Each colour fills 2 consecutive tiers (a plane empties in one go); the middle lanes bring a colour back after a 2-tier gap.
        const G = [['r', 'r', 'o', 'o', 'r', 'r'], ['g', 'g', 'c', 'c', 'g', 'g'], ['v', 'v', 'p', 'p', 'v', 'v'], ['k', 'k', 'w', 'w', 'k', 'k']];
        const box = (col: string) => { const o: string[] = []; for (let r = 0; r < 4; r++) o.push(col.repeat(3)); return o; };
        const out: Wave[] = [], ox = [0, 4, 7, 10];
        for (let g = 0; g < 4; g++) for (let t = 0; t < 6; t++) out.push({ ox: ox[g], dy: -t * 4 - g, art: box(G[g][t]) });
        return out;
    })() },
    { name: 'Hỗn chiến', big: [{ n: 2, hp: [5, 10] }],
        feature: 'big',
        waves: (() => { // 9x9 multi-colour Space-Invaders ships
            // Ships are drawn by ROLE: A body, B eyes, C legs, D antennae, E feet.
            const M = [
                ['..D...D..', '...D.D...', '..AAAAA..', '.ABBABBA.', 'AAAAAAAAA', 'A.AAAAA.A', 'A.A...A.A', '..EE.EE..', '.C.....C.'],
                ['....A....', '...AAA...', '..AAAAA..', '.ABBABBA.', 'AAAAAAAAA', 'A.AAAAA.A', '..EE.EE..', '.C.C.C.C.', 'C.......C'],
                ['.D.....D.', '..D...D..', '.AAAAAAA.', 'ABBAAABBA', 'AAAAAAAAA', 'A.AAAAA.A', 'A.EE.EE.A', '..CC.CC..', '.C.....C.'],
                ['D...A...D', '.D.AAA.D.', '..AAAAA..', '.ABBABBA.', 'AAAAAAAAA', '.AAAAAAA.', 'A.EE.EE.A', 'C.......C', '.C.C.C.C.']
            ];
            // 5 fixed colours (= the number of slots): big blocks eat lots of one colour's ammo.
            const TIER = [['r', 'y', 'c', 'b', 'w'], ['g', 'y', 'c', 'b', 'w'], ['r', 'c', 'y', 'b', 'w'], ['c', 'b', 'y', 'r', 'w']];
            const paint = (m: string[], T: string[]) => {
                const P: Record<string, string> = { A: T[0], B: T[1], C: T[2], D: T[3], E: T[4] };
                return m.map((row) => [...row].map((ch) => (ch === '.' ? '.' : P[ch])).join(''));
            };
            const out: Wave[] = [];
            for (let t = 0; t < TIER.length; t++) for (let g = 0; g < 2; g++)
                out.push({ ox: g * 12, dy: -t * 9 - g * 2, art: paint(M[(t * 2 + g) % 4], TIER[t]) });
            return out;
        })() },
    { name: 'Pháo đài', big: [{ n: 3, hp: [5, 10] }], waves: (() => { // 9 colours, thick walls, many big blocks
        const C = [['r', 'o', 'y'], ['g', 'c', 'b'], ['v', 'p', 'w']];
        const wall = (cols: string[]) => {
            const out: string[] = [];
            for (let r = 0; r < 5; r++) {
                let row = '';
                for (let c = 0; c < 9; c++) {
                    const notch = (r === 0 && (c === 0 || c === 8)) || (r === 4 && c === 4);
                    row += notch ? '.' : cols[Math.floor(c / 3)];
                }
                out.push(row);
            }
            return out;
        };
        const out: Wave[] = [];
        for (let t = 0; t < 4; t++) for (let g = 0; g < 2; g++) out.push({ ox: g * 11, dy: -t * 5 - g, art: wall(C[(t + g) % 3]) });
        return out;
    })() },
    { name: 'Trùm cuối', hidden: 0.45, connected: 3,
        big: [{ n: 1, hp: [20, 20], size: 5 }, { n: 3, hp: [6, 10] }],
        feature: 'boss',
        waves: (() => {
            // Boss body 11x7 (red, yellow eyes); the lower half is striped r/y/c so 3 colours are always shootable.
            const BOSS = ['..rrrrrrr..', '.rrryyyrrr.', 'rryyyyyyyrr', 'rryyyyyyyrr', 'rycrycrycry', 'rycrycrycry', '.ycrycrycy.'];
            // 5x5 escorts using only 2 colours -> 5 colours for the whole level (= number of slots).
            const E1 = ['.ggg.', 'gvvvg', 'gvvvg', '.ggg.', 'g...g'];
            const E2 = ['.vvv.', 'vgggv', 'vgggv', '.vvv.', 'v...v'];
            const ESC = [E1, E2, E1, E2];
            const out: Wave[] = [];
            out.push({ dy: 0, art: BOSS }); // boss phase 1
            for (let t = 0; t < 2; t++) {
                out.push({ ox: 2, dy: -8 - t * 6, art: ESC[t * 2] });
                out.push({ ox: 14, dy: -8 - t * 6 - 2, art: ESC[t * 2 + 1] });
            }
            out.push({ dy: -22, art: BOSS }); // boss phase 2
            for (let t = 0; t < 2; t++) {
                out.push({ ox: 2, dy: -31 - t * 6, art: ESC[(t * 2 + 1) % 4] });
                out.push({ ox: 14, dy: -31 - t * 6 - 2, art: ESC[(t * 2 + 2) % 4] });
            }
            return out;
        })() }
];

/** Logical play-field size (9:16). The camera zooms this up to the canvas resolution. */
export const W = 450;
export const H = 800;
export const ZOOM = 2.4;

export const SLOTS = 5;          // planes allowed in the combat zone
export const FIRE_CD = 0.16;     // seconds between shots
export const BULLET_V = 900;     // px/s
export const STALL_MAX = 5;      // seconds full (or stuck) before losing
export const BCOLS = 21;         // board width in cells
export const BROWS = 10;         // visible block rows
export const GAP = 2;            // empty rows between the lowest block row and the board floor
export const HUD_H = 62;

export const SKINS = ['Tiêm kích', 'Mũi nhọn', 'Tàng hình', 'Cánh đôi', 'Đĩa bay'];
export const AMMOS = ['Tia lửa', 'Laser', 'Cầu plasma', 'Tên lửa', 'Sao băng'];

export const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif';

/** '#rrggbb' -> 0xrrggbb */
export const hex = (s: string) => parseInt(s.slice(1), 16);

/** localStorage key holding the level editor's level list. */
export const EDITOR_KEY = 'ps_editor_levels';

/** Built-in levels, or the level editor's list when the page is opened with ?custom=1. */
export function loadLevels(): Level[] {
    try {
        if (new URLSearchParams(location.search).get('custom') === '1') {
            const raw = localStorage.getItem(EDITOR_KEY);
            const list = raw ? (JSON.parse(raw) as Level[]) : null;
            if (Array.isArray(list) && list.length) return list.map(migrateLevel);
        }
    } catch { /* bad or blocked storage: fall back to the built-in levels */ }
    return LEVELS;
}
