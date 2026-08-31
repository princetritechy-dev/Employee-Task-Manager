import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Pencil, Plus } from "lucide-react";
import Layout from "../components/Layout";
import ConfirmDialog from "../components/ConfirmDialog";
import ProjectWizard from "../components/ProjectWizard";
import api from "../api";



export default function Projects() {
  const user = JSON.parse(sessionStorage.getItem("user") || "null");
  const isAdmin = user?.role === "admin";
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [clients, setClients] = useState([]);
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

    // Keep this list live — pick up projects created/edited/deleted
    // elsewhere without needing a manual reload.
    const interval = setInterval(load, 6000);
    return () => clearInterval(interval);
  }, []);

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
        </div>
        {isAdmin && (
          <button className="btn" onClick={() => setShowWizard(true)}>
            <Plus size={16} /> New Project
          </button>
        )}
      </div>

      <div className="grid two">
        {projects.map(p => (
          <div className="card project-card" key={p.id}>
            <Link to={`/projects/${p.id}`} className="project-card-link">
              <div className="project-title">
                <h2>{p.name}</h2>
                <span className={`badge ${p.status}`}>{p.status}</span>
              </div>
              {p.Client && <div className="project-client">{p.Client.name}</div>}
              <p>{p.description || "No description"}</p>
              <small>{p.startDate || "No start date"} → {p.endDate || "No end date"}</small>
            </Link>
            <div className="members">
              {(p.Users || []).map(u => <span key={u.id} className="chip">{u.name}</span>)}
            </div>
            {isAdmin && (
              <div className="project-card-actions">
                <button className="btn small secondary" onClick={() => setEditingProject(p)}>
                  <Pencil size={12} /> Edit
                </button>
                <button className="btn danger small" onClick={() => setConfirmDeleteProject(p)}>Delete</button>
              </div>
            )}
          </div>
        ))}
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
