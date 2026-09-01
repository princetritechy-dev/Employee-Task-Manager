import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Pencil, Plus, Search, Calendar, Trash2 } from "lucide-react";
import Layout from "../components/Layout";
import ConfirmDialog from "../components/ConfirmDialog";
import ProjectWizard from "../components/ProjectWizard";
import AvatarDisplay from "../components/AvatarDisplay";
import api from "../api";

function formatDate(d) {
  if (!d) return null;
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return d;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function Projects() {
  const user = JSON.parse(sessionStorage.getItem("user") || "null");
  const isAdmin = user?.role === "admin";
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const [showWizard, setShowWizard] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [confirmDeleteProject, setConfirmDeleteProject] = useState(null);

  async function load() {
    const r = await api.get("/projects");
    setProjects(Array.isArray(r.data) ? r.data : []);
    const c = await api.get("/clients");
    setClients(Array.isArray(c.data) ? c.data : []);
    if (isAdmin) {
      const e = await api.get("/admin/employees");
      setEmployees(Array.isArray(e.data) ? e.data : []);
    }
  }

  useEffect(() => {
    load();

    const interval = setInterval(load, 6000);
    return () => clearInterval(interval);
  }, []);

  const filteredProjects = useMemo(() => {
    if (!search.trim()) return projects;
    const q = search.trim().toLowerCase();
    return projects.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.Client?.name?.toLowerCase().includes(q) ||
        p.status?.toLowerCase().includes(q)
    );
  }, [projects, search]);

  async function remove(id) {
    try {
      await api.delete(`/projects/${id}`);
      setConfirmDeleteProject(null);
      load();
    } catch (e) {
      alert(e.response?.data?.message || "Cannot delete project");
    }
  }

  return (
    <Layout title="Projects">
      <div className="page-head">
        <div>
          <h1>Projects</h1>
          <p className="muted">
            {projects.length} {projects.length === 1 ? "project" : "projects"}
          </p>
        </div>
        {isAdmin && (
          <button className="btn" onClick={() => setShowWizard(true)}>
            <Plus size={16} /> New Project
          </button>
        )}
      </div>

      {projects.length > 0 && (
        <div className="wizard-search projects-search">
          <Search size={15} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, client, or status..."
          />
        </div>
      )}

      <div className="project-grid">
        {filteredProjects.map((p) => {
          const members = p.Users || [];
          const visibleMembers = members.slice(0, 4);
          const overflow = members.length - visibleMembers.length;
          const start = formatDate(p.startDate);
          const end = formatDate(p.endDate);

          return (
            <div className="card project-card" key={p.id}>
              <Link to={`/projects/${p.id}`} className="project-card-link">
                <div className="project-title">
                  <h2>{p.name}</h2>
                  <span className={`badge ${p.status}`}>{p.status}</span>
                </div>

                {p.Client && <div className="project-client">{p.Client.name}</div>}

                <p className="project-card-description">
                  {p.description || "No description yet."}
                </p>

                <div className="project-card-dates">
                  <Calendar size={13} />
                  <span>{start || "No start date"}</span>
                  <span className="project-card-dates-arrow">→</span>
                  <span>{end || "No end date"}</span>
                </div>
              </Link>

              <div className="project-card-footer">
                <div className="project-card-avatars">
                  {visibleMembers.map((u) => (
                    <AvatarDisplay
                      key={u.id}
                      avatarId={u.avatarId}
                      name={u.name}
                      size={26}
                      className="project-avatar"
                    />
                  ))}
                  {overflow > 0 && (
                    <span className="project-avatar project-avatar-more">+{overflow}</span>
                  )}
                  {!members.length && (
                    <span className="muted project-card-no-members">No members yet</span>
                  )}
                </div>

                {isAdmin && (
                  <div className="project-card-actions">
                    <button
                      className="project-card-icon-btn"
                      onClick={() => setEditingProject(p)}
                      title="Edit project"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="project-card-icon-btn danger"
                      onClick={() => setConfirmDeleteProject(p)}
                      title="Delete project"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {!filteredProjects.length && projects.length > 0 && (
          <div className="empty" style={{ gridColumn: "1 / -1" }}>
            No projects match "{search}".
          </div>
        )}

        {!projects.length && (
          <div className="empty" style={{ gridColumn: "1 / -1" }}>
            {isAdmin
              ? "No projects yet — create one to get started."
              : "No projects yet."}
          </div>
        )}
      </div>

      {showWizard && (
        <ProjectWizard
          clients={clients}
          employees={employees}
          onClose={() => setShowWizard(false)}
          onCreated={() => {
            setShowWizard(false);
            load();
          }}
        />
      )}

      {editingProject && (
        <ProjectWizard
          project={editingProject}
          clients={clients}
          employees={employees}
          onClose={() => setEditingProject(null)}
          onCreated={() => {
            setEditingProject(null);
            load();
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDeleteProject}
        title="Delete project?"
        message={confirmDeleteProject ? `Delete "${confirmDeleteProject.name}"?` : ""}
        confirmLabel="Delete"
        onConfirm={() => remove(confirmDeleteProject.id)}
        onCancel={() => setConfirmDeleteProject(null)}
      />
    </Layout>
  );
}