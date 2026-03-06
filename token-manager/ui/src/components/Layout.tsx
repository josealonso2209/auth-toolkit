import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import Sidebar from "./Sidebar";

export default function Layout() {
  const { user } = useAuthStore();

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
