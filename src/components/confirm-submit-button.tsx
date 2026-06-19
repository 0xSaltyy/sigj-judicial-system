"use client";

import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ConfirmSubmitButton({ children, message, variant = "outline", className }: { children: React.ReactNode; message: string; variant?: "outline" | "destructive"; className?: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" variant={variant} disabled={pending} className={className} onClick={(event) => { if (!window.confirm(message)) event.preventDefault(); }}>{pending && <LoaderCircle className="size-4 animate-spin" />}{children}</Button>;
}
