import { env } from "cloudflare:workers";

export type BoardPerson = {
  id: string;
  name: string;
  position: number;
  suggestions: Array<{ id: string; label: string; points: number }>;
};

function database() {
  if (!env.DB) throw new Error("The shared board database is unavailable.");
  return env.DB;
}

export async function ensureBoard() {
  const db = database();
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS people (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS suggestions (
      id TEXT PRIMARY KEY,
      person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      points INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS votes (
      suggestion_id TEXT NOT NULL REFERENCES suggestions(id) ON DELETE CASCADE,
      voter_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (suggestion_id, voter_id)
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_people_position ON people(position)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_suggestions_person_points ON suggestions(person_id, points DESC)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_votes_voter_id ON votes(voter_id)"),
  ]);

  await db.batch([
    db.prepare("DELETE FROM suggestions WHERE id IN (?, ?, ?, ?, ?, ?, ?)").bind("idea-maya-1", "idea-maya-2", "idea-maya-3", "idea-jonas-1", "idea-jonas-2", "idea-noor-1", "idea-noor-2"),
    db.prepare("DELETE FROM people WHERE id IN (?, ?, ?)").bind("person-maya", "person-jonas", "person-noor"),
    db.prepare("UPDATE suggestions SET points = (SELECT COUNT(*) FROM votes WHERE votes.suggestion_id = suggestions.id)"),
  ]);
}

export async function readBoard(): Promise<BoardPerson[]> {
  const db = database();
  const peopleResult = await db.prepare("SELECT id, name, position FROM people ORDER BY position ASC, created_at ASC").all<{ id: string; name: string; position: number }>();
  const suggestionsResult = await db.prepare("SELECT id, person_id, label, points FROM suggestions ORDER BY points DESC, created_at ASC").all<{ id: string; person_id: string; label: string; points: number }>();
  const suggestionsByPerson = new Map<string, Array<{ id: string; label: string; points: number }>>();
  for (const idea of suggestionsResult.results) {
    const list = suggestionsByPerson.get(idea.person_id) ?? [];
    list.push({ id: idea.id, label: idea.label, points: idea.points });
    suggestionsByPerson.set(idea.person_id, list);
  }
  return peopleResult.results.map((person) => ({ ...person, suggestions: suggestionsByPerson.get(person.id) ?? [] }));
}

export function getBoardDatabase() {
  return database();
}

export async function readVotedSuggestionIds(voterId: string) {
  const result = await database().prepare("SELECT suggestion_id FROM votes WHERE voter_id = ?").bind(voterId).all<{ suggestion_id: string }>();
  return result.results.map((row) => row.suggestion_id);
}
