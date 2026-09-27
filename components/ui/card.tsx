import type { HTMLAttributes } from "react";
export function Card({className,...p}:HTMLAttributes<HTMLDivElement>){return <div className={`card ${className??""}`} {...p}/>}
export function CardContent({className,...p}:HTMLAttributes<HTMLDivElement>){return <div className={`card-pad ${className??""}`} {...p}/>}
export function CardHeader({className,...p}:HTMLAttributes<HTMLDivElement>){return <div className={`card-pad ${className??""}`} {...p}/>}
export function CardTitle({className,...p}:HTMLAttributes<HTMLHeadingElement>){return <h3 className={`card-title ${className??""}`} {...p}/>