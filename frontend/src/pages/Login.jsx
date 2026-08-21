import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api";
import "../styles/Login.css";
import { Lock, Mail, Eye, EyeOff, CheckCircle2 } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await api.post("/auth/login", {
        email: email.trim(),
        password,
      });

      const { token, user } = response.data;

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));

      if (user.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/");
      }
    } catch (err) {
      setError(
        err.response?.data?.message || "Invalid email or password"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">

      {/* =====================================================
          LEFT BRANDING
      ===================================================== */}
      <div className="login-brand">
        <div className="login-brand-content">

          <div className="login-logo">
            TM
          </div>

          <h1>Task Manager</h1>

          <p className="login-brand-description">
            Manage your team's work, track time,
            and stay organized in one place.
          </p>

          <div className="login-features">

            <div className="login-feature">
              <CheckCircle2 size={20} />
              <span>Track daily tasks</span>
            </div>

            <div className="login-feature">
              <CheckCircle2 size={20} />
              <span>Monitor employee hours</span>
            </div>

            <div className="login-feature">
              <CheckCircle2 size={20} />
              <span>Manage projects easily</span>
            </div>

          </div>

        </div>
      </div>


      {/* =====================================================
          LOGIN FORM
      ===================================================== */}
      <div className="login-form-section">

        <div className="login-card">

          {/* Header */}
          <div className="login-header">

            <div className="login-mobile-logo">
              TM
            </div>

            <h2>Welcome back</h2>

            <p>
              Sign in to your account to continue
            </p>

          </div>


          {/* Error */}
          {error && (
            <div className="login-error">
              {error}
            </div>
          )}


          <form onSubmit={submit}>

            {/* =================================================
                EMAIL
            ================================================= */}
            <div className="login-form-group">

              <label htmlFor="email">
                Email address
              </label>

              <div className="login-input-wrapper">

                <Mail
                  size={19}
                  className="login-input-icon"
                />

                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />

              </div>

            </div>


            {/* =================================================
                PASSWORD
            ================================================= */}
            <div className="login-form-group">

              <div className="login-password-label">

                <label htmlFor="password">
                  Password
                </label>

                <button
                  type="button"
                  className="login-forgot"
                  onClick={() => navigate("/forgot-password")}
                >
                  Forgot password?
                </button>
              </div>


              <div className="login-input-wrapper">

                <Lock
                  size={19}
                  className="login-input-icon"
                />

                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />

                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() =>
                    setShowPassword((prev) => !prev)
                  }
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showPassword ? (
                    <EyeOff size={19} />
                  ) : (
                    <Eye size={19} />
                  )}
                </button>

              </div>

            </div>


            {/* =================================================
                SUBMIT
            ================================================= */}
            <button
              type="submit"
              className="login-submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="login-spinner" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </button>

          </form>


          {/* =================================================
              REGISTER
          ================================================= */}
          <div className="login-register">

            <span>
              Don't have an account?
            </span>

            <Link to="/register">
              Create an account
            </Link>

          </div>

        </div>

      </div>

    </div>
  );
}