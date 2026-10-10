"use client";

import { ChangeEvent, FormEvent, useState } from "react";

export default function MemoryBookForm({ slug, maxChars }: { slug: string; maxChars: number }) {
  const [firstName,setFirstName]=useState("");
  const [lastName,setLastName]=useState("");
  const [phone,setPhone]=useState("");
  const [message,setMessage]=useState("");
  const [photos,setPhotos]=useState<File[]>([]);
  const [wantsPhotos,setWantsPhotos]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");

  function choosePhotos(e: ChangeEvent<HTMLInputElement>) {
    const selected=Array.from(e.target.files || []);
    if(selected.length>5){setError("Selecione no máximo 5 fotos.");e.target.value="";return;}
    if(selected.some(f=>f.size>10*1024*1024)){setError("Cada foto deve ter até 10 MB.");e.target.value="";return;}
    if(selected.some(f=>!["image/jpeg","image/png","image/webp"].includes(f.type))){setError("Envie fotos em JPG, PNG ou WebP.");e.target.value="";return;}
    setError("");setPhotos(selected);
  }

  async function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();setError("");setSuccess("");
    if(message.trim().length===0){setError("Escreva sua recordação antes de enviar.");return;}
    if(message.length>maxChars){setError(`A mensagem pode ter até ${maxChars} caracteres.`);return;}
    if(wantsPhotos&&photos.length===0){setError("Escolha pelo menos uma foto ou desmarque a opção de anexar fotos.");return;}
    setBusy(true);
    try {
      const data=new FormData();
      data.set("slug",slug);data.set("firstName",firstName);data.set("lastName",lastName);
      data.set("phone",phone);data.set("message",message.trim());
      photos.forEach(file=>data.append("photos",file));
      const response=await fetch("/api/memory-book/submit",{method:"POST",body:data});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||"Não foi possível enviar sua recordação.");
      setSuccess(result.message);setFirstName("");setLastName("");setPhone("");setMessage("");setPhotos([]);setWantsPhotos(false);
    } catch(e) {setError(e instanceof Error?e.message:"Erro inesperado ao enviar.");}
    finally {setBusy(false);}
  }

  const labelStyle={display:"block" as const,fontWeight:600,fontSize:14,marginBottom:7};
  const inputStyle={width:"100%",padding:"12px 13px",border:"1px solid #ded6df",borderRadius:10,fontSize:16,background:"#fff",color:"#2b2430",boxSizing:"border-box" as const};
  return <form onSubmit={submit} style={{display:"grid",gap:18,marginTop:24}}>
    <div><label style={labelStyle} htmlFor="firstName">Nome</label><input id="firstName" required maxLength={80} autoComplete="given-name" value={firstName} onChange={e=>setFirstName(e.target.value)} style={inputStyle}/></div>
    <div><label style={labelStyle} htmlFor="lastName">Sobrenome</label><input id="lastName" required maxLength={100} autoComplete="family-name" value={lastName} onChange={e=>setLastName(e.target.value)} style={inputStyle}/></div>
    <div><label style={labelStyle} htmlFor="phone">Celular com DDD</label><input id="phone" required type="tel" inputMode="tel" autoComplete="tel" placeholder="(11) 99999-9999" value={phone} onChange={e=>setPhone(e.target.value)} style={inputStyle}/><small style={{color:"#817783"}}>Cada celular pode enviar uma recordação por evento.</small></div>
    <div><label style={labelStyle} htmlFor="message">Sua mensagem</label><textarea id="message" required rows={5} maxLength={maxChars} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Escreva uma lembrança carinhosa deste momento..." style={{...inputStyle,resize:"vertical"}}/><div style={{textAlign:"right",fontSize:12,color:message.length>=maxChars?"#b42318":"#817783"}}>{message.length}/{maxChars} caracteres</div></div>
    <fieldset style={{border:"1px solid #e7dfe8",borderRadius:12,padding:14}}>
      <legend style={{fontWeight:600,padding:"0 6px"}}>Deseja anexar fotos desse momento?</legend>
      <label style={{display:"flex",gap:8,alignItems:"center",padding:6}}><input type="radio" checked={wantsPhotos} onChange={()=>setWantsPhotos(true)}/> Sim, quero enviar fotos</label>
      <label style={{display:"flex",gap:8,alignItems:"center",padding:6}}><input type="radio" checked={!wantsPhotos} onChange={()=>{setWantsPhotos(false);setPhotos([])}}/> Não, somente a mensagem</label>
      {wantsPhotos&&<div style={{marginTop:10}}><label style={labelStyle} htmlFor="photos">Fotos (máximo 5, até 10 MB cada)</label><input id="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={choosePhotos}/>{photos.length>0&&<p style={{fontSize:13,color:"#6d6470"}}>{photos.length} foto(s) selecionada(s)</p>}</div>}
    </fieldset>
    {error&&<p role="alert" style={{margin:0,padding:12,borderRadius:8,background:"#fff0f0",color:"#9b1c1c"}}>{error}</p>}
    {success&&<p role="status" style={{margin:0,padding:12,borderRadius:8,background:"#edf9f0",color:"#176b36"}}>{success}</p>}
    <button disabled={busy} type="submit" style={{border:0,borderRadius:12,padding:15,background:busy?"#b8a5b8":"#68466f",color:"#fff",fontWeight:700,fontSize:16,cursor:busy?"wait":"pointer"}}>{busy?"Enviando...":"Enviar recordação"}</button>
  </form>;
}
