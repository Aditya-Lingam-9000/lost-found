import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { auth } from "../utils/config/firebaseConfig";
import { onAuthStateChanged, signOut } from "firebase/auth";
import LocationPicker from "../components/LocationPicker";
import { usePopup } from "../components/PopupProvider";
import { apiUrl, assetUrl } from "../utils/config/apiConfig";

export default function Dashboard() {
  const navigate = useNavigate();
  const popup = usePopup();
  // activeForm: "none" | "lost" | "selectFound" | "quick" | "standard"
  const [activeForm, setActiveForm] = useState("none");

  const [lostData, setLostData] = useState({
    item_name: "",
    description: "",
    location: "",
    date: "",
    image: null,
  });
  const [foundData, setFoundData] = useState({
    item_name: "",
    description: "",
    location: "",
    date: "",
    image: null,
    verify_item_type: "",
    verify_color: "",
    verify_unique_mark: "",
    verify_inside_contents: "",
    verify_found_spot: "",
    verify_optional_1: "",
    verify_optional_2: "",
  });
  const [quickFoundData, setQuickFoundData] = useState({
    item_name: "",
    location: "",
    description: "",
    date: "",
    image: null,
  });

  const [myLostItems, setMyLostItems] = useState([]);
  const [myFoundItems, setMyFoundItems] = useState([]);
  const [myMatches, setMyMatches] = useState([]);

  const [user, setUser] = useState(null);

  // New States for loading and Modal
  const [isGlobalLoading, setIsGlobalLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showAllCompleted, setShowAllCompleted] = useState(false);
  const [incentiveProfile, setIncentiveProfile] = useState({
    finder_points: 0,
    returns_count: 0,
    badge_level: "starter",
    trust_tier: "bronze",
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        navigate("/login");
      }
    });

    // Enforce 1.5s attractive loading animation
    setTimeout(() => {
      setIsGlobalLoading(false);
    }, 1500);

    return () => unsubscribe();
  }, [navigate]);

  const userId = user?.uid || "U0000";
  const userIdentifier = user?.email || "User";

  const fetchMyData = async (currentUserId) => {
    if (!currentUserId || currentUserId === "U0000") return;
    try {
      const response = await fetch(
        apiUrl(`/my_data?user_id=${currentUserId}`),
      );
      const data = await response.json();
      if (data.success) {
        setMyLostItems(data.lost_items);
        setMyFoundItems(data.found_items);
        setMyMatches(data.matches);
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
    }
  };

  const fetchIncentiveProfile = async (currentUserId) => {
    if (!currentUserId || currentUserId === "U0000") return;
    try {
      const response = await fetch(
        apiUrl(`/incentives/${currentUserId}`),
      );
      const data = await response.json();
      if (data.success && data.profile) {
        setIncentiveProfile(data.profile);
      }
    } catch (err) {
      console.error("Failed to fetch incentive profile:", err);
    }
  };

  useEffect(() => {
    if (userId !== "U0000") {
      fetchMyData(userId);
      fetchIncentiveProfile(userId);
      // Poll every 3 seconds to get fresh data (including message unread/count bubbles)
      const interval = setInterval(() => {
        fetchMyData(userId);
        fetchIncentiveProfile(userId);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [userId]);

  useEffect(() => {
    const isMobileViewport = window.matchMedia("(max-width: 768px)").matches;
    const shouldLockScroll = isMobileViewport && activeForm !== "none";
    document.body.classList.toggle("dashboard-mobile-form-open", shouldLockScroll);

    return () => {
      document.body.classList.remove("dashboard-mobile-form-open");
    };
  }, [activeForm]);

  const handleFormOverlayClose = (e) => {
    const isMobileViewport = window.matchMedia("(max-width: 768px)").matches;
    if (isMobileViewport && e.target.id === "report-forms-container") {
      setActiveForm("none");
    }
  };

  const handleSignOut = async () => {
    setIsGlobalLoading(true);
    setTimeout(async () => {
      try {
        await signOut(auth);
        navigate("/");
      } catch (error) {
        console.error("Error signing out:", error);
        setIsGlobalLoading(false);
      }
    }, 1500); // 1.5s departure animation
  };

  const handleDeleteItem = async (e, type, id) => {
    e.stopPropagation(); // prevent modal opening
    const shouldDelete = await popup.confirm({
      title: "Delete Item",
      message: "Are you sure you want to permanently delete this item?",
      confirmText: "Delete",
      cancelText: "Cancel",
      tone: "warning",
    });
    if (!shouldDelete) return;

    try {
      const resp = await fetch(apiUrl("/delete_item"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_type: type, item_id: id, user_id: userId }),
      });
      const data = await resp.json();
      if (data.success) {
        fetchMyData(userId); // Refresh lists
      } else {
        popup.notify(data.message || "Unable to delete item.", "error");
      }
    } catch (err) {
      console.error(err);
      popup.notify("Failed to delete.", "error");
    }
  };

  const handleLostSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("item_name", lostData.item_name);
    formData.append("description", lostData.description);
    formData.append("location", lostData.location);
    formData.append("date", lostData.date);
    formData.append("user_id", userId);
    if (user?.email) {
      formData.append("user_email", user.email);
    }
    if (lostData.image) {
      formData.append("image", lostData.image);
    }

    try {
      const response = await fetch(apiUrl("/submit_lost"), {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (data.success) {
        popup.notify(data.message || "Lost item report submitted.", "success");
        setActiveForm("none");
        setLostData({
          item_name: "",
          description: "",
          location: "",
          date: "",
          image: null,
        });
        fetchMyData(userId);
      } else {
        popup.notify(data.message || "Unable to submit lost report.", "error");
      }
    } catch (err) {
      console.error(err);
      popup.notify("Failed to submit report.", "error");
    }
  };

  const handleFoundSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("item_name", foundData.item_name);
    formData.append("description", foundData.description);
    formData.append("location", foundData.location);
    formData.append("date", foundData.date);
    formData.append("verify_item_type", foundData.verify_item_type || "");
    formData.append("verify_color", foundData.verify_color || "");
    formData.append("verify_unique_mark", foundData.verify_unique_mark || "");
    formData.append("verify_inside_contents", foundData.verify_inside_contents || "");
    formData.append("verify_found_spot", foundData.verify_found_spot || "");
    formData.append("verify_optional_1", foundData.verify_optional_1 || "");
    formData.append("verify_optional_2", foundData.verify_optional_2 || "");
    formData.append("user_id", userId);
    if (user?.email) {
      formData.append("user_email", user.email);
    }
    if (foundData.image) {
      formData.append("image", foundData.image);
    }

    try {
      const response = await fetch(apiUrl("/submit_found"), {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (data.success) {
        popup.notify(data.message || "Found item report submitted.", "success");
        setActiveForm("none");
        setFoundData({
          item_name: "",
          description: "",
          location: "",
          date: "",
          image: null,
          verify_item_type: "",
          verify_color: "",
          verify_unique_mark: "",
          verify_inside_contents: "",
          verify_found_spot: "",
          verify_optional_1: "",
          verify_optional_2: "",
        });
        fetchMyData(userId);
      } else {
        popup.notify(data.message || "Failed to submit found item.", "error");
      }
    } catch (err) {
      console.error(err);
      popup.notify("Failed to submit report.", "error");
    }
  };

  const handleQuickFoundSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("item_name", quickFoundData.item_name);
    formData.append("location", quickFoundData.location);
    formData.append("description", quickFoundData.description || "Quick report");
    formData.append("date", quickFoundData.date);
    formData.append("user_id", userId);
    if (user?.email) {
      formData.append("user_email", user.email);
    }
    if (quickFoundData.image) {
      formData.append("image", quickFoundData.image);
    }

    try {
      const response = await fetch(apiUrl("/submit_found_quick"), {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (data.success) {
        popup.notify(
          `${data.message} Priority: ${data.item_priority}`,
          "success",
        );
        setActiveForm("none");
        setQuickFoundData({
          item_name: "",
          location: "",
          description: "",
          date: "",
          image: null,
        });
        fetchMyData(userId);
      } else {
        popup.notify(data.message || "Failed to submit quick found report.", "error");
      }
    } catch (err) {
      console.error(err);
      popup.notify("Failed to submit quick report.", "error");
    }
  };

  const formatPriorityLabel = (priority) => {
    if (priority === "critical_id") return "Critical ID";
    if (priority === "high_value") return "High Value";
    return "Normal";
  };

  const formatSlaLabel = (hours) => {
    if (!hours) return "No SLA";
    if (hours % 24 === 0) return `${hours / 24} day SLA`;
    return `${hours}h SLA`;
  };

  const activeMatches = myMatches.filter((m) => m.status === "pending" || m.status === "approved");
  const completedMatches = myMatches.filter((m) => m.status === "resolved" || m.status === "rejected");
  const resolvedMatches = myMatches.filter((m) => m.status === "resolved");

  const resolvedLostIds = resolvedMatches.map((m) => m.lost_id);
  const resolvedFoundIds = resolvedMatches.map((m) => m.found_id);

  const activeLostItems = myLostItems.filter(
    (i) => i.item_status !== "closed" && !resolvedLostIds.includes(i.lost_id),
  );
  const activeFoundItems = myFoundItems.filter(
    (i) => i.item_status !== "closed" && !resolvedFoundIds.includes(i.found_id),
  );
  const visibleCompletedMatches = showAllCompleted
    ? completedMatches
    : completedMatches.slice(0, 3);

  if (!user) return null;

  return (
    <>
      {isGlobalLoading && (
        <div className="full-screen-loader">
          <div className="spinner-ring"></div>
          <p className="loading-text">SYNCING DATA</p>
        </div>
      )}

      {selectedItem && (
        <div className="modal-overlay" onClick={() => setSelectedItem(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setSelectedItem(null)}
              style={{
                position: "absolute",
                right: "20px",
                top: "20px",
                background: "none",
                border: "none",
                fontSize: "1.5rem",
                cursor: "pointer",
                color: "var(--text-muted)",
              }}
            >
              x
            </button>
            <h2
              style={{
                marginBottom: "16px",
                color: "var(--text-main)",
                paddingRight: "30px",
              }}
            >
              {selectedItem.item_name}
            </h2>
            {selectedItem.image_path && (
              <img
                src={assetUrl(selectedItem.image_path)}
                alt="Item"
                style={{
                  width: "100%",
                  maxHeight: "200px",
                  objectFit: "cover",
                  borderRadius: "8px",
                  marginBottom: "16px",
                  border: "1px solid var(--border)",
                }}
              />
            )}
            <p>
              <strong>Location:</strong> {selectedItem.location}
            </p>
            <p>
              <strong>Date:</strong> {selectedItem.date}
            </p>
            <p
              style={{
                marginTop: "12px",
                background: "var(--bg-dark)",
                padding: "12px",
                borderRadius: "8px",
              }}
            >
              <strong>Description:</strong>
              <br />
              {selectedItem.description}
            </p>
            {selectedItem.item_priority && (
              <p style={{ marginTop: "10px" }}>
                <strong>Priority:</strong>{" "}
                <span className={`priority-pill ${selectedItem.item_priority}`}>
                  {formatPriorityLabel(selectedItem.item_priority)}
                </span>
              </p>
            )}
            {selectedItem.reporting_sla_hours && (
              <p>
                <strong>Compliance SLA:</strong> {formatSlaLabel(selectedItem.reporting_sla_hours)}
              </p>
            )}
            {selectedItem.report_channel && (
              <p>
                <strong>Report Channel:</strong> {selectedItem.report_channel}
              </p>
            )}
            <button
              className="btn btn-secondary"
              style={{ width: "100%", marginTop: "24px" }}
              onClick={() => setSelectedItem(null)}
            >
              Close Details
            </button>
          </div>
        </div>
      )}

      <header className="nav mobile-hide-top-nav">
        <div className="container nav-inner">
          <Link to="/" className="brand">
            <span>Campus Finder</span>
          </Link>
          <div className="nav-links">
            <Link className="nav-link" to="/admin" style={{ color: "var(--danger)" }}>
              Admin Portal
            </Link>
            <Link className="nav-link active" to="/dashboard">
              Dashboard
            </Link>
            <Link className="nav-link" to="/match">
              Match Analysis
            </Link>
            <button
              className="nav-link primary"
              onClick={handleSignOut}
              style={{ border: "none", cursor: "pointer" }}
            >
              Sign Out
            </button>
            <Link className="nav-link" to="/profile" style={{ display: "flex", alignItems: "center" }}>
              <img
                src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.email || "User"}&background=random`}
                alt="Profile"
                style={{ width: "36px", height: "36px", borderRadius: "50%", objectFit: "cover", border: "2px solid var(--border)" }}
              />
            </Link>
          </div>
        </div>
      </header>

      <main className="main-content container fade-in">
        <div
          className="card slide-up dashboard-summary-card"
          style={{
            marginBottom: "40px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "16px",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <div className="dashboard-summary-meta" style={{ display: "flex", gap: "16px", alignItems: "center" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                background: "var(--primary-light)",
                color: "var(--primary)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.1rem",
                fontWeight: "700",
                boxShadow: "inset 0 2px 4px rgba(0,0,0,0.1)",
              }}
            >
              ID
            </div>
            <div>
              <h2 className="page-gradient-title" style={{ fontSize: "1.2rem", marginBottom: "4px" }}>
                Operations Dashboard
              </h2>
              <div className="dashboard-mini-identity">
                <span className="identity-chip">{userIdentifier}</span>
                <span className="identity-chip">UID: {userId}</span>
              </div>
            </div>
          </div>
          <div className="dashboard-summary-actions" style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button
              className="btn btn-primary"
              onClick={() =>
                setActiveForm(activeForm === "lost" ? "none" : "lost")
              }
              style={{
                background: "var(--danger)",
                width: "auto",
                transition: "all 0.3s ease",
                transform: activeForm === "lost" ? "scale(0.95)" : "scale(1)",
              }}
            >
              + Report Lost
            </button>
            <button
              className="btn btn-primary"
              onClick={() =>
                setActiveForm(activeForm === "selectFound" ? "none" : "selectFound")
              }
              style={{
                background: "var(--secondary)",
                width: "auto",
                transition: "all 0.3s ease",
                transform: activeForm === "selectFound" ? "scale(0.95)" : "scale(1)",
              }}
            >
              + Report Found
            </button>
          </div>
        </div>

        <section className="card incentive-panel slide-up" style={{ marginBottom: "32px" }}>
          <div className="section-header" style={{ marginBottom: "16px" }}>
            <h2>Finder Rewards</h2>
          </div>
          <div className="incentive-grid">
            <div className="incentive-stat">
              <p className="incentive-label">Points</p>
              <h3>{incentiveProfile.finder_points || 0}</h3>
            </div>
            <div className="incentive-stat">
              <p className="incentive-label">Successful Returns</p>
              <h3>{incentiveProfile.returns_count || 0}</h3>
            </div>
            <div className="incentive-stat">
              <p className="incentive-label">Badge Level</p>
              <h3 style={{ textTransform: "capitalize" }}>
                {(incentiveProfile.badge_level || "starter").replaceAll("_", " ")}
              </h3>
            </div>
            <div className="incentive-stat">
              <p className="incentive-label">Trust Tier</p>
              <h3 style={{ textTransform: "capitalize" }}>
                {incentiveProfile.trust_tier || "bronze"}
              </h3>
            </div>
          </div>
        </section>

        <div
          style={{
            transition: "max-height 0.4s ease-in-out",
            overflow: "hidden",
          }}
        >
          {activeForm !== "none" && (
            <section
              id="report-forms-container"
              onClick={handleFormOverlayClose}
              style={{
                marginBottom: "40px",
                animation: "fadeIn 0.3s ease-out",
              }}
            >
              <div
                className="form-container"
                onClick={(e) => e.stopPropagation()}
                style={{ display: "flex", justifyContent: "center", width: "100%" }}
              >
                {activeForm === "selectFound" && (
                  <div
                    className="card"
                    style={{
                      width: "100%",
                      maxWidth: "900px",
                      boxShadow: "0 10px 25px -5px rgba(255, 130, 67, 0.25)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "24px",
                      }}
                    >
                      <h2 style={{ color: "var(--secondary)" }}>
                        Choose Report Type
                      </h2>
                      <button
                        onClick={() => setActiveForm("none")}
                        style={{
                          fontSize: "1.5rem",
                          color: "var(--text-muted)",
                          cursor: "pointer",
                          border: "none",
                          background: "none",
                        }}
                      >
                        X
                      </button>
                    </div>
                    <p style={{ color: "var(--text-muted)", marginBottom: "24px", textAlign: "center" }}>
                      Select the reporting method that best fits your situation
                    </p>
                    <div className="report-type-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                      <div
                        className="report-type-card"
                        onClick={() => setActiveForm("quick")}
                        style={{
                          padding: "20px",
                          border: "2px solid var(--warning)",
                          borderRadius: "12px",
                          background: "rgba(29, 78, 216, 0.08)",
                          cursor: "pointer",
                          transition: "all 0.3s ease",
                          transform: "scale(1)",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "scale(1.02)";
                          e.currentTarget.style.boxShadow = "0 4px 12px rgba(29, 78, 216, 0.3)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "scale(1)";
                          e.currentTarget.style.boxShadow = "none";
                        }}
                      >
                        <h3 style={{ color: "var(--warning)", marginBottom: "8px", fontSize: "1.2rem" }}>
                          ⚡ Quick Found (30s)
                        </h3>
                        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", lineHeight: "1.5" }}>
                          <strong>Usage:</strong> For urgent reporting when time is limited.
                        </p>
                        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "8px" }}>
                          <strong>Benefits:</strong> Chat unlocks instantly, no verification questions, perfect for students in a hurry.
                        </p>
                      </div>

                      <div
                        className="report-type-card"
                        onClick={() => setActiveForm("standard")}
                        style={{
                          padding: "20px",
                          border: "2px solid var(--secondary)",
                          borderRadius: "12px",
                          background: "rgba(29, 78, 216, 0.08)",
                          cursor: "pointer",
                          transition: "all 0.3s ease",
                          transform: "scale(1)",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "scale(1.02)";
                          e.currentTarget.style.boxShadow = "0 4px 12px rgba(29, 78, 216, 0.3)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "scale(1)";
                          e.currentTarget.style.boxShadow = "none";
                        }}
                      >
                        <h3 style={{ color: "var(--secondary)", marginBottom: "8px", fontSize: "1.2rem" }}>
                          🔒 Standard Report (Full Verification)
                        </h3>
                        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", lineHeight: "1.5" }}>
                          <strong>Usage:</strong> For high-value items or when you want maximum security.
                        </p>
                        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "8px" }}>
                          <strong>Benefits:</strong> Owner answers 7 verification questions before chat unlocks, prevents false claims.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {activeForm === "lost" && (
                  <div
                    className="card"
                    style={{
                      borderTop: "4px solid var(--danger)", width: "100%", maxWidth: "800px", width: "100%", maxWidth: "800px",
                      boxShadow: "0 10px 25px -5px rgba(29, 78, 216, 0.2)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "24px",
                      }}
                    >
                      <h2 style={{ color: "var(--danger)" }}>
                        Report Lost Item
                      </h2>
                      <button
                        onClick={() => setActiveForm("none")}
                        style={{
                          fontSize: "1.5rem",
                          color: "var(--text-muted)",
                          cursor: "pointer",
                          border: "none",
                          background: "none",
                        }}
                      >
                        X
                      </button>
                    </div>
                    <form onSubmit={handleLostSubmit}>
                      <div className="form-group">
                        <label>Item Name</label>
                        <input
                          type="text"
                          className="form-control"
                          required
                          value={lostData.item_name}
                          onChange={(e) =>
                            setLostData({
                              ...lostData,
                              item_name: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="form-group">
                        <label>Description</label>
                        <textarea
                          className="form-control"
                          rows="3"
                          required
                          value={lostData.description}
                          onChange={(e) =>
                            setLostData({
                              ...lostData,
                              description: e.target.value,
                            })
                          }
                        ></textarea>
                      </div>
                      <div className="form-group">
                        <label>Last Seen Location</label>
<input type="text" className="form-control" required placeholder="Type location or use map below..." value={lostData.location} onChange={(e) => setLostData({ ...lostData, location: e.target.value }) } />
<LocationPicker onLocationSelect={(val) => setLostData({ ...lostData, location: val })} />
</div>
                      <div className="form-group">
                        <label>Date Lost</label>
                        <input
                          type="date"
                          className="form-control"
                          required
                          value={lostData.date}
                          onChange={(e) =>
                            setLostData({ ...lostData, date: e.target.value })
                          }
                        />
                      </div>
                      <div className="form-group">
                        <label>Reference Image (Optional)</label>
                        <input
                          type="file"
                          className="form-control"
                          accept="image/*"
                          onChange={(e) =>
                            setLostData({
                              ...lostData,
                              image: e.target.files[0],
                            })
                          }
                        />
                      </div>
                      <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "12px" }}>
                        After AI finds a match, ownership will be verified in chat using guided questions.
                      </p>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ background: "var(--danger)", width: "100%" }}
                      >
                        Submit Lost Report
                      </button>
                    </form>
                  </div>
                )}

                {activeForm === "standard" && (
                  <div
                    className="card"
                    style={{
                      borderTop: "4px solid var(--secondary)", width: "100%", maxWidth: "800px", width: "100%", maxWidth: "800px",
                      boxShadow: "0 10px 25px -5px rgba(29, 78, 216, 0.2)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "24px",
                      }}
                    >
                      <h2 style={{ color: "var(--secondary)" }}>
                        Report Found Item
                      </h2>
                      <button
                        onClick={() => setActiveForm("none")}
                        style={{
                          fontSize: "1.5rem",
                          color: "var(--text-muted)",
                          cursor: "pointer",
                          border: "none",
                          background: "none",
                        }}
                      >
                        X
                      </button>
                    </div>
                    <form onSubmit={handleFoundSubmit}>
                      <div className="form-group">
                        <label>Item Name</label>
                        <input
                          type="text"
                          className="form-control"
                          required
                          value={foundData.item_name}
                          onChange={(e) =>
                            setFoundData({
                              ...foundData,
                              item_name: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="form-group">
                        <label>Description</label>
                        <textarea
                          className="form-control"
                          rows="3"
                          required
                          value={foundData.description}
                          onChange={(e) =>
                            setFoundData({
                              ...foundData,
                              description: e.target.value,
                            })
                          }
                        ></textarea>
                      </div>
                      <div className="form-group">
                        <label>Location Found</label>
<input type="text" className="form-control" required placeholder="Type location or use map below..." value={foundData.location} onChange={(e) => setFoundData({ ...foundData, location: e.target.value }) } />
<LocationPicker onLocationSelect={(val) => setFoundData({ ...foundData, location: val })} />
</div>
                      <div className="form-group">
                        <label>Date Found</label>
                        <input
                          type="date"
                          className="form-control"
                          required
                          value={foundData.date}
                          onChange={(e) =>
                            setFoundData({ ...foundData, date: e.target.value })
                          }
                        />
                      </div>
                      <div className="form-group">
                          <label>Image of Item (Optional)</label>
                        <input
                          type="file"
                          className="form-control"
                          accept="image/*"
                          onChange={(e) =>
                            setFoundData({
                              ...foundData,
                              image: e.target.files[0],
                            })
                          }
                        />
                      </div>
                      <div
                        style={{
                          margin: "10px 0 16px",
                          padding: "12px",
                          borderRadius: "8px",
                          border: "1px dashed var(--border)",
                          background: "var(--bg-alt)",
                        }}
                      >
                        <p
                          style={{
                            fontSize: "0.85rem",
                            color: "var(--text-muted)",
                            marginBottom: "10px",
                          }}
                        >
                          Verification profile (5 required, 2 optional). These answers are used to validate ownership before chat unlock.
                        </p>
                        <div className="form-group">
                          <label>1. Item Type (Required)</label>
                          <input
                            type="text"
                            className="form-control"
                            required
                            value={foundData.verify_item_type}
                            onChange={(e) => setFoundData({ ...foundData, verify_item_type: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>2. Primary Color (Required)</label>
                          <input
                            type="text"
                            className="form-control"
                            required
                            value={foundData.verify_color}
                            onChange={(e) => setFoundData({ ...foundData, verify_color: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>3. Unique Mark / Sticker (Required)</label>
                          <input
                            type="text"
                            className="form-control"
                            required
                            value={foundData.verify_unique_mark}
                            onChange={(e) => setFoundData({ ...foundData, verify_unique_mark: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>4. Inside Contents (Required)</label>
                          <input
                            type="text"
                            className="form-control"
                            required
                            value={foundData.verify_inside_contents}
                            onChange={(e) => setFoundData({ ...foundData, verify_inside_contents: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>5. Exact Spot Found (Required)</label>
                          <input
                            type="text"
                            className="form-control"
                            required
                            value={foundData.verify_found_spot}
                            onChange={(e) => setFoundData({ ...foundData, verify_found_spot: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>6. Optional Detail 1</label>
                          <input
                            type="text"
                            className="form-control"
                            value={foundData.verify_optional_1}
                            onChange={(e) => setFoundData({ ...foundData, verify_optional_1: e.target.value })}
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label>7. Optional Detail 2</label>
                          <input
                            type="text"
                            className="form-control"
                            value={foundData.verify_optional_2}
                            onChange={(e) => setFoundData({ ...foundData, verify_optional_2: e.target.value })}
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        style={{
                          background: "var(--secondary)",
                          width: "100%",
                        }}
                      >
                        Submit Found Report
                      </button>
                    </form>
                  </div>
                )}

                {activeForm === "quick" && (
                  <div
                    className="card"
                    style={{
                      borderTop: "4px solid var(--warning)", width: "100%", maxWidth: "800px", width: "100%", maxWidth: "800px",
                      boxShadow: "0 10px 25px -5px rgba(29, 78, 216, 0.25)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "24px",
                      }}
                    >
                      <h2 style={{ color: "var(--warning)" }}>
                        Quick Found Report
                      </h2>
                      <button
                        onClick={() => setActiveForm("none")}
                        style={{
                          fontSize: "1.5rem",
                          color: "var(--text-muted)",
                          cursor: "pointer",
                          border: "none",
                          background: "none",
                        }}
                      >
                        X
                      </button>
                    </div>
                    <form onSubmit={handleQuickFoundSubmit}>
                      <div className="form-group">
                        <label>Item Name</label>
                        <input
                          type="text"
                          className="form-control"
                          required
                          value={quickFoundData.item_name}
                          onChange={(e) =>
                            setQuickFoundData({
                              ...quickFoundData,
                              item_name: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="form-group">
                        <label>Location Found</label>
                        <input
                          type="text"
                          className="form-control"
                          required
                          placeholder="Type location or use map below..."
                          value={quickFoundData.location}
                          onChange={(e) =>
                            setQuickFoundData({
                              ...quickFoundData,
                              location: e.target.value,
                            })
                          }
                        />
                        <LocationPicker
                          onLocationSelect={(val) =>
                            setQuickFoundData({ ...quickFoundData, location: val })
                          }
                        />
                      </div>
                      <div className="form-group">
                        <label>Short Description (Optional)</label>
                        <textarea
                          className="form-control"
                          rows="2"
                          value={quickFoundData.description}
                          onChange={(e) =>
                            setQuickFoundData({
                              ...quickFoundData,
                              description: e.target.value,
                            })
                          }
                        ></textarea>
                      </div>
                      <div className="form-group">
                        <label>Date Found</label>
                        <input
                          type="date"
                          className="form-control"
                          required
                          value={quickFoundData.date}
                          onChange={(e) =>
                            setQuickFoundData({ ...quickFoundData, date: e.target.value })
                          }
                        />
                      </div>
                      <div className="form-group">
                        <label>Image (Optional)</label>
                        <input
                          type="file"
                          className="form-control"
                          accept="image/*"
                          onChange={(e) =>
                            setQuickFoundData({
                              ...quickFoundData,
                              image: e.target.files[0],
                            })
                          }
                        />
                      </div>
                      <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "12px" }}>
                        Best for fast reporting. High-value or critical-ID items are automatically tagged for stricter compliance.
                      </p>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        style={{
                          background: "var(--warning)",
                          width: "100%",
                        }}
                      >
                        Submit Quick Report
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        <section style={{ marginBottom: "48px" }} className="slide-up">
          <div className="section-header">
            <h2>AI Suggested Matches</h2>
          </div>
          <div className="items-grid">
            {activeMatches.length === 0 ? (
              <p
                style={{
                  color: "var(--text-muted)",
                  gridColumn: "1 / -1",
                  padding: "20px",
                  background: "var(--bg-dark)",
                  borderRadius: "8px",
                  textAlign: "center",
                }}
              >
                No pending matches found yet. We will notify you when an AI
                match is detected.
              </p>
            ) : (
              activeMatches.map((match) => (
                <div
                  key={match.match_id}
                  className="card item-card-hover"
                  style={{
                    border: "2px solid var(--primary)",
                    animation: "modalScaleUp 0.4s ease-out",
                    position: "relative"
                  }}
                >
                  {match.message_count > 0 && (
                    <span
                      style={{
                        position: "absolute",
                        top: "-10px",
                        right: "-10px",
                        background: "var(--danger)",
                        color: "white",
                        borderRadius: "50%",
                        width: "28px",
                        height: "28px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.85rem",
                        fontWeight: "bold",
                        boxShadow: "0 2px 5px rgba(0,0,0,0.2)"
                      }}
                      title="Messages received"
                    >
                      {match.message_count}
                    </span>
                  )}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      borderBottom: "1px solid #eee",
                      paddingBottom: "8px",
                      marginBottom: "12px",
                    }}
                  >
                    <h3 style={{ color: "var(--primary)" }}>
                      Match #{match.match_id}
                    </h3>
                    <span
                      style={{
                        background: "var(--primary-light)",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        fontWeight: "bold",
                        color: "var(--primary)",
                      }}
                    >
                      Score: {match.score}
                    </span>
                  </div>
                  <p>
                    <strong>Lost ID:</strong> {match.lost_id}
                  </p>
                  <p>
                    <strong>Found ID:</strong> {match.found_id}
                  </p>
                  <p>
                    <strong>Status:</strong>{" "}
                    <span
                      style={{
                        textTransform: "capitalize",
                        color: "var(--warning)",
                        fontWeight: "bold",
                      }}
                    >
                      {match.status}
                    </span>
                  </p>
                  <div
                    style={{
                      display: "grid",
                      gap: "10px",
                      marginTop: "16px",
                    }}
                  >
                    <Link
                      to={`/match?match_id=${match.match_id}${match.chat_id ? `&chat_id=${match.chat_id}` : ""}`}
                      className="btn btn-secondary"
                      style={{
                        width: "100%",
                        textAlign: "center",
                        display: "block",
                      }}
                    >
                      Show AI Match Analysis
                    </Link>
                    <Link
                      to={`/chat?chat_id=${match.chat_id}&match_id=${match.match_id}`}
                      className="btn btn-primary"
                      style={{
                        width: "100%",
                        textAlign: "center",
                        display: "block",
                        boxShadow: "0 4px 10px rgba(79, 70, 229, 0.3)",
                      }}
                    >
                      Verify & Chat
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <div className="grid-2" style={{ alignItems: "start", gap: "32px", margin: "40px 0" }}>
          <section className="slide-up">
            <div className="section-header">
              <h2>Your Pending Lost Items</h2>
            </div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "16px" }}
            >
              {activeLostItems.length === 0 ? (
                <p style={{ color: "var(--text-muted)" }}>No items reported.</p>
              ) : (
                activeLostItems.map((item, index) => (
                  <div
                    key={item.lost_id}
                    className="card item-card-hover"
                    style={{
                      padding: "16px",
                      borderLeft: "4px solid var(--danger)",
                      animationDelay: `${index * 0.1}s`,
                      animation: "fadeIn 0.5s both",
                    }}
                    onClick={() => setSelectedItem(item)}
                  >
                    <button
                      className="btn-delete"
                      onClick={(e) => handleDeleteItem(e, "lost", item.lost_id)}
                      title="Delete Record"
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinelinejoin="round"
                      >
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                      </svg>
                    </button>
                    <h3 style={{ marginBottom: "4px", paddingRight: "30px" }}>
                      {item.item_name}
                    </h3>
                    <p
                      style={{
                        fontSize: "0.9rem",
                        color: "var(--text-muted)",
                        marginBottom: "8px",
                      }}
                    >
                      {item.location}  {item.date}
                    </p>
                    <p
                      style={{
                        fontSize: "0.9rem",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.description}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="slide-up">
            <div className="section-header">
              <h2>Your Pending Found Items</h2>
            </div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "16px" }}
            >
              {activeFoundItems.length === 0 ? (
                <p style={{ color: "var(--text-muted)" }}>No items reported.</p>
              ) : (
                activeFoundItems.map((item, index) => (
                  <div
                    key={item.found_id}
                    className="card item-card-hover"
                    style={{
                      padding: "16px",
                      borderLeft: "4px solid var(--secondary)",
                      animationDelay: `${index * 0.1}s`,
                      animation: "fadeIn 0.5s both",
                    }}
                    onClick={() => setSelectedItem(item)}
                  >
                    <button
                      className="btn-delete"
                      onClick={(e) =>
                        handleDeleteItem(e, "found", item.found_id)
                      }
                      title="Delete Record"
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinelinejoin="round"
                      >
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                      </svg>
                    </button>
                    <h3 style={{ marginBottom: "4px", paddingRight: "30px" }}>
                      {item.item_name}
                    </h3>
                    <p
                      style={{
                        fontSize: "0.9rem",
                        color: "var(--text-muted)",
                        marginBottom: "8px",
                      }}
                    >
                      {item.location}  {item.date}
                    </p>
                    <p
                      style={{
                        fontSize: "0.9rem",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.description}
                    </p>
                    <div className="found-meta-row">
                      <span className={`priority-pill ${item.item_priority || "normal"}`}>
                        {formatPriorityLabel(item.item_priority)}
                      </span>
                      <span className="sla-pill">
                        {formatSlaLabel(item.reporting_sla_hours)}
                      </span>
                      <span className="channel-pill">
                        {(item.report_channel || "standard").toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {completedMatches.length > 0 && (
          <section style={{ marginTop: "48px", marginBottom: "48px" }} className="slide-up">
            <div className="section-header">
              <h2>Completed & Closed Cases</h2>
            </div>
            <div className="items-grid">
              {visibleCompletedMatches.map((match) => (
                <div
                  key={match.match_id}
                  className="card"
                  style={{
                    border: match.status === "rejected" ? "1px solid var(--danger)" : "1px solid var(--success)",
                    background: "rgba(29, 78, 216, 0.05)",
                    opacity: 0.8
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      borderBottom: "1px solid #ddd",
                      paddingBottom: "8px",
                      marginBottom: "12px",
                    }}
                  >
                    <h3 style={{ color: match.status === "rejected" ? "var(--danger)" : "var(--success)" }}>
                      {match.status === "rejected" ? "Rejected Match" : "Resolved Match"} #{match.match_id}
                    </h3>
                    <span 
                      style={{
                        background: match.status === "rejected" ? "var(--danger)" : "var(--success)", 
                        color: "white", 
                        padding: "2px 8px", 
                        borderRadius: "12px",
                        fontSize: "0.8rem",
                        fontWeight: "bold"
                      }}
                    >{match.status === "rejected" ? "Rejected" : "Case Closed"}</span>
                  </div>
                  <p><strong>Lost ID:</strong> {match.lost_id}</p>
                  <p><strong>Found ID:</strong> {match.found_id}</p>
                  <p style={{ marginTop: "12px", fontSize: "0.9rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                    {match.status === "rejected" ? "This match was rejected as inaccurate." : "This item has been successfully verified and physically returned."}
                  </p>
                </div>
              ))}
            </div>
            {completedMatches.length > 3 && (
              <div style={{ marginTop: "16px", display: "flex", justifyContent: "center" }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowAllCompleted((prev) => !prev)}
                  style={{ width: "auto", minWidth: "170px" }}
                >
                  {showAllCompleted ? "Collapse" : `Show More (${completedMatches.length - 3} more)`}
                </button>
              </div>
            )}
          </section>
        )}
      </main>
    </>
  );
}
