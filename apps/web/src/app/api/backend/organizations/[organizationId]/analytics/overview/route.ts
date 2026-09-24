import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
export async function GET(request:NextRequest,context:{params:Promise<{organizationId:string}>}){
  const {organizationId}=await context.params; const supabase=await createSupabaseServerClient();
  const {data}=await supabase.auth.getSession(); const token=data.session?.access_token;
  if(!token)return NextResponse.json({error:'unauthenticated'},{status:401});
  const api=process.env.API_URL??process.env.NEXT_PUBLIC_API_URL??'http://127.0.0.1:3001';
  const upstream=await fetch(`${api}/v1/organizations/${organizationId}/analytics/overview${request.nextUrl.search}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});
  return new NextResponse(await upstream.text(),{status:upstream.status,headers:{'content-type':upstream.headers.get('content-type')??'application/json'}});
}
