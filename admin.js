/* OMA Labs — Admin Panel Logic
   Auth: GitHub OAuth (redirect) via Cloudflare Worker proxy
   Fallback: Personal Access Token
   Verifies repo collaborator status, then allows
   editing config.json with commits via GitHub API.
   ============================================================ */

// ── Config ──────────────────────────────────────────────────
const REPO_OWNER = 'beats0126';
const REPO_NAME  = 'omalabs_website';
const CONFIG_PATH = 'config.json';
const API_BASE    = 'https://api.github.com';

/* ═══════════════════════════════════════════════════════════
   Replace these with your OAuth App details
   Create one at: https://github.com/settings/developers
   - Application name: OMA Labs Admin
   - Homepage URL: https://profile.omalabs.cc
   - Callback URL:  https://profile.omalabs.cc/admin.html
   ═══════════════════════════════════════════════════════════ */
const OAUTH_CLIENT_ID = 'Ov23li9mwupQD7qHXXWa';
const WORKER_URL = 'https://omalabs-auth.omalabs.workers.dev';
/* ═══════════════════════════════════════════════════════════
   Deploy worker.js to Cloudflare Workers, then update WORKER_URL
   ═══════════════════════════════════════════════════════════ */

const STORAGE_KEY = 'omalabs_admin';

// ── DOM refs ────────────────────────────────────────────────
const loginScreen   = document.getElementById('loginScreen');
const editorScreen  = document.getElementById('editorScreen');
const loginBtn      = document.getElementById('loginBtn');
const loginError    = document.getElementById('loginError');
const loginSpinner  = document.getElementById('loginSpinner');
const tokenInput    = document.getElementById('tokenInput');
const toggleToken   = document.getElementById('toggleToken');
const rememberCheck = document.getElementById('rememberCheck');

// Editor
const logoutBtn   = document.getElementById('logoutBtn');
const userName    = document.getElementById('userName');
const editorForm  = document.getElementById('editorForm');
const saveBtn     = document.getElementById('saveBtn');
const resetBtn    = document.getElementById('resetBtn');
const saveError   = document.getElementById('saveError');
const saveSuccess = document.getElementById('saveSuccess');
const saveSpinner = document.getElementById('saveSpinner');

// ── State ───────────────────────────────────────────────────
let currentToken   = null;
let currentUser    = null;
let currentSha     = null;
let originalConfig = null;

// ── Storage helpers ─────────────────────────────────────────
function saveToken(token, user) {
  const data = JSON.stringify({ token, user, ts: Date.now() });
  if (rememberCheck && rememberCheck.checked) {
    localStorage.setItem(STORAGE_KEY, data);
  }
  sessionStorage.setItem(STORAGE_KEY, data);
}

function loadSavedToken() {
  const raw = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (Date.now() - data.ts > 7 * 24 * 60 * 60 * 1000) {
      clearSavedToken();
      return null;
    }
    return data;
  } catch { return null; }
}

function clearSavedToken() {
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
}

// ── Helpers ─────────────────────────────────────────────────
function show(s) { s.hidden = false; }
function hide(s) { s.hidden = true; }

async function apiCall(url, token, opts = {}) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...opts.headers,
    },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.message || `GitHub API: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function verifyTokenAndCollaborator(token) {
  const user = await apiCall(`${API_BASE}/user`, token);
  try {
    await apiCall(
      `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/collaborators/${user.login}`,
      token
    );
  } catch (e) {
    if (e.status === 404) {
      throw new Error(
        `User "${user.login}" is not a collaborator on ${REPO_OWNER}/${REPO_NAME}.`
      );
    }
    throw e;
  }
  return user;
}

// ═══════════════════════════════════════════════════════════
//  OAUTH REDIRECT FLOW (primary)
// ═══════════════════════════════════════════════════════════

function startOAuth() {
  const params = new URLSearchParams({
    client_id: OAUTH_CLIENT_ID,
    redirect_uri: window.location.origin + '/admin.html',
    scope: 'repo',
  });
  window.location.href = `https://github.com/login/oauth/authorize?${params}`;
}

async function handleOAuthCallback(code) {
  loginError.textContent = '';
  show(loginSpinner);
  loginBtn.textContent = '⏳ Exchanging code…';

  // Exchange code for token via Cloudflare Worker
  const workerRes = await fetch(`${WORKER_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });

  const data = await workerRes.json();

  if (!workerRes.ok || data.error) {
    throw new Error(data.error_description || data.error || 'Token exchange failed');
  }

  if (!data.access_token) {
    throw new Error('No access token returned. Check worker logs.');
  }

  // Verify token & collaborator status
  const user = await verifyTokenAndCollaborator(data.access_token);
  currentToken = data.access_token;
  currentUser  = user.login;
  saveToken(data.access_token, user.login);

  // Clean URL
  window.history.replaceState({}, '', '/admin.html');

  await loadEditor();
}

// Sign in button → redirect to GitHub
loginBtn.addEventListener('click', () => {
  if (WORKER_URL.includes('REPLACE_USERNAME')) {
    // Worker not configured — fall back to PAT
    loginError.textContent = 'OAuth not configured yet. Enter a PAT below, or deploy the worker.';
    return;
  }
  startOAuth();
});

// ═══════════════════════════════════════════════════════════
//  PAT FALLBACK
// ═══════════════════════════════════════════════════════════

toggleToken.addEventListener('click', () => {
  const isPw = tokenInput.type === 'password';
  tokenInput.type = isPw ? 'text' : 'password';
  toggleToken.textContent = isPw ? '🙈' : '👁';
});

// The PAT input works by pressing Enter or clicking a small inline button
// (handled via the login form's secondary mode)
tokenInput.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    await patLogin();
  }
});

async function patLogin() {
  const token = tokenInput.value.trim();
  if (!token) return;
  loginError.textContent = '';
  show(loginSpinner);
  try {
    const user = await verifyTokenAndCollaborator(token);
    currentToken = token;
    currentUser  = user.login;
    saveToken(token, user.login);
    await loadEditor();
  } catch (e) {
    loginError.textContent = e.message;
  } finally {
    hide(loginSpinner);
  }
}

// ═══════════════════════════════════════════════════════════
//  EDITOR
// ═══════════════════════════════════════════════════════════

async function loadEditor() {
  loginScreen.hidden = true;
  editorScreen.hidden = false;
  userName.textContent = `👤 ${currentUser}`;
  hide(loginSpinner);
  loginBtn.textContent = 'Sign In with GitHub';

  try {
    const file = await apiCall(
      `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${CONFIG_PATH}`,
      currentToken
    );
    currentSha = file.sha;
    const content = JSON.parse(atob(file.content));
    originalConfig = content;

    document.getElementById('emailInput').value        = content.email || '';
    document.getElementById('heading1Input').value     = content.contactHeading1 || '';
    document.getElementById('heading2Input').value     = content.contactHeading2 || '';
    document.getElementById('bodyInput').value         = content.contactBody || '';
    document.getElementById('primaryCtaInput').value   = content.primaryCta || '';
    document.getElementById('secondaryCtaInput').value = content.secondaryCta || '';
    document.getElementById('secondaryUrlInput').value = content.secondaryUrl || '';
  } catch (e) {
    saveError.textContent = 'Failed to load config: ' + e.message;
  }
}

// ── Save ────────────────────────────────────────────────────
editorForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  saveError.textContent = '';
  saveSuccess.textContent = '';
  saveBtn.disabled = true;
  show(saveSpinner);

  const newConfig = {
    email:            document.getElementById('emailInput').value.trim(),
    contactHeading1:  document.getElementById('heading1Input').value.trim(),
    contactHeading2:  document.getElementById('heading2Input').value.trim(),
    contactBody:      document.getElementById('bodyInput').value.trim(),
    primaryCta:       document.getElementById('primaryCtaInput').value.trim(),
    secondaryCta:     document.getElementById('secondaryCtaInput').value.trim(),
    secondaryUrl:     document.getElementById('secondaryUrlInput').value.trim(),
  };

  const contentBase64 = btoa(unescape(encodeURIComponent(
    JSON.stringify(newConfig, null, 2)
  )));

  try {
    const result = await apiCall(
      `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${CONFIG_PATH}`,
      currentToken,
      {
        method: 'PUT',
        body: JSON.stringify({
          message: '🔧 Update contact section config',
          content: contentBase64,
          sha: currentSha,
        }),
      }
    );
    currentSha = result.content.sha;
    originalConfig = newConfig;
    saveSuccess.textContent = '✅ Published! Live in ~60 seconds.';
  } catch (err) {
    saveError.textContent = 'Save failed: ' + err.message;
  } finally {
    saveBtn.disabled = false;
    hide(saveSpinner);
  }
});

// ── Reset ───────────────────────────────────────────────────
resetBtn.addEventListener('click', () => {
  if (!originalConfig) return;
  document.getElementById('emailInput').value        = originalConfig.email || '';
  document.getElementById('heading1Input').value     = originalConfig.contactHeading1 || '';
  document.getElementById('heading2Input').value     = originalConfig.contactHeading2 || '';
  document.getElementById('bodyInput').value         = originalConfig.contactBody || '';
  document.getElementById('primaryCtaInput').value   = originalConfig.primaryCta || '';
  document.getElementById('secondaryCtaInput').value = originalConfig.secondaryCta || '';
  document.getElementById('secondaryUrlInput').value = originalConfig.secondaryUrl || '';
  saveError.textContent = '';
  saveSuccess.textContent = '';
});

// ── Logout ──────────────────────────────────────────────────
logoutBtn.addEventListener('click', () => {
  clearSavedToken();
  currentToken = null;
  currentUser = null;
  currentSha = null;
  originalConfig = null;
  loginScreen.hidden = false;
  editorScreen.hidden = true;
  tokenInput.value = '';
  loginError.textContent = '';
});

// ═══════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════

(async function init() {
  // 1) Check for OAuth callback (code in URL)
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');

  if (code) {
    try {
      await handleOAuthCallback(code);
      return;
    } catch (e) {
      loginError.textContent = 'OAuth failed: ' + e.message;
      hide(loginSpinner);
      loginBtn.textContent = 'Sign In with GitHub';
      window.history.replaceState({}, '', '/admin.html');
    }
  }

  // 2) Try restoring saved session
  const saved = loadSavedToken();
  if (saved && saved.token && saved.user) {
    try {
      await apiCall(`${API_BASE}/user`, saved.token);
      currentToken = saved.token;
      currentUser  = saved.user;
      saveToken(saved.token, saved.user); // refresh timestamp
      await loadEditor();
      return;
    } catch {
      clearSavedToken();
    }
  }

  // 3) Show login screen
  loginScreen.hidden = false;
})();
