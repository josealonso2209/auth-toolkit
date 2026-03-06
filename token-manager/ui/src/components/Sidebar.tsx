import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Key,
  Server,
  Users,
  Webhook,
  ScrollText,
  LogOut,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import * as api from "@/api/client";

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "operator", "viewer"] },
  { path: "/tokens", label: "Tokens", icon: Key, roles: ["admin", "operator", "viewer"] },
  { path: "/services", label: "Servicios", icon: Server, roles: ["admin", "operator"] },
  { path: "/users", label: "Usuarios", icon: Users, roles: ["admin"] },
  { path: "/webhooks", label: "Webhooks", icon: Webhook, roles: ["admin"] },
  { path: "/audit", label: "Auditoria", icon: ScrollText, roles: ["admin"] },
];

export default function Sidebar() {
  const location = useLocation();
  const { user, clearAuth, hasRole } = useAuthStore();

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {}
    clearAuth();
  };

  return (
    <aside className="w-64 min-h-screen bg-content1 border-r border-divider flex flex-col">
      <div className="p-6 border-b border-divider">
        <h1 className="text-xl font-bold text-foreground">Auth Toolkit</h1>
        <p className="text-sm text-default-500 mt-1">Token Manager</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems
          .filter((item) => item.roles.some((r) => hasRole(r)))
          .map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-default-600 hover:bg-default-100"
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            );
          })}
      </nav>

      <div className="p-4 border-t border-divider">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-medium">{user?.username}</p>
            <p className="text-xs text-default-400 capitalize">{user?.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg text-default-400 hover:text-danger hover:bg-danger-50 transition-colors"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}
