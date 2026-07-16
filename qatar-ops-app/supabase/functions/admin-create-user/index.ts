import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return Response.json({ error: 'Function environment is not configured.' }, { status: 500, headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization') || '';
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: callerAuth } = await userClient.auth.getUser();
  if (!callerAuth.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
  }

  const { data: callerProfile, error: callerError } = await userClient
    .from('profiles')
    .select('id, roles(name)')
    .eq('auth_user_id', callerAuth.user.id)
    .single();
  if (callerError || callerProfile?.roles?.name !== 'Administrator') {
    return Response.json({ error: 'Administrator access required.' }, { status: 403, headers: corsHeaders });
  }

  const body = await req.json();
  const { email, password, fullName, roleName = 'Viewer', accountStatus = 'Invited', mustChangePassword = true } = body;
  if (!email || !password || !fullName) {
    return Response.json({ error: 'email, password, and fullName are required.' }, { status: 400, headers: corsHeaders });
  }

  const { data: role, error: roleError } = await adminClient
    .from('roles')
    .select('id')
    .eq('name', roleName)
    .single();
  if (roleError || !role) {
    return Response.json({ error: 'Invalid role.' }, { status: 400, headers: corsHeaders });
  }

  const created = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName }
  });
  if (created.error) {
    return Response.json({ error: created.error.message }, { status: 400, headers: corsHeaders });
  }

  const profile = await adminClient.from('profiles').insert({
    auth_user_id: created.data.user.id,
    full_name: fullName,
    email,
    role_id: role.id,
    account_status: accountStatus,
    must_change_password: mustChangePassword,
    created_by: callerProfile.id
  }).select('id').single();
  if (profile.error) {
    return Response.json({ error: profile.error.message }, { status: 400, headers: corsHeaders });
  }

  return Response.json({ profileId: profile.data.id, authUserId: created.data.user.id }, { headers: corsHeaders });
});
