import { useState } from "react";

const API_BASE = "http://127.0.0.1:8000";

interface RegisterPageProps {
  onGoToLogin: () => void;
}

export default function RegisterPage({ onGoToLogin }: RegisterPageProps) {
  const [username, setUsername] = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, email, password }),
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => onGoToLogin(), 1800);
      } else {
        const data = await res.json();
        setError(data.detail || "Registration failed. Please try again.");
      }
    } catch {
      setError("Could not reach the server. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#F8FAFC",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
    }}>

      {/* Grid background */}
      <svg style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }}>
        <defs>
          <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#E2E8F0" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 420, padding: "0 16px" }}>

        {/* Logo / brand */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: "#FF6D5A",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, marginBottom: 14,
            boxShadow: "0 4px 14px rgba(255,109,90,0.35)",
          }}>⚡</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1E293B", letterSpacing: "-0.5px" }}>
            My Workflow
          </div>
          <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 4 }}>
            Create your account
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: "white",
          borderRadius: 16,
          border: "1px solid #E2E8F0",
          padding: "32px 32px 28px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
        }}>

          {/* Success state */}
          {success ? (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#1E293B", marginBottom: 6 }}>Account created!</div>
              <div style={{ fontSize: 13, color: "#94A3B8" }}>Redirecting you to sign in…</div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>

              {/* Username */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", letterSpacing: "0.3px" }}>
                  USERNAME
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="yourname"
                  required
                  style={{
                    padding: "10px 14px",
                    fontSize: 14,
                    border: "1px solid #E2E8F0",
                    borderRadius: 8,
                    outline: "none",
                    color: "#1E293B",
                    background: "#F8FAFC",
                    fontFamily: "inherit",
                    transition: "border-color 0.15s",
                  }}
                  onFocus={e => e.target.style.borderColor = "#7B61FF"}
                  onBlur={e => e.target.style.borderColor = "#E2E8F0"}
                />
              </div>

              {/* Email */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", letterSpacing: "0.3px" }}>
                  EMAIL
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  style={{
                    padding: "10px 14px",
                    fontSize: 14,
                    border: "1px solid #E2E8F0",
                    borderRadius: 8,
                    outline: "none",
                    color: "#1E293B",
                    background: "#F8FAFC",
                    fontFamily: "inherit",
                    transition: "border-color 0.15s",
                  }}
                  onFocus={e => e.target.style.borderColor = "#7B61FF"}
                  onBlur={e => e.target.style.borderColor = "#E2E8F0"}
                />
              </div>

              {/* Password */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", letterSpacing: "0.3px" }}>
                  PASSWORD
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    required
                    minLength={8}
                    style={{
                      width: "100%",
                      padding: "10px 40px 10px 14px",
                      fontSize: 14,
                      border: "1px solid #E2E8F0",
                      borderRadius: 8,
                      outline: "none",
                      color: "#1E293B",
                      background: "#F8FAFC",
                      fontFamily: "inherit",
                      boxSizing: "border-box",
                      transition: "border-color 0.15s",
                    }}
                    onFocus={e => e.target.style.borderColor = "#7B61FF"}
                    onBlur={e => e.target.style.borderColor = "#E2E8F0"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(s => !s)}
                    style={{
                      position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer",
                      fontSize: 15, color: "#94A3B8", padding: 0, lineHeight: 1,
                    }}
                  >
                    {showPass ? "🙈" : "👁"}
                  </button>
                </div>
                {/* Password strength hint */}
                {password.length > 0 && (
                  <div style={{ fontSize: 11, color: password.length >= 8 ? "#36B37E" : "#F5A623", marginTop: 2 }}>
                    {password.length >= 8 ? "✓ Strong enough" : `${8 - password.length} more character${8 - password.length !== 1 ? "s" : ""} needed`}
                  </div>
                )}
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  padding: "10px 14px",
                  background: "#FFF0EE",
                  border: "1px solid #FECACA",
                  borderRadius: 8,
                  fontSize: 13,
                  color: "#EF4444",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}>
                  <span>⚠</span> {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: 4,
                  padding: "11px",
                  background: loading ? "#94A3B8" : "#7B61FF",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: loading ? "default" : "pointer",
                  fontFamily: "inherit",
                  transition: "background 0.15s",
                  boxShadow: loading ? "none" : "0 4px 14px rgba(123,97,255,0.35)",
                }}
                onMouseEnter={e => { if (!loading) (e.target as HTMLButtonElement).style.background = "#6D51F0"; }}
                onMouseLeave={e => { if (!loading) (e.target as HTMLButtonElement).style.background = "#7B61FF"; }}
              >
                {loading ? "Creating account…" : "Create Account"}
              </button>

            </form>
          )}
        </div>

        {/* Login link */}
        <div style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "#94A3B8" }}>
          Already have an account?{" "}
          <button
            onClick={onGoToLogin}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#7B61FF", fontWeight: 600, fontSize: 13,
              fontFamily: "inherit", padding: 0,
            }}
          >
            Sign in
          </button>
        </div>

      </div>
    </div>
  );
}
