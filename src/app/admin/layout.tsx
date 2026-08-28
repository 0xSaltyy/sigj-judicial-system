import { AdminSidebar, AdminTopbar } from "@/components/admin-sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#f3f1ec]"><AdminSidebar /><div className="lg:pl-[238px]"><AdminTopbar /><main className="mx-auto max-w-[1440px] p-4 sm:p-6 lg:p-7">{children}</main></div></div>;
}
