import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import api from "../api";



export default function Projects() {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const isAdmin = user?.role === "admin";
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({ name: "", description: "", status: "ongoing", startDate: "", endDate: "", employeeIds: [] });

  async function load() {
    const r = await api.get("/projects");
    setProjects(r.data);
    if (isAdmin) {
      const e = await api.get("/admin/employees");
      setEmployees(e.data);
    }
  }

  useEffect(() => { load(); }, []);

  async function create(e) {
    e.preventDefault();
    await api.post("/projects", { ...form, employeeIds: form.employeeIds.map(Number) });
    setForm({ name: "", description: "", status: "ongoing", startDate: "", endDate: "", employeeIds: [] });
    load();
  }

  async function remove(id) {
    if (confirm("Delete project?")) {
      try { await api.delete(`/projects/${id}`); load(); }
      catch (e) { alert(e.response?.data?.message || "Cannot delete project"); }
    }
  }

  return (
    <Layout title="Projects">
      <h1>Projects</h1>

      {/* form now visible to admin AND user */}
      <form className="card" onSubmit={create}>
        <h2>Create Project</h2>
        <div className="grid two">
          <div><label>Name</label><input required value={form.name} onChange={e => setForm({...form, name:e.target.value})}/></div>
          <div><label>Status</label><select value={form.status} onChange={e => setForm({...form, status:e.target.value})}><option>ongoing</option><option>paused</option><option>completed</option></select></div>
        </div>
        <label>Description</label><textarea value={form.description} onChange={e => setForm({...form, description:e.target.value})}/>
        <div className="grid two">
          <div><label>Start date</label><input type="date" value={form.startDate} onChange={e => setForm({...form, startDate:e.target.value})}/></div>
          <div><label>End date</label><input type="date" value={form.endDate} onChange={e => setForm({...form, endDate:e.target.value})}/></div>
        </div>

        {/* employee assignment stays admin-only */}
        {isAdmin && (
          <>
            <label>Assign employees</label>
            <select multiple value={form.employeeIds} onChange={e => setForm({...form, employeeIds:Array.from(e.target.selectedOptions, o => o.value)})}>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name} — {e.email}</option>)}
            </select>
          </>
        )}

        <button className="btn">Create Project</button>
      </form>

      <div className="grid two">
        {projects.map(p => (
          <div className="card" key={p.id}>
            <div className="project-title">
              <h2>{p.name}</h2>
              <span className={`badge ${p.status}`}>{p.status}</span>
            </div>
            <p>{p.description || "No description"}</p>
            <small>{p.startDate || "No start date"} → {p.endDate || "No end date"}</small>
            {isAdmin && <button className="btn danger small" onClick={() => remove(p.id)}>Delete</button>}
            {isAdmin && (
              <div className="members">
                {(p.Users || []).map(u => <span key={u.id} className="chip">{u.name}</span>)}
              </div>
            )}
          </div>
        ))}
      </div>
    </Layout>
  );
}
