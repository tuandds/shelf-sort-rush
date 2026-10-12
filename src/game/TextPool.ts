import * as Phaser from 'phaser';
import { FONT } from './data';

export interface TextOpts {
    size: number;
    weight?: number;
    color?: string;
    alpha?: number;
    originX?: number;
    originY?: number;
}

/**
 * Immediate-mode text: call begin() each frame, put() for every label, end() to hide unused ones.
 * Text objects are reused, and only re-rendered when their content or style changes.
 */
export class TextPool {
    private items: Phaser.GameObjects.Text[] = [];
    private used = 0;

    constructor(private scene: Phaser.Scene, private parent: Phaser.GameObjects.Container, private resolution: number) {}

    begin() { this.used = 0; }

    put(x: number, y: number, str: string, o: TextOpts) {
        let t = this.items[this.used];
        if (!t) {
            t = this.scene.add.text(0, 0, '', { fontFamily: FONT, resolution: this.resolution });
            this.parent.add(t);
            this.items.push(t);
        }
        this.used++;
        const font = `${o.weight ?? 700} ${o.size}px`;
        const color = o.color ?? '#ffffff';
        if (t.getData('font') !== font) {
            t.setFontSize(o.size).setFontStyle(String(o.weight ?? 700));
            t.setData('font', font);
        }
        if (t.style.color !== color) t.setColor(color);
        if (t.text !== str) t.setText(str);
        t.setOrigin(o.originX ?? 0.5, o.originY ?? 0.5).setPosition(x, y).setAlpha(o.alpha ?? 1).setVisible(true);
        return t;
    }

    end() {
        for (let i = this.used; i < this.items.length; i++) this.items[i].setVisible(false);
    }
}
