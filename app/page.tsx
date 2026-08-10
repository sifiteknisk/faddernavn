"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type Suggestion = {
  id: string;
  label: string;
  points: number;
};

type Person = {
  id: string;
  name: string;
  suggestions: Suggestion[];
};

type BoardResponse = {
  people: Person[];
  votedSuggestionIds: string[];
  error?: string;
};

export default function Home() {
  const [people, setPeople] = useState<Person[]>([]);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [newPerson, setNewPerson] = useState("");
  const [addingPerson, setAddingPerson] = useState(false);
  const savingRef = useRef(false);

  function applyBoard(data: BoardResponse) {
    setPeople(data.people);
    setVotedIds(new Set(data.votedSuggestionIds));
  }

  async function loadBoard(silent = false) {
    try {
      const response = await fetch("/api/board", { cache: "no-store" });
      const data = (await response.json()) as BoardResponse;
      if (!response.ok) throw new Error(data.error || "Kunne ikke laste inn navnene.");
      applyBoard(data);
      setError("");
    } catch (cause) {
      if (!silent) setError(cause instanceof Error ? cause.message : "Kunne ikke laste inn navnene.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void loadBoard();
    const refresh = () => {
      if (document.visibilityState === "visible" && !savingRef.current) void loadBoard(true);
    };
    const intervalId = window.setInterval(refresh, 1500);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  async function updateBoard(payload: Record<string, unknown>) {
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/board", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as BoardResponse;
      if (!response.ok) throw new Error(data.error || "Kunne ikke lagre endringen.");
      applyBoard(data);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Kunne ikke lagre endringen.");
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function submitPerson(event: FormEvent) {
    event.preventDefault();
    const name = newPerson.trim();
    if (!name) return;
    if (await updateBoard({ action: "addPerson", name })) {
      setNewPerson("");
      setAddingPerson(false);
    }
  }

  async function submitSuggestion(event: FormEvent<HTMLFormElement>, personId: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.namedItem("suggestion") as HTMLInputElement;
    const label = input.value.trim();
    if (!label) return;
    if (await updateBoard({ action: "addSuggestion", personId, label })) form.reset();
  }

  async function toggleVote(suggestionId: string, hasVoted: boolean) {
    if (saving) return;
    await updateBoard({ action: hasVoted ? "unvote" : "vote", suggestionId });
  }

  async function removePerson(person: Person) {
    if (!window.confirm(`Fjern ${person.name} og alle navneforslagene?`)) return;
    await updateBoard({ action: "deletePerson", personId: person.id });
  }

  async function removeSuggestion(suggestion: Suggestion) {
    if (!window.confirm(`Fjern navnet «${suggestion.label}»?`)) return;
    await updateBoard({ action: "deleteSuggestion", suggestionId: suggestion.id });
  }

  return (
    <main>
      <header className="page-header">
        <div className="title-block">
          <img className="sifi-logo" src="/sifi-logo.png" alt="SIFI – Sikkerhet på ifi" />
          <h1>Faddernavn</h1>
        </div>
        <button className="add-person-button" onClick={() => setAddingPerson(true)}>+ Legg til person</button>
      </header>

      {addingPerson && (
        <form className="person-form" onSubmit={submitPerson}>
          <label htmlFor="person-name">Person</label>
          <input
            id="person-name"
            value={newPerson}
            onChange={(event) => setNewPerson(event.target.value)}
            placeholder="Navn på personen"
            maxLength={50}
            autoFocus
          />
          <button type="submit" disabled={saving}>Legg til</button>
          <button type="button" className="cancel-button" onClick={() => setAddingPerson(false)}>Avbryt</button>
        </form>
      )}

      {error && (
        <div className="error-banner" role="alert">
          {error} <button onClick={() => void loadBoard()}>Prøv igjen</button>
        </div>
      )}

      {loading ? (
        <div className="loading-grid" aria-label="Laster inn">
          <div /><div />
        </div>
      ) : people.length === 0 ? (
        <button className="empty-board" onClick={() => setAddingPerson(true)}>
          <span>+</span>
          Legg til første person
        </button>
      ) : (
        <section className="people-grid" aria-label="Personer og navneforslag">
          {people.map((person) => (
            <article className="person-card" key={person.id}>
              <div className="person-card-header">
                <h2>{person.name}</h2>
                <button className="remove-person-button" onClick={() => void removePerson(person)} disabled={saving} aria-label={`Fjern ${person.name}`}>
                  Fjern
                </button>
              </div>

              <div className="suggestions">
                {person.suggestions.length === 0 ? (
                  <p className="no-suggestions">Ingen navn ennå</p>
                ) : person.suggestions.map((suggestion) => {
                  const hasVoted = votedIds.has(suggestion.id);
                  return (
                    <div className="suggestion" key={suggestion.id}>
                      <button className="remove-name-button" onClick={() => void removeSuggestion(suggestion)} disabled={saving} aria-label={`Fjern ${suggestion.label}`} title="Fjern navn"><span aria-hidden="true">×</span></button>
                      <span className="suggestion-name">{suggestion.label}</span>
                      <button
                        className={hasVoted ? "vote-button voted" : "vote-button"}
                        onClick={() => void toggleVote(suggestion.id, hasVoted)}
                        disabled={saving}
                        aria-pressed={hasVoted}
                        aria-label={hasVoted ? `Fjern stemmen på ${suggestion.label}` : `Stem på ${suggestion.label}`}
                      >
                        {!hasVoted && <span className="vote-mark">+</span>}
                        <span className="vote-count">{suggestion.points}</span>
                        <span className="vote-remove-label">Fjern?</span>
                      </button>
                    </div>
                  );
                })}
              </div>

              <form className="suggestion-form" onSubmit={(event) => void submitSuggestion(event, person.id)}>
                <input name="suggestion" placeholder="Legg til navn" maxLength={60} aria-label={`Legg til navn for ${person.name}`} />
                <button type="submit" disabled={saving}>Legg til</button>
              </form>
            </article>
          ))}

          <button className="add-person-card" onClick={() => setAddingPerson(true)}>
            <span>+</span>
            Legg til person
          </button>
        </section>
      )}
    </main>
  );
}
