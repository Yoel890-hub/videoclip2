-- Progreso visible de las búsquedas de momentos destacados (descargar y analizar vídeos largos puede tardar).
alter table auto_jobs add column if not exists progress int not null default 0;
alter table auto_jobs add column if not exists stage text;
