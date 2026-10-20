"use client";

import { ChangeEvent, FormEvent, useState } from "react";

const profanity = [
  "caralho", "porra", "puta", "puto", "merda", "buceta", "foder", "fodase",
  "fdp", "cuzao", "arrombado", "desgraca", "vadia", "piranha", "putaria"
];

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[@4]/g, "a").replace(/[3]/g, "e")
    .replace(/[1!|]/g, "i").replace(/[0]/g, "o").replace(/[$5]/g, "s")
    .replace(/[7]/g, "t");
}

function containsProfanity(value: string) {
  const normalized = normalizeText(value);
  return profanity.some(word => {
    const pattern = word.split("").join("[^a-z]*");
    return new RegExp("(^|[^a-z])" + pattern + "($|[^a-z])").test(normalized);
  });
}

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
  const hasProfanity = containsProfanity(message);

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
    if(hasProfanity){setError("A mensagem contém palavras não permitidas. Revise o texto e tente novamente.");return;}
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
    <div>
      <label style={labelStyle} htmlFor="message">Sua mensagem (máximo de {maxChars.toLocaleString("pt-BR")} caracteres)</label>
      <textarea id="message" required rows={7} maxLength={maxChars} value={message} onChange={e=>{setMessage(e.target.value);setError("");setSuccess("");}} placeholder="Escreva uma lembrança carinhosa deste momento..." aria-invalid={hasProfanity} style={{...inputStyle,resize:"vertical",borderColor:hasProfanity?"#b42318":"#ded6df"}}/>
      <div style={{display:"flex",justifyContent:"space-between",gap:12,fontSize:12,color:message.length>=maxChars?"#b42318":"#817783"}}>
        <span>{message.length>=maxChars?"Você atingiu o limite máximo.":message.length>=maxChars-200?"Você está perto do limite.": "Conte sua lembrança com carinho."}</span>
        <span>{message.length.toLocaleString("pt-BR")} / {maxChars.toLocaleString("pt-BR")} caracteres</span>
      </div>
      {hasProfanity&&<p role="alert" style={{margin:"8px 0 0",color:"#b42318",fontSize:13}}>Esta mensagem contém palavras não permitidas. Remova-as para poder enviar.</p>}
    </div>
    <fieldset style={{border:"1px solid #e7dfe8",borderRadius:12,padding:14}}>
      <legend style={{fontWeight:600,padding:"0 6px"}}>Deseja anexar fotos desse momento?</legend>
      <label style={{display:"flex",gap:8,alignItems:"center",padding:6}}><input type="radio" checked={wantsPhotos} onChange={()=>setWantsPhotos(true)}/> Sim, quero enviar fotos</label>
      <label style={{display:"flex",gap:8,alignItems:"center",padding:6}}><input type="radio" checked={!wantsPhotos} onChange={()=>{setWantsPhotos(false);setPhotos([])}}/> Não, somente a mensagem</label>
      {wantsPhotos&&<div style={{marginTop:10}}><label style={labelStyle} htmlFor="photos">Fotos (máximo 5, até 10 MB cada)</label><input id="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={choosePhotos}/>{photos.length>0&&<p style={{fontSize:13,color:"#6d6470"}}>{photos.length} foto(s) selecionada(s)</p>}</div>}
    </fieldset>
    {error&&<p role="alert" style={{margin:0,padding:12,borderRadius:8,background:"#fff0f0",color:"#9b1c1c"}}>{error}</p>}
    {success&&<p role="status" style={{margin:0,padding:12,borderRadius:8,background:"#edf9f0",color:"#176b36"}}>{success}</p>}
    <button disabled={busy||hasProfanity} type="submit" style={{border:0,borderRadius:12,padding:15,background:busy||hasProfanity?"#b8a5b8":"#68466f",color:"#fff",fontWeight:700,fontSize:16,cursor:busy||hasProfanity?"not-allowed":"pointer"}}>{busy?"Enviando...":"Enviar recordação"}</button>
  </form>;
}