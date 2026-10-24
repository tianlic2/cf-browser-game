// Local +Z faces the courtyard. Shared by visible furniture and combat brushes;
// changing a cabinet must never leave an invisible obstacle at its old position.
export const SMALL_HALLS = [
  {name:'west',x:-25.5,z:7,w:9,d:16,plinth:.7,eave:5,rot:Math.PI/2,
    theme:'scripture',furniture:[
      ...[-1,1].flatMap(side=>[-3.7,3.7].map(z=>
        ({kind:'bookcase',x:side*2.57,z,w:2.15,d:.62,h:1.95,rot:-side*Math.PI/2}))),
      ...[-1,1].map(side=>({kind:'desk',x:side*2.57,z:0,w:1.8,d:.62,h:.78,rot:-side*Math.PI/2})),
    ]},
  {name:'east',x:19,z:7,w:9,d:16,plinth:.7,eave:5,rot:-Math.PI/2,
    theme:'lotus',furniture:[
      {kind:'altar',x:0,z:-5.3,w:3.565,d:1.3,h:1.08,rot:0},
      ...[-1,1].map(side=>({kind:'cabinet',x:side*2.57,z:-1.5,w:1.9,d:.62,h:1.1,rot:-side*Math.PI/2})),
      ...[-1,1].map(side=>({kind:'bench',x:side*2.57,z:2.8,w:1.9,d:.62,h:.88,rot:-side*Math.PI/2})),
    ]},
];

/** Axis-aligned local bounds of each turned piece, in metres above the floor. */
export function smallHallFurnitureBounds(piece) {
  const c=Math.abs(Math.cos(piece.rot)),s=Math.abs(Math.sin(piece.rot));
  return {x:piece.x,z:piece.z,hx:(piece.w*c+piece.d*s)/2,
    hz:(piece.w*s+piece.d*c)/2,h:piece.h+
      (piece.kind==='altar'?.11:piece.kind==='bookcase'?.04:piece.kind==='desk'?.05:piece.kind==='lectern'?.055:0)};
}
