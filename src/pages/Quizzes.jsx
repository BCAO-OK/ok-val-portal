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

  const startGeneralQuiz = async () => {
    setLoadingQuiz(true);
    setError("");

    try {
      const res = await fetch("/api/quiz/start");
      const data = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error?.message || "Failed to start quiz.");
      }

      setQuestions(data.questions || []);
      setCurrentIndex(0);
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
  };

  const currentQuestion = questions[currentIndex];

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ margin: "0 0 12px" }}>Quizzes</h1>

      <section
        style={{
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 12,
          padding: 14,
          background: "rgba(255,255,255,0.02)",
          maxWidth: 400,
        }}
      >
        <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>
          General Knowledge
        </h2>

        <button
          onClick={startGeneralQuiz}
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
          }}
        >
          {loadingQuiz ? "Starting..." : "Start General Quiz (25)"}
        </button>

        {error && (
          <div style={{ marginTop: 10, color: "#ffb4b4", fontSize: 13 }}>
            {error}
          </div>
        )}
      </section>

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
              maxWidth: 600,
              background: "#111",
              padding: 20,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <h3 style={{ marginBottom: 12 }}>
              Question {currentIndex + 1} of {questions.length}
            </h3>

            <p style={{ marginBottom: 16 }}>{currentQuestion.prompt}</p>

            {currentQuestion.choices.map((choice) => (
              <div
                key={choice.choice_id}
                style={{
                  marginBottom: 8,
                  padding: 8,
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.15)",
                }}
              >
                {choice.choice_label}. {choice.choice_text}
              </div>
            ))}

            <div style={{ marginTop: 16 }}>
              <button
                onClick={closeQuiz}
                style={{
                  padding: "8px 12px",
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
          </div>
        </div>
      )}
    </div>
  );
}