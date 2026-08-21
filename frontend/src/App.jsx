import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import Projects from "./pages/Projects";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import { ToastProvider } from "./components/Toast";


/*
|--------------------------------------------------------------------------
| Authentication guard
|--------------------------------------------------------------------------
*/

function RequireAuth({ children }) {
  const token = localStorage.getItem("token");
  const user = JSON.parse(
    localStorage.getItem("user") || "null"
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
  const token = localStorage.getItem("token");
  const user = JSON.parse(
    localStorage.getItem("user") || "null"
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

      <Route
        path="/register"
        element={<Register />}
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