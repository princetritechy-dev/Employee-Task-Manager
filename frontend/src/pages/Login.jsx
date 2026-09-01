import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { useToast } from "../components/Toast";
import "../styles/login.css";
import { Lock, Mail, Eye, EyeOff, CheckCircle2 } from "lucide-react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [emailTouched, setEmailTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);

  const emailValid = email.length === 0 || EMAIL_RE.test(email.trim());

  function triggerShake() {
    setShake(true);
    setTimeout(() => setShake(false), 450);
  }

  async function submit(e) {
    e.preventDefault();

    setError("");

    if (!EMAIL_RE.test(email.trim())) {
      setEmailTouched(true);
      triggerShake();
      return;
    }

    setLoading(true);

    try {
      const response = await api.post("/auth/login", {
        email: email.trim(),
        password,
      });

      const { token, user } = response.data;

      sessionStorage.setItem("token", token);
      sessionStorage.setItem("user", JSON.stringify(user));

      showToast("Signed in", "success");

      setTimeout(() => {
        navigate(user.role === "admin" ? "/admin" : "/");
      }, 350);
    } catch (err) {
      const message =
        err.response?.data?.message || "Invalid email or password";
      setError(message);
      showToast(message, "error");
      triggerShake();
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
            TD
          </div>

          <h1>TriTechy DevHub</h1>

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

        <div className={`login-card ${shake ? "shake" : ""}`}>

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


          <form onSubmit={submit} noValidate>

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
                  className={emailTouched && !emailValid ? "field-invalid" : ""}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setEmailTouched(true)}
                  autoComplete="email"
                  required
                />

              </div>

              {emailTouched && !emailValid && (
                <span className="field-error">Enter a valid email address</span>
              )}

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


          <p className="login-admin-note">
            Don't have an account? Ask your admin to create one for you.
          </p>

        </div>

      </div>

    </div>
  );
}