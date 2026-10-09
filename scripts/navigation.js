import { intersectsBrush, brushSupport } from './brush_collision.js';

// A shared flow field with separate nodes for stacked floors. A tunnel and the
// deck above it must never become the same node merely because X/Z coincide.
export class GroundNavigation {
  constructor(colliders,bounds) {
    this.colliders=colliders;
    this.groundBrushes=colliders.filter(c=>c.h<=.5);
    this.floorY=Math.min(0,...this.groundBrushes.map(c=>c.h));
    this.step=.55;this.hw=bounds.hw;this.hl=bounds.hl;
    this.xs=Array.from({length:Math.ceil(bounds.hw*2/this.step)+1},(_,i)=>i*this.step-this.hw);
    // The authored spawn stairs have a central divider. Their 1.05m lanes
    // need a centre sample; a uniform .55m grid can miss the entire clearance.
    const rails=colliders.filter(c=>c.h<=.05&&c.h>=0&&c.y0<-2&&c.hx<.2&&c.hz>1);
    for(const a of rails)for(const b of rails) {
      const left=a.x+a.hx,right=b.x-b.hx,gap=right-left;
      if(gap>.92&&gap<1.4&&Math.min(a.z+a.hz,b.z+b.hz)-Math.max(a.z-a.hz,b.z-b.hz)>1)
        this.xs.push((left+right)/2);
    }
    this.xs=[...new Set(this.xs)].sort((a,b)=>a-b);
    this.w=this.xs.length;this.h=Math.ceil(bounds.hl*2/this.step)+1;
    this.cells=Array.from({length:this.w*this.h},()=>[]);
    this.local=[];this.points=[];this.nodeCells=[];
    for(let z=0;z<this.h;z++)for(let x=0;x<this.w;x++) {
      const px=this.xs[x],pz=z*this.step-this.hl,cell=z*this.w+x;
      const nearby=colliders.filter(c=>Math.abs(px-c.x)<=c.hx+.6&&Math.abs(pz-c.z)<=c.hz+.6);
      this.local[cell]=nearby;
      const heights=nearby.map(c=>brushSupport(c,px,pz)).filter(y=>Number.isFinite(y)&&y>=this.floorY-.01&&y<=.5).sort((a,b)=>a-b);
      let last=-Infinity;
      for(const y of heights) {
        if(y-last<.02)continue;last=y;
        if(nearby.some(c=>intersectsBrush(c,px,pz,y,.46)))continue;
        const id=this.points.length;this.cells[cell].push(id);
        this.points.push({x:px,y,z:pz});this.nodeCells.push(cell);
      }
    }
    this.open=new Uint8Array(this.points.length).fill(1);
    this.distance=new Int32Array(this.points.length).fill(-1);
    this.queue=new Int32Array(this.points.length);this.goal=-1;
    this.edges=this.points.map(()=>[]);
    for(let i=0;i<this.points.length;i++) {
      const cell=this.nodeCells[i],x=cell%this.w,z=Math.floor(cell/this.w),p=this.points[i];
      for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++) {
        if(!dx&&!dz||x+dx<0||x+dx>=this.w||z+dz<0||z+dz>=this.h)continue;
        for(const j of this.cells[cell+dz*this.w+dx]) {
          if(Math.abs(this.points[j].y-p.y)>.5)continue;
          if(dx&&dz&&(!this.cells[cell+dx].some(k=>Math.abs(this.points[k].y-p.y)<=.5)||
             !this.cells[cell+dz*this.w].some(k=>Math.abs(this.points[k].y-p.y)<=.5)))continue;
          if(this.clear(p,this.points[j]))this.edges[i].push(j);
        }
      }
    }
  }
  cell(x,z) {
    let lo=0,hi=this.w-1;
    while(lo<hi){const mid=(lo+hi)>>1;if(this.xs[mid]<x)lo=mid+1;else hi=mid;}
    const ix=lo>0&&Math.abs(this.xs[lo-1]-x)<Math.abs(this.xs[lo]-x)?lo-1:lo;
    const iz=Math.round((z+this.hl)/this.step);
    return iz<0||iz>=this.h||x<-this.hw||x>this.hw ? -1 : iz*this.w+ix;
  }
  heightAt(x,z,feet=0) {
    let y=this.floorY;
    for(const c of this.local[this.cell(x,z)]||[]) {
      const top=brushSupport(c,x,z);
      if(top<=feet+.5)y=Math.max(y,top);
    }
    return y;
  }
  index(x,z,feet=0) {
    let best=-1,d=Infinity;
    for(const i of this.cells[this.cell(x,z)]||[]) {
      const dy=Math.abs(this.points[i].y-feet);if(dy<d){best=i;d=dy;}
    }
    return best;
  }
  point(i) { return this.points[i]; }
  nearest(x,z,feet=0) {
    const i=this.index(x,z,feet);if(i>=0&&Math.abs(this.points[i].y-feet)<.55)return i;
    let best=-1,dist=Infinity;
    for(let dz=-10;dz<=10;dz++)for(let dx=-10;dx<=10;dx++) {
      const j=this.index(x+dx*this.step,z+dz*this.step,feet);if(j<0)continue;
      const p=this.points[j],d=(p.x-x)**2+(p.z-z)**2+16*(p.y-feet)**2;
      if(d<dist){best=j;dist=d;}
    }
    return best;
  }
  neighbors(i,visit) { for(const j of this.edges[i])visit(j); }
  update(target) {
    const goal=this.nearest(target.x,target.z,target.y);if(goal===this.goal)return;
    this.goal=goal;this.distance.fill(-1);if(goal<0)return;
    let head=0,tail=1;this.queue[0]=goal;this.distance[goal]=0;
    while(head<tail) {
      const i=this.queue[head++];
      this.neighbors(i,j=>{if(this.distance[j]<0){this.distance[j]=this.distance[i]+1;this.queue[tail++]=j;}});
    }
  }
  clear(a,b) {
    const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.16));
    let y=a.y??0;
    for(let i=0;i<=steps;i++) {
      const f=i/steps,x=a.x+(b.x-a.x)*f,z=a.z+(b.z-a.z)*f;
      const next=this.heightAt(x,z,y),nearby=this.local[this.cell(x,z)];
      if(!nearby||!nearby.some(c=>Math.abs(brushSupport(c,x,z)-next)<.01)||
         Math.abs(next-y)>.5||nearby.some(c=>intersectsBrush(c,x,z,next,.46)))return false;
      y=next;
    }
    return Math.abs(y-(b.y??0))<.55;
  }
  steer(position,target) {
    if(Math.hypot(target.x-position.x,target.z-position.z)<8&&this.clear(position,target))return null;
    let i=this.nearest(position.x,position.z,position.y);
    if(i<0||this.distance[i]<0)return null;
    let waypoint=this.point(i);
    for(let n=0;n<8;n++) {
      let best=i;
      this.neighbors(i,j=>{if(this.distance[j]>=0&&this.distance[j]<this.distance[best])best=j;});
      if(best===i)break;
      const p=this.point(best);
      if(n>0&&!this.clear(position,p))break;
      waypoint=p;i=best;
    }
    const dx=waypoint.x-position.x,dz=waypoint.z-position.z,len=Math.hypot(dx,dz);
    return len>.04 ? {x:dx/len,z:dz/len} : null;
  }
}
