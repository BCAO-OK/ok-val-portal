import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  Dropdown,
  GhostButton,
  Icon,
  Input,
  Modal,
  Pill,
  PrimaryButton,
  Select,
  TEXT_DIM,
  TEXT_DIM_2,
  TextArea,
  Toggle,
} from "../components/ui/UI";
import { apiFetch } from "../lib/api";
import { canEditQuestions } from "../lib/authz";

function normalizeQuestionId(q) {
  return q?.question_id ?? q?.id ?? q?.questionId ?? q?.questionID;
}

export default function Questions({ me, getToken }) {
  const canEdit = canEditQuestions(me);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [items, setItems] = useState([]);

  // Filters
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [domainId, setDomainId] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [unverifiedOnly, setUnverifiedOnly] = useState(false);

  // Taxonomy
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [domainOptions, setDomainOptions] = useState([]);

  const [page, setPage] = useState(1);
  const pageSize = 25;

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState("create"); // create | edit
  const [draft, setDraft] = useState(() => ({
    question_id: "",
    category_id: "",
    domain_id: "",
    difficulty: "1",
    prompt: "",
    choice_a: "",
    choice_b: "",
    choice_c: "",
    choice_d: "",
    correct_choice_label: "A",
    explanation: "",
    citation_text: "",
    is_active: true,
    is_verified: false,
  }));

  const [confirmDelete, setConfirmDelete] = useState(null);

  async function loadTaxonomy() {
    try {
      const params = new URLSearchParams();
      params.set("page", "1");
      params.set("pageSize", "1000");
      params.set("active", "true");

      const json = await apiFetch(getToken, `/api/questions?${params.toString()}`);
      const list = json?.data ?? json;
      const rows = Array.isArray(list) ? list : Array.isArray(list?.items) ? list.items : [];

      const catMap = new Map();
      const domMap = new Map();

      for (const r of rows) {
        if (r?.category_id && r?.category_name) catMap.set(String(r.category_id), String(r.category_name));
        if (r?.domain_id && r?.domain_name) {
          domMap.set(String(r.domain_id), {
            name: String(r.domain_name),
            category_id: String(r.category_id || ""),
          });
        }
      }

      const cats = Array.from(catMap.entries())
        .map(([id, name]) => ({ value: id, label: name }))
        .sort((a, b) => a.label.localeCompare(b.label));

      const doms = Array.from(domMap.entries())
        .map(([id, v]) => ({ value: id, label: v.name, category_id: v.category_id }))
        .sort((a, b) => a.label.localeCompare(b.label));

      setCategoryOptions(cats);
      setDomainOptions(doms);
    } catch (e) {
      console.warn("taxonomy load failed:", e);
    }
  }

  async function load() {
    try {
      setLoading(true);
      setErr("");

      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (categoryId) params.set("category_id", categoryId);
      if (domainId) params.set("domain_id", domainId);
      if (difficulty) params.set("difficulty", difficulty);
      params.set("active", activeOnly ? "true" : "false");
      if (unverifiedOnly) params.set("verified", "false");
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      const json = await apiFetch(getToken, `/api/questions?${params.toString()}`);
      const data = json?.data ?? json;
      const list = data?.items ?? data?.questions ?? data?.rows ?? data;
      const rows = Array.isArray(list) ? list : [];

      setItems(rows);
    } catch (e) {
      setErr(String(e?.message || e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTaxonomy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryId, domainId, difficulty, activeOnly, unverifiedOnly]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryId, domainId, difficulty, activeOnly, unverifiedOnly]);

  useEffect(() => {
    if (!domainId) return;
    const d = domainOptions.find((x) => x.value === domainId);
    if (d && categoryId && d.category_id !== categoryId) setDomainId("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId]);

  const filteredDomainOptions = useMemo(() => {
    const base = domainOptions;
    const doms = categoryId ? base.filter((d) => d.category_id === categoryId) : base;
    return [{ value: "", label: "All" }, ...doms.map((d) => ({ value: d.value, label: d.label }))];
  }, [domainOptions, categoryId]);

  const categoryFilterOptions = useMemo(() => [{ value: "", label: "All" }, ...categoryOptions], [categoryOptions]);

  function openCreate() {
    setEditorMode("create");
    setDraft({
      question_id: "",
      category_id: categoryId || "",
      domain_id: domainId || "",
      difficulty: difficulty || "1",
      prompt: "",
      choice_a: "",
      choice_b: "",
      choice_c: "",
      choice_d: "",
      correct_choice_label: "A",
      explanation: "",
      citation_text: "",
      is_active: true,
      is_verified: false,
    });
    setEditorOpen(true);
  }

  function openEdit(q) {
    const id = normalizeQuestionId(q);
    const choices = Array.isArray(q?.choices) ? q.choices : [];
    const byLabel = new Map(choices.map((c) => [String(c.choice_label || "").toUpperCase(), c]));

    setEditorMode("edit");
    setDraft({
      question_id: id ? String(id) : "",
      category_id: q?.category_id ? String(q.category_id) : "",
      domain_id: q?.domain_id ? String(q.domain_id) : "",
      difficulty: String(q?.difficulty ?? "1"),
      prompt: q?.prompt ?? "",
      choice_a: String(byLabel.get("A")?.choice_text ?? ""),
      choice_b: String(byLabel.get("B")?.choice_text ?? ""),
      choice_c: String(byLabel.get("C")?.choice_text ?? ""),
      choice_d: String(byLabel.get("D")?.choice_text ?? ""),
      correct_choice_label: String(q?.correct_choice_label ?? "A").toUpperCase(),
      explanation: q?.explanation ?? "",
      citation_text: q?.citation_text ?? "",
      is_active: q?.is_active ?? true,
      is_verified: q?.is_verified ?? false,
    });
    setEditorOpen(true);
  }

  function validateDraft(d) {
    const required = [
      ["category_id", "Category"],
      ["domain_id", "Domain"],
      ["prompt", "Prompt"],
      ["choice_a", "Choice A"],
      ["choice_b", "Choice B"],
      ["choice_c", "Choice C"],
      ["choice_d", "Choice D"],
      ["correct_choice_label", "Correct choice"],
      ["explanation", "Explanation"],
      ["citation_text", "Citation"],
    ];
    for (const [k, label] of required) if (!String(d?.[k] ?? "").trim()) return `${label} is required.`;
    if (!["1", "2", "3"].includes(String(d?.difficulty ?? ""))) return "Difficulty must be 1, 2, or 3.";
    if (!["A", "B", "C", "D"].includes(String(d?.correct_choice_label ?? "").toUpperCase()))
      return "Correct choice must be A, B, C, or D.";
    return "";
  }

  async function saveDraft() {
    try {
      const v = validateDraft(draft);
      if (v) throw new Error(v);
      if (!canEdit) throw new Error("You do not have permission to create or edit questions.");

      setLoading(true);
      setErr("");

      const correct = String(draft.correct_choice_label).toUpperCase();

      const payload = {
        domain_id: String(draft.domain_id).trim(),
        difficulty: Number(draft.difficulty),
        prompt: String(draft.prompt).trim(),
        explanation: String(draft.explanation).trim(),
        citation_text: String(draft.citation_text).trim(),
        is_active: Boolean(draft.is_active),
        is_verified: Boolean(draft.is_verified),
        correct_choice_label: correct,
        choices: [
          { choice_label: "A", choice_text: String(draft.choice_a).trim() },
          { choice_label: "B", choice_text: String(draft.choice_b).trim() },
          { choice_label: "C", choice_text: String(draft.choice_c).trim() },
          { choice_label: "D", choice_text: String(draft.choice_d).trim() },
        ],
      };

      if (editorMode === "create") {
        await apiFetch(getToken, "/api/questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        const id = draft?.question_id;
        if (!id) throw new Error("Missing question id.");
        await apiFetch(getToken, `/api/questions/${encodeURIComponent(String(id))}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      setEditorOpen(false);
      await load();
      await loadTaxonomy();
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function doDelete(q) {
    try {
      if (!canEdit) throw new Error("You do not have permission to delete questions.");
      const id = normalizeQuestionId(q);
      if (!id) throw new Error("Missing question id.");

      setLoading(true);
      setErr("");

      await apiFetch(getToken, `/api/questions/${encodeURIComponent(String(id))}`, { method: "DELETE" });
      setConfirmDelete(null);
      await load();
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  const categoryEditorOptions = useMemo(() => [{ value: "", label: "Select…" }, ...categoryOptions], [categoryOptions]);

  const domainEditorOptions = useMemo(() => {
    const doms = draft.category_id ? domainOptions.filter((d) => d.category_id === draft.category_id) : domainOptions;
    return [{ value: "", label: "Select…" }, ...doms.map((d) => ({ value: d.value, label: d.label }))];
  }, [domainOptions, draft.category_id]);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 1000, letterSpacing: 0.2 }}>Question Bank</div>
          <div style={{ marginTop: 6, fontSize: 13, color: TEXT_DIM, lineHeight: 1.45 }}>
            View, create, edit, and delete questions in the database. Changes are role-gated and audit-friendly.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {canEdit ? (
            <PrimaryButton onClick={openCreate} icon={<Icon name="plus" />}>
              New question
            </PrimaryButton>
          ) : (
            <Pill tone="warn">
              <Icon name="dot" /> View-only
            </Pill>
          )}
          <GhostButton onClick={load} icon={<Icon name="refresh" />} ariaLabel="Refresh questions">
            Refresh
          </GhostButton>
        </div>
      </div>

      <Card title="Filters" subtitle="Search by prompt. Filter by category/domain/difficulty. (Server-side filters.)">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <Input label="Search prompt" value={search} onChange={setSearch} placeholder="e.g., homestead exemption" />
          <Dropdown label="Category" value={categoryId} onChange={setCategoryId} options={categoryFilterOptions} />
          <Dropdown label="Domain" value={domainId} onChange={setDomainId} options={filteredDomainOptions} />
          <Select
            label="Difficulty"
            value={difficulty}
            onChange={setDifficulty}
            options={[
              { value: "", label: "All" },
              { value: "1", label: "1" },
              { value: "2", label: "2" },
              { value: "3", label: "3" },
            ]}
          />
        </div>

        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
          <Toggle label="Active only" checked={activeOnly} onChange={setActiveOnly} hint="Hide inactive questions" />
          <Toggle label="Unverified only" checked={unverifiedOnly} onChange={setUnverifiedOnly} hint="Show questions flagged as not verified" />
        </div>
      </Card>

      {err ? (
        <Card title="Error" subtitle="The last request failed.">
          <div style={{ color: "rgba(255,220,220,0.95)", fontSize: 13, fontWeight: 900, lineHeight: 1.5 }}>{err}</div>
        </Card>
      ) : null}

      <Card
        title="Questions"
        subtitle={loading ? "Loading…" : `${items.length} loaded • page ${page}`}
        right={
          <div style={{ display: "flex", gap: 8 }}>
            <GhostButton onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading} ariaLabel="Previous page">
              Prev
            </GhostButton>
            <GhostButton onClick={() => setPage((p) => p + 1)} disabled={loading || items.length < pageSize} ariaLabel="Next page">
              Next
            </GhostButton>
          </div>
        }
      >
        <div style={{ display: "grid", gap: 10 }}>
          {items.length ? (
            items.map((q) => {
              const id = normalizeQuestionId(q);
              const title = q?.prompt ? String(q.prompt).slice(0, 140) : "(no prompt)";
              const badge = q?.is_verified ? <Pill tone="ok">Verified</Pill> : <Pill tone="warn">Unverified</Pill>;

              return (
                <div
                  key={String(id || title)}
                  style={{
                    border: `1px solid rgba(255,255,255,0.10)`,
                    borderRadius: 16,
                    padding: 12,
                    background: "rgba(255,255,255,0.03)",
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 950, lineHeight: 1.35 }}>{title}</div>
                      <div style={{ marginTop: 6, color: TEXT_DIM_2, fontSize: 12, lineHeight: 1.4 }}>
                        {q?.category_name ? `${q.category_name} • ` : ""}
                        {q?.domain_name ? `${q.domain_name} • ` : ""}
                        Difficulty {q?.difficulty ?? "—"}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {badge}
                      {q?.is_active ? <Pill tone="ok">Active</Pill> : <Pill tone="bad">Inactive</Pill>}
                      {canEdit ? (
                        <>
                          <GhostButton onClick={() => openEdit(q)} icon={<Icon name="edit" />} ariaLabel="Edit question">
                            Edit
                          </GhostButton>
                          <GhostButton onClick={() => setConfirmDelete(q)} icon={<Icon name="trash" />} ariaLabel="Delete question">
                            Delete
                          </GhostButton>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontSize: 12, color: TEXT_DIM, fontWeight: 850 }}>Explanation</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.86)", lineHeight: 1.45 }}>
                      {q?.explanation ? String(q.explanation) : "—"}
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontSize: 12, color: TEXT_DIM, fontWeight: 850 }}>Citation</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.86)", lineHeight: 1.45 }}>
                      {q?.citation_text ? String(q.citation_text) : "—"}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ color: TEXT_DIM, fontSize: 13 }}>No questions found.</div>
          )}
        </div>
      </Card>

      {editorOpen ? (
        <Modal title={editorMode === "create" ? "New Question" : "Edit Question"} onClose={() => setEditorOpen(false)} width={980}>
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
              <Dropdown
                label="Category"
                value={draft.category_id}
                onChange={(v) => setDraft((d) => ({ ...d, category_id: v }))}
                options={categoryEditorOptions}
              />
              <Dropdown
                label="Domain"
                value={draft.domain_id}
                onChange={(v) => setDraft((d) => ({ ...d, domain_id: v }))}
                options={domainEditorOptions}
              />
              <Select
                label="Difficulty"
                value={draft.difficulty}
                onChange={(v) => setDraft((d) => ({ ...d, difficulty: v }))}
                options={[
                  { value: "1", label: "1" },
                  { value: "2", label: "2" },
                  { value: "3", label: "3" },
                ]}
              />
              <Select
                label="Correct choice"
                value={draft.correct_choice_label}
                onChange={(v) => setDraft((d) => ({ ...d, correct_choice_label: v }))}
                options={[
                  { value: "A", label: "A" },
                  { value: "B", label: "B" },
                  { value: "C", label: "C" },
                  { value: "D", label: "D" },
                ]}
              />
            </div>

            <Input label="Prompt" value={draft.prompt} onChange={(v) => setDraft((d) => ({ ...d, prompt: v }))} placeholder="Question prompt…" />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
              <Input label="Choice A" value={draft.choice_a} onChange={(v) => setDraft((d) => ({ ...d, choice_a: v }))} />
              <Input label="Choice B" value={draft.choice_b} onChange={(v) => setDraft((d) => ({ ...d, choice_b: v }))} />
              <Input label="Choice C" value={draft.choice_c} onChange={(v) => setDraft((d) => ({ ...d, choice_c: v }))} />
              <Input label="Choice D" value={draft.choice_d} onChange={(v) => setDraft((d) => ({ ...d, choice_d: v }))} />
            </div>

            <TextArea label="Explanation" value={draft.explanation} onChange={(v) => setDraft((d) => ({ ...d, explanation: v }))} rows={4} />
            <TextArea label="Citation" value={draft.citation_text} onChange={(v) => setDraft((d) => ({ ...d, citation_text: v }))} rows={3} />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
              <Toggle label="Active" checked={Boolean(draft.is_active)} onChange={(v) => setDraft((d) => ({ ...d, is_active: v }))} />
              <Toggle label="Verified" checked={Boolean(draft.is_verified)} onChange={(v) => setDraft((d) => ({ ...d, is_verified: v }))} />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
              <GhostButton onClick={() => setEditorOpen(false)} ariaLabel="Cancel">Cancel</GhostButton>
              <PrimaryButton onClick={saveDraft} disabled={loading}>
                {loading ? "Saving…" : "Save"}
              </PrimaryButton>
            </div>
          </div>
        </Modal>
      ) : null}

      {confirmDelete ? (
        <Modal title="Delete Question" onClose={() => setConfirmDelete(null)} width={720}>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ color: TEXT_DIM, fontSize: 13, lineHeight: 1.5 }}>
              This will permanently delete the question. Prefer marking inactive if you want to preserve auditability.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <GhostButton onClick={() => setConfirmDelete(null)} ariaLabel="Cancel delete">Cancel</GhostButton>
              <PrimaryButton onClick={() => doDelete(confirmDelete)} disabled={loading} icon={<Icon name="trash" />}>
                {loading ? "Deleting…" : "Delete"}
              </PrimaryButton>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}