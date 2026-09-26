export function formatCurrency(value:number,currency="INR"){return new Intl.NumberFormat("en-IN",{style:"currency",currency,maximumFractionDigits:2}).format(value||0)}
export function formatPercent(value:number){return `${((value||0)*100).toFixed(1)}%`}
export function formatNumber(value:number){return new Intl.NumberFormat("en-IN",{maximumFractionDigits:2}).format(value||0)}
