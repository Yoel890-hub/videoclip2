-- Encuadre del recorte vertical/cuadrado: auto (sigue las caras), left, center o right.
alter table clips add column if not exists framing text not null default 'center' check (framing in ('auto','left','center','right'));
alter table auto_jobs add column if not exists framing text not null default 'auto' check (framing in ('auto','left','center','right'));
