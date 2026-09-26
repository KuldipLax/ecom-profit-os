"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function AdminClientActions({businessId,status,clientEmail}:{businessId:string;status:string;clientEmail?:string|null}){
  const [msg,setMsg]=useState("");
  const [credentials,setCredentials]=useState<{email:string;password:string}|null>(null);
  const [loading,setLoading]=useState(false);

  async function update(next:string){
    setLoading(true); setMsg("");
    const r=await fetch(`/api/admin/clients/${businessId}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:next})});
    const j=await r.json().catch(()=>({}));
    setMsg(r.ok?`Client set to ${next}. Refresh to see state.`:j.error??'Could not update client.');
    setLoading(false);
  }

  async function reset(){
    setLoading(true); setMsg(""); setCredentials(null);
    const r=await fetch(`/api/admin/clients/${businessId}/credentials`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({})});
    const j=await r.json().catch(()=>({}));
    if(r.ok){setMsg('Client password reset. Save the new temporary credentials below.');setCredentials(j.credentials);}else setMsg(j.error??'Reset failed.');
    setLoading(false);
  }

  return <div className="flex flex-wrap gap-2">
    <Button size="sm" variant="secondary" disabled={loading} onClick={()=>update(status==='active'?'inactive':'active')}>{status==='active'?'Deactivate client':'Activate client'}</Button>
    <Button size="sm" variant="secondary" disabled={loading} onClick={reset}>Reset / generate credentials</Button>
    {msg&&<span className="w-full text-[10px] text-slate-500">{msg}</span>}
    {credentials&&<div className="w-full rounded-md border border-amber-200 bg-amber-50 p-3 text-[10px] text-amber-900">
      <div className="font-semibold">New temporary credentials — shown once</div>
      <div className="mt-1">Email: <b>{credentials.email}</b></div>
      <div>Password: <b className="select-all">{credentials.password}</b></div>
      <div className="mt-1 text-amber-700">Password is not persisted in application tables.</div>
    </div>}
  </div>
}
