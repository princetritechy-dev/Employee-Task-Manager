import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Eye, EyeOff, Check } from "lucide-react";
import api from "../api";
import { useToast } from "../components/Toast";
import "../styles/ResetPassword.css";

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [loading, setLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [shake, setShake] = useState(false);

  const lengthOk = password.length >= 6;
  const matchOk = confirmPassword.length > 0 && password === confirmPassword;

  function triggerShake() {
    setShake(true);
    setTimeout(() => setShake(false), 450);
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    setMessage("");
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      triggerShake();
      return;
    }

    if (password !== confirmPassword) {
      setConfirmTouched(true);
      setError("Passwords do not match");
      triggerShake();
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
      showToast("Password updated", "success");

      setPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        navigate("/login");
      }, 1500);

    } catch (err) {
      const msg = err.response?.data?.message || "Unable to reset password";
      setError(msg);
      showToast(msg, "error");
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  return (
<div className="password-page">
  <div className={`password-card ${shake ? "shake" : ""}`}>

    <h2>Reset Password</h2>

    <p className="password-description">
      Enter your new password below.
    </p>

    <form
      className="password-form"
      onSubmit={handleSubmit}
      noValidate
    >

      <div className="password-input-wrapper">

        <input
          className="password-input"
          type={showPassword ? "text" : "password"}
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          type="button"
          className="password-toggle"
          onClick={() => setShowPassword((prev) => !prev)}
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
        </button>

      </div>

      {password.length > 0 && (
        <div className={`password-check ${lengthOk ? "met" : ""}`}>
          <Check size={13} />
          <span>At least 6 characters</span>
        </div>
      )}

      <div className="password-input-wrapper">

        <input
          className={`password-input ${confirmTouched && !matchOk ? "field-invalid" : ""}`}
          type={showConfirmPassword ? "text" : "password"}
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(e) =>
            setConfirmPassword(e.target.value)
          }
          onBlur={() => setConfirmTouched(true)}
        />

        <button
          type="button"
          className="password-toggle"
          onClick={() => setShowConfirmPassword((prev) => !prev)}
          aria-label={showConfirmPassword ? "Hide password" : "Show password"}
        >
          {showConfirmPassword ? <EyeOff size={19} /> : <Eye size={19} />}
        </button>

      </div>

      {confirmPassword.length > 0 && (
        <div className={`password-check ${matchOk ? "met" : ""}`}>
          <Check size={13} />
          <span>Passwords match</span>
        </div>
      )}

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