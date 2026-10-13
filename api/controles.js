import { detalleControl, listarControles } from '../lib/catalogo.js';
import { obtenerCatalogo } from '../lib/db.js';
import { manejar, parametros, requerirUsuario, responder } from '../lib/http.js';

// /api/controles          -> lista de todos los controles
// /api/controles?n=500    -> detalle del control 500 (modelos que lo usan y reemplazos)
export default manejar(async (req, res) => {
  const usuario = await requerirUsuario(req, res);
  if (!usuario) return;

  const catalogo = await obtenerCatalogo();
  const n = parametros(req).get('n');
  if (n === null) return responder(res, 200, { controles: listarControles(catalogo) });

  const detalle = detalleControl(catalogo, Number(n));
  if (!detalle) return responder(res, 404, { error: 'control_no_encontrado' });
  responder(res, 200, detalle);
});
