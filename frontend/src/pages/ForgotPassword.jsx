import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import "../styles/ResetPassword.css";

export default function ForgotPassword() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    setMessage("");
    setError("");

    if (!email.trim()) {
      setError("Please enter your email");
      return;
    }

    try {
      setLoading(true);

      const response = await api.post("/auth/forgot-password", {
        email: email.trim()
      });

      setMessage(response.data.message);
      setEmail("");

    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to send reset link"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
<div className="password-page">
  <div className="password-card">

    <h2>Forgot Password?</h2>

    <p className="password-description">
      Enter your registered email address and
      we'll send you a password reset link.
    </p>

    <form
      className="password-form"
      onSubmit={handleSubmit}
    >
      <input
        className="password-input"
        type="email"
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <button
        className="password-submit"
        type="submit"
        disabled={loading}
      >
        {loading ? "Sending..." : "Send Reset Link"}
      </button>
    </form>

    {message && (
      <p className="password-success">
        {message}
      </p>
    )}

    {error && (
      <p className="password-error">
        {error}
      </p>
    )}

    <button
      className="password-back"
      type="button"
      onClick={() => navigate("/login")}
    >
      Back to Login
    </button>

  </div>
</div>
  );
}