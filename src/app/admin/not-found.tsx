import { AccessDenied } from "@/components/access-denied";

export default function AdminNotFound() {
  return <AccessDenied title="Registro no disponible" message="El registro no existe o su perfil no tiene acceso por institución, dependencia o nivel de reserva. Su sesión permanece activa." />;
}
