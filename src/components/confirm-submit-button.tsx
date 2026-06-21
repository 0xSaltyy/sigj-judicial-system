"use client";

import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ConfirmSubmitButton({ children, message, variant = "outline", className, disabled = false, name, value }: { children: React.ReactNode; message: string; variant?: "outline" | "destructive"; className?: string; disabled?: boolean; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" name={name} value={value} variant={variant} disabled={pending || disabled} className={className} onClick={(event) => { if (!window.confirm(message)) event.preventDefault(); }}>{pending && <LoaderCircle className="size-4 animate-spin" />}{children}</Button>;
}
