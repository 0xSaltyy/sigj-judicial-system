"use client";

import { manageUserAccount } from "@/app/actions/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function UserAccountActions({ id, active, protectedOwner }: { id: string; active: boolean; protectedOwner: boolean }) {
  return (
    <div className="grid min-w-64 gap-2">
      <form action={manageUserAccount} onSubmit={(event) => { if (!window.confirm(active ? "¿Suspender esta cuenta y bloquear su acceso?" : "¿Reactivar esta cuenta?")) event.preventDefault(); }}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="action" value={active ? "suspend" : "reactivate"} />
        <input type="hidden" name="reason" value="Cambio de estado desde panel de usuarios" />
        <Button type="submit" size="sm" variant="outline" disabled={protectedOwner && active} className={active ? "rounded-none border-red-200 text-red-800 hover:bg-red-50" : "rounded-none border-emerald-200 text-emerald-800 hover:bg-emerald-50"}>
          {active ? "Suspender" : "Reactivar"}
        </Button>
      </form>
      <form action={manageUserAccount} className="grid gap-2 rounded border bg-slate-50 p-2" onSubmit={(event) => { if (!window.confirm("¿Restablecer la contraseña y exigir cambio en el próximo inicio?")) event.preventDefault(); }}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="action" value="password_reset" />
        <Input name="temporary_password" type="password" minLength={12} required placeholder="Nueva contraseña temporal" className="h-8 rounded-none text-xs" />
        <Input name="reason" placeholder="Motivo administrativo" className="h-8 rounded-none text-xs" />
        <Button type="submit" size="sm" variant="outline" disabled={protectedOwner} className="rounded-none">Restablecer manualmente</Button>
      </form>
    </div>
  );
}
