/* OMA Labs — Admin Panel Logic
   Auth: GitHub Device Flow (primary) or PAT (fallback)
   Verifies repo collaborator status, then allows
   editing config.json with commits via GitHub API.
   ============================================================ */

// ── Config ──────────────────────────────────────────────────
const REPO_OWNER = 'beats0126';
const REPO_NAME  = 'omalabs_website';
const CONFIG_PATH = 'config.json';
const API_BASE    = 'https://api.github.com';

/* ═══════════════════════════════════════════════════════════
   IMPORTANT: Replace this with your OAuth App's Client ID
   Create one at: https://github.com/settings/developers
   - Application name: OMA Labs Admin
   - Homepage URL: https://profile.omalabs.cc
   - Callback URL:  https://profile.omalabs.cc/admin.html
   ═══════════════════════════════════════════════════════════ */
const OAUTH_CLIENT_ID = 'Ov23li9mwupQD7qHXXWa';

// ── DOM refs ────────────────────────────────────────────────
const loginScreen     = document.getElementById('loginScreen');
const editorScreen    = document.getElementById('editorScreen');

// Device flow
const deviceFlowBtn   = document.getElementById('deviceFlowBtn');
const deviceFlowUI    = document.getElementById('deviceFlowUI');
const deviceCode      = document.getElementById('deviceCode');
const deviceFlowError = document.getElementById('deviceFlowError');
const deviceSpinner   = document.getElementById('deviceFlowSpinner');

// PAT fallback
const tokenInput      = document.getElementById('tokenInput');
const toggleToken     = document.getElementById('toggleToken');
const patLoginBtn     = document.getElementById('patLoginBtn');
const patLoginError   = document.getElementById('patLoginError');
const patLoginSpinner = document.getElementById('patLoginSpinner');

// General
const loginError      = document.getElementById('loginError');

// Editor
const logoutBtn       = document.getElementById('logoutBtn');
const userName        = document.getElementById('userName');
const editorForm      = document.getElementById('editorForm');
const saveBtn         = document.getElementById('saveBtn');
const resetBtn        = document.getElementById('resetBtn');
const saveError       = document.getElementById('saveError');
const saveSuccess     = document.getElementById('saveSuccess');
const saveSpinner     = document.getElementById('saveSpinner');

// ── State ───────────────────────────────────────────────────
let currentToken    = null;
let currentUser     = null;
let currentSha      = null;
let originalConfig  = null;
let devicePollTimer = null;

// ── Helpers ─────────────────────────────────────────────────
function s(show, spinner) { spinner.hidden = !show; }

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
        `User "${user.login}" is not a collaborator on ${REPO_OWNER}/${REPO_NAME}. Access denied.`
      );
    }
    throw e;
  }
  return user;
}

function completeLogin(token, user) {
  currentToken = token;
  currentUser  = user.login;
  sessionStorage.setItem('omalabs_admin_token', token);
  sessionStorage.setItem('omalabs_admin_user', user.login);
  loadEditor();
}

// ═══════════════════════════════════════════════════════════
//  DEVICE FLOW (primary)
// ═══════════════════════════════════════════════════════════

deviceFlowBtn.addEventListener('click', async () => {
  if (OAUTH_CLIENT_ID === 'REPLACE_WITH_YOUR_CLIENT_ID') {
    loginError.textContent = 'OAuth Client ID not configured. Use the PAT fallback below, or set up an OAuth App (see admin.js).';
    return;
  }
  loginError.textContent = '';
  deviceFlowBtn.disabled = true;
  deviceFlowBtn.textContent = '⏳ Requesting…';

  try {
    // Step 1: Request device code
    const dcRes = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: OAUTH_CLIENT_ID,
        scope: 'repo',
      }),
    });
    if (!dcRes.ok) {
      const err = await dcRes.json().catch(() => ({}));
      throw new Error(err.error_description || err.error || 'Device code request failed');
    }
    const dc = await dcRes.json();

    // Show code & instructions
    deviceCode.textContent = dc.user_code;
    deviceFlowUI.hidden = false;
    deviceFlowBtn.textContent = '🔁 Waiting for authorization…';
    deviceFlowError.textContent = '';
    s(true, deviceSpinner);

    // Step 2: Poll for token
    const interval = (dc.interval || 5) * 1000;
    const deadline = Date.now() + (dc.expires_in || 900) * 1000;

    const poll = async () => {
      if (Date.now() > deadline) {
        deviceFlowError.textContent = 'Timed out. Please try again.';
        deviceFlowBtn.disabled = false;
        deviceFlowBtn.textContent = '🔑 Sign in with GitHub';
        s(false, deviceSpinner);
        return;
      }

      try {
        const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: OAUTH_CLIENT_ID,
            device_code: dc.device_code,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          }),
        });

        const tr = await tokenRes.json();

        if (tr.error) {
          if (tr.error === 'authorization_pending') {
            devicePollTimer = setTimeout(poll, interval);
            return;
          }
          if (tr.error === 'slow_down') {
            devicePollTimer = setTimeout(poll, interval + 5000);
            return;
          }
          throw new Error(tr.error_description || tr.error);
        }

        // Got token!
        s(false, deviceSpinner);
        deviceFlowBtn.textContent = '✅ Authorized!';
        const user = await verifyTokenAndCollaborator(tr.access_token);
        completeLogin(tr.access_token, user);
      } catch (e) {
        deviceFlowError.textContent = e.message;
        deviceFlowBtn.disabled = false;
        deviceFlowBtn.textContent = '🔑 Sign in with GitHub';
        s(false, deviceSpinner);
      }
    };

    devicePollTimer = setTimeout(poll, interval);
  } catch (e) {
    deviceFlowError.textContent = e.message;
    deviceFlowBtn.disabled = false;
    deviceFlowBtn.textContent = '🔑 Sign in with GitHub';
    s(false, deviceSpinner);
  }
});

// ═══════════════════════════════════════════════════════════
//  PAT FALLBACK
// ═══════════════════════════════════════════════════════════

toggleToken.addEventListener('click', () => {
  const isPw = tokenInput.type === 'password';
  tokenInput.type = isPw ? 'text' : 'password';
  toggleToken.textContent = isPw ? '🙈' : '👁';
});

patLoginBtn.addEventListener('click', async () => {
  const token = tokenInput.value.trim();
  if (!token) {
    patLoginError.textContent = 'Please enter a personal access token.';
    return;
  }
  patLoginError.textContent = '';
  patLoginBtn.disabled = true;
  s(true, patLoginSpinner);

  try {
    const user = await verifyTokenAndCollaborator(token);
    completeLogin(token, user);
  } catch (e) {
    patLoginError.textContent = e.message;
  } finally {
    patLoginBtn.disabled = false;
    s(false, patLoginSpinner);
  }
});

// ═══════════════════════════════════════════════════════════
//  EDITOR
// ═══════════════════════════════════════════════════════════

async function loadEditor() {
  if (devicePollTimer) clearTimeout(devicePollTimer);
  loginScreen.hidden = true;
  editorScreen.hidden = false;
  userName.textContent = `👤 ${currentUser}`;

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
  s(true, saveSpinner);

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
    saveSuccess.textContent = '✅ Published! Changes will appear on the site within ~60 seconds.';
  } catch (err) {
    saveError.textContent = 'Save failed: ' + err.message;
  } finally {
    saveBtn.disabled = false;
    s(false, saveSpinner);
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
  sessionStorage.removeItem('omalabs_admin_token');
  sessionStorage.removeItem('omalabs_admin_user');
  currentToken = null;
  currentUser = null;
  currentSha = null;
  originalConfig = null;
  if (devicePollTimer) clearTimeout(devicePollTimer);
  loginScreen.hidden = false;
  editorScreen.hidden = true;
  tokenInput.value = '';
  patLoginError.textContent = '';
  deviceFlowError.textContent = '';
  deviceFlowUI.hidden = true;
  deviceFlowBtn.disabled = false;
  deviceFlowBtn.textContent = '🔑 Sign in with GitHub';
});

// ── Auto-restore session ────────────────────────────────────
(async function init() {
  const savedToken = sessionStorage.getItem('omalabs_admin_token');
  const savedUser  = sessionStorage.getItem('omalabs_admin_user');
  if (savedToken && savedUser) {
    try {
      await apiCall(`${API_BASE}/user`, savedToken);
      currentToken = savedToken;
      currentUser  = savedUser;
      await loadEditor();
    } catch {
      sessionStorage.removeItem('omalabs_admin_token');
      sessionStorage.removeItem('omalabs_admin_user');
    }
  }
})();
