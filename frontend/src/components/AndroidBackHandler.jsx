import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";

export default function AndroidBackHandler() {
  const navigate = useNavigate();
  const location = useLocation();
  const pathnameRef = useRef(location.pathname);

  useEffect(() => {
    pathnameRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return undefined;
    }

    let backButtonListener;

    const registerBackHandler = async () => {
      backButtonListener = await CapacitorApp.addListener(
        "backButton",
        ({ canGoBack }) => {
          if (canGoBack || window.history.length > 1) {
            window.history.back();
            return;
          }

          if (pathnameRef.current !== "/") {
            navigate(-1);
          }
        },
      );
    };

    registerBackHandler();

    return () => {
      backButtonListener?.remove();
    };
  }, [navigate]);

  return null;
}