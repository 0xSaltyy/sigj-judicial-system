"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
export function CopyTextButton({text,label="Copiar"}:{text:string;label?:string}){const [copied,setCopied]=useState(false);async function copy(){await navigator.clipboard.writeText(text);setCopied(true);window.setTimeout(()=>setCopied(false),1800);}return <Button type="button" size="sm" variant="outline" onClick={copy}>{copied?<Check className="size-4"/>:<Copy className="size-4"/>}{copied?"Copiado":label}</Button>}
