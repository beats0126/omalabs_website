/* OMA Labs — Admin Panel Logic
   Auth via GitHub Personal Access Token
   Verifies repo collaborator status, then allows
   editing config.json with commits via GitHub API.
   ============================================================ */

// ── Config ──────────────────────────────────────────────────
const REPO_OWNER = 'beats0126';
const REPO_NAME  = 'omalabs_website';
const CONFIG_PATH = 'config.json';
const API_BASE    = 'https://api.github.com';
const STORAGE_KEY  = 'omalabs_admin';

// ── DOM refs ────────────────────────────────────────────────
const loginScreen  = document.getElementById('loginScreen');
const editorScreen = document.getElementById('editorScreen');
const loginBtn     = document.getElementById('loginBtn');
const loginError   = document.getElementById('loginError');
const loginSpinner = document.getElementById('loginSpinner');
const tokenInput   = document.getElementById('tokenInput');
const toggleToken  = document.getElementById('toggleToken');
const rememberCheck = document.getElementById('rememberCheck');

// Editor
const logoutBtn    = document.getElementById('logoutBtn');
const userName     = document.getElementById('userName');
const editorForm   = document.getElementById('editorForm');
const saveBtn      = document.getElementById('saveBtn');
const resetBtn     = document.getElementById('resetBtn');
const saveError    = document.getElementById('saveError');
const saveSuccess  = document.getElementById('saveSuccess');
const saveSpinner  = document.getElementById('saveSpinner');

// ── State ───────────────────────────────────────────────────
let currentToken   = null;
let currentUser    = null;
let currentSha     = null;
let originalConfig = null;

// ── Storage helpers ─────────────────────────────────────────
function saveToken(token, user) {
  const data = JSON.stringify({ token, user, ts: Date.now() });
  if (rememberCheck.checked) {
    localStorage.setItem(STORAGE_KEY, data);
  }
  sessionStorage.setItem(STORAGE_KEY, data);
}

function loadSavedToken() {
  // Try session first, then localStorage
  const raw = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (Date.now() - data.ts > 30 * 24 * 60 * 60 * 1000) { // 30-day expiry for localStorage
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_KEY);
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
function show(spinner) { spinner.hidden = false; }
function hide(spinner) { spinner.hidden = true; }

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

// ── Login ───────────────────────────────────────────────────
loginBtn.addEventListener('click', async () => {
  const token = tokenInput.value.trim();
  if (!token) {
    loginError.textContent = 'Please enter a personal access token.';
    return;
  }
  loginError.textContent = '';
  loginBtn.disabled = true;
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
    loginBtn.disabled = false;
    hide(loginSpinner);
  }
});

// ── Toggle visibility ───────────────────────────────────────
toggleToken.addEventListener('click', () => {
  const isPw = tokenInput.type === 'password';
  tokenInput.type = isPw ? 'text' : 'password';
  toggleToken.textContent = isPw ? '🙈' : '👁';
});

// ── Load editor ─────────────────────────────────────────────
async function loadEditor() {
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

// ── Auto-restore session ────────────────────────────────────
(async function init() {
  const saved = loadSavedToken();
  if (saved && saved.token && saved.user) {
    try {
      await apiCall(`${API_BASE}/user`, saved.token);
      currentToken = saved.token;
      currentUser  = saved.user;
      // Refresh storage timestamps
      saveToken(saved.token, saved.user);
      await loadEditor();
    } catch {
      clearSavedToken();
    }
  }
})();
