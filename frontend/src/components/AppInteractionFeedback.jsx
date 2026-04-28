import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { useSettings } from "./SettingsProvider";

const INTERACTIVE_SELECTOR = [
  "button",
  "a",
  "input[type='button']",
  "input[type='submit']",
  "input[type='checkbox']",
  "input[type='radio']",
  "[role='button']",
  ".bottom-nav-item",
  ".mobile-bottom-nav a",
].join(",");

export default function AppInteractionFeedback() {
  const { preferences } = useSettings();
  const lastPulseRef = useRef(0);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !preferences.hapticFeedback) {
      return undefined;
    }

    const handlePointerDown = async (event) => {
      const target = event.target?.closest?.(INTERACTIVE_SELECTOR);
      if (!target) return;

      const now = Date.now();
      if (now - lastPulseRef.current < 120) return;
      lastPulseRef.current = now;

      try {
        await Haptics.impact({ style: ImpactStyle.Light });
      } catch (error) {
        console.error("Haptics pulse failed:", error);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [preferences.hapticFeedback]);

  return null;
}
