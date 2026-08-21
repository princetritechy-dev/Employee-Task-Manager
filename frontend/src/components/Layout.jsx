import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FolderKanban,
  ShieldCheck,
  LogOut,
  UserCircle,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

export default function Layout({ children, title }) {
  const navigate = useNavigate();
  const location = useLocation();

  const user = JSON.parse(localStorage.getItem("user") || "null");
  const [mobileOpen, setMobileOpen] = useState(false);

  function logout() {
    localStorage.clear();
    navigate("/login");
  }

const navItems = [];

if (user?.role !== "admin") {
  navItems.push({
    label: "Dashboard",
    path: "/",
    icon: LayoutDashboard,
  });
}

navItems.push({
  label: "Projects",
  path: "/projects",
  icon: FolderKanban,
});

if (user?.role === "admin") {
  navItems.push({
    label: "Admin",
    path: "/admin",
    icon: ShieldCheck,
  });
}

  return (
    <div className="app-shell">

      {mobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>

        <div className="sidebar-brand">
          <div className="brand-logo">
            TM
          </div>

          <div>
            <strong>Task Manager</strong>
            <span>Work Management</span>
          </div>

          <button
            className="mobile-close"
            onClick={() => setMobileOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <div className="sidebar-section">
          <span className="sidebar-label">MAIN MENU</span>

          <nav className="sidebar-nav">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active =
                location.pathname === item.path;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`sidebar-link ${
                    active ? "active" : ""
                  }`}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon size={19} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="sidebar-bottom">

          <div className="user-card">
            <div className="user-avatar">
              {user?.name?.charAt(0)?.toUpperCase() || "U"}
            </div>

            <div className="user-info">
              <strong>{user?.name || "User"}</strong>
              <span>
                {user?.role === "admin"
                  ? "Administrator"
                  : "Employee"}
              </span>
            </div>
          </div>

          <button className="logout-btn" onClick={logout}>
            <LogOut size={18} />
            Logout
          </button>

        </div>
      </aside>

      <div className="main-area">

        <header className="topbar">

          <button
            className="mobile-menu"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={22} />
          </button>

          <div>
            <div className="breadcrumb">
              Task Manager
              <span>/</span>
              {title}
            </div>

            <h1>{title}</h1>
          </div>

          <div className="topbar-user">
            <UserCircle size={22} />
            <span>{user?.name}</span>
          </div>

        </header>

        <main className="container">
          {children}
        </main>

      </div>
    </div>
  );
}