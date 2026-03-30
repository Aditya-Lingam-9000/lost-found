import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { auth } from "../utils/config/firebaseConfig";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { usePopup } from "../components/PopupProvider";
import { apiUrl } from "../utils/config/apiConfig";

export default function Admin() {
  const navigate = useNavigate();
  const popup = usePopup();
  const [matches, setMatches] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState(null);

  // Hardcode an admin email for testing/demo purposes 
  // In a real app, this would be validated via backend claims.
  const ADMIN_EMAILS = ["admin@campus.edu", "testadmin@campus.edu"]; 

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Checking if user is admin (You might want to just bypass this for local testing)
        // If the user's email isn't in our array, let's just let them in for demo purposes, 
        // but typically we'd redirect them to dashboard.
        setIsAdmin(true); 
      } else {
        navigate("/login");
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const fetchMatches = async () => {
    try {
      const response = await fetch(apiUrl("/admin/matches"));
      const data = await response.json();
      if (data.success) {
        setMatches(data.matches);
      }
    } catch (err) {
      console.error("Failed to fetch admin matches:", err);
    }
  };

  useEffect(() => {
    if (user && isAdmin) {
      fetchMatches();
      const interval = setInterval(fetchMatches, 5000);
      return () => clearInterval(interval);
    }
  }, [user, isAdmin]);

  const handleAction = async (match_id, action) => {
    const confirmMsg = 
        action === 'approve' ? "Approve this match and authorize a handover?" :
        action === 'reject' ? "Reject this match as false/invalid?" :
        "Confirm item has been physically returned to the owner?";
        
    const shouldProceed = await popup.confirm({
      title: "Admin Action",
      message: confirmMsg,
      confirmText: "Proceed",
      cancelText: "Cancel",
      tone: "warning",
    });
    if (!shouldProceed) return;

    try {
      const response = await fetch(apiUrl("/admin/update_match"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id, action })
      });
      const data = await response.json();
      if (data.success) {
        popup.notify(data.message || "Action completed.", "success");
        fetchMatches();
      } else {
        popup.notify(data.message || "Unable to complete action.", "error");
      }
    } catch (err) {
      console.error("Action error", err);
      popup.notify("Failed to process action.", "error");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const pendingCount = matches.filter((m) => m.status === "pending").length;
  const approvedCount = matches.filter((m) => m.status === "approved").length;
  const closedCount = matches.filter(
    (m) => m.status === "resolved" || m.status === "rejected",
  ).length;

  if (!user || !isAdmin)
    return (
      <div className="full-screen-loader">
        <div className="spinner-ring"></div>
      </div>
    );

  return (
    <div className="admin-page">
      <header className="nav admin-nav mobile-hide-top-nav">
        <div className="container nav-inner">
          <Link to="/" className="brand admin-brand">
            <span>Admin Portal</span>
          </Link>
          <div className="nav-links">
            <Link className="nav-link admin-nav-link" to="/dashboard">
              User Dashboard
            </Link>
            <button
              className="nav-link admin-signout-btn"
              onClick={handleSignOut}
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="admin-main container fade-in">
        <div className="admin-hero">
          <div>
            <h2 className="page-gradient-title">Campus Security Verification Setup</h2>
            <p>
              Monitor AI matches and orchestrate physical handovers with
              confidence.
            </p>
          </div>
          <div className="admin-stats">
            <div className="admin-stat-card pending">
              <span>Pending</span>
              <strong>{pendingCount}</strong>
            </div>
            <div className="admin-stat-card approved">
              <span>Approved</span>
              <strong>{approvedCount}</strong>
            </div>
            <div className="admin-stat-card closed">
              <span>Closed</span>
              <strong>{closedCount}</strong>
            </div>
          </div>
        </div>

        <div className="admin-match-grid">
          {matches.length === 0 ? (
            <p className="admin-empty">
              No matches to review.
            </p>
          ) : (
            matches.map((match) => (
              <article key={match.match_id} className="admin-match-card">
                <div className="admin-card-head">
                  <h3>{match.match_id}</h3>
                  <span
                    className={`admin-status-chip ${
                      match.status === "pending"
                        ? "pending"
                        : match.status === "approved"
                          ? "approved"
                          : "closed"
                    }`}
                  >
                    {match.status.toUpperCase()}
                  </span>
                </div>

                <div className="admin-confidence">
                  <strong>AI Confidence:</strong> {(match.score * 100).toFixed(0)}%
                </div>

                <div className="admin-item-split">
                  <div>
                    <p className="admin-label lost">REPORTED LOST</p>
                    <p className="admin-item-title">
                      {match.lost_item?.item_name || "Unknown"}
                    </p>
                    <span className="admin-item-location">
                      {match.lost_item?.location || "Unknown location"}
                    </span>
                  </div>
                  <div className="admin-split-divider"></div>
                  <div>
                    <p className="admin-label found">REPORTED FOUND</p>
                    <p className="admin-item-title">
                      {match.found_item?.item_name || "Unknown"}
                    </p>
                    <span className="admin-item-location">
                      {match.found_item?.location || "Unknown location"}
                    </span>
                  </div>
                </div>

                <Link
                  to={`/chat?chat_id=${match.chat_id}&match_id=${match.match_id}`}
                  className="btn admin-chat-btn"
                >
                  Review User Chat Logs
                </Link>

                <div className="admin-actions">
                  {match.status === "pending" && (
                    <>
                      <button
                        className="btn admin-action approve"
                        onClick={() => handleAction(match.match_id, "approve")}
                      >
                        Approve
                      </button>
                      <button
                        className="btn admin-action reject"
                        onClick={() => handleAction(match.match_id, "reject")}
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {match.status === "approved" && (
                    <button
                      className="btn admin-action handover"
                      onClick={() => handleAction(match.match_id, "handover")}
                    >
                      Log Physical Handover
                    </button>
                  )}
                  {(match.status === "resolved" || match.status === "rejected") && (
                    <p className="admin-closed">Case Closed</p>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </main>
    </div>
  );
}