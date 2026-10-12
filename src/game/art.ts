import * as Phaser from 'phaser';

type G = Phaser.GameObjects.Graphics;

/** Rounded rect that tolerates a radius larger than half the box. */
export function fillRR(g: G, x: number, y: number, w: number, h: number, r: number) {
    if (w <= 0 || h <= 0) return;
    g.fillRoundedRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)));
}
export function strokeRR(g: G, x: number, y: number, w: number, h: number, r: number) {
    if (w <= 0 || h <= 0) return;
    g.strokeRoundedRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)));
}

/**
 * Rounded rect with a vertical gradient. Drawn as top cap + gradient middle + bottom cap so nothing
 * overlaps, which keeps translucent fills even.
 */
export function gradRR(g: G, x: number, y: number, w: number, h: number, r: number,
    top: number, aTop: number, bottom: number, aBottom: number) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    if (r > 0) {
        g.fillStyle(top, aTop);
        g.fillRoundedRect(x, y, w, r, { tl: r, tr: r, bl: 0, br: 0 });
        g.fillStyle(bottom, aBottom);
        g.fillRoundedRect(x, y + h - r, w, r, { tl: 0, tr: 0, bl: r, br: r });
    }
    const k = r / h, mixA = (t: number) => aTop + (aBottom - aTop) * t;
    const mixC = (t: number) => Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(top), Phaser.Display.Color.ValueToColor(bottom), 100, t * 100);
    const c0 = mixC(k), c1 = mixC(1 - k);
    const v0 = Phaser.Display.Color.GetColor(c0.r, c0.g, c0.b), v1 = Phaser.Display.Color.GetColor(c1.r, c1.g, c1.b);
    g.fillGradientStyle(v0, v0, v1, v1, mixA(k), mixA(k), mixA(1 - k), mixA(1 - k));
    g.fillRect(x, y + r, w, h - 2 * r);
}

/** Glassy panel: translucent vertical gradient and a hairline border. */
export function panel(g: G, x: number, y: number, w: number, h: number, r: number,
    fill: number, a1: number, a2: number, border = 0xffffff, borderA = 0.1) {
    gradRR(g, x, y, w, h, r, fill, a1, fill, a2);
    g.lineStyle(1, border, borderA);
    strokeRR(g, x + 0.5, y + 0.5, w - 1, h - 1, r);
}

/** Dashed straight line. */
export function dashLine(g: G, x1: number, y1: number, x2: number, y2: number, on: number, off: number) {
    const len = Math.hypot(x2 - x1, y2 - y1), dx = (x2 - x1) / len, dy = (y2 - y1) / len;
    for (let d = 0; d < len; d += on + off) {
        const e = Math.min(len, d + on);
        g.lineBetween(x1 + dx * d, y1 + dy * d, x1 + dx * e, y1 + dy * e);
    }
}

/** Dashed circle outline. */
export function dashCircle(g: G, x: number, y: number, r: number, on: number, off: number) {
    const step = (on + off) / r, arc = on / r;
    for (let a = 0; a < Math.PI * 2; a += step) {
        g.beginPath();
        g.arc(x, y, r, a, Math.min(a + arc, Math.PI * 2));
        g.strokePath();
    }
}

/** Plane outline for a skin, centred on (0,0) with size s. */
function planePoints(s: number, sk: number): number[][] {
    if (sk === 1) return [[0, -0.72], [0.16, 0.1], [0.52, 0.45], [0.1, 0.42], [0, 0.6], [-0.1, 0.42], [-0.52, 0.45], [-0.16, 0.1]] // Mũi nhọn
        .map(([x, y]) => [x * s, y * s]);
    if (sk === 2) return [[0, -0.6], [0.12, -0.1], [0.66, 0.3], [0.3, 0.34], [0.2, 0.52], [-0.2, 0.52], [-0.3, 0.34], [-0.66, 0.3], [-0.12, -0.1]] // Tàng hình
        .map(([x, y]) => [x * s, y * s]);
    if (sk === 3) return [[0, -0.62], [0.18, -0.08], [0.56, 0.06], [0.56, 0.5], [0.34, 0.5], [0.34, 0.2], [0.12, 0.3], [0, 0.48], // Cánh đôi
        [-0.12, 0.3], [-0.34, 0.2], [-0.34, 0.5], [-0.56, 0.5], [-0.56, 0.06], [-0.18, -0.08]].map(([x, y]) => [x * s, y * s]);
    return [[0, -0.64], [0.2, -0.04], [0.58, 0.2], [0.58, 0.37], [0.17, 0.25], [0.15, 0.5], [0, 0.4], // Tiêm kích (default)
        [-0.15, 0.5], [-0.17, 0.25], [-0.58, 0.37], [-0.58, 0.2], [-0.2, -0.04]].map(([x, y]) => [x * s, y * s]);
}

function fillShape(g: G, x: number, y: number, s: number, sk: number, grow = 1) {
    if (sk === 4) { // Đĩa bay
        g.fillEllipse(x, y + s * 0.05, s * 1.24 * grow, s * 0.52 * grow);
        g.fillTriangle(x, y - s * 0.52 * grow, x + s * 0.3 * grow, y - s * 0.02, x - s * 0.3 * grow, y - s * 0.02);
        return;
    }
    const pts = planePoints(s * grow, sk).map(([px, py]) => new Phaser.Math.Vector2(x + px, y + py));
    g.fillPoints(pts, true);
}

/**
 * Draw a plane. Text for the ammo count is returned as a request so the caller can place a Text object
 * (Graphics cannot draw text); null when no badge is shown.
 */
export function drawPlane(g: G, x: number, y: number, s: number, color: number, alpha: number, kick: number, sk: number,
    badge: boolean, badgeWide: boolean) {
    y += kick ? kick * s * 0.09 : 0;
    // jet flame
    g.fillStyle(0x78c8ff, 0.32 * alpha);
    g.fillTriangle(x - s * 0.13, y + s * 0.4, x + s * 0.13, y + s * 0.4, x, y + s * (1.0 + (kick || 0) * 0.35));
    // glow, body, sheen
    g.fillStyle(color, 0.22 * alpha);
    fillShape(g, x, y, s, sk, 1.22);
    g.fillStyle(color, alpha);
    fillShape(g, x, y, s, sk);
    g.fillStyle(0xffffff, 0.18 * alpha);
    g.fillRect(x - s * 0.06, y - s * 0.5, s * 0.12, s * 0.9);
    // cockpit
    g.fillStyle(0xffffff, 0.92 * alpha);
    if (sk === 4) g.fillEllipse(x, y + s * 0.02, s * 0.32, s * 0.24);
    else g.fillEllipse(x, y - s * 0.2, s * 0.19, s * 0.3);
    if (badge) {
        const bw = s * (badgeWide ? 0.74 : 0.58);
        g.fillStyle(0x060a16, 0.82 * alpha);
        fillRR(g, x - bw / 2, y + s * 0.5, bw, s * 0.32, s * 0.16);
        g.lineStyle(1, 0xffffff, 0.18 * alpha);
        strokeRR(g, x - bw / 2, y + s * 0.5, bw, s * 0.32, s * 0.16);
    }
    return { x, y: y + s * 0.66, size: Math.round(s * 0.27) };
}

/** Draw one bullet in the selected ammo style. */
export function drawBullet(g: G, x: number, y: number, color: number, type: number) {
    if (type === 1) { // Laser
        g.fillGradientStyle(0xffffff, 0xffffff, color, color, 0, 0, 1, 1);
        g.fillRect(x - 1.3, y - 40, 2.6, 44);
        g.fillStyle(color, 0.35);
        g.fillRect(x - 3, y - 12, 6, 18);
        g.fillStyle(0xffffff, 1);
        g.fillRect(x - 1, y - 10, 2, 14);
    } else if (type === 2) { // Cầu plasma
        g.fillStyle(color, 0.25); g.fillCircle(x, y, 9);
        g.fillStyle(color, 0.7); g.fillCircle(x, y, 6);
        g.fillStyle(0xffffff, 1); g.fillCircle(x, y, 3);
    } else if (type === 3) { // Tên lửa
        g.fillStyle(0xffa040, 0.6);
        g.fillTriangle(x - 2.4, y + 2, x + 2.4, y + 2, x, y + 18);
        g.fillStyle(color, 0.35); fillRR(g, x - 5, y - 11, 10, 16, 4);
        g.fillStyle(color, 1);
        g.fillPoints([new Phaser.Math.Vector2(x, y - 9), new Phaser.Math.Vector2(x + 3, y - 2), new Phaser.Math.Vector2(x + 3, y + 3),
            new Phaser.Math.Vector2(x - 3, y + 3), new Phaser.Math.Vector2(x - 3, y - 2)], true);
    } else if (type === 4) { // Sao băng
        g.fillStyle(color, 0.3);
        g.fillPoints([new Phaser.Math.Vector2(x, y - 13), new Phaser.Math.Vector2(x + 5, y), new Phaser.Math.Vector2(x, y + 13), new Phaser.Math.Vector2(x - 5, y)], true);
        g.fillStyle(color, 1);
        g.fillPoints([new Phaser.Math.Vector2(x, y - 9), new Phaser.Math.Vector2(x + 3.2, y), new Phaser.Math.Vector2(x, y + 9), new Phaser.Math.Vector2(x - 3.2, y)], true);
        g.fillStyle(0xffffff, 0.9);
        g.fillPoints([new Phaser.Math.Vector2(x, y - 4), new Phaser.Math.Vector2(x + 1.6, y), new Phaser.Math.Vector2(x, y + 4), new Phaser.Math.Vector2(x - 1.6, y)], true);
    } else { // Tia lửa (default)
        g.fillGradientStyle(0xffffff, 0xffffff, color, color, 0, 0, 1, 1);
        g.fillRect(x - 1.6, y - 22, 3.2, 26);
        g.fillStyle(color, 0.35); fillRR(g, x - 4.5, y - 10, 9, 17, 4.5);
        g.fillStyle(0xffffff, 1); fillRR(g, x - 2.4, y - 7, 4.8, 11, 2.4);
    }
}
