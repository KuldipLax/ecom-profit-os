"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function AdminCreateClient(){
  const [name,setName]=useState("");
  const [email,setEmail]=useState("");
  const [clientName,setClientName]=useState("");
  const [password,setPassword]=useState("");
  const [msg,setMsg]=useState("");
  const [error,setError]=useState("");
  const [credentials,setCredentials]=useState<{email:string;password:string;businessId:string}|null>(null);
  const [loading,setLoading]=useState(false);

  async function create(){
    setLoading(true); setMsg(""); setError(""); setCredentials(null);
    const r=await fetch('/api/admin/clients',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,email,clientName,password:password||undefined})});
    const j=await r.json().catch(()=>({}));
    if(!r.ok){setError(j.error??'Could not create client.'); setLoading(false); return;}
    setMsg('Client account created successfully. Save the generated credentials below.');
    setCredentials(j.credentials); setName(''); setEmail(''); setClientName(''); setPassword(''); setLoading(false);
  }

  return <div className="rounded-lg border bg-white p-5">
    <div className="text-sm font-semibold">Create client business</div>
    <div className="mt-1 text-xs text-slate-500">Admin creates the client login and assigns the client role automatically.</div>
    <div className="mt-4 grid gap-4 md:grid-cols-4">
      <div><Label>Business name</Label><Input value={name} onChange={e=>setName(e.target.value)} placeholder="GS Ayurvedic" /></div>
      <div><Label>Client contact name</Label><Input value={clientName} onChange={e=>setClientName(e.target.value)} placeholder="Client name" /></div>
      <div><Label>Login email</Label><Input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="client@example.com" /></div>
      <div><Label>Temporary password (optional)</Label><Input value={password} onChange={e=>setPassword(e.target.value)} placeholder="Leave blank to generate" minLength={12} /></div>
    </div>
    <div className="mt-4 flex items-center gap-2"><Button onClick={create} disabled={loading||!name||!email}>{loading?'Creating…':'Create client + credentials'}</Button></div>
    {error&&<div className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}
    {msg&&<div className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{msg}</div>}
    {credentials&&<div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="text-xs font-semibold text-amber-900">Client login credentials — shown once</div>
      <div className="mt-2 grid gap-2 text-xs"><div><span className="text-amber-700">Email:</span> <b>{credentials.email}</b></div><div><span className="text-amber-700">Temporary password:</span> <b className="select-all">{credentials.password}</b></div><div><span className="text-amber-700">Login:</span> <span>/login</span></div></div>
      <div className="mt-3 text-[10px] text-amber-700">The password is not stored in the application database or audit log.</div>
    </div>}
  </div>
}
