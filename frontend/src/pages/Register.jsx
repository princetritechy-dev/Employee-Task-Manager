import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, Eye, EyeOff, Check } from "lucide-react";
import api from "../api";
import { useToast } from "../components/Toast";
import "../styles/register.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Register() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "employee",
    adminCode: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showAdminCode, setShowAdminCode] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [shake, setShake] = useState(false);

  const emailValid = form.email.length === 0 || EMAIL_RE.test(form.email.trim());
  const passwordLongEnough = form.password.length >= 6;

  function change(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  function triggerShake() {
    setShake(true);
    setTimeout(() => setShake(false), 450);
  }

  async function submit(e) {
    e.preventDefault();

    setError("");

    if (!EMAIL_RE.test(form.email.trim())) {
      setEmailTouched(true);
      triggerShake();
      return;
    }

    if (form.password.length < 6) {
      setPasswordTouched(true);
      triggerShake();
      return;
    }

    setLoading(true);

    try {
      const { data } = await api.post("/auth/register", form);

      sessionStorage.setItem("token", data.token);
      sessionStorage.setItem("user", JSON.stringify(data.user));

      showToast("Account created", "success");

      setTimeout(() => {
        navigate(data.user.role === "admin" ? "/admin" : "/");
      }, 350);
    } catch (err) {
      const message = err.response?.data?.message || "Registration failed";
      setError(message);
      showToast(message, "error");
      triggerShake();
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
            TD
          </div>

          <h1>TriTechy DevHub</h1>

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

        <div className={`register-card ${shake ? "shake" : ""}`}>

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


          <form onSubmit={submit} noValidate>

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
                className={`register-input ${emailTouched && !emailValid ? "field-invalid" : ""}`}
                name="email"
                required
                type="email"
                value={form.email}
                onChange={change}
                onBlur={() => setEmailTouched(true)}
                placeholder="you@example.com"
                autoComplete="email"
              />

              {emailTouched && !emailValid && (
                <span className="field-error">Enter a valid email address</span>
              )}

            </div>


            {/* Password */}
            <div className="register-form-group">

              <label htmlFor="password">
                Password
              </label>

              <div className="register-input-wrapper">

                <input
                  id="password"
                  className={`register-input ${passwordTouched && !passwordLongEnough ? "field-invalid" : ""}`}
                  name="password"
                  required
                  minLength={6}
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={change}
                  onBlur={() => setPasswordTouched(true)}
                  placeholder="Minimum 6 characters"
                  autoComplete="new-password"
                />

                <button
                  type="button"
                  className="register-password-toggle"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>

              </div>

              {form.password.length > 0 && (
                <div className={`password-check ${passwordLongEnough ? "met" : ""}`}>
                  <Check size={13} />
                  <span>At least 6 characters</span>
                </div>
              )}

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

                <div className="register-input-wrapper">

                  <input
                    id="adminCode"
                    className="register-input"
                    name="adminCode"
                    required
                    type={showAdminCode ? "text" : "password"}
                    value={form.adminCode}
                    onChange={change}
                    placeholder="Enter admin registration code"
                  />

                  <button
                    type="button"
                    className="register-password-toggle"
                    onClick={() => setShowAdminCode((prev) => !prev)}
                    aria-label={showAdminCode ? "Hide code" : "Show code"}
                  >
                    {showAdminCode ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>

                </div>

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