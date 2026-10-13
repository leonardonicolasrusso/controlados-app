import { manejar, requerirUsuario, responder } from '../lib/http.js';

// Lo usa la app para saber si la sesión sigue activa y mostrar el nombre del cliente.
export default manejar(async (req, res) => {
  const usuario = await requerirUsuario(req, res);
  if (!usuario) return;
  responder(res, 200, { nombre: usuario.nombre });
});
