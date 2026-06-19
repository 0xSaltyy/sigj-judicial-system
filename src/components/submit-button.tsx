"use client";

import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SubmitButton({ children, pendingLabel = "Guardando…", className, variant = "default" }: { children: React.ReactNode; pendingLabel?: string; className?: string; variant?: "default" | "outline" | "destructive" | "ghost"; }) {
  const { pending } = useFormStatus();
  return <Button type="submit" variant={variant} disabled={pending} className={className}>{pending && <LoaderCircle className="size-4 animate-spin" />}{pending ? pendingLabel : children}</Button>;
}
