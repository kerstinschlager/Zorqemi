import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors={"Access-Control-Allow-Origin":"https://kerstinschlager.github.io","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  try{
    const auth=req.headers.get('Authorization');if(!auth)return json({error:'Anmeldung erforderlich'},401);
    const {session_id}=await req.json();if(!session_id)return json({error:'session_id fehlt'},400);
    const key=Deno.env.get('STRIPE_SECRET_KEY');if(!key)return json({error:'STRIPE_SECRET_KEY ist in Supabase noch nicht hinterlegt.'},500);
    const supabaseUrl=Deno.env.get('SUPABASE_URL')!;const anonKey=Deno.env.get('SUPABASE_ANON_KEY')!;const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const userClient=createClient(supabaseUrl,anonKey,{global:{headers:{Authorization:auth}}});
    const {data:userData}=await userClient.auth.getUser();if(!userData.user)return json({error:'Ungültige Sitzung'},401);
    const admin=createClient(supabaseUrl,serviceKey);
    const orderQuery=await admin.from('orders').select('id,customer_id,payment_status,status').eq('stripe_checkout_session_id',session_id).maybeSingle();
    if(orderQuery.error)throw orderQuery.error;
    if(!orderQuery.data||orderQuery.data.customer_id!==userData.user.id)return json({error:'Bestellung nicht gefunden'},404);
    const res=await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(session_id)}`,{headers:{Authorization:`Bearer ${key}`}});
    const session=await res.json();if(!res.ok)throw new Error(session?.error?.message||'Stripe-Fehler');
    const paid=session.payment_status==='paid';
    let currentPaymentStatus=orderQuery.data.payment_status;
    let currentStatus=orderQuery.data.status;
    if(paid && ['pending','unpaid'].includes(currentPaymentStatus)){
      const pi=typeof session.payment_intent==='string'?session.payment_intent:null;
      const {data:updatedOrder,error:updateError}=await admin
        .from('orders')
        .update({payment_status:'paid',status:'paid',paid_at:new Date().toISOString(),stripe_payment_intent_id:pi})
        .eq('id',orderQuery.data.id)
        .in('payment_status',['pending','unpaid'])
        .select('id')
        .maybeSingle();
      if(updateError)throw updateError;
      if(updatedOrder){
        const {error:consumeError}=await admin.rpc('consume_order_stock',{p_order_id:orderQuery.data.id});
        if(consumeError)throw consumeError;
        currentPaymentStatus='paid';
        currentStatus='paid';
      }else{
        const latest=await admin.from('orders').select('payment_status,status').eq('id',orderQuery.data.id).single();
        if(latest.error)throw latest.error;
        currentPaymentStatus=latest.data.payment_status;
        currentStatus=latest.data.status;
      }
    }
    return json({paid,order_id:orderQuery.data.id,payment_status:currentPaymentStatus,status:currentStatus});
  }catch(e){console.error(e);return json({error:e instanceof Error?e.message:'Unbekannter Fehler'},500)}
});
