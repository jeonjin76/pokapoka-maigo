// 시작 전에 assets/game/ 의 그림을 불러온다.
// tools/prepare-assets.ps1 이 만든 manifest.json 에 적힌 파일만 불러오고,
// 없는 그림은 art.js 가 임시 도형으로 대신 그린다.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    this.load.json('manifest', 'assets/game/manifest.json');
    this.load.on('filecomplete-json-manifest', (key, type, manifest) => {
      for (const [file, info] of Object.entries(manifest || {})) {
        const name = file.replace(/\.png$/, '');
        this.load.spritesheet(`raw-${name}`, `assets/game/${file}`, {
          frameWidth: info.frameWidth,
          frameHeight: info.frameHeight,
        });
      }
    });
    // manifest 가 없어도 게임은 임시 그림으로 시작
    this.load.on('loaderror', () => {});
  }

  create() {
    this.scene.start('Title');
  }
}
