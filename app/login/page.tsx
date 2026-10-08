"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [show,setShow]=useState(false);
  const [busy,setBusy]=useState(false); const [error,setError]=useState("");

  async function submit(e:FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    const {error:signInError}=await supabase.auth.signInWithPassword({email:email.trim(),password});
    if(signInError){setError("E-mail ou senha inválidos.");setBusy(false);return;}
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){setError("Não foi possível confirmar sua sessão.");setBusy(false);return;}
    const [{data:platform},{data:memberships},{data:request}]=await Promise.all([
      supabase.from("platform_roles").select("role,active").eq("user_id",user.id).maybeSingle(),
      supabase.from("memberships").select("role,active").eq("user_id",user.id).eq("active",true),
      supabase.from("access_requests").select("status").eq("user_id",user.id).order("created_at",{ascending:false}).limit(1).maybeSingle()
    ]);
    const privileged=Boolean(platform?.active&&platform.role==="developer")||Boolean(memberships?.some(m=>m.role==="company_admin"));
    if(privileged){const {data:aal}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();if(aal?.nextLevel==="aal2"&&aal.currentLevel!=="aal2"){router.replace("/mfa");return;}}
    if(request?.status==="pending") router.replace("/acesso-pendente");
    else if(request?.status==="rejected") router.replace("/acesso-pendente?status=rejected");
    else if(request?.status==="suspended"||request?.status==="revoked") router.replace("/acesso-pendente?status=suspended");
    else if(memberships?.some(m=>m.active)||(platform?.active&&platform.role==="developer")) router.replace("/app");
    else router.replace("/solicitar-acesso");
  }

  return <main className="auth-shell">
    <section className="auth-card"><div className="auth-card-inner"><span className="eyebrow">ACESSO SEGURO</span><h2>Bem-vindo de volta</h2><p className="muted">Entre com seu e-mail e senha para acessar o ambiente autorizado.</p><form onSubmit={submit} className="auth-form"><label>E-mail<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Senha<div className="password-row"><input type={show?"text":"password"} required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/><button type="button" className="text-button" onClick={()=>setShow(!show)}>{show?"Ocultar":"Exibir"}</button></div></label>{error&&<div className="form-error" role="alert">{error}</div>}<button className="primary-button" disabled={busy}>{busy?"Entrando...":"Entrar"}</button></form><div className="auth-links"><a href="/recuperar">Esqueci minha senha</a><a className="secondary-button" href="/solicitar-acesso">Solicitar primeiro acesso</a></div></div></section>
  </main>;
}
