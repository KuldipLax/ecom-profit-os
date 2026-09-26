export type CheckoutTransaction={externalTransactionId:string;orderNumber:string;transactionDate:string;paymentMethod:"prepaid"|"cod"|"unknown";paymentStatus:string;transactionValue:number;checkoutFee:number|null};
export interface CheckoutProviderAdapter{readonly name:string;listTransactions(args:{from:string;to:string}):Promise<CheckoutTransaction[]>;}
export class ManualCheckoutAdapter implements CheckoutProviderAdapter{readonly name="manual";async listTransactions(){return[];}}
