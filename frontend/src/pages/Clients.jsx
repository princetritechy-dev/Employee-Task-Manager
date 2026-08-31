import React, { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import Layout from "../components/Layout";
import api from "../api";

const emptyForm = { name: "", contactName: "", email: "", phone: "", notes: "" };

export default function Clients() {
  const currentUser = JSON.parse(sessionStorage.getItem("user") || "null");
  const isAdmin = currentUser?.role === "admin";

  const [clients, setClients] = useState([]);
  const [error, setError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const [editingClient, setEditingClient] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");

  async function load() {
    try {
      const r = await api.get("/clients");
      setClients(Array.isArray(r.data) ? r.data : []);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load clients");
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, []);

  async function createClient(e) {
    e.preventDefault();
    setCreateError("");
    setCreating(true);
    try {
      await api.post("/clients", form);
      setForm(emptyForm);
      setShowCreate(false);
      load();
    } catch (err) {
      setCreateError(err.response?.data?.message || "Could not create client");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(c) {
    setEditingClient(c);
    setEditError("");
    setEditForm({
      name: c.name || "",
      contactName: c.contactName || "",
      email: c.email || "",
      phone: c.phone || "",
      notes: c.notes || "",
    });
  }

  async function saveEdit(e) {
    e.preventDefault();
    setEditError("");
    setSavingEdit(true);
    try {
      await api.put(`/clients/${editingClient.id}`, editForm);
      setEditingClient(null);
      setEditForm(null);
      load();
    } catch (err) {
      setEditError(err.response?.data?.message || "Could not update client");
    } finally {
      setSavingEdit(false);
    }
  }

  async function deleteClient(c) {
    if (!window.confirm(`Delete client "${c.name}"?`)) return;
    try {
      await api.delete(`/clients/${c.id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.message || "Could not delete client");
    }
  }

  return (
    <Layout title="Clients">

      <div className="page-head">
        <div>
          <h1>Clients</h1>
          <p className="muted">Companies your projects are done for.</p>
        </div>

        {isAdmin && (
          <button className="btn" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> Add Client
          </button>
        )}
      </div>

      {error && <div className="error">{error}</div>}

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Email</th>
                <th>Phone</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong></td>
                  <td>{c.contactName || "-"}</td>
                  <td>{c.email || "-"}</td>
                  <td>{c.phone || "-"}</td>
                  {isAdmin && (
                    <td>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button className="btn small secondary" onClick={() => startEdit(c)}>
                          <Pencil size={12} /> Edit
                        </button>
                        <button className="btn small danger" onClick={() => deleteClient(c)}>
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}

              {!clients.length && (
                <tr>
                  <td colSpan={isAdmin ? 5 : 4} className="empty">
                    No clients yet{isAdmin ? " — add one above." : "."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Client</h2>
              <button className="close-btn" onClick={() => setShowCreate(false)}>×</button>
            </div>

            {createError && <div className="error">{createError}</div>}

            <form onSubmit={createClient}>
              <label>Client / Company name</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />

              <label>Contact person</label>
              <input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />

              <div className="grid two">
                <div>
                  <label>Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <label>Phone</label>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>

              <label>Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />

              <div className="form-actions" style={{ marginTop: "14px" }}>
                <button className="btn" disabled={creating}>
                  {creating ? "Creating..." : "Create Client"}
                </button>
                <button type="button" className="btn secondary" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingClient && editForm && (
        <div className="modal-overlay" onClick={() => setEditingClient(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Client</h2>
              <button className="close-btn" onClick={() => setEditingClient(null)}>×</button>
            </div>

            {editError && <div className="error">{editError}</div>}

            <form onSubmit={saveEdit}>
              <label>Client / Company name</label>
              <input required value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />

              <label>Contact person</label>
              <input value={editForm.contactName} onChange={(e) => setEditForm({ ...editForm, contactName: e.target.value })} />

              <div className="grid two">
                <div>
                  <label>Email</label>
                  <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                </div>
                <div>
                  <label>Phone</label>
                  <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                </div>
              </div>

              <label>Notes</label>
              <textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />

              <div className="form-actions" style={{ marginTop: "14px" }}>
                <button className="btn" disabled={savingEdit}>
                  {savingEdit ? "Saving..." : "Save Changes"}
                </button>
                <button type="button" className="btn secondary" onClick={() => setEditingClient(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </Layout>
  );
}
