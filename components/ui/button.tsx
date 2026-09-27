import { cva,type VariantProps } from "class-variance-authority";import { cn } from "@/lib/utils";
const variants=cva("inline-flex items-center justify-center transition disabled:opacity-50 disabled:pointer-events-none",{variants:{variant:{default:"primary-btn",secondary:"secondary-btn",ghost:"secondary-btn"},size:{default:"",sm:""}},defaultVariants:{variant:"default"}});
export function Button({className,variant,size,...props}:React.ButtonHTMLAttributes<HTMLButtonElement>&VariantProps<typeof variants>){return <button className={cn(variants({variant,size}),className)} {...props}/>}
