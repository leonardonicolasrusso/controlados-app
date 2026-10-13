-- Buscador de Controles - RUSSO Electrónica
-- Pegar todo este archivo en Supabase > SQL Editor > New query > Run.

-- Modelos de TV / aire y el control que usa cada uno (hoja MODELOS del Excel).
create table if not exists modelos (
  id bigint generated always as identity primary key,
  marca text not null,
  modelo text not null,
  control integer not null
);

-- Reemplazos de cada control (hoja REEMPLAZOS). Van en un solo sentido:
-- "control 500 -> reemplazos 522-553" NO significa que el 522 se reemplace por el 500.
create table if not exists reemplazos (
  id bigint generated always as identity primary key,
  control integer not null unique,
  reemplazos text not null  -- ej: "522-553"
);

-- Clientes que pueden entrar (hoja USUARIOS). Entran solo con el DNI.
create table if not exists usuarios (
  dni text primary key,           -- solo números, sin puntos
  nombre text not null,
  activo boolean not null default true,  -- poner en false para cortar el acceso
  session_hash text,              -- lo maneja la app: sesión activa (el último login gana)
  ultimo_login timestamptz
);

-- Registro de búsquedas, para saber qué buscan los clientes y qué modelos faltan.
create table if not exists busquedas (
  id bigint generated always as identity primary key,
  dni text,
  texto text not null,
  encontrados integer not null,
  fecha timestamptz not null default now()
);

create index if not exists usuarios_session_hash_idx on usuarios (session_hash);
create index if not exists busquedas_fecha_idx on busquedas (fecha desc);

-- Seguridad: activamos RLS SIN políticas. Así nadie puede leer ni escribir estas tablas
-- con la clave pública (anon). Solo la app, desde el servidor, con la service role key.
alter table modelos enable row level security;
alter table reemplazos enable row level security;
alter table usuarios enable row level security;
alter table busquedas enable row level security;

-- Vista útil: modelos que buscaron los clientes y no encontraron.
create or replace view busquedas_sin_resultado
with (security_invoker = true) as
select upper(texto) as texto, count(*) as veces, max(fecha) as ultima_vez
from busquedas
where encontrados = 0
group by upper(texto)
order by veces desc, ultima_vez desc;

-- Datos de ejemplo (los del Excel BASE). Se pueden borrar al importar el catálogo real.
insert into modelos (marca, modelo, control) values
  ('NOBLEX', 'EA50X6100', 500),
  ('LG', '32LF565B', 477),
  ('NOBLEX', 'LT32DR530', 446),
  ('SAMSUNG', 'UN43J5320', 520);

insert into reemplazos (control, reemplazos) values
  (500, '522-553'),
  (446, '452'),
  (520, '589'),
  (477, '525')
on conflict (control) do nothing;
