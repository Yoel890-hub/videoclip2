-- Opción de subtítulos automáticos (Whisper) quemados en el vídeo.
alter table clips add column if not exists subtitles boolean not null default false;
alter table auto_jobs add column if not exists subtitles boolean not null default false;
