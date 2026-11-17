// Coordinates run across each room and aft from its inboard bulkhead.
// The light bake imports this layout so the pools stay attached to the fittings.
export const compartments = [
  { facing:1, wall:36.60, height:3.45, doors:[[-4.91,1.32],[6.88,1.68]] },
  { facing:-1, wall:-37.91, height:3.25, doors:[[-5.13,1.32],[6.66,1.68]] },
];
export const luminaires = [[-9.15,1.84],[-3.55,5.57],[2.90,1.84],[10.95,5.57]];

export const lightGrid={width:125, depth:37, layers:15, cell:.25, left:-15.5, front:-.25};
