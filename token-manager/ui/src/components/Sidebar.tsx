import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Key,
  Server,
  Users,
  Webhook,
  ScrollText,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Button, Tooltip } from "@heroui/react";
import { useAuthStore } from "@/store/authStore";
import ThemeToggle from "./ThemeToggle";
import * as api from "@/api/client";

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "operator", "viewer"] },
  { path: "/tokens", label: "Tokens", icon: Key, roles: ["admin", "operator", "viewer"] },
  { path: "/services", label: "Servicios", icon: Server, roles: ["admin", "operator"] },
  { path: "/users", label: "Usuarios", icon: Users, roles: ["admin"] },
  { path: "/webhooks", label: "Webhooks", icon: Webhook, roles: ["admin"] },
  { path: "/audit", label: "Auditoria", icon: ScrollText, roles: ["admin"] },
];

interface Props {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: Props) {
  const location = useLocation();
  const { user, clearAuth, hasRole } = useAuthStore();

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {}
    clearAuth();
  };

  return (
    <aside
      className={`${
        collapsed ? "w-[68px]" : "w-64"
      } min-h-screen bg-content1 border-r border-divider flex flex-col transition-all duration-200`}
    >
      {/* Header */}
      <div className="p-4 border-b border-divider flex items-center justify-between gap-2">
        {!collapsed && (
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-foreground truncate">Auth Toolkit</h1>
            <p className="text-xs text-default-500">Token Manager</p>
          </div>
        )}
        <Button
          isIconOnly
          size="sm"
          variant="light"
          onPress={onToggle}
          className="flex-shrink-0"
          aria-label={collapsed ? "Expandir menu" : "Colapsar menu"}
        >
          {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        </Button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-1">
        {navItems
          .filter((item) => item.roles.some((r) => hasRole(r)))
          .map((item) => {
            const active = location.pathname === item.path;
            const link = (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-default-600 hover:bg-default-100"
                } ${collapsed ? "justify-center" : ""}`}
              >
                <item.icon size={18} className="flex-shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.path} content={item.label} placement="right">
                  {link}
                </Tooltip>
              );
            }
            return link;
          })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-divider space-y-2">
        <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"}`}>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{user?.username}</p>
              <p className="text-xs text-default-400 capitalize">{user?.role}</p>
            </div>
          )}
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Tooltip content="Cerrar sesion" placement={collapsed ? "right" : "top"}>
              <Button
                isIconOnly
                size="sm"
                variant="light"
                onPress={handleLogout}
                className="text-default-400 hover:text-danger"
                aria-label="Cerrar sesion"
              >
                <LogOut size={18} />
              </Button>
            </Tooltip>
          </div>
        </div>
      </div>
    </aside>
  );
}
