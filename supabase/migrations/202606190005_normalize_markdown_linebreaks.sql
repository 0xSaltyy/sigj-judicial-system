-- Las cadenas semilla antiguas almacenaban "\n" de forma literal.
-- Se normalizan a saltos reales para edición, vista previa e impresión.
update public.proceedings
set content_markdown = replace(content_markdown, E'\\n', E'\n')
where position(E'\\n' in content_markdown) > 0;

update public.public_notices
set content_markdown = replace(content_markdown, E'\\n', E'\n')
where position(E'\\n' in content_markdown) > 0;
