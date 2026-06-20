"use client";

import { useRef, useState } from "react";
import { Bold, Heading2, Italic, List, ListOrdered, Pilcrow, SeparatorHorizontal } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type PlaceholderContext, renderDocumentPlaceholders } from "@/lib/document-templates";
import { cn } from "@/lib/utils";

export function MarkdownEditor({
  initialValue,
  name = "content_markdown",
  previewContext,
}: {
  initialValue: string;
  name?: string;
  previewContext?: PlaceholderContext;
}) {
  const [value, setValue] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function insert(before: string, after = "", fallback = "texto") {
    const field = textareaRef.current;
    if (!field) return;
    const start = field.selectionStart;
    const end = field.selectionEnd;
    const selected = value.slice(start, end) || fallback;
    const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
    setValue(next);
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(start + before.length, start + before.length + selected.length);
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  function prefixLines(prefix: string) {
    const field = textareaRef.current;
    if (!field) return;
    const start = field.selectionStart;
    const end = field.selectionEnd;
    const selected = value.slice(start, end) || "Elemento";
    const nextBlock = selected
      .split("\n")
      .map((line, index) => `${prefix === "1. " ? `${index + 1}. ` : prefix}${line}`)
      .join("\n");
    setValue(`${value.slice(0, start)}${nextBlock}${value.slice(end)}`);
    requestAnimationFrame(() => field.dispatchEvent(new Event("input", { bubbles: true })));
  }

  const preview = previewContext ? renderDocumentPlaceholders(value, previewContext) : value;
  return (
    <Tabs defaultValue="editor">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="editor">Editor</TabsTrigger>
          <TabsTrigger value="preview">Vista previa formal</TabsTrigger>
        </TabsList>
        <div className="flex flex-wrap gap-1" aria-label="Formato del documento">
          <FormatButton label="Negrita" onClick={() => insert("**", "**")}><Bold /></FormatButton>
          <FormatButton label="Cursiva" onClick={() => insert("*", "*")}><Italic /></FormatButton>
          <FormatButton label="Encabezado" onClick={() => insert("## ", "", "SECCIÓN")}><Heading2 /></FormatButton>
          <FormatButton label="Lista" onClick={() => prefixLines("- ")}><List /></FormatButton>
          <FormatButton label="Lista numerada" onClick={() => prefixLines("1. ")}><ListOrdered /></FormatButton>
          <FormatButton label="Párrafo resolutivo" onClick={() => insert("**PRIMERO.** ", "", "Redacte la decisión.")}><Pilcrow /></FormatButton>
          <FormatButton label="Salto de página" onClick={() => insert("\n\n---\n\n", "", "")}><SeparatorHorizontal /></FormatButton>
        </div>
      </div>
      <TabsContent value="editor">
        <Textarea
          ref={textareaRef}
          name={name}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="min-h-[520px] font-mono text-sm leading-6"
        />
        <p className="mt-2 text-xs text-muted-foreground">
          La negrita, cursiva, listas, títulos y saltos de página se conservan al imprimir.
        </p>
      </TabsContent>
      <TabsContent value="preview"><MarkdownViewer content={preview} variant="document" /></TabsContent>
    </Tabs>
  );
}

function FormatButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button type="button" size="icon" variant="outline" title={label} aria-label={label} onClick={onClick} className="size-8 [&_svg]:size-4">
      {children}
    </Button>
  );
}

export function MarkdownViewer({
  content,
  variant = "editor",
}: {
  content: string;
  variant?: "editor" | "document" | "compact";
}) {
  return (
    <article
      className={cn(
        "prose prose-slate max-w-none text-sm leading-7 [&_h1]:font-bold [&_h2]:font-bold [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-7 [&_ul]:list-disc [&_ul]:pl-7 [&_strong]:font-bold",
        variant === "editor" && "min-h-[420px] rounded-md border bg-white p-7 [&_h1]:text-2xl [&_h2]:mt-6 [&_h2]:text-lg [&_p]:my-3",
        variant === "document" && "judicial-rich-text min-h-0 bg-transparent p-0 [&_h1]:text-center [&_h1]:text-lg [&_h2]:mt-8 [&_h2]:text-center [&_h2]:text-base [&_h3]:mt-6 [&_p]:my-4",
        variant === "compact" && "min-h-0 border-0 bg-transparent p-0 [&_h2]:mt-4 [&_p]:my-2",
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          hr: () => <div className="page-break-before" aria-label="Salto de página" />,
        }}
      >
        {content.replace(/\\n/g, "\n")}
      </ReactMarkdown>
    </article>
  );
}
