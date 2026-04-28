import { useEffect, useState } from "react";

const ENTER_DURATION_MS = 2400;
const EXIT_DURATION_MS = 500;

export default function AppOpeningAnimation() {
  const [phase, setPhase] = useState(() => {
    if (typeof window === "undefined") {
      return "hidden";
    }

    if (window.__lfOpeningAnimationShown) {
      return "hidden";
    }

    window.__lfOpeningAnimationShown = true;
    return "visible";
  });

  useEffect(() => {
    if (phase !== "visible") {
      return undefined;
    }

    const enterTimer = window.setTimeout(() => {
      setPhase("exit");
    }, ENTER_DURATION_MS);

    const exitTimer = window.setTimeout(() => {
      setPhase("hidden");
    }, ENTER_DURATION_MS + EXIT_DURATION_MS);

    return () => {
      window.clearTimeout(enterTimer);
      window.clearTimeout(exitTimer);
    };
  }, [phase]);

  if (phase === "hidden") {
    return null;
  }

  return (
    <div className={`app-opening-overlay ${phase === "exit" ? "closing" : ""}`}>
      <div className="app-opening-backdrop-layer"></div>
      <div className="app-opening-pulse pulse-a"></div>
      <div className="app-opening-pulse pulse-b"></div>

      <div className="app-opening-core">
        <div className="app-opening-ring ring-one"></div>
        <div className="app-opening-ring ring-two"></div>
        <div className="app-opening-logo">L&amp;F</div>
      </div>

      <h1 className="app-opening-title">Campus Finder</h1>
      <p className="app-opening-subtitle">AI Guided Lost and Found Operations</p>
    </div>
  );
}