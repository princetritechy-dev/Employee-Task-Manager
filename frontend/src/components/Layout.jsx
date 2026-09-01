import React, { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FolderKanban,
  ShieldCheck,
  Users as UsersIcon,
  LogOut,
  UserCircle,
  Menu,
  X,
  Briefcase,
  Bell,
  MessageCircle,
  Building2,
  Search,
} from "lucide-react";
import { useState } from "react";
import ChatWidget from "./ChatWidget";
import GlobalSearch from "./GlobalSearch";

export default function Layout({ children, title }) {
  const navigate = useNavigate();
  const location = useLocation();

  const user = JSON.parse(sessionStorage.getItem("user") || "null");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);

  function logout() {
    sessionStorage.clear();
    navigate("/login");
  }

  // ⌘K / Ctrl+K opens global search from anywhere in the app.
  useEffect(() => {
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

const navItems = [];

if (user?.role !== "admin") {
  navItems.push({
    label: "Dashboard",
    path: "/",
    icon: LayoutDashboard,
  });
}

navItems.push({
  label: "My Work",
  path: "/my-work",
  icon: Briefcase,
});

navItems.push({
  label: "Projects",
  path: "/projects",
  icon: FolderKanban,
});

navItems.push({
  label: "Clients",
  path: "/clients",
  icon: Building2,
});

if (user?.role === "admin") {
  navItems.push({
    label: "Dashboard",
    path: "/admin",
    icon: ShieldCheck,
  });

  navItems.push({
    label: "Users",
    path: "/admin/users",
    icon: UsersIcon,
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

          <button className="topbar-search" onClick={() => setSearchOpen(true)}>
            <Search size={15} />
            <span>Search</span>
            <kbd>⌘K</kbd>
          </button>

          <div className="topbar-user">
            <button
              className="topbar-icon-btn"
              onClick={() => setChatOpen((v) => !v)}
              title="Chat"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="topbar-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
              )}
            </button>
            <UserCircle size={22} />
            <span>{user?.name}</span>
          </div>

        </header>

        <main className="container">
          {children}
        </main>

      </div>

      <button
        className="chat-fab"
        onClick={() => setChatOpen((v) => !v)}
        title="Chat"
      >
        <MessageCircle size={24} />
        {unreadCount > 0 && (
          <span className="chat-fab-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
        )}
      </button>

      <ChatWidget
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        onUnreadChange={setUnreadCount}
      />

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}