export type Json=string|number|boolean|null|{[key:string]:Json|undefined}|Json[];
export type Database={public:{Tables:Record<string,{Row:Record<string,any>;Insert:Record<string,any>;Update:Record<string,any>}>;Views:Record<string,never>;Functions:Record<string,any>;Enums:Record<string,string>}};
