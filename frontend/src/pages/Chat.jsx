import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { auth } from "../utils/config/firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import { usePopup } from "../components/PopupProvider";
import { apiUrl } from "../utils/config/apiConfig";

export default function Chat() {
  const popup = usePopup();
  const [params] = useSearchParams();
  const chat_id = params.get("chat_id");
  const match_id = params.get("match_id");
  const navigate = useNavigate();

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [user, setUser] = useState(null);
  const [isOtherTyping, setIsOtherTyping] = useState(false);

  const [questions, setQuestions] = useState([]);
  const [ownerUserId, setOwnerUserId] = useState("");
  const [finderUserId, setFinderUserId] = useState("");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answerInput, setAnswerInput] = useState("");
  const [answers, setAnswers] = useState({});
  const [verificationStatus, setVerificationStatus] = useState("pending_questions");
  const [verificationMessage, setVerificationMessage] = useState("");
  const [isSubmittingVerification, setIsSubmittingVerification] = useState(false);

  const messagesEndRef = useRef(null);
  const shouldAutoScrollRef = useRef(false);
  const lastMessageSignatureRef = useRef("");
  const messageCountRef = useRef(0);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) setUser(u);
      else navigate("/login");
    });
    return () => unsub();
  }, [navigate]);

  const fetchVerificationForm = async ({ preserveProgress = false } = {}) => {
    if (!match_id) return;
    try {
      const res = await fetch(apiUrl(`/match/verification_form?match_id=${match_id}`));
      const data = await res.json();
      if (!data.success) {
        setVerificationMessage(data.message || "Unable to load verification form.");
        return;
      }

      setQuestions(data.questions || []);
      setVerificationStatus(data.verification_status || "pending_questions");
      setOwnerUserId(data.owner_user_id || "");
      setFinderUserId(data.finder_user_id || "");

      // Preserve in-progress answers while owner is filling the questionnaire.
      if (!preserveProgress) {
        setQuestionIndex(0);
        setAnswers({});
        setAnswerInput("");
      }
    } catch (e) {
      console.error(e);
      setVerificationMessage("Failed to load verification form.");
    }
  };

  const fetchMessages = async () => {
    if (!chat_id) return;
    try {
      const res = await fetch(apiUrl(`/chat/messages?chat_id=${chat_id}`));
      const data = await res.json();
      if (!data.success) return;

      const latest = data.messages[data.messages.length - 1];
      const currentSignature = `${data.messages.length}:${latest?.message_id || "none"}`;
      if (currentSignature === lastMessageSignatureRef.current) return;

      const hasNewMessage = data.messages.length > messageCountRef.current;
      shouldAutoScrollRef.current = hasNewMessage;

      if (latest && hasNewMessage && user && latest.sender_id !== user.uid) {
        setIsOtherTyping(true);
        setTimeout(() => setIsOtherTyping(false), 900);
      }

      setMessages(data.messages);
      lastMessageSignatureRef.current = currentSignature;
    } catch (e) {
      console.error("Failed to fetch messages", e);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchVerificationForm();
  }, [match_id, user]);

  useEffect(() => {
    if (!user || !match_id) return;

    const interval = setInterval(() => {
      fetchVerificationForm({ preserveProgress: true });
    }, 2500);

    return () => clearInterval(interval);
  }, [user, match_id]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 2500);
    return () => clearInterval(interval);
  }, [chat_id, user]);

  useEffect(() => {
    messageCountRef.current = messages.length;
    if (shouldAutoScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      shouldAutoScrollRef.current = false;
    }
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    const isEligible = verificationStatus === "verified" || (!verificationRequired && verificationStatus === "not_required");
    if (!isEligible) {
      setVerificationMessage("Complete verification first. Then chat unlocks.");
      return;
    }
    if (!newMessage.trim() || !user || !chat_id) return;

    try {
      const res = await fetch(apiUrl("/chat/send"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id,
          sender_id: user.uid,
          text: newMessage.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNewMessage("");
        shouldAutoScrollRef.current = true;
        fetchMessages();
      }
    } catch (error) {
      console.error("Failed to send", error);
    }
  };

  const saveCurrentAnswer = () => {
    const current = questions[questionIndex];
    if (!current) return;
    setAnswers((prev) => ({ ...prev, [current.key]: answerInput }));
  };

  const handleAnswerInputChange = (value) => {
    setAnswerInput(value);
    const current = questions[questionIndex];
    if (!current?.key) return;
    setAnswers((prev) => ({ ...prev, [current.key]: value }));
  };

  const handleNextQuestion = () => {
    saveCurrentAnswer();
    const nextIndex = Math.min(questionIndex + 1, questions.length - 1);
    setQuestionIndex(nextIndex);
    const nextKey = questions[nextIndex]?.key;
    setAnswerInput(nextKey ? answers[nextKey] || "" : "");
  };

  const handlePrevQuestion = () => {
    saveCurrentAnswer();
    const prevIndex = Math.max(questionIndex - 1, 0);
    setQuestionIndex(prevIndex);
    const prevKey = questions[prevIndex]?.key;
    setAnswerInput(prevKey ? answers[prevKey] || "" : "");
  };

  const handleSubmitVerification = async () => {
    if (!user || !match_id) return;
    saveCurrentAnswer();

    const finalAnswers = {
      ...answers,
      [questions[questionIndex]?.key]: answerInput,
    };

    setIsSubmittingVerification(true);
    setVerificationMessage("");
    try {
      const res = await fetch(apiUrl("/match/verify_answers"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          match_id,
          actor_id: user.uid,
          answers: finalAnswers,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setVerificationStatus("verified");
        setVerificationMessage(data.message || "You are eligible. Chat unlocked.");
      } else {
        setVerificationStatus(data.status || "failed");
        setVerificationMessage(data.message || "You are not eligible.");
      }
    } catch (e) {
      console.error(e);
      setVerificationMessage("Verification failed due to server error.");
    } finally {
      setIsSubmittingVerification(false);
    }
  };

  const handleResolve = async () => {
    const isEligible = verificationStatus === "verified" || (!verificationRequired && verificationStatus === "not_required");
    if (!isEligible) {
      setVerificationMessage("Only eligible users can resolve this case.");
      return;
    }
    const shouldResolve = await popup.confirm({
      title: "Resolve Match",
      message: "Mark this match as resolved?",
      confirmText: "Resolve",
      cancelText: "Cancel",
      tone: "warning",
    });
    if (!shouldResolve) return;

    try {
      const res = await fetch(apiUrl("/match/resolve"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id, actor_id: user.uid }),
      });
      const data = await res.json();
      if (data.success) {
        popup.notify("Case resolved successfully.", "success");
        navigate("/dashboard");
      } else {
        popup.notify(data.message || "Unable to resolve case.", "error");
      }
    } catch (error) {
      console.error(error);
      popup.notify("Failed to resolve.", "error");
    }
  };

  useEffect(() => {
    const currentKey = questions[questionIndex]?.key;
    if (!currentKey) {
      setAnswerInput("");
      return;
    }
    setAnswerInput(answers[currentKey] || "");
  }, [questionIndex, questions]);

  if (!user) return null;

  const currentQuestion = questions[questionIndex];
  const verificationRequired = questions.length > 0;
  const isLostOwner = !!ownerUserId && user.uid === ownerUserId;
  const canChat = verificationStatus === "verified" || (!verificationRequired && verificationStatus === "not_required");

  return (
    <div className="chat-page">
      <header className="nav mobile-hide-top-nav">
        <div className="container nav-inner">
          <Link to="/dashboard" className="brand">
            <span>&larr; Back to Dashboard</span>
          </Link>
        </div>
      </header>

      <main className="chat-main container fade-in">
        <div className="chat-title-wrap">
          <h2 className="page-gradient-title">Verification Chat</h2>
          <p>Answer verification questions first. Chat unlocks only when eligible.</p>
        </div>

        <section className="chat-claim-panel">
          <div className="chat-claim-head">
            <h3>Ownership Verification</h3>
            <span className={`badge ${canChat ? "success" : "pending"}`}>
              {canChat ? "Eligible" : "Pending"}
            </span>
          </div>

          {!verificationRequired && canChat ? (
            <p className="chat-claim-note">
              ✓ Chat and resolution are ready. No additional verification required for this quick-report match.
            </p>
          ) : canChat ? (
            <p className="chat-claim-note">
              ✓ Verification completed. Chat and resolution are now enabled for both users.
            </p>
          ) : !isLostOwner ? (
            <p className="chat-claim-note">
              Waiting for lost user verification. Chat will unlock for both users once verification is approved.
            </p>
          ) : (
            <>
              <div className="chat-claim-grid" style={{ gridTemplateColumns: "1fr" }}>
                <div>
                  <label>
                    Q{questionIndex + 1}. {currentQuestion?.label}
                    {currentQuestion?.required ? " (Required)" : " (Optional)"}
                  </label>
                  <input
                    value={answerInput}
                    onChange={(e) => handleAnswerInputChange(e.target.value)}
                    placeholder="Type your answer"
                  />
                </div>
              </div>

              <div className="chat-claim-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={questionIndex === 0}
                  onClick={handlePrevQuestion}
                >
                  Previous
                </button>
                {questionIndex < questions.length - 1 ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleNextQuestion}
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={isSubmittingVerification}
                    onClick={handleSubmitVerification}
                  >
                    {isSubmittingVerification ? "Checking..." : "Submit Verification"}
                  </button>
                )}
              </div>
            </>
          )}

          {verificationMessage && <p className="chat-claim-note">{verificationMessage}</p>}
        </section>

        <div className="chat-shell slide-up">
          <div className="chat-topbar">
            <div>
              <h3>Match ID: {match_id}</h3>
              <span className="badge pending">Active</span>
            </div>
            <button
              onClick={handleResolve}
              className="btn chat-resolve-btn"
              disabled={!canChat}
            >
              Mark Resolved
            </button>
          </div>

          <div className="chat-message-list">
            <div className="chat-encrypted-note">Connection established. Messages are end-to-end encrypted.</div>

            {messages.map((m) => {
              const isMine = m.sender_id === user.uid;
              return (
                <div key={m.message_id} className={`chat-message-row ${isMine ? "mine" : "other"}`}>
                  <div className={`chat-bubble ${isMine ? "mine" : "other"}`}>{m.text}</div>
                </div>
              );
            })}

            {isOtherTyping && (
              <div className="chat-message-row other">
                <div className="chat-bubble other typing-bubble">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <form className="chat-compose" onSubmit={handleSend}>
            <input
              type="text"
              placeholder={canChat ? "Type a message..." : "Complete verification to unlock chat"}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              disabled={!canChat}
            />
            <button type="submit" className="btn btn-primary" disabled={!canChat || !newMessage.trim()}>
              Send
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
