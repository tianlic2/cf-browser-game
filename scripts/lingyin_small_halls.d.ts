export type SmallHallFurniture = {
  kind:'bookcase'|'desk'|'cabinet'|'bench'|'altar'|'lectern';
  x:number;z:number;w:number;d:number;h:number;rot:number;
};
export type SmallHallSpec = {
  name:'west'|'east'|'rear';x:number;z:number;w:number;d:number;
  plinth:number;eave:number;rot:number;theme:'scripture'|'lotus'|'dharma';
  furniture:SmallHallFurniture[];
};
export const SMALL_HALLS:SmallHallSpec[];
export function smallHallFurnitureBounds(piece:SmallHallFurniture):{
  x:number;z:number;hx:number;hz:number;h:number;
};
