-- Progreso visible de cada clip y más opciones de subtítulos.
alter table clips add column if not exists progress int not null default 0;
alter table clips add column if not exists stage text;

-- Subtítulos: tamaño (s, m, l), posición (auto = evita caras, bottom, middle, top) e idioma (original o en = traducir al inglés).
alter table clips add column if not exists subtitle_size text not null default 'm' check (subtitle_size in ('s','m','l'));
alter table clips add column if not exists subtitle_position text not null default 'auto' check (subtitle_position in ('auto','bottom','middle','top'));
alter table clips add column if not exists subtitle_lang text not null default 'original' check (subtitle_lang in ('original','en'));
alter table auto_jobs add column if not exists subtitle_size text not null default 'm' check (subtitle_size in ('s','m','l'));
alter table auto_jobs add column if not exists subtitle_position text not null default 'auto' check (subtitle_position in ('auto','bottom','middle','top'));
alter table auto_jobs add column if not exists subtitle_lang text not null default 'original' check (subtitle_lang in ('original','en'));
