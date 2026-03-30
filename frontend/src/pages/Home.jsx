import { Link, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../utils/config/firebaseConfig";

export default function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState(auth.currentUser);
  const bg3dRef = useRef(null);
  const wrapperRef = useRef(null);
  const gridLinesRef = useRef(null);
  const heroContentRef = useRef(null);
  const heroGraphicRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  const handleAuthAction = async () => {
    if (!user) {
      navigate("/login");
      return;
    }

    try {
      await signOut(auth);
      navigate("/");
    } catch (error) {
      console.error("Failed to sign out:", error);
    }
  };

  useEffect(() => {
    const supportsFinePointer = window.matchMedia("(pointer: fine)").matches;
    const desktopMedia = window.matchMedia("(min-width: 1025px)");

    // Reveal logic
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.home8-reveal').forEach((el) => {
      observer.observe(el);
    });

    // Additional desktop-only reveal for cards/stats/cta
    const desktopObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
          }
        });
      },
      { threshold: 0.18, rootMargin: "0px 0px -8% 0px" },
    );

    document.querySelectorAll(".home8-desktop-scroll").forEach((el) => {
      desktopObserver.observe(el);
    });

    const resetDesktopTransforms = () => {
      if (heroContentRef.current) {
        heroContentRef.current.style.transform = "";
        heroContentRef.current.style.opacity = "";
      }
      if (heroGraphicRef.current) {
        heroGraphicRef.current.style.transform = "";
      }
      if (gridLinesRef.current) {
        gridLinesRef.current.style.transform = "";
        gridLinesRef.current.style.opacity = "";
      }
      if (wrapperRef.current) {
        wrapperRef.current.style.setProperty("--home8-scroll-progress", "0");
      }
    };

    // 3D Background Mouse Interaction & Subtle Hero Parallax
    const handleMouseMove = (e) => {
      if (!supportsFinePointer) return;
      if (!bg3dRef.current) return;
      
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;
      
      // Calculate rotation based on center of screen (-1 to 1)
      const xPos = (clientX / innerWidth - 0.5) * 2; 
      const yPos = (clientY / innerHeight - 0.5) * 2; 

      // Tilt values for background
      const rotateX = yPos * -15; // Max 15 deg tilt
      const rotateY = xPos * 20;  // Max 20 deg tilt

      bg3dRef.current.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    };

    const handleScroll = () => {
      const scrollY = window.scrollY;
      const viewportHeight = window.innerHeight || 1;

      if (!desktopMedia.matches) {
        resetDesktopTransforms();
        return;
      }

      if (wrapperRef.current) {
        const progress = Math.min(scrollY / (viewportHeight * 1.8), 1);
        wrapperRef.current.style.setProperty(
          "--home8-scroll-progress",
          progress.toFixed(3),
        );
      }
      
      if (heroContentRef.current) {
        const heroRange = viewportHeight * 1.15;
        const heroShift = Math.min(scrollY * -0.18, 0);
        heroContentRef.current.style.transform = `translate3d(0, ${heroShift}px, 0)`;
        heroContentRef.current.style.opacity = `${Math.max(0.2, 1 - scrollY / heroRange)}`;
      }

      if (heroGraphicRef.current) {
        const graphicShift = Math.min(80, scrollY * 0.12);
        const graphicTilt = Math.min(8, scrollY * 0.01);
        heroGraphicRef.current.style.transform = `translate3d(0, ${-graphicShift}px, 0) rotate(${graphicTilt}deg)`;
      }

      if (gridLinesRef.current) {
        const linesShift = Math.min(58, scrollY * 0.08);
        const linesOpacity = Math.max(0.45, 1 - scrollY / (viewportHeight * 2.2));
        gridLinesRef.current.style.transform = `translate3d(0, ${linesShift}px, 0)`;
        gridLinesRef.current.style.opacity = `${linesOpacity}`;
      }
    };

    const handleDesktopResize = () => {
      if (!desktopMedia.matches) {
        resetDesktopTransforms();
      }
      handleScroll();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('scroll', handleScroll, { passive: true });

    if (typeof desktopMedia.addEventListener === "function") {
      desktopMedia.addEventListener("change", handleDesktopResize);
    } else {
      desktopMedia.addListener(handleDesktopResize);
    }

    handleScroll();

    return () => {
      observer.disconnect();
      desktopObserver.disconnect();
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('scroll', handleScroll);

      if (typeof desktopMedia.removeEventListener === "function") {
        desktopMedia.removeEventListener("change", handleDesktopResize);
      } else {
        desktopMedia.removeListener(handleDesktopResize);
      }

      resetDesktopTransforms();
    };
  }, []);

  return (
    <div className="home8-wrapper" ref={wrapperRef}>
      {/* FIXED 3D BACKGROUND */}
      <div className="home8-bg-fixed">
        <div className="home8-bg-3d-scene" ref={bg3dRef}>
           <div className="home8-3d-grid"></div>
           <div className="home8-3d-shape ring-1"></div>
           <div className="home8-3d-shape ring-2"></div>
           <div className="home8-3d-shape ring-3"></div>
        </div>
      </div>

      <div className="home8-grid-lines" ref={gridLinesRef}>
        <div className="home8-line"></div>
        <div className="home8-line"></div>
        <div className="home8-line"></div>
        <div className="home8-line"></div>
        <div className="home8-line"></div>
      </div>
      
      {/* SECTION 1: HERO */}
      <section className="home8-section home8-hero">
        <header className="home8-header">
          <div className="home8-logo-area">
            <Link to="/" className="home8-logo-text">
              <span className="home8-logo-accent">L</span>&<span className="home8-logo-accent">F</span> FINDER
            </Link>
          </div>
          <div className="home8-header-right">
            {user ? (
              <button type="button" className="home8-btn" onClick={handleAuthAction}>
                LOGOUT
              </button>
            ) : (
              <button type="button" className="home8-btn" onClick={handleAuthAction}>
                LOGIN
              </button>
            )}
          </div>
        </header>

        <div className="home8-hero-inner">
          <div className="home8-hero-content home8-reveal" ref={heroContentRef}>
            <h1>Your guide to<br />the campus<br />lost & found.</h1>
            <p className="home8-hero-subtitle">
              <span className="home8-subtitle-icon">+</span> AI MATCHING ACTIVE
            </p>
            <p className="home8-hero-desc">
              We are <strong>L&F FINDER</strong>. We create powerful AI workflows to match 
              lost belongings and scale recovery rates safely.
            </p>
            <Link to={user ? "/dashboard" : "/login"} className="home8-btn-solid">START MATCHING NOW</Link>
          </div>

          <div className="home8-hero-graphic home8-reveal" ref={heroGraphicRef}>
            <div className="home8-neon-mesh">
              L&F
            </div>
          </div>
        </div>

        <div className="home8-scroll-indicator">
          <span>FIND ITEMS</span>
          <div className="home8-scroll-line"></div>
        </div>
      </section>

      {/* SECTION 2: HOW IT WORKS / ABOUT */}
      <section id="features" className="home8-section home8-features">
        <div className="home8-features-row home8-reveal">
          <div className="home8-feature-heading">
            <h2>Transforming<br/><span className="home8-text-accent">Recovery</span>.</h2>
          </div>
          <div className="home8-feature-grid">
            <div className="home8-feature-card home8-desktop-scroll" style={{ "--desktop-delay": "50ms" }}>
              <h3>Upload & Scan</h3>
              <p>Easily post physical descriptions and images of lost or found items. Our database securely ingests and categorizes submissions.</p>
            </div>
            <div className="home8-feature-card home8-desktop-scroll" style={{ "--desktop-delay": "120ms" }}>
              <h3>AI Verification</h3>
              <p>Our intelligent text and image models analyze similarities, sending you highly confident matching leads.</p>
            </div>
            <div className="home8-feature-card home8-desktop-scroll" style={{ "--desktop-delay": "190ms" }}>
              <h3>Secure Handovers</h3>
              <p>Connect with verifed campus members anonymously via in-app chat to arrange a secure, face-to-face handover.</p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: CTA & FOOTER */}
      <section id="stats" className="home8-section home8-cta">
        <div className="home8-cta-inner home8-reveal">
          <h2>Lost something important?</h2>
          <p>Don't wait. The faster you act, the higher the chance of recovery using our AI ecosystem.</p>
          <div className="home8-stats-row">
            <div className="home8-stat home8-desktop-scroll" style={{ "--desktop-delay": "70ms" }}>
              <strong>1.2K+</strong>
              <span>Items Located</span>
            </div>
            <div className="home8-stat home8-desktop-scroll" style={{ "--desktop-delay": "140ms" }}>
              <strong>98%</strong>
              <span>Accuracy</span>
            </div>
            <div className="home8-stat home8-desktop-scroll" style={{ "--desktop-delay": "210ms" }}>
              <strong>Zero</strong>
              <span>Cost</span>
            </div>
          </div>
        </div>
      </section>

      <footer className="home8-footer">
        <p>This project uses AI mapping strings and temporary cookies to match items with highest precision. By continuing, you agree to our usage policies.<span className="home8-footer-agree"> AGREE +</span></p>
      </footer>
    </div>
  );
}
