import { AdminSidebar, AdminTopbar } from "@/components/admin-sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#f5f7f9]"><AdminSidebar /><div className="lg:pl-64"><AdminTopbar /><main className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">{children}</main></div></div>;
}
