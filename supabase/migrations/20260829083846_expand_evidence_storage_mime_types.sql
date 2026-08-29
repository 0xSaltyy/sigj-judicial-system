-- Expand protected evidence Storage MIME types to match the Evidence Manager UI.
-- This is additive and keeps the bucket private.

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'evidence-files',
  'evidence-files',
  false,
  104857600,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg',
    'image/webp',
    'text/plain',
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'audio/mpeg',
    'audio/wav',
    'audio/wave',
    'audio/x-wav',
    'audio/mp4',
    'audio/aac',
    'application/octet-stream'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

notify pgrst, 'reload schema';
