import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Pencil } from "lucide-react";
import Layout from "../components/Layout";
import api from "../api";



export default function Projects() {
  const user = JSON.parse(sessionStorage.getItem("user") || "null");
  const isAdmin = user?.role === "admin";
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState({ name: "", clientId: "", description: "", status: "ongoing", startDate: "", endDate: "", employeeIds: [] });
  const [editingProject, setEditingProject] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editError, setEditError] = useState("");

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

  async function create(e) {
    e.preventDefault();
    await api.post("/projects", { ...form, employeeIds: form.employeeIds });
    setForm({ name: "", clientId: "", description: "", status: "ongoing", startDate: "", endDate: "", employeeIds: [] });
    load();
  }

  async function remove(id) {
    if (confirm("Delete project?")) {
      try { await api.delete(`/projects/${id}`); load(); }
      catch (e) { alert(e.response?.data?.message || "Cannot delete project"); }
    }
  }

  function startEdit(p) {
    setEditingProject(p);
    setEditError("");
    setEditForm({
      name: p.name || "",
      clientId: p.clientId || "",
      description: p.description || "",
      status: p.status || "ongoing",
      startDate: p.startDate || "",
      endDate: p.endDate || "",
      employeeIds: (p.Users || []).map((u) => u.id),
    });
  }

  async function saveEdit(e) {
    e.preventDefault();
    setEditError("");
    try {
      await api.put(`/projects/${editingProject.id}`, editForm);
      setEditingProject(null);
      setEditForm(null);
      load();
    } catch (err) {
      setEditError(err.response?.data?.message || "Could not update project");
    }
  }

  return (
    <Layout title="Projects">
      <h1>Projects</h1>

      {/* Creating projects (Spaces, in ClickUp terms) is admin-only */}
      {isAdmin && (
      <form className="card" onSubmit={create}>
        <h2>Create Project</h2>
        <div className="grid two">
          <div><label>Name</label><input required value={form.name} onChange={e => setForm({...form, name:e.target.value})}/></div>
          <div><label>Status</label><select value={form.status} onChange={e => setForm({...form, status:e.target.value})}><option>ongoing</option><option>paused</option><option>completed</option></select></div>
        </div>
        <label>Client / Company</label>
        <select value={form.clientId} onChange={e => setForm({...form, clientId:e.target.value})}>
          <option value="">No client</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <small className="muted">
          Don't see the client you need? <Link to="/clients">Add one here</Link>.
        </small>
        <label>Description</label><textarea value={form.description} onChange={e => setForm({...form, description:e.target.value})}/>
        <div className="grid two">
          <div><label>Start date</label><input type="date" value={form.startDate} onChange={e => setForm({...form, startDate:e.target.value})}/></div>
          <div><label>End date</label><input type="date" value={form.endDate} onChange={e => setForm({...form, endDate:e.target.value})}/></div>
        </div>

        <label>Assign employees</label>
        <select multiple value={form.employeeIds} onChange={e => setForm({...form, employeeIds:Array.from(e.target.selectedOptions, o => o.value)})}>
          {employees.map(e => <option key={e.id} value={e.id}>{e.name} — {e.email}</option>)}
        </select>

        <button className="btn">Create Project</button>
      </form>
      )}

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
                <button className="btn small secondary" onClick={() => startEdit(p)}>
                  <Pencil size={12} /> Edit
                </button>
                <button className="btn danger small" onClick={() => remove(p.id)}>Delete</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {editingProject && editForm && (
        <div className="modal-overlay">
          <div className="edit-modal">
            <form className="card" onSubmit={saveEdit} style={{ boxShadow: "none", padding: 0 }}>
              <div className="modal-header">
                <h2>Edit Project</h2>
                <button type="button" className="close-btn" onClick={() => setEditingProject(null)}>×</button>
              </div>

              {editError && <div className="error">{editError}</div>}

              <div className="grid two">
                <div>
                  <label>Name</label>
                  <input required value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                </div>
                <div>
                  <label>Status</label>
                  <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
                    <option value="ongoing">ongoing</option>
                    <option value="paused">paused</option>
                    <option value="completed">completed</option>
                  </select>
                </div>
              </div>

              <label>Client / Company</label>
              <select
                value={editForm.clientId}
                onChange={e => setEditForm({ ...editForm, clientId: e.target.value })}
              >
                <option value="">No client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>

              <label>Description</label>
              <textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />

              <div className="grid two">
                <div>
                  <label>Start date</label>
                  <input type="date" value={editForm.startDate} onChange={e => setEditForm({ ...editForm, startDate: e.target.value })} />
                </div>
                <div>
                  <label>End date</label>
                  <input type="date" value={editForm.endDate} onChange={e => setEditForm({ ...editForm, endDate: e.target.value })} />
                </div>
              </div>

              <label>Assign employees</label>
              <select
                multiple
                value={editForm.employeeIds}
                onChange={e => setEditForm({ ...editForm, employeeIds: Array.from(e.target.selectedOptions, o => o.value) })}
              >
                {employees.map(e => <option key={e.id} value={e.id}>{e.name} — {e.email}</option>)}
              </select>

              <div className="form-actions" style={{ marginTop: "14px" }}>
                <button className="btn">Save Changes</button>
                <button type="button" className="btn secondary" onClick={() => setEditingProject(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
