// Shared source dimensions, in game metres from the courtyard floor.
export const PAGODA = Object.freeze({ x:-31, z:33, segments:8, baseH:.7,
  baseTop:3.1, baseBottom:3.4, tiers:5, initialRadius:2.1 });
export function pagodaTiers() {
  let base=PAGODA.baseH, radius=PAGODA.initialRadius;
  return Array.from({length:PAGODA.tiers},(_,index)=>{
    const height=2.25-index*.1;
    const tier={index,base,radius,height};
    base+=height+.5; radius*=.87;
    return tier;
  });
}
