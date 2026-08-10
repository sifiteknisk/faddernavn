import { neon } from "@neondatabase/serverless";

export type BoardPerson = {
  id: string;
  name: string;
  position: number;
  suggestions: Array<{ id: string; label: string; points: number }>;
};

type PersonRow = { id: string; name: string; position: number };
type SuggestionRow = {
  id: string;
  person_id: string;
  label: string;
  points: number;
};

let client: ReturnType<typeof neon> | undefined;
let initialization: Promise<void> | undefined;

function database() {
  const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error("Databasen er ikke koblet til.");
  }

  client ??= neon(connectionString);
  return client;
}

async function initializeBoard() {
  const sql = database();

  await sql`CREATE TABLE IF NOT EXISTS people (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`;
  await sql`CREATE TABLE IF NOT EXISTS suggestions (
    id TEXT PRIMARY KEY,
    person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    points INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`;
  await sql`CREATE TABLE IF NOT EXISTS votes (
    suggestion_id TEXT NOT NULL REFERENCES suggestions(id) ON DELETE CASCADE,
    voter_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (suggestion_id, voter_id)
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_people_position ON people(position)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_suggestions_person_points ON suggestions(person_id, points DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_votes_voter_id ON votes(voter_id)`;
}

export async function ensureBoard() {
  initialization ??= initializeBoard().catch((error) => {
    initialization = undefined;
    throw error;
  });
  await initialization;
}

export async function readBoard(): Promise<BoardPerson[]> {
  const sql = database();
  const people = (await sql`SELECT id, name, position FROM people ORDER BY position ASC, created_at ASC`) as PersonRow[];
  const suggestions = (await sql`SELECT id, person_id, label, points FROM suggestions ORDER BY points DESC, created_at ASC`) as SuggestionRow[];
  const suggestionsByPerson = new Map<string, BoardPerson["suggestions"]>();

  for (const suggestion of suggestions) {
    const list = suggestionsByPerson.get(suggestion.person_id) ?? [];
    list.push({ id: suggestion.id, label: suggestion.label, points: suggestion.points });
    suggestionsByPerson.set(suggestion.person_id, list);
  }

  return people.map((person) => ({
    ...person,
    suggestions: suggestionsByPerson.get(person.id) ?? [],
  }));
}

export async function readVotedSuggestionIds(voterId: string) {
  const rows = (await database()`SELECT suggestion_id FROM votes WHERE voter_id = ${voterId}`) as Array<{ suggestion_id: string }>;
  return rows.map((row) => row.suggestion_id);
}

export async function addPerson(name: string) {
  await database()`INSERT INTO people (id, name, position)
    SELECT ${crypto.randomUUID()}, ${name}, COALESCE(MAX(position), -1) + 1
    FROM people`;
}

export async function addSuggestion(personId: string, label: string) {
  const rows = (await database()`INSERT INTO suggestions (id, person_id, label)
    SELECT ${crypto.randomUUID()}, ${personId}, ${label}
    WHERE EXISTS (SELECT 1 FROM people WHERE id = ${personId})
    RETURNING id`) as unknown as Array<{ id: string }>;
  return rows.length > 0;
}

async function updatePoints(suggestionId: string) {
  await database()`UPDATE suggestions
    SET points = (SELECT COUNT(*)::integer FROM votes WHERE suggestion_id = ${suggestionId})
    WHERE id = ${suggestionId}`;
}

export async function vote(suggestionId: string, voterId: string) {
  const sql = database();
  const suggestion = (await sql`SELECT id FROM suggestions WHERE id = ${suggestionId}`) as unknown as Array<{ id: string }>;
  if (suggestion.length === 0) return false;

  await sql`INSERT INTO votes (suggestion_id, voter_id)
    VALUES (${suggestionId}, ${voterId})
    ON CONFLICT (suggestion_id, voter_id) DO NOTHING`;
  await updatePoints(suggestionId);
  return true;
}

export async function unvote(suggestionId: string, voterId: string) {
  await database()`DELETE FROM votes WHERE suggestion_id = ${suggestionId} AND voter_id = ${voterId}`;
  await updatePoints(suggestionId);
}

export async function deletePerson(personId: string) {
  await database()`DELETE FROM people WHERE id = ${personId}`;
}

export async function deleteSuggestion(suggestionId: string) {
  await database()`DELETE FROM suggestions WHERE id = ${suggestionId}`;
}
