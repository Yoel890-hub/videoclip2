-- Estilo de los subtítulos (ids de worker/captions.mjs y src/lib/captionStyles.ts).
alter table clips add column if not exists subtitle_style text not null default 'clasico';
alter table auto_jobs add column if not exists subtitle_style text not null default 'clasico';
