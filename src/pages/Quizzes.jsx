import React, { useEffect, useState } from "react";

export default function Quizzes() {
  const [domains, setDomains] = useState([]);
  const [domain, setDomain] = useState("");
  const [loadingDomains, setLoadingDomains] = useState(false);
  const [error, setError] = useState("");

  const [quizOpen, setQuizOpen] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadingQuiz, setLoadingQuiz] = useState(false);

  const [selectedChoiceId, setSelectedChoiceId] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function loadDomains() {
      setLoadingDomains(true);
      setError("");

      try {
        const res = await fetch("/api/quiz/domains");
        const data = await res.json();

        if (!res.ok || !data?.ok) {
          throw new Error(data?.error?.message || "Failed to load domains.");
        }

        if (!mounted) return;
        setDomains(data.domains || []);
      } catch (err) {
        if (!mounted) return;
        setError(err.message || "Failed to load domains.");
      } finally {
        if (!mounted) return;
        setLoadingDomains(false);
      }
    }

    loadDomains();
    return () => {
      mounted = false;
    };
  }, []);

  const startQuiz = async (domainId = null) => {
    setLoadingQuiz(true);
    setError("");

    try {
      const url = domainId ? `/api/quiz/start?domain_id=${domainId}` : `/api/quiz/start`;
      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error?.message || "Failed to start quiz.");
      }

      setQuestions(data.questions || []);
      setCurrentIndex(0);

      // reset per-quiz state
      setSelectedChoiceId(null);
      setSubmitted(false);
      setIsCorrect(null);

      setQuizOpen(true);
    } catch (err) {
      setError(err.message || "Failed to start quiz.");
    } finally {
      setLoadingQuiz(false);
    }
  };

  const closeQuiz = () => {
    setQuizOpen(false);
    setQuestions([]);
    setCurrentIndex(0);
    setSelectedChoiceId(null);
    setSubmitted(false);
    setIsCorrect(null);
  };

  const currentQuestion = questions[currentIndex];

  const submitAnswer = () => {
    if (!currentQuestion || !selectedChoiceId) return;

    const correct = currentQuestion.choices?.some(
      (c) => c.choice_id === selectedChoiceId && c.is_correct === true
    );

    setIsCorrect(!!correct);
    setSubmitted(true);
  };

  const nextQuestion = () => {
    const next = currentIndex + 1;

    if (next >= questions.length) {
      // Later we’ll replace this with the final score modal.
      closeQuiz();
      return;
    }

    setCurrentIndex(next);
    setSelectedChoiceId(null);
    setSubmitted(false);
    setIsCorrect(null);
  };

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ margin: "0 0 12px" }}>Quizzes</h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 12,
          alignItems: "start",
        }}
      >
        {/* General Knowledge */}
        <section
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 12,
            padding: 14,
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>General Knowledge</h2>
          <p style={{ margin: "0 0 12px", opacity: 0.85, lineHeight: 1.4 }}>
            Full random 25-question quiz pulled from the question bank.
          </p>

          <button
            onClick={() => startQuiz(null)}
            disabled={loadingQuiz}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.06)",
              color: "inherit",
              cursor: "pointer",
              fontWeight: 600,
              opacity: loadingQuiz ? 0.7 : 1,
            }}
          >
            {loadingQuiz ? "Starting..." : "Start General Quiz (25)"}
          </button>
        </section>

        {/* Domain Quiz */}
        <section
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 12,
            padding: 14,
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>By Domain</h2>
          <p style={{ margin: "0 0 12px", opacity: 0.85, lineHeight: 1.4 }}>
            Select a domain and take a random 25-question quiz from that domain only.
          </p>

          <label style={{ display: "block", fontSize: 13, marginBottom: 6, opacity: 0.9 }}>
            Domain
          </label>

          <select
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            disabled={loadingDomains}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(0,0,0,0.25)",
              color: "inherit",
              marginBottom: 12,
            }}
          >
            <option value="">
              {loadingDomains ? "Loading domains..." : "Select a domain"}
            </option>
            {domains.map((d) => (
              <option key={d.domain_id} value={d.domain_id}>
                {d.domain_label}
              </option>
            ))}
          </select>

          <button
            onClick={() => {
              if (!domain) {
                alert("Select a domain first.");
                return;
              }
              startQuiz(domain);
            }}
            disabled={loadingQuiz}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.06)",
              color: "inherit",
              cursor: "pointer",
              fontWeight: 600,
              opacity: loadingQuiz ? 0.7 : 1,
            }}
          >
            {loadingQuiz ? "Starting..." : "Start Domain Quiz (25)"}
          </button>
        </section>
      </div>

      {error ? (
        <div style={{ marginTop: 12, color: "#ffb4b4", fontSize: 13 }}>{error}</div>
      ) : null}

      {/* Quiz Modal */}
      {quizOpen && currentQuestion && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: "90%",
              maxWidth: 720,
              background: "#111",
              padding: 22,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <h3 style={{ margin: 0 }}>
                Question {currentIndex + 1} of {questions.length}
              </h3>
              <button
                onClick={closeQuiz}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "rgba(255,255,255,0.05)",
                  color: "inherit",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>

            <p style={{ margin: "16px 0", lineHeight: 1.5 }}>
              {currentQuestion.prompt}
            </p>

            <div>
              {currentQuestion.choices.map((choice) => {
                const isSelected = selectedChoiceId === choice.choice_id;

                return (
                  <div
                    key={choice.choice_id}
                    onClick={() => {
                      if (submitted) return;
                      setSelectedChoiceId(choice.choice_id);
                    }}
                    style={{
                      marginBottom: 10,
                      padding: 12,
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.18)",
                      cursor: submitted ? "default" : "pointer",
                      background: isSelected ? "rgba(0,120,255,0.25)" : "rgba(255,255,255,0.02)",
                      opacity: submitted && !isSelected ? 0.85 : 1,
                    }}
                  >
                    <div style={{ fontWeight: 700, display: "inline-block", width: 22 }}>
                      {choice.choice_label}.
                    </div>
                    <span>{choice.choice_text}</span>
                  </div>
                );
              })}
            </div>

            {!submitted ? (
              <button
                onClick={submitAnswer}
                disabled={!selectedChoiceId}
                style={{
                  marginTop: 8,
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "rgba(255,255,255,0.06)",
                  color: "inherit",
                  cursor: selectedChoiceId ? "pointer" : "not-allowed",
                  fontWeight: 600,
                  opacity: selectedChoiceId ? 1 : 0.6,
                }}
              >
                Submit
              </button>
            ) : (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>
                  {isCorrect ? "Correct" : "Incorrect"}
                </div>

                {!isCorrect ? (
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(255,255,255,0.03)",
                      lineHeight: 1.45,
                    }}
                  >
                    <div style={{ marginBottom: 8 }}>
                      <span style={{ fontWeight: 700 }}>Explanation: </span>
                      {currentQuestion.explanation}
                    </div>
                    <div>
                      <span style={{ fontWeight: 700 }}>Citation: </span>
                      {currentQuestion.citation_text}
                    </div>
                  </div>
                ) : null}

                <button
                  onClick={nextQuestion}
                  style={{
                    marginTop: 12,
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.18)",
                    background: "rgba(255,255,255,0.06)",
                    color: "inherit",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}