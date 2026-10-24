// Resolution is a visual budget only: CSS/HUD, FOV, input, simulation and rays
// never use it. Retain native resolution where possible; cap Retina fill cost.
export class RenderBudget {
  constructor({maxPixels=3000000,maxDpr=1.75}={}) {
    this.maxPixels=maxPixels;this.maxDpr=maxDpr;this.scale=1;this.base=1;
    this.ratio=1;this.samples=[];this.activeSince=null;this.lastChange=0;this.fastSince=null;
  }
  setViewport(width,height,dpr=1) {
    this.base=Math.min(Math.max(.5,dpr||1),this.maxDpr,Math.sqrt(this.maxPixels/Math.max(1,width*height)));
    this.ratio=this.target();this.samples.length=0;return this.ratio;
  }
  target(){return Math.min(this.base,Math.max(Math.min(1,this.base),this.base*this.scale));}
  sample(ms,now,active) {
    if(!active){this.samples.length=0;this.activeSince=null;this.fastSince=null;return null;}
    if(this.activeSince===null)this.activeSince=now;
    // Hidden tabs, debugger stalls and one-off loading/GC pauses are not a GPU
    // quality signal. Require a sustained window and a long resize cooldown.
    if(ms>=250){this.samples.length=0;this.activeSince=now;this.fastSince=null;return null;}
    if(now-this.activeSince<3000||ms<=0)return null;
    this.samples.push(ms);if(this.samples.length>90)this.samples.shift();
    if(this.samples.length<90||now-this.lastChange<4000)return null;
    const sorted=[...this.samples].sort((a,b)=>a-b),median=sorted[45];
    let next=this.scale;
    if(median>22){next=Math.max(.64,this.scale-.08);this.fastSince=null;}
    else if(median<17.8){
      this.fastSince??=now;
      if(now-this.fastSince>8000)next=Math.min(1,this.scale+.04);
    }else this.fastSince=null;
    if(next===this.scale)return null;
    const previous=this.scale;this.scale=next;const ratio=this.target();
    if(Math.abs(ratio-this.ratio)<.035){this.scale=previous;return null;}
    this.ratio=ratio;this.lastChange=now;this.samples.length=0;this.fastSince=null;return ratio;
  }
  stats(){return {pixelRatio:+this.ratio.toFixed(3),nativeBudget:+this.base.toFixed(3),scale:+this.scale.toFixed(2),maxPixels:this.maxPixels};}
}
