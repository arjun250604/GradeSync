/* ═══════════════════════════════════════════════════
   auth.js  –  Supabase Auth & Guest-mode fallback
   ─────────────────────────────────────────────────
   SETUP GUIDE:
   1. Go to https://supabase.com and create a free project.
   2. In your project → Settings → API, copy:
      • Project URL  → paste as SUPABASE_URL below
      • anon/public key → paste as SUPABASE_ANON_KEY below
   3. Enable Email/Password auth under Authentication → Providers.
   4. (Optional) Disable email confirmation in Auth → Settings
      so users can sign in immediately after signup.
════════════════════════════════════════════════════ */

// ── Supabase credentials ─────────────────────────
// Replace the placeholder strings with your actual project credentials.
const SUPABASE_URL = 'https://plzevbehadiijqhurnoc.supabase.co';   // ← PASTE YOUR PROJECT URL
const SUPABASE_ANON_KEY = 'sb_publishable_m2RC1KqNG-OZTgBzkkoI2A_3KaI3muj';                  // ← PASTE YOUR ANON KEY

// ── Initialize Supabase client ───────────────────
// supabase is exposed globally by the CDN script.
// We wrap init in a try/catch so the app still works
// in guest (LocalStorage) mode if credentials are invalid.
let supabaseClient = null;

try {
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (err) {
  console.warn('[Auth] Supabase init failed – falling back to guest mode.', err);
}

// ── App-level session state ───────────────────────
// currentUser: { id, email, name, isGuest }
let currentUser = null;

// ══════════════════════════════════════════════════
//  Boot: check existing session on page load
// ══════════════════════════════════════════════════
async function initAuth() {
  // Try Supabase session first
  if (supabaseClient) {
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session) {
        const meta = session.user.user_metadata || {};
        currentUser = {
          id: session.user.id,
          email: session.user.email,
          name: meta.display_name || meta.name || session.user.email.split('@')[0],
          isGuest: false,
        };
        onAuthSuccess();
        return;
      }
    } catch (err) {
      console.warn('[Auth] Session check error:', err);
    }
  }

  // Fall back to guest session stored in localStorage
  const guestFlag = localStorage.getItem('gradesync_guest') || localStorage.getItem('grasdesync_guest') || localStorage.getItem('acadplan_guest');
  if (guestFlag === 'true') {
    setGuestUser();
    onAuthSuccess();
    return;
  }

  // No session → show auth screen
  showAuthScreen();
}

// ══════════════════════════════════════════════════
//  Login handler
// ══════════════════════════════════════════════════
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');

  hideAuthError('login-error');
  setButtonLoading(btn, true);

  if (!supabaseClient) {
    showAuthError('login-error', 'Supabase not configured. Use "Continue as Guest" mode.');
    setButtonLoading(btn, false);
    return;
  }

  try {
    // supabase.auth.signInWithPassword returns { data, error }
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) throw error;

    const meta = data.user.user_metadata || {};
    currentUser = {
      id: data.user.id,
      email: data.user.email,
      name: meta.display_name || meta.name || email.split('@')[0],
      isGuest: false,
    };
    onAuthSuccess();
  } catch (err) {
    showAuthError('login-error', err.message || 'Login failed. Please try again.');
  } finally {
    setButtonLoading(btn, false);
  }
}

// ══════════════════════════════════════════════════
//  Signup handler
// ══════════════════════════════════════════════════
async function handleSignup(e) {
  e.preventDefault();
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const btn = document.getElementById('signup-btn');

  hideAuthError('signup-error');
  document.getElementById('signup-success').classList.add('hidden');
  setButtonLoading(btn, true);

  if (!supabaseClient) {
    showAuthError('signup-error', 'Supabase not configured. Use "Continue as Guest" mode.');
    setButtonLoading(btn, false);
    return;
  }

  try {
    // signUp stores display_name in user_metadata so we can read it later
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: { data: { display_name: name } },
    });

    if (error) throw error;

    if (data.user && !data.session) {
      // Email confirmation required (default Supabase behaviour)
      const successEl = document.getElementById('signup-success');
      successEl.textContent = `✅ Account created! Check ${email} to confirm, then sign in.`;
      successEl.classList.remove('hidden');
    } else if (data.session) {
      // Email confirmation disabled – auto-login
      currentUser = { id: data.user.id, email, name, isGuest: false };
      onAuthSuccess();
    }
  } catch (err) {
    showAuthError('signup-error', err.message || 'Signup failed. Please try again.');
  } finally {
    setButtonLoading(btn, false);
  }
}

// ══════════════════════════════════════════════════
//  Guest mode
// ══════════════════════════════════════════════════
function continueAsGuest() {
  localStorage.setItem('gradesync_guest', 'true');
  setGuestUser();
  onAuthSuccess();
}

function setGuestUser() {
  const storedName = localStorage.getItem('gradesync_guest_name') || localStorage.getItem('grasdesync_guest_name') || localStorage.getItem('acadplan_guest_name') || 'Student';
  currentUser = {
    id: 'guest',
    email: 'guest@local',
    name: storedName,
    isGuest: true,
  };
}

// ══════════════════════════════════════════════════
//  Logout
// ══════════════════════════════════════════════════
async function handleLogout() {
  if (!confirm('Sign out of GradeSync?')) return;

  if (supabaseClient && !currentUser.isGuest) {
    await supabaseClient.auth.signOut().catch(console.warn);
  }
  localStorage.removeItem('gradesync_guest');
  localStorage.removeItem('grasdesync_guest');
  localStorage.removeItem('acadplan_guest');
  currentUser = null;
  showAuthScreen();
  showToast('Signed out successfully', 'info');
}

// ══════════════════════════════════════════════════
//  Supabase auth state listener
//  Keeps the session alive if the token auto-refreshes
// ══════════════════════════════════════════════════
if (supabaseClient) {
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' && currentUser && !currentUser.isGuest) {
      currentUser = null;
      showAuthScreen();
    }
    if (event === 'TOKEN_REFRESHED' && session) {
      // Token silently refreshed – no UI action needed
      console.log('[Auth] Token refreshed.');
    }
  });
}

// ══════════════════════════════════════════════════
//  UI helpers
// ══════════════════════════════════════════════════
function showAuthScreen() {
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('app-screen').classList.add('hidden');
}

function onAuthSuccess() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');
  // Delegate full app init to app.js
  if (typeof initApp === 'function') initApp();
}

function switchAuthTab(tab) {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const tabLogin = document.getElementById('tab-login');
  const tabSignup = document.getElementById('tab-signup');

  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
    tabLogin.className = 'flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm';
    tabSignup.className = 'flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200';
  } else {
    loginForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
    tabSignup.className = 'flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm';
    tabLogin.className = 'flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200';
  }
}

function showAuthError(elId, msg) {
  const el = document.getElementById(elId);
  el.textContent = msg;
  el.classList.remove('hidden');
}

function hideAuthError(elId) {
  document.getElementById(elId).classList.add('hidden');
}

function setButtonLoading(btn, loading) {
  btn.disabled = loading;
  btn.querySelector('.btn-text').classList.toggle('hidden', loading);
  btn.querySelector('.btn-loader').classList.toggle('hidden', !loading);
}

function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  const icon = btn.querySelector('i');
  if (input.type === 'password') {
    input.type = 'text';
    icon.className = 'fa-solid fa-eye-slash text-sm';
  } else {
    input.type = 'password';
    icon.className = 'fa-solid fa-eye text-sm';
  }
}

// ── Boot on DOM ready ─────────────────────────────
document.addEventListener('DOMContentLoaded', initAuth);
