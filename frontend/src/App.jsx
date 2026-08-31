import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import Login from "./pages/Login";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Clients from "./pages/Clients";
import MyWork from "./pages/MyWork";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import { ToastProvider } from "./components/Toast";


/*
|--------------------------------------------------------------------------
| Authentication guard
|--------------------------------------------------------------------------
*/

function RequireAuth({ children }) {
  const token = sessionStorage.getItem("token");
  const user = JSON.parse(
    sessionStorage.getItem("user") || "null"
  );

  if (!token || !user) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  return children;
}


/*
|--------------------------------------------------------------------------
| Admin guard
|--------------------------------------------------------------------------
*/

function RequireAdmin({ children }) {
  const token = sessionStorage.getItem("token");
  const user = JSON.parse(
    sessionStorage.getItem("user") || "null"
  );

  if (!token || !user) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  if (user.role !== "admin") {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  return children;
}


/*
|--------------------------------------------------------------------------
| Application routes
|--------------------------------------------------------------------------
*/

export default function App() {
  return (
    <ToastProvider>
      <Routes>

      {/* ==============================
          PUBLIC
      ============================== */}

      <Route
        path="/login"
        element={<Login />}
      />


      {/* ==============================
          AUTHENTICATED USERS
      ============================== */}

      <Route
        path="/"
        element={
          <RequireAuth>
            <EmployeeDashboard />
          </RequireAuth>
        }
      />

      <Route
        path="/projects"
        element={
          <RequireAuth>
            <Projects />
          </RequireAuth>
        }
      />

      <Route
        path="/projects/:id"
        element={
          <RequireAuth>
            <ProjectDetail />
          </RequireAuth>
        }
      />

      <Route
        path="/clients"
        element={
          <RequireAuth>
            <Clients />
          </RequireAuth>
        }
      />

      <Route
        path="/my-work"
        element={
          <RequireAuth>
            <MyWork />
          </RequireAuth>
        }
      />


      {/* ==============================
          ADMIN ONLY
      ============================== */}

      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminDashboard />
          </RequireAdmin>
        }
      />


      {/* ==============================
          FALLBACK
      ============================== */}

      <Route
        path="*"
        element={
          <Navigate
            to="/"
            replace
          />
        }
      />

      <Route
        path="/forgot-password"
        element={<ForgotPassword />}
      />

      <Route
        path="/reset-password/:token"
        element={<ResetPassword />}
      />
    </Routes>
    </ToastProvider>
  );
}