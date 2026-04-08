import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Tokens from "@/pages/Tokens";
import Gateway from "@/pages/Gateway";
import CICD from "@/pages/CICD";
import Services from "@/pages/Services";
import Users from "@/pages/Users";
import Webhooks from "@/pages/Webhooks";
import AuditLog from "@/pages/AuditLog";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tokens" element={<Tokens />} />
          <Route path="/gateway" element={<Gateway />} />
          <Route path="/cicd" element={<CICD />} />
          <Route path="/services" element={<Services />} />
          <Route path="/users" element={<Users />} />
          <Route path="/webhooks" element={<Webhooks />} />
          <Route path="/audit" element={<AuditLog />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
