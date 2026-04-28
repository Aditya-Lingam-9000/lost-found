import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { NativeBiometric } from "capacitor-native-biometric";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth } from "../utils/config/firebaseConfig";
import { useSettings } from "./SettingsProvider";

export default function BiometricGate() {
  const { preferences } = useSettings();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser || null);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !Capacitor.isNativePlatform() || !preferences.biometricLogin) {
      return undefined;
    }

    let active = true;

    const requestUnlock = async () => {
      setStatus("pending");
      setErrorMessage("");

      try {
        const availability = await NativeBiometric.isAvailable();
        if (!availability?.isAvailable) {
          setStatus("unavailable");
          setErrorMessage("Device biometrics are not available on this phone.");
          return;
        }

        await NativeBiometric.verifyIdentity({
          reason: "Unlock Campus Finder",
          title: "Biometric unlock",
          subtitle: "Use fingerprint or face recognition to continue",
          description: "Biometric authentication is required because the setting is enabled.",
        });

        if (active) {
          setStatus("unlocked");
        }
      } catch (error) {
        if (!active) {
          return;
        }

        setStatus("failed");
        setErrorMessage(error?.message || "Biometric authentication was cancelled or failed.");
      }
    };

    requestUnlock();

    return () => {
      active = false;
    };
  }, [preferences.biometricLogin, user]);

  if (!user || !Capacitor.isNativePlatform() || !preferences.biometricLogin || status === "unlocked") {
    return null;
  }

  return (
    <div className="biometric-gate">
      <div className="biometric-card card">
        <div className="biometric-icon">⇪</div>
        <h2>Biometric Unlock</h2>
        <p>{errorMessage || "Confirm your fingerprint or face to open the app."}</p>
        <div className="biometric-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            Try Again
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={async () => {
              await signOut(auth);
              navigate("/login");
            }}
          >
            Use Login
          </button>
        </div>
      </div>
    </div>
  );
}
