// App del cliente: una sola página con pantallas por "#" en la URL.
//   #inicio · #buscar · #catalogo · #reemplazos · #control/500

const vista = document.getElementById('vista');

// ---------- Utilidades ----------

// Crea elementos sin usar innerHTML (así ningún dato puede romper la página).
function h(tag, attrs = {}, ...hijos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const hijo of hijos.flat()) {
    if (hijo == null || hijo === false) continue;
    el.append(hijo instanceof Node ? hijo : String(hijo));
  }
  return el;
}

function mostrar(...elementos) {
  vista.replaceChildren(...elementos);
  window.scrollTo(0, 0);
}

async function api(ruta) {
  const res = await fetch(ruta);
  if (res.status === 401) {
    const { error } = await res.json().catch(() => ({}));
    location.replace(error === 'otra_sesion' ? '/?motivo=otra-sesion' : '/');
    throw new Error('sin sesión');
  }
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

// Se pide cada vez (no se guarda): así cada pantalla confirma que la sesión sigue activa.
async function obtenerControles() {
  return (await api('/api/controles')).controles;
}

const volver = () => h('a', { class: 'volver', href: '#inicio' }, '← Volver al inicio');
const linkControl = (c) => h('a', { class: 'chip', href: `#control/${c.numero}` }, c.nombre);
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

function lineaReemplazos(control) {
  return h('p', { class: 'reemplazos-linea' },
    h('span', { class: 'etiqueta' }, 'Reemplazos: '),
    control.reemplazos.length ? control.reemplazos.map(linkControl) : 'no tiene cargados',
  );
}

function errorCarga() {
  return h('p', { class: 'vacio' }, 'No pudimos cargar los datos. Revisá tu conexión y volvé a intentar.');
}

// ---------- Pantallas ----------

function pantallaInicio() {
  const tarjeta = (href, icono, titulo, texto) =>
    h('a', { class: 'tarjeta-menu', href },
      h('span', { class: 'icono', 'aria-hidden': 'true' }, icono),
      h('strong', {}, titulo),
      h('span', {}, texto),
    );

  mostrar(
    h('h1', {}, '¿Qué necesitás buscar?'),
    h('div', { class: 'tarjetas' },
      tarjeta('#buscar', '🔍', 'Buscar por modelo', 'Escribí el modelo de la TV o del aire y te decimos qué control lleva.'),
      tarjeta('#catalogo', '📋', 'Ver catálogo', 'Todos los controles LCD/LED/Smart y de aire acondicionado.'),
      tarjeta('#reemplazos', '🔁', 'Reemplazos', 'Elegí un control y mirá con cuáles se puede reemplazar.'),
    ),
  );
}

function pantallaBuscar() {
  const input = h('input', {
    class: 'campo', type: 'search', id: 'buscador', autocomplete: 'off', autocapitalize: 'characters',
    spellcheck: 'false', placeholder: 'Ej: ea50x6100', 'aria-label': 'Modelo de TV o aire',
  });
  const resultados = h('div', { class: 'resultados', 'aria-live': 'polite' });

  let temporizador = null;
  let temporizadorRegistro = null;
  let ultimaConsulta = 0;

  async function buscar(registrar) {
    const texto = input.value.trim();
    if (texto.replace(/[^a-z0-9]/gi, '').length < 3) {
      resultados.replaceChildren(texto ? h('p', { class: 'nota' }, 'Seguí escribiendo… (mínimo 3 letras o números)') : '');
      return;
    }
    const consulta = ++ultimaConsulta;
    try {
      const datos = await api(`/api/buscar?q=${encodeURIComponent(texto)}${registrar ? '&registrar=1' : ''}`);
      if (consulta !== ultimaConsulta) return; // llegó tarde una búsqueda vieja
      pintarResultados(datos.resultados, texto);
    } catch {
      if (consulta === ultimaConsulta) resultados.replaceChildren(errorCarga());
    }
  }

  function pintarResultados(lista, texto) {
    if (!lista.length) {
      resultados.replaceChildren(
        h('div', { class: 'vacio' },
          h('p', {}, `No encontramos el modelo "${texto}".`),
          h('p', {}, 'Probá escribiendo solo una parte (por ejemplo "', texto.slice(0, 6), '"), o consultanos por ',
            h('a', { href: `https://wa.me/543415851441?text=${encodeURIComponent(`Hola! Busco el control para el modelo ${texto}`)}` }, 'WhatsApp'),
            '.'),
        ),
      );
      return;
    }
    resultados.replaceChildren(
      ...lista.map((r) =>
        h('article', { class: 'resultado' },
          h('p', { class: 'titulo' }, 'Control equivalente para ', h('b', {}, `${r.marca} ${r.modelo}`)),
          h('a', { class: 'control-grande', href: `#control/${r.control.numero}` }, r.control.nombre),
          lineaReemplazos(r.control),
        ),
      ),
    );
  }

  input.addEventListener('input', () => {
    clearTimeout(temporizador);
    clearTimeout(temporizadorRegistro);
    temporizador = setTimeout(() => buscar(false), 350);
    // Si deja de escribir 2 segundos, guardamos la búsqueda (para estadísticas).
    temporizadorRegistro = setTimeout(() => buscar(true), 2000);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      clearTimeout(temporizador);
      clearTimeout(temporizadorRegistro);
      buscar(true);
      input.blur(); // cierra el teclado del celular
    }
  });

  mostrar(
    volver(),
    h('h1', {}, 'Buscar por modelo'),
    h('p', { class: 'nota' }, 'Escribí solo el modelo, no hace falta la marca. Da igual mayúsculas, espacios o guiones.'),
    input,
    resultados,
  );
  input.focus();
}

async function pantallaCatalogo() {
  mostrar(volver(), h('h1', {}, 'Catálogo de controles'), h('p', { class: 'cargando' }, 'Cargando…'));
  let controles;
  try {
    controles = await obtenerControles();
  } catch {
    return mostrar(volver(), h('h1', {}, 'Catálogo de controles'), errorCarga());
  }

  let tipo = sessionStorage.getItem('catalogoTipo') === 'AR' ? 'AR' : 'LCD';
  const grilla = h('div', { class: 'grilla' });
  const filtro = h('input', {
    class: 'campo', type: 'search', inputmode: 'numeric', placeholder: 'Filtrar por número, ej: 500',
    'aria-label': 'Filtrar por número de control',
  });
  const pestana = (valor, texto) =>
    h('button', { type: 'button', role: 'tab', 'aria-selected': String(valor === tipo), onclick: () => elegir(valor) }, texto);
  const pestanas = h('div', { class: 'pestanas', role: 'tablist' },
    pestana('LCD', 'TV LCD / LED / Smart'),
    pestana('AR', 'Aire acondicionado'),
  );

  function elegir(valor) {
    tipo = valor;
    try { sessionStorage.setItem('catalogoTipo', valor); } catch { /* sin almacenamiento */ }
    [...pestanas.children].forEach((b, i) => b.setAttribute('aria-selected', String((i === 0 ? 'LCD' : 'AR') === tipo)));
    pintar();
  }

  function pintar() {
    const f = filtro.value.replace(/\D/g, '');
    const lista = controles.filter((c) => c.tipo === tipo && String(c.numero).includes(f));
    grilla.replaceChildren(
      ...(lista.length
        ? lista.map((c) =>
            h('a', { class: 'control-boton', href: `#control/${c.numero}` },
              h('strong', {}, c.nombre),
              h('span', {}, plural(c.cantidadModelos, 'modelo', 'modelos')),
            ))
        : [h('p', { class: 'vacio' }, 'No hay controles para mostrar.')]),
    );
  }

  filtro.addEventListener('input', pintar);
  mostrar(volver(), h('h1', {}, 'Catálogo de controles'), pestanas, filtro, grilla);
  pintar();
}

async function pantallaReemplazos() {
  mostrar(volver(), h('h1', {}, 'Reemplazos'), h('p', { class: 'cargando' }, 'Cargando…'));
  let controles;
  try {
    controles = (await obtenerControles()).filter((c) => c.reemplazos.length);
  } catch {
    return mostrar(volver(), h('h1', {}, 'Reemplazos'), errorCarga());
  }

  const lista = h('div', { class: 'lista-reemplazos' });
  const filtro = h('input', {
    class: 'campo', type: 'search', inputmode: 'numeric', placeholder: 'Buscar control, ej: 500',
    'aria-label': 'Buscar control por número',
  });

  function pintar() {
    const f = filtro.value.replace(/\D/g, '');
    const visibles = controles.filter((c) => String(c.numero).includes(f));
    lista.replaceChildren(
      ...(visibles.length
        ? visibles.map((c) =>
            h('details', {},
              h('summary', {}, c.nombre),
              h('div', { class: 'cuerpo' },
                h('p', { class: 'nota' }, `El ${c.nombre} se puede reemplazar por:`),
                h('p', {}, c.reemplazos.map(linkControl)),
                h('a', { href: `#control/${c.numero}` }, `Ver modelos que usan el ${c.nombre}`),
              ),
            ))
        : [h('p', { class: 'vacio' }, 'No hay controles con reemplazos para ese número.')]),
    );
  }

  filtro.addEventListener('input', pintar);
  mostrar(
    volver(),
    h('h1', {}, 'Reemplazos'),
    h('p', { class: 'nota' }, 'Tocá un control para ver con cuáles se puede reemplazar.'),
    filtro,
    lista,
  );
  pintar();
}

async function pantallaControl(numero) {
  mostrar(volver(), h('p', { class: 'cargando' }, 'Cargando…'));
  let c;
  try {
    c = await api(`/api/controles?n=${encodeURIComponent(numero)}`);
  } catch {
    return mostrar(volver(), h('p', { class: 'vacio' }, `No encontramos el control ${numero}.`));
  }

  const porMarca = h('table', { class: 'tabla-modelos' },
    h('thead', {}, h('tr', {}, h('th', {}, 'Marca'), h('th', {}, 'Modelo'))),
    h('tbody', {}, c.modelos.map((m) => h('tr', {}, h('td', {}, m.marca), h('td', {}, m.modelo)))),
  );

  mostrar(
    volver(),
    h('h1', {}, c.nombre),
    h('article', { class: 'resultado' }, lineaReemplazos(c)),
    h('h2', {}, `Modelos que usan el ${c.nombre} (${c.modelos.length})`),
    c.modelos.length ? porMarca : h('p', { class: 'vacio' }, 'Todavía no hay modelos cargados para este control.'),
  );
}

// ---------- Navegación ----------

function navegar() {
  const [ruta, param] = location.hash.replace(/^#/, '').split('/');
  switch (ruta) {
    case 'buscar': return pantallaBuscar();
    case 'catalogo': return pantallaCatalogo();
    case 'reemplazos': return pantallaReemplazos();
    case 'control': return pantallaControl(param);
    default: return pantallaInicio();
  }
}

document.getElementById('botonSalir').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' }).catch(() => {});
  location.replace('/?motivo=salir');
});

// Si la cuenta se abre en otro dispositivo, avisamos apenas el cliente vuelve a esta pestaña.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') api('/api/yo').catch(() => {});
});

(async () => {
  const yo = await api('/api/yo');
  document.getElementById('usuario').textContent = `Hola, ${yo.nombre}`;
  window.addEventListener('hashchange', navegar);
  navegar();
})().catch(() => {});
