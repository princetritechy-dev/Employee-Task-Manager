import React, { useMemo, useState } from "react";
import { Eye, EyeOff, Check, X as XIcon } from "lucide-react";
import Layout from "../components/Layout";
import AvatarDisplay from "../components/AvatarDisplay";
import { AVATAR_OPTIONS } from "../avatarOptions";
import api from "../api";

export default function Profile() {
  const storedUser = JSON.parse(sessionStorage.getItem("user") || "null");

  const [form, setForm] = useState({
    name: storedUser?.name || "",
    email: storedUser?.email || "",
    avatarId: storedUser?.avatarId || "",
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  // Drives the "Unsaved changes" pill and disables Save until something
  // has actually changed — live, on every keystroke/click.
  const isDirty = useMemo(() => {
    return (
      form.name !== (storedUser?.name || "") ||
      form.email !== (storedUser?.email || "") ||
      form.avatarId !== (storedUser?.avatarId || "") ||
      !!passwordForm.newPassword
    );
  }, [form, passwordForm.newPassword, storedUser]);

  // Live password strength checklist — updates as you type, not on submit.
  const pwChecks = useMemo(
    () => ({
      length: passwordForm.newPassword.length >= 6,
      letter: /[A-Za-z]/.test(passwordForm.newPassword),
      number: /\d/.test(passwordForm.newPassword),
    }),
    [passwordForm.newPassword]
  );

  const pwMatches =
    passwordForm.newPassword.length > 0 &&
    passwordForm.confirmPassword.length > 0 &&
    passwordForm.newPassword === passwordForm.confirmPassword;

  const pwMismatch =
    passwordForm.confirmPassword.length > 0 &&
    passwordForm.newPassword !== passwordForm.confirmPassword;

  async function saveProfile(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (passwordForm.newPassword && passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError("New password and confirmation don't match");
      return;
    }

    setSaving(true);

    try {
      const body = {
        name: form.name,
        email: form.email,
        avatarId: form.avatarId,
      };

      if (passwordForm.newPassword) {
        body.currentPassword = passwordForm.currentPassword;
        body.newPassword = passwordForm.newPassword;
      }

      const res = await api.put("/auth/profile", body);

      // Keep sessionStorage (and therefore every other page that reads the
      // user from it) in sync immediately, without requiring a re-login.
      sessionStorage.setItem("user", JSON.stringify(res.data.user));

      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setSuccess("Profile updated");

      // Layout/sidebar read sessionStorage on mount only, so refresh the
      // shell once to pick up the new name/avatar everywhere immediately.
      setTimeout(() => window.location.reload(), 600);
    } catch (err) {
      setError(err.response?.data?.message || "Could not update profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout title="My Profile">

      <div className="page-head">
        <div>
          <h1>My Profile</h1>
          <p className="muted">Update your personal information and avatar.</p>
        </div>
        {isDirty && <span className="unsaved-pill">Unsaved changes</span>}
      </div>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <div className="profile-layout">

        <form className="card profile-form" onSubmit={saveProfile}>

          <div className="avatar-picker-grid">
            {AVATAR_OPTIONS.map((opt) => {
              const selected = form.avatarId === opt.id;
              return (
                <button
                  type="button"
                  key={opt.id}
                  className={`avatar-picker-option ${selected ? "selected" : ""}`}
                  onClick={() => setForm({ ...form, avatarId: opt.id })}
                  title={opt.id}
                >
                  <AvatarDisplay avatarId={opt.id} name="" size={44} />
                  {selected && (
                    <span className="avatar-picker-check">
                      <Check size={12} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="grid two" style={{ marginTop: "20px" }}>
            <div>
              <label>Name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label>Email</label>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
          </div>

          <h3 className="profile-section-title">Change password</h3>
          <p className="muted small-note">Leave blank if you don't want to change it.</p>

          <div className="grid two">
            <div>
              <label>Current password</label>
              <input
                type={showPasswords ? "text" : "password"}
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                autoComplete="current-password"
              />
            </div>
            <div>
              <label>New password</label>
              <input
                type={showPasswords ? "text" : "password"}
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                autoComplete="new-password"
                placeholder="At least 6 characters, letter + number"
              />

              {passwordForm.newPassword.length > 0 && (
                <div className="password-checklist">
                  <span className={`password-check ${pwChecks.length ? "met" : ""}`}>
                    <Check size={12} /> 6+ characters
                  </span>
                  <span className={`password-check ${pwChecks.letter ? "met" : ""}`}>
                    <Check size={12} /> A letter
                  </span>
                  <span className={`password-check ${pwChecks.number ? "met" : ""}`}>
                    <Check size={12} /> A number
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="grid two">
            <div>
              <label>Confirm new password</label>
              <input
                type={showPasswords ? "text" : "password"}
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                autoComplete="new-password"
              />

              {pwMatches && (
                <span className="password-match ok">
                  <Check size={12} /> Passwords match
                </span>
              )}
              {pwMismatch && (
                <span className="password-match bad">
                  <XIcon size={12} /> Passwords don't match
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button
                type="button"
                className="btn secondary"
                onClick={() => setShowPasswords((v) => !v)}
              >
                {showPasswords ? <EyeOff size={14} /> : <Eye size={14} />}
                {showPasswords ? " Hide" : " Show"} passwords
              </button>
            </div>
          </div>

          <div className="form-actions" style={{ marginTop: "14px" }}>
            <button className="btn" disabled={saving || !isDirty}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>

        </form>

        <div className="card profile-preview-card">
          <h3 className="profile-section-title" style={{ marginTop: 0 }}>
            Live preview
          </h3>
          <p className="muted small-note">This is how you'll appear around the app.</p>

          <div className="preview-big-avatar">
            <AvatarDisplay avatarId={form.avatarId} name={form.name} size={88} />
            <strong>{form.name || "Your name"}</strong>
            <span className="muted small-note">{form.email || "your@email.com"}</span>
          </div>

          <div className="preview-block">
            <span className="preview-block-label">Sidebar</span>
            <div className="preview-sidebar-mock">
              <div className="preview-user-card">
                <AvatarDisplay avatarId={form.avatarId} name={form.name} size={34} />
                <div className="user-info">
                  <strong>{form.name || "Your name"}</strong>
                  <span>
                    {storedUser?.role === "admin" ? "Administrator" : "Employee"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="preview-block">
            <span className="preview-block-label">Topbar</span>
            <div className="preview-topbar-mock">
              <AvatarDisplay avatarId={form.avatarId} name={form.name} size={22} />
              <span>{form.name || "Your name"}</span>
            </div>
          </div>
        </div>

      </div>

    </Layout>
  );
}