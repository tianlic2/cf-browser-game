export const MAIN_INTERIOR_COLUMNS:number[][];
export const MAIN_COLUMN_PARTS:{role:'bronze'|'lacquer'|'gilt';rt:number;rb:number;h:number;y:number;segments:number}[];
export const MAIN_CENSER:{x:number;z:number;scale:number};
export const MAIN_CENSER_PROFILE:number[][];
export const MAIN_HALL_FIXTURES:{name:string;role:'darkWood'|'bronze'|'gilt'|'lacquer';w:number;h:number;d:number;x:number;y:number;z:number;support:boolean}[];
export function hallPerimeterColumns(s:{w:number;d:number;eave:number;plinth:number;name?:string}):{x:number;z:number;height:number}[];
export function columnBrush(x:number,z:number,y0:number,h:number,rt:number,rb:number,sx?:number,sz?:number,rot?:number,segments?:number,name?:string):any;
