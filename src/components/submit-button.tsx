"use client";

import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SubmitButton({ children, pendingLabel = "Guardando…", className, variant = "default", size = "default", name, value }: { children: React.ReactNode; pendingLabel?: string; className?: string; variant?: "default" | "outline" | "destructive" | "ghost"; size?: "default" | "sm" | "lg" | "icon"; name?: string; value?: string; }) {
  const { pending } = useFormStatus();
  return <Button type="submit" name={name} value={value} variant={variant} size={size} disabled={pending} className={className}>{pending && <LoaderCircle className="size-4 animate-spin" />}{pending ? pendingLabel : children}</Button>;
}
