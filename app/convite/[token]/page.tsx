import {notFound} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import InvitationFlow from "./invitation-flow";
export const dynamic="force-dynamic";
export default async function InvitationPage({params}:{params:Promise<{token:string}>}){
 const {token}=await params;
 const supabase=await createClient();
 const {data,error}=await supabase.rpc("get_invitation_context",{p_token:token});
 if(error||!data)notFound();
 return <InvitationFlow token={token} initial={data}/>;
}
