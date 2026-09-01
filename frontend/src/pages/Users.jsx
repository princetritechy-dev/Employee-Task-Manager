import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Eye, Pencil, Trash2 } from "lucide-react";
import Layout from "../components/Layout";
import ConfirmDialog from "../components/ConfirmDialog";
import AvatarDisplay from "../components/AvatarDisplay";
import api from "../api";

export default function Users() {
  const [allUsers, setAllUsers] = useState([]);
  const [search, setSearch] = useState("");

  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "" });
  const [createUserError, setCreateUserError] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);

  const [editingUser, setEditingUser] = useState(null);
  const [editUserForm, setEditUserForm] = useState(null);
  const [editUserError, setEditUserError] = useState("");
  const [savingUser, setSavingUser] = useState(false);

  const [confirmDeleteUser, setConfirmDeleteUser] = useState(null);

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return allUsers;
    const q = search.trim().toLowerCase();
    return allUsers.filter(
      (u) => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
    );
  }, [allUsers, search]);

  async function loadUsers() {
    try {
      const r = await api.get("/admin/users");
      setAllUsers(Array.isArray(r.data) ? r.data : []);
    } catch (error) {
      console.error("Could not load users", error);
    }
  }

  useEffect(() => {
    loadUsers();

    const interval = setInterval(loadUsers, 6000);
    return () => clearInterval(interval);
  }, []);

  async function createUser(e) {
    e.preventDefault();
    setCreateUserError("");
    setCreatingUser(true);

    try {
      await api.post("/admin/users", newUser);
      setNewUser({ name: "", email: "", password: "" });
      setShowCreateUserModal(false);
      await loadUsers();
    } catch (error) {
      setCreateUserError(
        error.response?.data?.message || "Could not create user"
      );
    } finally {
      setCreatingUser(false);
    }
  }

  function startEditUser(person) {
    setEditingUser(person);
    setEditUserError("");
    setEditUserForm({
      name: person.name,
      email: person.email,
      status: person.status,
    });
  }

  async function saveEditUser(e) {
    e.preventDefault();
    setEditUserError("");
    setSavingUser(true);

    try {
      await api.put(`/admin/users/${editingUser.id}`, editUserForm);
      setEditingUser(null);
      setEditUserForm(null);
      await loadUsers();
    } catch (error) {
      setEditUserError(error.response?.data?.message || "Could not update user");
    } finally {
      setSavingUser(false);
    }
  }

  async function deleteUser(person) {
    try {
      await api.delete(`/admin/users/${person.id}`);
      setConfirmDeleteUser(null);
      await loadUsers();
    } catch (error) {
      alert(error.response?.data?.message || "Could not delete user");
    }
  }

  return (
    <Layout title="Users">

      <div className="page-head">
        <div>
          <h1>Users</h1>
          <p className="muted">
            {allUsers.length} {allUsers.length === 1 ? "employee" : "employees"} in the system.
          </p>
        </div>

        <button className="btn" onClick={() => setShowCreateUserModal(true)}>
          <Plus size={16} /> Add User
        </button>
      </div>

      <div className="card">

        <div className="view-toolbar" style={{ borderTop: "none", marginTop: 0, paddingTop: 0 }}>
          <div className="view-filters">
            <div className="wizard-search" style={{ minWidth: "260px" }}>
              <Search size={15} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email..."
              />
            </div>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredUsers.map((person) => (
                <tr key={person.id}>
                  <td>
                    <div className="employee-cell">
                      <AvatarDisplay avatarId={person.avatarId} name={person.name} size={38} className="employee-avatar" />
                      <strong>{person.name}</strong>
                    </div>
                  </td>
                  <td className="muted">{person.email}</td>
                  <td>
                    <span className="role-badge">{person.role}</span>
                  </td>
                  <td>
                    <span
                      className={`status-badge ${
                        person.status === "active" ? "status-active" : "status-inactive"
                      }`}
                    >
                      <span className="status-dot" />
                      {person.status}
                    </span>
                  </td>
                  <td>
                    <div className="users-actions">
                      <Link
                        to={`/admin/employee/${person.id}/dashboard`}
                        className="project-card-icon-btn"
                        title="View dashboard"
                      >
                        <Eye size={15} />
                      </Link>
                      <button
                        className="project-card-icon-btn"
                        onClick={() => startEditUser(person)}
                        title="Edit user"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className="project-card-icon-btn danger"
                        onClick={() => setConfirmDeleteUser(person)}
                        title="Delete user"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!filteredUsers.length && (
                <tr>
                  <td colSpan="5" className="empty">
                    {allUsers.length
                      ? "No users match your search."
                      : "No employees yet — add one above."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

      {showCreateUserModal && (
        <div className="modal-overlay" onClick={() => setShowCreateUserModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Add User</h2>
                <p className="muted">Create an employee account</p>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => setShowCreateUserModal(false)}
              >
                ×
              </button>
            </div>

            {createUserError && <div className="error">{createUserError}</div>}

            <form onSubmit={createUser}>
              <label>Name</label>
              <input
                required
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                placeholder="Full name"
              />

              <label>Email</label>
              <input
                required
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                placeholder="name@example.com"
              />

              <label>Password</label>
              <input
                required
                type="password"
                minLength={6}
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                placeholder="At least 6 characters, letter + number"
              />

              <div className="form-actions" style={{ marginTop: "14px" }}>
                <button className="btn" disabled={creatingUser}>
                  {creatingUser ? "Creating..." : "Create User"}
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setShowCreateUserModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingUser && editUserForm && (
        <div className="modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Edit User</h2>
                <p className="muted">{editingUser.email}</p>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => setEditingUser(null)}
              >
                ×
              </button>
            </div>

            {editUserError && <div className="error">{editUserError}</div>}

            <form onSubmit={saveEditUser}>
              <label>Name</label>
              <input
                required
                value={editUserForm.name}
                onChange={(e) => setEditUserForm({ ...editUserForm, name: e.target.value })}
              />

              <label>Email</label>
              <input
                required
                type="email"
                value={editUserForm.email}
                onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })}
              />

              <label>Status</label>
              <select
                value={editUserForm.status}
                onChange={(e) => setEditUserForm({ ...editUserForm, status: e.target.value })}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>

              <div className="form-actions" style={{ marginTop: "14px" }}>
                <button className="btn" disabled={savingUser}>
                  {savingUser ? "Saving..." : "Save Changes"}
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setEditingUser(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDeleteUser && (
        <ConfirmDialog
          open
          title="Delete user?"
          message={`Delete ${confirmDeleteUser.name}? This can't be undone.`}
          confirmLabel="Delete"
          onConfirm={() => deleteUser(confirmDeleteUser)}
          onCancel={() => setConfirmDeleteUser(null)}
        />
      )}

    </Layout>
  );
}