"use client";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton({ label = "Imprimir" }: { label?: string }) { return <Button variant="outline" onClick={() => window.print()} className="no-print gap-2"><Printer className="size-4" />{label}</Button>; }
