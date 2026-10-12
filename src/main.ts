import * as Phaser from 'phaser';
import { Game } from './scenes/Game';
import { H, W, ZOOM } from './game/data';

// Portrait 9:16 play field: game logic works in a 450x800 world, the camera zooms it to a
// 1080x1920 canvas so shapes and text stay sharp on phones. FIT letterboxes other aspect ratios.
const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    title: 'Pixel Squadron',
    version: __APP_VERSION__,
    backgroundColor: '#04060d',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        parent: 'game-container',
        width: W * ZOOM,
        height: H * ZOOM
    },
    input: { activePointers: 1 },
    disableContextMenu: true,
    scene: [Game]
};

const game = new Phaser.Game(config);

if (import.meta.env.DEV) (window as unknown as { game: Phaser.Game }).game = game;

export default game;
