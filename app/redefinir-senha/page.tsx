"use client";
import { FormEvent,useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
export default function Reset(){const supabase=createClient();const router=useRouter();const [p,setP]=useState("");const [c,setC]=useState("");const [error,setError]=useState("");const [done,setDone]=useState(false);
async function submit(e:FormEvent){e.preventDefault();if(p.length<8||p!==c){setError("Use pelo menos 8 caracteres e confirme a mesma senha.");return}const {error}=await supabase.auth.updateUser({password:p});if(error)setError("Não foi possível alterar a senha.");else setDone(true)}
return <main className="simple-state"><div className="state-card wide-state"><span className="eyebrow">SEGURANÇA</span><h1>{done?"Senha atualizada":"Criar nova senha"}</h1>{done?<><p>Sua senha foi alterada com sucesso.</p><button className="primary-button" onClick={()=>router.push("/login")}>Ir para o login</button></>:<form onSubmit={submit} className="auth-form"><label>Nova senha<input type="password" minLength={8} required value={p} onChange={e=>setP(e.target.value)}/></label><label>Confirmar senha<input type="password" minLength={8} required value={c} onChange={e=>setC(e.target.value)}/></label>{error&&<div className="form-error">{error}</div>}<button className="primary-button">Salvar nova senha</button></form>}</div></main>}
