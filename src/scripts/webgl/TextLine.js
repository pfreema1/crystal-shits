import * as THREE from 'three';

export default class TextLine {
  constructor(
    startX,
    startY,
    snippetWidth,
    snippetPadding,
    scrollSpeed,
    scrollDir,
    ctx,
    fontSize
  ) {
    this.ctx = ctx;
    this.scrollSpeed = scrollSpeed;
    this.scrollDir = scrollDir;
    this.snippetWidth = snippetWidth;
    this.snippetPadding = snippetPadding;

    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.fontSize = fontSize;
    this.rotationTime = 2;
    this.textMetric = {
      over: this.ctx.measureText('SOME'),
      and: this.ctx.measureText('THING')
    };


    this.initSnippetLines();

    this.snippets = [
      {
        x: startX,
        y: startY
      },
      {
        x: startX + (snippetWidth + snippetPadding) * 1,
        y: startY
      },
      {
        x: startX + (snippetWidth + snippetPadding) * 2,
        y: startY
      }
    ];

  }

  initSnippetLines() {
    this.snippetLines = [];

    let numRows = Math.ceil(this.height / this.fontSize) + 2;
    numRows = numRows % 2 === 0 ? numRows : numRows + 1; // make number even
    numRows += 2;

    this.snippetPadding = 10;

    for (let i = 0; i < numRows; i++) {
      let line = {
        text: i % 2 === 0 ? 'SOME' : 'THING',
        x: (this.width / 2),// - (this.textMetric[i % 2 === 0 ? 'over' : 'and'].width * 0.5),
        y: (i * this.fontSize) + this.snippetPadding
      }

      this.snippetLines.push(line);
    }

    console.log("TextLine -> initSnippetLines -> this.snippetLines", this.snippetLines)

    // debugger;
  }

  returnFirstSnippet() {
    let firstSnippet = null;

    firstSnippet = this.snippetLines.reduce((accum, currVal) => {
      return accum.y < currVal.y ? accum : currVal;
    });

    return firstSnippet;
  }

  returnLastSnippet() {
    let lastSnippet = null;

    // case: we going left
    lastSnippet = this.snippetLines.reduce((accum, currVal) => {
      return accum.y > currVal.y ? accum : currVal;
    });

    return lastSnippet;
  }

  checkLastSnippet() {
    const firstSnippet = this.returnFirstSnippet();
    const lastSnippet = this.returnLastSnippet();
    const snippetHeight = this.fontSize + this.snippetPadding;

    // if lastSnippet is offscreen
    if (this.scrollDir < 0) {
      // case: going left
      if (firstSnippet.y < -300) {
        //case:  the farthest left snippet is off screen, move it to the end
        firstSnippet.y = lastSnippet.y + snippetHeight;
      }
    } else {

      // case: going right
      if (lastSnippet.y - snippetHeight > this.height) {
        // case:  the farthest right snippet is off screen, move it to the beginning
        lastSnippet.y = firstSnippet.y - snippetHeight;
      }
    }
  }

  update(time) {
    for (let i = 0; i < this.snippetLines.length; i++) {
      this.snippetLines[i].y += this.scrollSpeed * this.scrollDir;
    }

    this.checkLastSnippet();
  }

  draw(time) {
    // this.ctx.translate(this.width * 0.5, this.height * 0.5);
    // this.ctx.rotate(Math.sin(time * 5.0) * 0.001);
    // this.ctx.translate(0, 0);

    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ctx.fillStyle = 'white';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // this.ctx.rotate(Math.PI / 180);
    // this.ctx.save();
    // this.ctx.restore();

    for (let i = 0; i < this.snippetLines.length; i++) {
      let snippetLine = this.snippetLines[i];
      this.ctx.font = this.fontSize + 'px Oswald';
      this.ctx.fillStyle = 'black';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(
        snippetLine.text,
        snippetLine.x,
        snippetLine.y
      );
    }
  }
}
