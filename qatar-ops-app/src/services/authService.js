import { requireSupabase, supabase, isSupabaseConfigured } from './supabaseClient.js';

let cachedUser = null;

function mapProfile(profile, authUser) {
  if (!profile) return null;
  return {
    id: profile.id,
    authUserId: profile.auth_user_id,
    fullName: profile.full_name,
    email: profile.email || authUser?.email,
    role: profile.roles?.name || profile.role_name || 'Viewer',
    status: profile.account_status,
    mustChangePassword: Boolean(profile.must_change_password),
    lastLoginAt: profile.last_login_at
  };
}

async function loadProfile(authUser) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('profiles')
    .select('id, auth_user_id, full_name, email, account_status, must_change_password, last_login_at, roles(name)')
    .eq('auth_user_id', authUser.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('No authorized profile exists for this account.');
  if (data.account_status !== 'Active') throw new Error('This account is not active. Contact an administrator.');

  cachedUser = mapProfile(data, authUser);
  return cachedUser;
}

export const authService = {
  isConfigured() {
    return isSupabaseConfigured;
  },

  async login(email, password) {
    const client = requireSupabase();
    const { data, error } = await client.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    });
    if (error) throw new Error(error.message || 'Unable to sign in.');
    const user = await loadProfile(data.user);
    await client.from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', user.id);
    return user;
  },

  async restoreSession() {
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.user) {
      cachedUser = null;
      return null;
    }
    return loadProfile(data.session.user);
  },

  async logout() {
    if (supabase) await supabase.auth.signOut();
    cachedUser = null;
  },

  getCurrentUser() {
    return cachedUser;
  },

  onAuthStateChange(callback) {
    if (!supabase) return { unsubscribe: () => {} };
    const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) {
        cachedUser = null;
        callback(null);
        return;
      }
      try {
        callback(await loadProfile(session.user));
      } catch {
        cachedUser = null;
        callback(null);
      }
    });
    return data.subscription;
  }
};
