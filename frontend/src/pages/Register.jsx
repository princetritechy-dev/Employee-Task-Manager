import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import api from "../api";
import "../styles/register.css";

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "employee",
    adminCode: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function change(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  async function submit(e) {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const { data } = await api.post("/auth/register", form);

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      navigate(
        data.user.role === "admin"
          ? "/admin"
          : "/"
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Registration failed"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="register-page">

      {/* =====================================================
          LEFT BRANDING
      ===================================================== */}
      <div className="register-brand">

        <div className="register-brand-content">

          <div className="register-logo">
            TM
          </div>

          <h1>Task Manager</h1>

          <p className="register-brand-description">
            Create your account and start managing
            your team's work in one place.
          </p>

          <div className="register-features">

            <div className="register-feature">
              <CheckCircle2 size={20} />
              <span>Organize daily tasks</span>
            </div>

            <div className="register-feature">
              <CheckCircle2 size={20} />
              <span>Track working hours</span>
            </div>

            <div className="register-feature">
              <CheckCircle2 size={20} />
              <span>Collaborate with your team</span>
            </div>

          </div>

        </div>

      </div>


      {/* =====================================================
          REGISTER FORM
      ===================================================== */}
      <div className="register-form-section">

        <div className="register-card">

          {/* Header */}
          <div className="register-header">

            <div className="register-mobile-logo">
              TM
            </div>

            <h2>Create account</h2>

            <p>
              Set up your account to get started
            </p>

          </div>


          {/* Error */}
          {error && (
            <div className="register-error">
              {error}
            </div>
          )}


          <form onSubmit={submit}>

            {/* Name */}
            <div className="register-form-group">

              <label htmlFor="name">
                Name
              </label>

              <input
                id="name"
                className="register-input"
                name="name"
                required
                value={form.name}
                onChange={change}
                placeholder="Your name"
                autoComplete="name"
              />

            </div>


            {/* Email */}
            <div className="register-form-group">

              <label htmlFor="email">
                Email address
              </label>

              <input
                id="email"
                className="register-input"
                name="email"
                required
                type="email"
                value={form.email}
                onChange={change}
                placeholder="you@example.com"
                autoComplete="email"
              />

            </div>


            {/* Password */}
            <div className="register-form-group">

              <label htmlFor="password">
                Password
              </label>

              <input
                id="password"
                className="register-input"
                name="password"
                required
                minLength={6}
                type="password"
                value={form.password}
                onChange={change}
                placeholder="Minimum 6 characters"
                autoComplete="new-password"
              />

            </div>


            {/* Role */}
            <div className="register-form-group">

              <label htmlFor="role">
                Account role
              </label>

              <select
                id="role"
                className="register-select"
                name="role"
                value={form.role}
                onChange={change}
              >
                <option value="employee">
                  Employee
                </option>

                <option value="admin">
                  Admin
                </option>
              </select>

            </div>


            {/* Admin Code */}
            {form.role === "admin" && (
              <div className="register-admin-code">

                <label htmlFor="adminCode">
                  Admin Registration Code
                </label>

                <input
                  id="adminCode"
                  className="register-input"
                  name="adminCode"
                  required
                  type="password"
                  value={form.adminCode}
                  onChange={change}
                  placeholder="Enter admin registration code"
                />

                <small>
                  To register as an admin, please enter the authorization code provided by your administrator.
                </small>

              </div>
            )}


            {/* Submit */}
            <button
              type="submit"
              className="register-submit"
              disabled={loading}
            >
              {loading
                ? "Creating account..."
                : "Create account"}
            </button>

          </form>


          {/* Login */}
          <div className="register-login">

            <span>
              Already registered?
            </span>

            <Link to="/login">
              Login
            </Link>

          </div>

        </div>

      </div>

    </div>
  );
}