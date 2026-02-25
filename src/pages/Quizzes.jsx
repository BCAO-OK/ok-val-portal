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

  const [selectedChoice, setSelectedChoice] = useState(null);
  const [submitted, setSubmitted] = useState(false);

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
    return () => (mounted = false);
  }, []);

  const startQuiz = async (domainId = null) => {
    setLoadingQuiz(true);
    setError("");

    try {
      const url = domainId
        ? `/api/quiz/start?domain_id=${domainId}`
        : `/api/quiz/start`;

      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error?.message || "Failed to start quiz.");
      }

      setQuestions(data.questions || []);
      setCurrentIndex(0);
      setSelectedChoice(null);
      setSubmitted(false);
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
    setSelectedChoice(null);
    setSubmitted(false);
  };

  const submitAnswer = () => {
    if (!selectedChoice) return;
    setSubmitted(true);
  };

  const nextQuestion = () => {
    if (currentIndex + 1 >= questions.length) {
      closeQuiz(); // temporary until we build final results modal
      return;
    }

    setCurrentIndex((prev) => prev + 1);
    setSelectedChoice(null);
    setSubmitted(false);
  };

  const currentQuestion = questions[currentIndex];

  const correctChoice = currentQuestion?.choices.find(
    (c) => c.is_correct === true
  );

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ margin: "0 0 12px" }}>Quizzes</h1>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button onClick={() => startQuiz()} disabled={loadingQuiz}>
          {loadingQuiz ? "Starting..." : "Start General Quiz (25)"}
        </button>

        <select
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          disabled={loadingDomains}
        >
          <option value="">Select domain</option>
          {domains.map((d) => (
            <option key={d.domain_id} value={d.domain_id}>
              {d.domain_label}
            </option>
          ))}
        </select>

        <button
          onClick={() => {
            if (!domain) return alert("Select a domain first.");
            startQuiz(domain);
          }}
          disabled={loadingQuiz}
        >
          Start Domain Quiz (25)
        </button>
      </div>

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
              maxWidth: 700,
              background: "#111",
              padding: 20,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <h3>
              Question {currentIndex + 1} of {questions.length}
            </h3>

            <p style={{ margin: "16px 0" }}>
              {currentQuestion.prompt}
            </p>

            {currentQuestion.choices.map((choice) => {
              const isSelected = selectedChoice === choice.choice_id;

              return (
                <div
                  key={choice.choice_id}
                  onClick={() =>
                    !submitted && setSelectedChoice(choice.choice_id)
                  }
                  style={{
                    marginBottom: 8,
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.2)",
                    cursor: submitted ? "default" : "pointer",
                    background: isSelected
                      ? "rgba(0,120,255,0.2)"
                      : "transparent",
                  }}
                >
                  {choice.choice_label}. {choice.choice_text}
                </div>
              );
            })}

            {!submitted && (
              <button
                onClick={submitAnswer}
                disabled={!selectedChoice}
                style={{ marginTop: 16 }}
              >
                Submit
              </button>
            )}

            {submitted && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 600 }}>
                  {selectedChoice === correctChoice?.choice_id
                    ? "Correct"
                    : "Incorrect"}
                </div>

                {selectedChoice !== correctChoice?.choice_id && (
                  <div style={{ marginTop: 8 }}>
                    <div>
                      <strong>Explanation:</strong>{" "}
                      {currentQuestion.explanation}
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <strong>Citation:</strong>{" "}
                      {currentQuestion.citation_text}
                    </div>
                  </div>
                )}

                <button onClick={nextQuestion} style={{ marginTop: 12 }}>
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