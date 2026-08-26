"use client";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function MarkdownEditor({ initialValue, name = "content_markdown" }: { initialValue: string; name?: string }) {
  const [value, setValue] = useState(initialValue);
  return <Tabs defaultValue="editor"><TabsList><TabsTrigger value="editor">Editor</TabsTrigger><TabsTrigger value="preview">Vista previa</TabsTrigger></TabsList><TabsContent value="editor"><Textarea name={name} value={value} onChange={(e) => setValue(e.target.value)} className="min-h-[420px] font-mono text-sm leading-6" /></TabsContent><TabsContent value="preview"><MarkdownViewer content={value} /></TabsContent></Tabs>;
}
export function MarkdownViewer({ content }: { content: string }) { return <article className="prose prose-slate min-h-[420px] max-w-none rounded-md border bg-white p-7 text-sm leading-7 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:my-3"><ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown></article>; }
