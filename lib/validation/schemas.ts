import { z } from "zod";
export const businessIdSchema=z.string().uuid();
export const dateRangeSchema=z.object({start:z.string().date(),end:z.string().date()}).refine(v=>v.start<=v.end,{message:"Start date must be on or before end date."});
export const settingsSchema=z.object({businessId:businessIdSchema,settings:z.record(z.string(),z.any())});
export const orderCreateSchema=z.object({businessId:businessIdSchema,orderNumber:z.string().min(1),orderDate:z.string().datetime(),paymentMethod:z.enum(["prepaid","cod","unknown"]),grossSale:z.coerce.number().nonnegative(),status:z.string()});
