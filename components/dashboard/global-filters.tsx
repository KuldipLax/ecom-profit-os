"use client";
import { useState } from "react";
import { rangeFromPreset } from "@/lib/utils/date";
import { useRouter,useSearchParams } from "next/navigation";

export function GlobalFilters({businessId,memberships}:{businessId:string;memberships:any[]}){
  const sp=useSearchParams(),router=useRouter();
  const [business,setBusiness]=useState(sp.get("business")??businessId);
  const [start,setStart]=useState(sp.get("start")??"");
  const [end,setEnd]=useState(sp.get("end")??"");
  const [channel,setChannel]=useState(sp.get("channel")??"");
  const [paymentMethod,setPaymentMethod]=useState(sp.get("paymentMethod")??"");
  const [orderStatus,setOrderStatus]=useState(sp.get("orderStatus")??"");
  const [product,setProduct]=useState(sp.get("product")??"");

  function apply(e:React.FormEvent){
    e.preventDefault();
    const p=new URLSearchParams();
    p.set("business",business);
    if(start)p.set("start",start);
    if(end)p.set("end",end);
    if(channel)p.set("channel",channel);
    if(paymentMethod)p.set("paymentMethod",paymentMethod);
    if(orderStatus)p.set("orderStatus",orderStatus);
    if(product)p.set("product",product);
    router.push("?"+p.toString());
  }
  function preset(name:"7d"|"14d"|"30d"|"month"){
    const r=rangeFromPreset(name as any);
    setStart(r.start);setEnd(r.end);
  }

  return <form onSubmit={apply} className="filters">
    {memberships.length>1&&<label className="filter" style={{paddingRight:6}}>
      <span className="muted">Business</span>
      <select value={business} onChange={e=>setBusiness(e.target.value)} style={{border:0,background:"transparent",outline:0,fontSize:11,fontWeight:600,color:"var(--text)"}}>
        {memberships.map((m:any)=><option key={m.business_id} value={m.business_id}>{m.businesses?.name??m.business_id}</option>)}
      </select>
    </label>}
    <label className="filter"><span className="muted">From</span><input type="date" value={start} onChange={e=>setStart(e.target.value)} style={{border:0,background:"transparent",outline:0,fontSize:11,color:"var(--text)"}}/></label>
    <label className="filter"><span className="muted">To</span><input type="date" value={end} onChange={e=>setEnd(e.target.value)} style={{border:0,background:"transparent",outline:0,fontSize:11,color:"var(--text)"}}/></label>
    <label className="filter"><span className="muted">Channel</span><select value={channel} onChange={e=>setChannel(e.target.value)} style={{border:0,background:"transparent",outline:0,fontSize:11,fontWeight:600,color:"var(--text)"}}><option value="">All</option><option value="shopify">Shopify</option><option value="manual">Manual</option><option value="csv">CSV</option></select></label>
    <label className="filter"><span className="muted">Payment</span><select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)} style={{border:0,background:"transparent",outline:0,fontSize:11,fontWeight:600,color:"var(--text)"}}><option value="">All</option><option value="prepaid">Prepaid</option><option value="cod">COD</option><option value="unknown">Unknown</option></select></label>
    <label className="filter"><span className="muted">Status</span><select value={orderStatus} onChange={e=>setOrderStatus(e.target.value)} style={{border:0,background:"transparent",outline:0,fontSize:11,fontWeight:600,color:"var(--text)"}}><option value="">All</option><option value="DELIVERED">Delivered</option><option value="RTO_DELIVERED">RTO</option><option value="OPEN">Open</option><option value="SHIPPED">Shipped</option></select></label>
    <label className="filter"><span className="muted">Product</span><input value={product} onChange={e=>setProduct(e.target.value)} placeholder="All products" style={{width:96,border:0,background:"transparent",outline:0,fontSize:11,color:"var(--text)"}}/></label>
    <div style={{display:"flex",gap:5,marginLeft:"auto"}}>
      <button type="button" className="filter" onClick={()=>preset("7d")}>7D</button>
      <button type="button" className="filter" onClick={()=>preset("14d")}>14D</button>
      <button type="button" className="filter" onClick={()=>preset("30d")}>30D</button>
      <button type="button" className="primary-btn" onClick={apply}>Apply</button>
    </div>
  </form>
}