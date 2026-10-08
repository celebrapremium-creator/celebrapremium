"use client";
import { FormEvent,useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function RequestAccessPage(){
 const supabase=createClient(); const router=useRouter();
 const [f,setF]=useState({fullName:"",email:"",cpf:"",eventName:"",password:"",confirm:"",role:"event_manager",terms:false});
 const [busy,setBusy]=useState(false); const [error,setError]=useState(""); const [done,setDone]=useState(false);
 const set=(k:string,v:string|boolean)=>setF(x=>({...x,[k]:v}));
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError("");
  if(f.password.length<8){setError("A senha deve ter pelo menos 8 caracteres.");setBusy(false);return}
  if(f.password!==f.confirm){setError("As senhas não conferem.");setBusy(false);return}
  if(!f.terms){setError("Aceite os termos de uso e o aviso de privacidade.");setBusy(false);return}
  const {data,error:authError}=await supabase.auth.signUp({email:f.email.trim(),password:f.password,options:{data:{full_name:f.fullName.trim()}}});
  if(authError||!data.user){setError("Não foi possível criar o acesso.");setBusy(false);return}
  if(!data.session){setError("O Supabase ainda exige confirmação por e-mail. Para este fluxo, a confirmação deve estar desativada em Authentication > Providers > Email.");setBusy(false);return}
  const {error:reqError}=await supabase.rpc("submit_access_request",{p_full_name:f.fullName.trim(),p_email:f.email.trim(),p_cpf:f.cpf,p_event_name:f.eventName.trim(),p_requested_role:f.role,p_terms_version:"2026-10-v1",p_privacy_version:"2026-10-v1"});
  if(reqError){setError(reqError.message.includes("event_not_unique")?"O nome informado não corresponde a um único evento cadastrado.":"Não foi possível registrar a solicitação.");setBusy(false);return}
  setDone(true);setBusy(false);
 }
 if(done)return <main className="simple-state"><div className="state-card"><span className="success-icon">✓</span><span className="eyebrow">SOLICITAÇÃO ENVIADA</span><h1>Aguardando liberação</h1><p>Sua solicitação foi registrada. O Desenvolvedor precisa conferir a empresa, o evento, a identidade informada e o nível de acesso.</p><button className="primary-button" onClick={()=>router.push("/acesso-pendente")}>Ver situação</button></div></main>;
 return <main className="auth-shell"><section className="auth-visual compact"><div className="brand-wordmark">CELEBRA <strong>PREMIUM</strong></div><div><span className="eyebrow">PRIMEIRO ACESSO</span><h1>Seu acesso começa aqui.</h1><p>O cadastro não libera acesso automaticamente.</p></div></section><section className="auth-card"><div className="auth-card-inner wide"><span className="eyebrow">SOLICITAR ACESSO</span><h2>Cadastre sua solicitação</h2><p className="muted">O evento precisa já existir no CELEBRA PREMIUM.</p><form onSubmit={submit} className="auth-form"><label>Nome completo<input required value={f.fullName} onChange={e=>set("fullName",e.target.value)}/></label><div className="form-grid"><label>E-mail<input type="email" required value={f.email} onChange={e=>set("email",e.target.value)}/></label><label>CPF<input inputMode="numeric" required value={f.cpf} onChange={e=>set("cpf",e.target.value)}/></label></div><label>Nome do evento<input required value={f.eventName} onChange={e=>set("eventName",e.target.value)}/></label><div className="form-grid"><label>Senha<input type="password" minLength={8} required value={f.password} onChange={e=>set("password",e.target.value)}/></label><label>Confirmar senha<input type="password" minLength={8} required value={f.confirm} onChange={e=>set("confirm",e.target.value)}/></label></div><label>Função pretendida<select value={f.role} onChange={e=>set("role",e.target.value)}><option value="event_manager">Gestor do evento</option><option value="contractor">Contratante</option><option value="ceremonialist">Cerimonialista</option><option value="finance">Financeiro</option><option value="receptionist">Recepção</option><option value="viewer">Consulta</option></select></label><label className="check-row"><input type="checkbox" checked={f.terms} onChange={e=>set("terms",e.target.checked)}/><span>Li e aceito os termos de uso e o aviso de privacidade.</span></label>{error&&<div className="form-error" role="alert">{error}</div>}<button className="primary-button" disabled={busy}>{busy?"Enviando...":"Solicitar primeiro acesso"}</button></form><div className="auth-links"><a href="/login">Voltar ao login</a></div></div></section></main>;
}
