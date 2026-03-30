import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const TARGET_SELECTOR = [
  ".glass-card",
  ".card",
  ".auth-box",
  ".home-section",
  ".chat-shell",
  ".admin-match-card",
  ".incentive-stat",
  ".match-item",
  ".section-head",
  ".items-grid > *",
].join(",");

export default function ScrollAnimator() {
  const location = useLocation();

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll(TARGET_SELECTOR));
    if (!nodes.length) return undefined;

    nodes.forEach((node, index) => {
      node.classList.add("scroll-animate");
      node.classList.remove("from-up", "from-down", "in-view");
      node.classList.add(index % 2 === 0 ? "from-up" : "from-down");
      node.style.setProperty("--scroll-delay", `${Math.min(index * 35, 280)}ms`);
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.classList.toggle("in-view", entry.isIntersecting);
        });
      },
      {
        threshold: 0.14,
        rootMargin: "0px 0px -10% 0px",
      },
    );

    nodes.forEach((node) => observer.observe(node));

    return () => observer.disconnect();
  }, [location.pathname]);

  return null;
}
