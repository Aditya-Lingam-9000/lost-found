import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../utils/config/firebaseConfig";
import { apiUrl, assetUrl } from "../utils/config/apiConfig";

const statusPriority = {
  pending: 0,
  approved: 1,
  resolved: 2,
  rejected: 3,
};

const toPercentageValue = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  const normalized = num <= 1 ? num * 100 : num;
  return Math.max(0, Math.min(100, normalized));
};

const toPercentageLabel = (value) => `${Math.round(toPercentageValue(value))}%`;

const resolveImageUrl = (imagePath) => {
  return assetUrl(imagePath);
};

const formatDate = (rawDate) => {
  if (!rawDate) return "Unknown date";
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return rawDate;
  return parsed.toLocaleDateString();
};

export default function Match() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [myMatches, setMyMatches] = useState([]);
  const [lostById, setLostById] = useState({});
  const [foundById, setFoundById] = useState({});
  const [matchDetailsById, setMatchDetailsById] = useState({});

  const [selectedMatchId, setSelectedMatchId] = useState(searchParams.get("match_id") || "");
  const [selectedChatId, setSelectedChatId] = useState(searchParams.get("chat_id") || "");
  const [explanation, setExplanation] = useState(null);
  const [isExplanationLoading, setIsExplanationLoading] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 768px)").matches
      : false,
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const handleMediaChange = (event) => setIsMobileViewport(event.matches);

    setIsMobileViewport(mediaQuery.matches);
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleMediaChange);
      return () => mediaQuery.removeEventListener("change", handleMediaChange);
    }

    mediaQuery.addListener(handleMediaChange);
    return () => mediaQuery.removeListener(handleMediaChange);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        navigate("/login");
      }
    });
    return () => unsub();
  }, [navigate]);

  useEffect(() => {
    setSelectedMatchId(searchParams.get("match_id") || "");
    setSelectedChatId(searchParams.get("chat_id") || "");
  }, [searchParams]);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(apiUrl(`/my_data?user_id=${user.uid}`));
        const data = await response.json();
        if (!data.success) return;

        const sortedMatches = [...(data.matches || [])].sort((a, b) => {
          const aPriority = statusPriority[a.status] ?? 99;
          const bPriority = statusPriority[b.status] ?? 99;
          if (aPriority !== bPriority) return aPriority - bPriority;
          return String(b.created_at || "").localeCompare(String(a.created_at || ""));
        });

        setMyMatches(sortedMatches);
        setLostById(
          Object.fromEntries((data.lost_items || []).map((item) => [item.lost_id, item])),
        );
        setFoundById(
          Object.fromEntries((data.found_items || []).map((item) => [item.found_id, item])),
        );

        // Pull full pair details so both sides (lost/found) are visible in analysis.
        try {
          const detailsResponse = await fetch(apiUrl("/admin/matches"));
          const detailsData = await detailsResponse.json();
          if (detailsData.success) {
            const myMatchIds = new Set(sortedMatches.map((m) => m.match_id));
            const detailMap = {};
            for (const detail of detailsData.matches || []) {
              if (myMatchIds.has(detail.match_id)) {
                detailMap[detail.match_id] = detail;
              }
            }
            setMatchDetailsById(detailMap);
          }
        } catch (error) {
          console.error("Failed to fetch match details:", error);
        }

        const queryMatchId = searchParams.get("match_id");
        if (queryMatchId) {
          const existing = sortedMatches.find((m) => m.match_id === queryMatchId);
          if (!existing) {
            const next = new URLSearchParams(searchParams);
            next.delete("match_id");
            next.delete("chat_id");
            setSearchParams(next, { replace: true });
          }
        }
      } catch (error) {
        console.error("Failed to fetch match data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [searchParams, setSearchParams, user]);

  const selectedMatch = useMemo(
    () => myMatches.find((match) => match.match_id === selectedMatchId) || null,
    [myMatches, selectedMatchId],
  );

  const selectedMatchDetails = selectedMatch ? matchDetailsById[selectedMatch.match_id] : null;
  const selectedLostItem =
    selectedMatchDetails?.lost_item || (selectedMatch ? lostById[selectedMatch.lost_id] : null);
  const selectedFoundItem =
    selectedMatchDetails?.found_item || (selectedMatch ? foundById[selectedMatch.found_id] : null);

  useEffect(() => {
    const shouldLockScroll = isMobileViewport && Boolean(selectedMatch);
    document.body.classList.toggle("match-mobile-overlay-open", shouldLockScroll);

    return () => {
      document.body.classList.remove("match-mobile-overlay-open");
    };
  }, [isMobileViewport, selectedMatch]);

  useEffect(() => {
    if (!selectedMatch) {
      setExplanation(null);
      return;
    }

    const fetchExplanation = async () => {
      setIsExplanationLoading(true);
      try {
        const response = await fetch(apiUrl(`/match/${selectedMatch.match_id}/explanation`));
        const data = await response.json();
        if (data.success) {
          setExplanation(data.explanation || null);
        } else {
          setExplanation(null);
        }
      } catch (error) {
        console.error("Failed to fetch match explanation:", error);
        setExplanation(null);
      } finally {
        setIsExplanationLoading(false);
      }
    };

    fetchExplanation();
  }, [selectedMatch]);

  const handleSelectMatch = (match) => {
    const next = new URLSearchParams(searchParams);
    next.set("match_id", match.match_id);
    if (match.chat_id) {
      next.set("chat_id", match.chat_id);
    } else {
      next.delete("chat_id");
    }
    setSearchParams(next);
  };

  const clearSelection = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("match_id");
    next.delete("chat_id");
    setSearchParams(next);
  };

  const scoreForDisplay = explanation?.overall_confidence ?? selectedMatch?.score ?? 0;
  const scoreBarWidth = `${toPercentageValue(scoreForDisplay)}%`;
  const activeChatId = selectedChatId || selectedMatch?.chat_id || "";
  const matchStatus = String(selectedMatch?.status || "").toLowerCase();
  const isPendingTask = matchStatus === "pending" || matchStatus === "approved";
  const canVerifyAndChat = Boolean(activeChatId) && isPendingTask;

  const renderMatchAnalysisContent = (isModalView = false) => {
    if (!selectedMatch) {
      return (
        <div className="match-detail-empty">
          <h3>Select a match to view AI analysis</h3>
          <p>
            Open any match from the list to review confidence, item details,
            uploaded images, and verification chat action.
          </p>
        </div>
      );
    }

    return (
      <>
        {isModalView && (
          <div className="match-mobile-modal-head">
            <strong>AI Match Analysis</strong>
            <button
              type="button"
              className="match-mobile-close-btn"
              onClick={clearSelection}
              aria-label="Close match analysis"
            >
              X
            </button>
          </div>
        )}

        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <h2 className="page-gradient-title" style={{ fontSize: "2rem", marginBottom: "8px" }}>
            AI Match Analysis
          </h2>
          <p style={{ color: "var(--text-muted)" }}>
            Match #{selectedMatch.match_id} | Verification: {selectedMatch.verification_status || "pending"}
          </p>
        </div>

        <div className="match-score-panel">
          <h3
            style={{
              marginBottom: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            Confidence Score
            <span className={`match-mini-status ${selectedMatch.status || "pending"}`}>
              {selectedMatch.status || "pending"}
            </span>
          </h3>
          <h1 id="match-score-text" style={{ fontSize: "3rem", marginBottom: "16px" }}>
            {toPercentageLabel(scoreForDisplay)}
          </h1>
          <div className="score-bar-container">
            <div className="score-bar" style={{ width: scoreBarWidth }}></div>
          </div>
        </div>

        <div className="match-comparison">
          <div className="match-item">
            <h3 style={{ color: "var(--danger)", marginBottom: "16px" }}>Lost Item</h3>
            {resolveImageUrl(selectedLostItem?.image_path) ? (
              <img
                src={resolveImageUrl(selectedLostItem?.image_path)}
                alt={selectedLostItem?.item_name || "Lost item"}
                className="match-item-image"
              />
            ) : (
              <div className="item-thumb-placeholder" style={{ marginBottom: "16px" }}>
                No image uploaded
              </div>
            )}
            <h4>{selectedLostItem?.item_name || "Unknown item"}</h4>
            <p style={{ color: "var(--text-muted)", marginTop: "8px" }}>
              {selectedLostItem?.description || "No description provided."}
            </p>
            <p style={{ marginTop: "12px", fontWeight: "500" }}>
              {selectedLostItem?.location || "Unknown location"} | {formatDate(selectedLostItem?.date)}
            </p>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                background: "var(--border)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "bold",
              }}
            >
              VS
            </div>
          </div>

          <div className="match-item">
            <h3 style={{ color: "var(--secondary)", marginBottom: "16px" }}>Found Item</h3>
            {resolveImageUrl(selectedFoundItem?.image_path) ? (
              <img
                src={resolveImageUrl(selectedFoundItem?.image_path)}
                alt={selectedFoundItem?.item_name || "Found item"}
                className="match-item-image"
              />
            ) : (
              <div className="item-thumb-placeholder" style={{ marginBottom: "16px" }}>
                No image uploaded
              </div>
            )}
            <h4>{selectedFoundItem?.item_name || "Unknown item"}</h4>
            <p style={{ color: "var(--text-muted)", marginTop: "8px" }}>
              {selectedFoundItem?.description || "No description provided."}
            </p>
            <p style={{ marginTop: "12px", fontWeight: "500" }}>
              {selectedFoundItem?.location || "Unknown location"} | {formatDate(selectedFoundItem?.date)}
            </p>
          </div>
        </div>

        {isExplanationLoading ? (
          <p style={{ marginTop: "14px", color: "var(--text-muted)" }}>
            Loading AI explanation...
          </p>
        ) : explanation?.scoring_breakdown ? (
          <div className="match-breakdown-grid">
            <div className="match-breakdown-card">
              <strong>Text Match</strong>
              <p>{toPercentageLabel(explanation.scoring_breakdown.text_match?.score || 0)}</p>
            </div>
            <div className="match-breakdown-card">
              <strong>Location Plausibility</strong>
              <p>{toPercentageLabel(explanation.scoring_breakdown.location_plausibility?.score || 0)}</p>
            </div>
            <div className="match-breakdown-card">
              <strong>Time Plausibility</strong>
              <p>{toPercentageLabel(explanation.scoring_breakdown.time_plausibility?.score || 0)}</p>
            </div>
            <div className="match-breakdown-card">
              <strong>Risk Level</strong>
              <p style={{ textTransform: "capitalize" }}>
                {explanation.risk_assessment?.priority_level || "normal"}
              </p>
            </div>
          </div>
        ) : null}

        <div className="match-action-row">
          {canVerifyAndChat ? (
            <Link
              to={`/chat?chat_id=${activeChatId}&match_id=${selectedMatch.match_id}`}
              className="btn btn-primary"
              style={{ width: "100%", textAlign: "center" }}
            >
              Verify & Chat
            </Link>
          ) : (
            <button className="btn btn-secondary" disabled style={{ width: "100%" }}>
              {isPendingTask ? "Chat Not Available" : "Case Already Closed"}
            </button>
          )}

          <button className="btn btn-secondary" onClick={clearSelection}>
            {isModalView ? "Close" : "Back To Match List"}
          </button>
        </div>
      </>
    );
  };

  if (!user) return null;

  return (
    <>
      <header className="nav mobile-hide-top-nav">
        <div className="container nav-inner">
          <Link to="/dashboard" className="brand">
            <span>Back to Dashboard</span>
          </Link>
        </div>
      </header>

      <main className="main-content container fade-in match-main" style={{ maxWidth: "1120px" }}>
        <div className="match-hub-grid">
          <section className="card slide-up match-list-card">
            <div className="section-header" style={{ marginBottom: "12px" }}>
              <h2>Detected Matches</h2>
            </div>

            {isLoading ? (
              <p style={{ color: "var(--text-muted)" }}>Loading your match list...</p>
            ) : myMatches.length === 0 ? (
              <p style={{ color: "var(--text-muted)" }}>
                No matches found yet. Once AI detects a match, it will appear here.
              </p>
            ) : (
              <div className="match-list">
                {myMatches.map((match) => {
                  const isActive = match.match_id === selectedMatchId;
                  return (
                    <button
                      key={match.match_id}
                      type="button"
                      className={`match-list-item ${isActive ? "active" : ""}`}
                      onClick={() => handleSelectMatch(match)}
                    >
                      <div className="match-list-item-top">
                        <strong>Match #{match.match_id}</strong>
                        <span className={`match-mini-status ${match.status || "pending"}`}>
                          {match.status || "pending"}
                        </span>
                      </div>
                      <p>Score: {toPercentageLabel(match.score)}</p>
                      <p>Lost: {match.lost_id} | Found: {match.found_id}</p>
                    </button>
                  );
                })}
              </div>
            )}

            {isMobileViewport && myMatches.length > 0 && !selectedMatch && (
              <p className="match-mobile-hint">
                Tap a match to open AI analysis in a popup.
              </p>
            )}
          </section>

          {!isMobileViewport && (
            <section className="card slide-up match-detail-panel">
              {renderMatchAnalysisContent(false)}
            </section>
          )}
        </div>

        {isMobileViewport && selectedMatch && (
          <section
            id="match-analysis-overlay"
            className="match-analysis-overlay"
            onClick={(e) => {
              if (e.target.id === "match-analysis-overlay") {
                clearSelection();
              }
            }}
          >
            <div className="card slide-up match-analysis-modal" onClick={(e) => e.stopPropagation()}>
              {renderMatchAnalysisContent(true)}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
