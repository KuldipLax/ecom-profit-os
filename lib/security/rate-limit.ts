const buckets=new Map<string,{count:number;reset:number}>();
export function rateLimit(key:string,limit:number,windowMs=60000){const now=Date.now();const current=buckets.get(key);if(!current||current.reset<now){buckets.set(key,{count:1,reset:now+windowMs});return {allowed:true,remaining:limit-1};}current.count++;return {allowed:current.count<=limit,remaining:Math.max(0,limit-current.count)};}
