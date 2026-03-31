document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('loginBtn')?.addEventListener('click', doLogin);
  document.getElementById('togglePassBtn')?.addEventListener('click', togglePass);
  document.getElementById('username')?.addEventListener('keydown', onEnter);
  document.getElementById('password')?.addEventListener('keydown', onEnter);
});

(async () => {
  const token = sessionStorage.getItem('bielsa_token');
  if (!token) return;

  try {
    const response = await fetch('/api/auth/check', { headers: { Authorization: 'Bearer ' + token } });
    if (response.ok) {
      window.location.href = '/admin';
    }
  } catch {
    // Si falla la comprobación, dejamos que continúe el login manual.
  }
})();

async function doLogin() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const button = document.getElementById('loginBtn');
  const errorMessage = document.getElementById('errorMsg');

  if (!username || !password) {
    showError('Introduce usuario y contraseña.');
    return;
  }

  button.disabled = true;
  button.classList.add('loading');
  errorMessage.classList.remove('show');

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();
    if (response.ok && data.token) {
      sessionStorage.setItem('bielsa_token', data.token);
      window.location.href = '/admin';
      return;
    }

    showError(data.error || 'Credenciales incorrectas.');
  } catch {
    showError('No se pudo conectar con el servidor.');
  } finally {
    button.disabled = false;
    button.classList.remove('loading');
  }
}

function showError(message) {
  const card = document.getElementById('loginCard');
  document.getElementById('errorText').textContent = message;
  document.getElementById('errorMsg').classList.add('show');
  document.getElementById('password').classList.add('error');
  card.classList.remove('shake');
  void card.offsetWidth;
  card.classList.add('shake');
  setTimeout(() => document.getElementById('password').classList.remove('error'), 2000);
}

function togglePass() {
  const input = document.getElementById('password');
  input.type = input.type === 'password' ? 'text' : 'password';
}

function onEnter(event) {
  if (event.key === 'Enter') {
    doLogin();
  }
}
