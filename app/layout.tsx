import type { Metadata } from "next";
import "./globals.css";
export const metadata:Metadata={title:"ECOM PROFIT OS",description:"Real Profit. Real Costs. Real-Time E-commerce Intelligence."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
