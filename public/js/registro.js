document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('regBtn').addEventListener('click', doRegister);
  // Enter en cualquier input del formulario
  document.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') doRegister(); });
  });
});

async function doRegister() {
  const nombre = document.getElementById('nombre').value.trim();
  const email  = document.getElementById('email').value.trim();
  const pass   = document.getElementById('pass').value;
  const pass2  = document.getElementById('pass2').value;

  document.getElementById('errMsg').classList.remove('show');
  document.getElementById('pass2').classList.remove('err');

  if (!nombre || !email || !pass) { showErr('Nombre, email y contraseÃ±a son obligatorios.'); return; }
  if (pass.length < 6)            { showErr('La contraseÃ±a debe tener al menos 6 caracteres.'); return; }
  if (pass !== pass2)             { showErr('Las contraseÃ±as no coinciden.'); document.getElementById('pass2').classList.add('err'); return; }

  const btn = document.getElementById('regBtn');
  btn.disabled    = true;
  btn.textContent = 'Registrando...';

  try {
    const r = await fetch('/api/cliente/registro', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre,
        email,
        password:  pass,
        empresa:   document.getElementById('empresa').value.trim(),
        cif:       document.getElementById('cif').value.trim(),
        telefono:  document.getElementById('tel').value.trim()
      })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Error al registrarse');

    // Guardar token y redirigir al portal
    sessionStorage.setItem('bielsa_client_token', d.token);
    document.getElementById('formWrap').style.display = 'none';
    document.getElementById('successMsg').classList.add('show');
    setTimeout(() => window.location.href = '/portal', 2000);

  } catch (e) {
    showErr(e.message);
    btn.disabled    = false;
    btn.textContent = 'Crear cuenta â†’';
  }
}

function showErr(msg) {
  const el = document.getElementById('errMsg');
  el.textContent = msg;
  el.classList.add('show');
}
