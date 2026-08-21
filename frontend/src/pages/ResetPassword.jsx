import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api";
import "../styles/ResetPassword.css";

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    setMessage("");
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      setLoading(true);

      const response = await api.patch(
        `/auth/reset-password/${token}`,
        {
          password
        }
      );

      setMessage(response.data.message);

      setPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        navigate("/login");
      }, 1500);

    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to reset password"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
<div className="password-page">
  <div className="password-card">

    <h2>Reset Password</h2>

    <p className="password-description">
      Enter your new password below.
    </p>

    <form
      className="password-form"
      onSubmit={handleSubmit}
    >

      <input
        className="password-input"
        type="password"
        placeholder="New password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <input
        className="password-input"
        type="password"
        placeholder="Confirm new password"
        value={confirmPassword}
        onChange={(e) =>
          setConfirmPassword(e.target.value)
        }
      />

      <button
        className="password-submit"
        type="submit"
        disabled={loading}
      >
        {loading ? "Updating..." : "Reset Password"}
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

  </div>
</div>
  );
}