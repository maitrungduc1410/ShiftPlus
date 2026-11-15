import Phaser from 'phaser';
import { COLORS, H, W } from './config';
import { TitleScene } from './scenes/TitleScene';
import { LevelsScene } from './scenes/LevelsScene';
import { GameScene } from './scenes/GameScene';
import { EndScene } from './scenes/EndScene';
import { simulateKey } from './input';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: W,
  height: H,
  backgroundColor: COLORS.paper,
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [TitleScene, LevelsScene, GameScene, EndScene],
});

// Debug hook for playtesting from the console: __shift.game.scene.start('game', { index: 3 })
(window as unknown as { __shift: unknown }).__shift = { game, key: simulateKey };
