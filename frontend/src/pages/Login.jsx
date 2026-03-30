import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  auth,
  provider,
  signInWithPopup,
  signInWithRedirect,
} from "../utils/config/firebaseConfig";

export default function Login() {
  const navigate = useNavigate();
  const [isLogingIn, setIsLogingIn] = useState(false);
  const [loginError, setLoginError] = useState("");

  const handleLogin = async () => {
    try {
      setIsLogingIn(true);
      setLoginError("");
      await signInWithPopup(auth, provider);

      // 1.5s attractive animation
      setTimeout(() => {
        navigate("/dashboard");
      }, 1500);
    } catch (error) {
      console.error("Login failed:", error);

      // On some browsers/hosts popup can be blocked or instantly closed.
      if (
        error?.code === "auth/popup-blocked" ||
        error?.code === "auth/popup-closed-by-user"
      ) {
        try {
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectError) {
          console.error("Redirect login failed:", redirectError);
        }
      }

      if (error?.code === "auth/unauthorized-domain") {
        setLoginError(
          "This website domain is not authorized in Firebase Authentication settings."
        );
      } else {
        setLoginError(error?.message || "Google login failed. Please try again.");
      }

      setIsLogingIn(false);
    }
  };

  return (
    <>
      {isLogingIn && (
        <div className="full-screen-loader">
          <div className="spinner-ring"></div>
          <p className="loading-text">AUTHENTICATING...</p>
        </div>
      )}

      <header className="nav">
        <div className="container nav-inner">
          <Link to="/" className="brand">
            <span>Campus Finder</span>
          </Link>
        </div>
      </header>

      <main
        className="main-content container fade-in auth-main"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "calc(100vh - 70px)",
        }}
      >
        <div
          className="card slide-up auth-box"
          style={{
            padding: "48px",
            transition: "all 0.3s ease",
            transform: isLogingIn ? "scale(0.95)" : "scale(1)",
          }}
        >
          <div style={{ fontSize: "3.5rem", marginBottom: "16px" }}></div>
          <h2 className="page-gradient-title">Welcome Back</h2>
          <p>Sign in to post items, view AI matches, and verify owners.</p>

          {loginError && (
            <p
              style={{
                marginTop: "12px",
                color: "#b91c1c",
                fontSize: "0.92rem",
                lineHeight: 1.4,
              }}
            >
              {loginError}
            </p>
          )}

          <button
            onClick={handleLogin}
            type="button"
            className="btn btn-secondary"
            style={{
              width: "100%",
              border: "1px solid var(--border)",
              padding: "14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
              marginTop: "24px",
              fontSize: "1.05rem",
              transition:
                "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "var(--shadow-md)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              ></path>
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              ></path>
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              ></path>
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              ></path>
            </svg>
            Continue with Google
          </button>

          <p
            style={{
              marginTop: "24px",
              fontSize: "0.85rem",
              color: "var(--text-muted)",
            }}
          >
            Please use your college issued Google account to verify your
            identity on our campus portal.
          </p>
        </div>
      </main>
    </>
  );
}
