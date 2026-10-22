export const WEST_RIDGE_TRAIL: readonly (readonly [number,number,number])[];
export const RIDGE_TRAILS: readonly (readonly (readonly [number,number,number])[])[];
export const RIDGE_HALF_WIDTH: number;
export const RIDGE_RAIL_OFFSET: number;
export const RIDGE_GRADED_WIDTH: number;
export const RIDGE_SHOULDER: number;
export const RIDGE_SURFACE_LIFT: number;
export const RIDGE_LOOKOUTS: readonly Readonly<{
  x:number;z:number;hx:number;hz:number;y:number;
  entrySide:'north'|'south'|'east'|'west';entryX:number;entryZ:number;
}>[];
export const FRONT_GATE_FORECOURT: Readonly<{
  x0:number;x1:number;z0:number;z1:number;y:number;
}>;
export type RidgeFrame = {x:number;z:number;y:number;nx:number;nz:number;along:number};
export type RidgeGuardPoint = {x:number;z:number;y:number;along:number};
export type RidgeGuardSection = {routeIndex:number;side:number;points:RidgeGuardPoint[]};
export function ridgeRouteFrames(route:typeof WEST_RIDGE_TRAIL,spacing?:number): RidgeFrame[];
export function ridgeGuardSections(routeIndex:number,spacing?:number): RidgeGuardSection[];
export function ridgeTrailAt(x:number,z:number): {
  distance:number;y:number;x:number;z:number;trail:number;segment:number;t:number;along:number;
};
export function ridgeLookoutContains(x:number,z:number): typeof RIDGE_LOOKOUTS[number]|null;
export function ridgeTrailSurfaceAt(x:number,z:number): number|null;
export function ridgeTrailDistance(x:number,z:number): number;
