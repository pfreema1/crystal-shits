import TextLine from './TextLine';
import * as THREE from 'three';

export default class TextCanvas {
  constructor(webGlView) {
    this.webGlView = webGlView;

    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.needsUpdate = true;

    let fontSize = 280;

    this.ctx.font = fontSize + 'px Oswald';
    this.ctx.fillStyle = 'black';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    let textMetric = this.ctx.measureText('ALL YOU SEE IS');
    let textSnippetWidth = textMetric.width;
    let textSnippetHeight = textMetric.height;
    let textSnippetsPerLine = Math.ceil(this.width / textSnippetWidth + 2);
    let textLineCount = Math.ceil(this.height / fontSize) + 1;
    let textLineHeight = fontSize;
    let snippetPadding = 45;
    let scrollSpeed = 2;
    this.textLine = new TextLine(
      0,
      this.height * 0.5,
      textSnippetWidth,
      snippetPadding,
      scrollSpeed,
      -1,
      this.ctx,
      fontSize
    );
  }
}
