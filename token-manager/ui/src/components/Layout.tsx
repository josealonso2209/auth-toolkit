import { useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { Button } from "@heroui/react";
import { Menu } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { ToastContainer } from "./Toast";
import Sidebar from "./Sidebar";

export default function Layout() {
  const { user } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar - desktop */}
      <div className="hidden lg:block">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      </div>

      {/* Sidebar - mobile drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 lg:hidden transform transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar collapsed={false} onToggle={() => setMobileOpen(false)} />
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center gap-3 p-4 border-b border-border bg-surface">
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            onPress={() => setMobileOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </Button>
          <h1 className="text-lg font-bold">Auth Toolkit</h1>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>

      <ToastContainer />
    </div>
  );
}
