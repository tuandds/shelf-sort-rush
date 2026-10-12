import * as Phaser from 'phaser';
import { AMMOS, FONT, H, PAL, SKINS, W, hex, type Feature } from '../game/data';
import { drawBullet, drawPlane, fillRR, gradRR, strokeRR } from '../game/art';

const TEXT = '#eaf0ff';
const DEPTH = 100;

type Align = 'center' | 'bottom';

/** A vertically stacked card ("sheet") on a dimmed backdrop that swallows taps. */
class Sheet {
    readonly root: Phaser.GameObjects.Container;
    readonly body: Phaser.GameObjects.Container;
    private bg: Phaser.GameObjects.Graphics;
    y: number;
    readonly inner: number;

    constructor(private scene: Phaser.Scene, readonly width: number, private padX: number, padTop: number, dim: number) {
        this.root = scene.add.container(0, 0).setDepth(DEPTH);
        const back = scene.add.rectangle(0, 0, W, H, 0x060914, dim).setOrigin(0).setInteractive();
        this.bg = scene.add.graphics();
        this.body = scene.add.container(0, 0);
        this.root.add([back, this.bg, this.body]);
        this.y = padTop;
        this.inner = width - padX * 2;
    }

    text(str: string, size: number, opts: { weight?: number; alpha?: number; color?: string; gap?: number; spacing?: number; letter?: number } = {}) {
        const t = this.scene.add.text(this.width / 2, this.y, str, {
            fontFamily: FONT, fontSize: `${size}px`, fontStyle: String(opts.weight ?? 400), color: opts.color ?? TEXT,
            align: 'center', wordWrap: { width: this.inner, useAdvancedWrap: true }, lineSpacing: opts.spacing ?? 0,
            resolution: 3
        }).setOrigin(0.5, 0).setAlpha(opts.alpha ?? 1);
        if (opts.letter) t.setLetterSpacing(opts.letter);
        this.body.add(t);
        this.y += t.height + (opts.gap ?? 0);
        return t;
    }

    button(label: string, primary: boolean, onClick: () => void, gap = 0) {
        const h = primary ? 52 : 44;
        makeButton(this.scene, this.body, this.padX, this.y, this.inner, h, label, primary, onClick);
        this.y += h + gap;
    }

    space(px: number) { this.y += px; }

    finish(align: Align, bottomPad: number, padOuter: number) {
        const h = this.y + bottomPad;
        const x = (W - this.width) / 2;
        const y = align === 'center' ? Math.round((H - h) / 2) : H - padOuter - h;
        gradRR(this.bg, x, y, this.width, h, 26, 0x1b2450, 1, 0x121937, 1);
        this.bg.lineStyle(1, 0xffffff, 0.14);
        strokeRR(this.bg, x + 0.5, y + 0.5, this.width - 1, h - 1, 26);
        this.body.setPosition(x, y);
        this.root.setAlpha(0);
        this.scene.tweens.add({ targets: this.root, alpha: 1, duration: 200 });
        this.body.y += 26;
        this.scene.tweens.add({ targets: this.body, y, duration: 300, ease: 'Cubic.Out' });
        return { x, y, h };
    }

    destroy() { this.root.destroy(); }
}

/** Rounded button with a primary (green) or ghost style. */
export function makeButton(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number, w: number, h: number,
    label: string, primary: boolean, onClick: () => void) {
    const c = scene.add.container(x + w / 2, y + h / 2);
    const g = scene.add.graphics();
    if (primary) {
        g.fillStyle(0x22b573, 0.35); fillRR(g, -w / 2, -h / 2 + 4, w, h, 17);
        gradRR(g, -w / 2, -h / 2, w, h, 17, 0x6ef0ad, 1, 0x22b573, 1);
        g.fillStyle(0xffffff, 0.5); g.fillRect(-w / 2 + 17, -h / 2 + 1, w - 34, 1);
    } else {
        g.fillStyle(0xffffff, 0.08); fillRR(g, -w / 2, -h / 2, w, h, 17);
        g.lineStyle(1, 0xffffff, 0.12); strokeRR(g, -w / 2 + 0.5, -h / 2 + 0.5, w - 1, h - 1, 17);
    }
    const t = scene.add.text(0, 0, label, {
        fontFamily: FONT, fontSize: primary ? '16.5px' : '14px', fontStyle: '800', color: primary ? '#04231a' : '#cfd8f5', resolution: 3
    }).setOrigin(0.5).setLetterSpacing(0.3);
    const hit = scene.add.zone(0, 0, w, h).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => c.setScale(0.97));
    hit.on('pointerout', () => c.setScale(1));
    hit.on('pointerup', () => { c.setScale(1); onClick(); });
    c.add([g, t, hit]);
    parent.add(c);
    return c;
}

export interface LevelInfo { name: string; colors: number }

/** All modal UI: start/win/lose sheet, feature intro, level select, customisation, toast. */
export class Popups {
    private sheet: Sheet | null = null;
    private toastC: Phaser.GameObjects.Container;
    private toastT: Phaser.GameObjects.Text;
    private toastBg: Phaser.GameObjects.Graphics;
    private toastTween?: Phaser.Tweens.TweenChain;

    constructor(private scene: Phaser.Scene) {
        this.toastBg = scene.add.graphics();
        this.toastT = scene.add.text(0, 0, '', {
            fontFamily: FONT, fontSize: '12.5px', fontStyle: '600', color: TEXT, align: 'center',
            wordWrap: { width: W * 0.82 - 30, useAdvancedWrap: true }, resolution: 3
        }).setOrigin(0.5);
        this.toastC = scene.add.container(W / 2, H * 0.7, [this.toastBg, this.toastT]).setDepth(DEPTH - 10).setAlpha(0);
    }

    get open() { return this.sheet !== null; }

    close() { this.sheet?.destroy(); this.sheet = null; }

    toast(msg: string) {
        this.toastT.setText(msg);
        const w = this.toastT.width + 30, h = this.toastT.height + 18;
        this.toastBg.clear();
        this.toastBg.fillStyle(0x0a0e1c, 0.9); fillRR(this.toastBg, -w / 2, -h / 2, w, h, 13);
        this.toastBg.lineStyle(1, 0xffffff, 0.16); strokeRR(this.toastBg, -w / 2, -h / 2, w, h, 13);
        this.toastTween?.stop();
        this.toastC.setAlpha(0).setScale(0.96).setY(H * 0.7 + 6);
        this.toastTween = this.scene.tweens.chain({ targets: this.toastC, tweens: [
            { alpha: 1, scale: 1, y: H * 0.7, duration: 200 },
            { alpha: 0, duration: 200, delay: 1500 }
        ] });
    }

    /** Start / win / lose sheet anchored to the bottom. */
    showOverlay(o: { icon: string; title: string; text: string; button: string; levels: number; lit: number; onButton: () => void }) {
        this.close();
        const s = new Sheet(this.scene, Math.min(420, W - 32), 22, 26, 0.9);
        const g = this.scene.add.graphics();
        g.fillStyle(0xffffff, 0.1); fillRR(g, s.width / 2 - 33, s.y, 66, 66, 22);
        g.lineStyle(1, 0xffffff, 0.16); strokeRR(g, s.width / 2 - 33 + 0.5, s.y + 0.5, 65, 65, 22);
        s.body.add(g);
        s.body.add(this.scene.add.text(s.width / 2, s.y + 33, o.icon, { fontFamily: FONT, fontSize: '31px', resolution: 3 }).setOrigin(0.5));
        s.space(66 + 14);
        s.text(o.title, 25, { weight: 800, gap: 9 });
        // progress dots (one per level)
        const dots = this.scene.add.graphics();
        const dx = 13, x0 = s.width / 2 - ((o.levels - 1) * dx) / 2;
        for (let i = 0; i < o.levels; i++) {
            const on = i <= o.lit;
            if (on) { dots.fillStyle(0x4ade80, 0.35); dots.fillCircle(x0 + i * dx, s.y + 3.5, 5.5); }
            dots.fillStyle(on ? 0x4ade80 : 0xffffff, on ? 1 : 0.2);
            dots.fillCircle(x0 + i * dx, s.y + 3.5, 3.5);
        }
        s.body.add(dots);
        s.space(7 + 18);
        s.text(o.text, 13.5, { alpha: 0.76, spacing: 8, gap: 22 });
        s.button(o.button, true, () => { this.close(); o.onButton(); });
        s.finish('bottom', 22, 22);
        this.sheet = s;
    }

    /** "New feature" intro, shown the first time a level with that mechanic loads. */
    showFeature(f: Feature, onClose: () => void) {
        this.close();
        const s = new Sheet(this.scene, Math.min(420, W - 40), 22, 26, 0.9);
        s.text(f.icon, 34, { gap: 8 });
        const tag = s.text('TÍNH NĂNG MỚI', 10, { weight: 800, color: '#6ef0ad', letter: 1.4, gap: 12 });
        const tg = this.scene.add.graphics();
        tg.lineStyle(1, 0x6ef0ad, 0.45);
        strokeRR(tg, tag.x - tag.width / 2 - 10, tag.y - 4, tag.width + 20, tag.height + 8, 99);
        s.body.add(tg);
        s.space(4);
        s.text(f.title, 21, { weight: 800, gap: 10 });
        // three demo tiles
        const tw = 54, th = 64, gap = 16, x0 = s.width / 2 - (tw * 3 + gap * 2) / 2;
        const dg = this.scene.add.graphics();
        s.space(4);
        f.demo.forEach(([big, small], i) => {
            const x = x0 + i * (tw + gap);
            dg.fillStyle(0xffffff, 0.06); fillRR(dg, x, s.y, tw, th, 14);
            dg.lineStyle(1, 0xffffff, 0.12); strokeRR(dg, x + 0.5, s.y + 0.5, tw - 1, th - 1, 14);
            s.body.add(this.scene.add.text(x + tw / 2, s.y + 25, big, { fontFamily: FONT, fontSize: '22px', fontStyle: '800', color: TEXT, resolution: 3 }).setOrigin(0.5));
            s.body.add(this.scene.add.text(x + tw / 2, s.y + 48, small, { fontFamily: FONT, fontSize: '7.5px', fontStyle: '700', color: TEXT, resolution: 3 }).setOrigin(0.5).setAlpha(0.6));
        });
        s.body.addAt(dg, 0);
        s.space(th + 16);
        s.text(f.text, 13.5, { alpha: 0.76, spacing: 8, gap: 22 });
        s.button('ĐÃ HIỂU', true, () => { this.close(); onClose(); });
        s.finish('center', 22, 0);
        this.sheet = s;
    }

    showLevels(levels: LevelInfo[], current: number, onPick: (i: number) => void, onClose: () => void) {
        this.close();
        const s = new Sheet(this.scene, Math.min(420, W - 36), 22, 26, 0.86);
        s.text('CHỌN MÀN', 20, { weight: 800, gap: 16 });
        const gap = 9, bw = (s.inner - gap) / 2, bh = 50;
        levels.forEach((L, i) => {
            const x = 22 + (i % 2) * (bw + gap), y = s.y + Math.floor(i / 2) * (bh + gap);
            const c = this.scene.add.container(x + bw / 2, y + bh / 2);
            const g = this.scene.add.graphics();
            g.fillStyle(0xffffff, 0.07); fillRR(g, -bw / 2, -bh / 2, bw, bh, 14);
            const cur = i === current;
            g.lineStyle(cur ? 1.5 : 1, cur ? 0x6ef0ad : 0xffffff, cur ? 1 : 0.13);
            strokeRR(g, -bw / 2 + 0.5, -bh / 2 + 0.5, bw - 1, bh - 1, 14);
            const t1 = this.scene.add.text(0, -8, `Màn ${i + 1}`, { fontFamily: FONT, fontSize: '13px', fontStyle: '800', color: TEXT, resolution: 3 }).setOrigin(0.5);
            const t2 = this.scene.add.text(0, 10, `${L.name} · ${L.colors} màu`, { fontFamily: FONT, fontSize: '10px', fontStyle: '600', color: TEXT, resolution: 3 }).setOrigin(0.5).setAlpha(0.6);
            const hit = this.scene.add.zone(0, 0, bw, bh).setInteractive({ useHandCursor: true });
            hit.on('pointerdown', () => c.setScale(0.96));
            hit.on('pointerout', () => c.setScale(1));
            hit.on('pointerup', () => { this.close(); onPick(i); });
            c.add([g, t1, t2, hit]);
            s.body.add(c);
        });
        s.space(Math.ceil(levels.length / 2) * (bh + gap) - gap + 14);
        s.button('Đóng', false, () => { this.close(); onClose(); });
        s.finish('center', 22, 0);
        this.sheet = s;
    }

    showCustom(skin: number, ammo: number, onChange: (skin: number, ammo: number) => void, onClose: () => void) {
        this.close();
        const s = new Sheet(this.scene, Math.min(420, W - 32), 22, 26, 0.88);
        s.text('TÙY BIẾN', 20, { weight: 800, gap: 2 });
        const row = (title: string, names: string[], cur: number, draw: (g: Phaser.GameObjects.Graphics, cx: number, cy: number, i: number) => void,
            pick: (i: number) => void) => {
            s.space(14);
            const h2 = this.scene.add.text(22, s.y, title, { fontFamily: FONT, fontSize: '11px', fontStyle: '800', color: TEXT, resolution: 3 })
                .setAlpha(0.6).setLetterSpacing(1.5);
            s.body.add(h2);
            s.space(h2.height + 8);
            const gap = 7, pw = (s.inner - gap * 4) / 5, ph = 68;
            names.forEach((n, i) => {
                const x = 22 + i * (pw + gap);
                const c = this.scene.add.container(x + pw / 2, s.y + ph / 2);
                const g = this.scene.add.graphics();
                const on = i === cur;
                g.fillStyle(on ? 0x6ef0ad : 0xffffff, on ? 0.16 : 0.05); fillRR(g, -pw / 2, -ph / 2, pw, ph, 12);
                g.lineStyle(1, on ? 0x6ef0ad : 0xffffff, on ? 1 : 0.12); strokeRR(g, -pw / 2 + 0.5, -ph / 2 + 0.5, pw - 1, ph - 1, 12);
                draw(g, 0, -ph / 2 + 6 + 21, i);
                const t = this.scene.add.text(0, ph / 2 - 11, n, {
                    fontFamily: FONT, fontSize: '8px', fontStyle: '700', color: on ? '#bdf5d8' : TEXT, align: 'center',
                    wordWrap: { width: pw - 4 }, resolution: 3
                }).setOrigin(0.5).setAlpha(on ? 1 : 0.65);
                const hit = this.scene.add.zone(0, 0, pw, ph).setInteractive({ useHandCursor: true });
                hit.on('pointerup', () => pick(i));
                c.add([g, t, hit]);
                s.body.add(c);
            });
            s.space(ph);
        };
        row('SKIN MÁY BAY', SKINS, skin, (g, cx, cy, i) => drawPlane(g, cx, cy - 1, 26, hex(PAL.r), 1, 0, i, false, false),
            (i) => { onChange(i, ammo); this.showCustom(i, ammo, onChange, onClose); });
        row('LOẠI ĐẠN', AMMOS, ammo, (g, cx, cy, i) => drawBullet(g, cx, cy + 8, hex(PAL.y), i),
            (i) => { onChange(skin, i); this.showCustom(skin, i, onChange, onClose); });
        s.space(16);
        s.button('Xong', false, () => { this.close(); onClose(); });
        s.finish('center', 22, 0);
        // re-opening after a pick should not replay the entrance animation
        this.scene.tweens.killTweensOf([s.root, s.body]);
        s.root.setAlpha(1);
        s.body.y -= 26;
        this.sheet = s;
    }
}
