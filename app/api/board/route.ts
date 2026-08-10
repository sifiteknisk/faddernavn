import {
  addPerson,
  addSuggestion,
  deletePerson,
  deleteSuggestion,
  ensureBoard,
  readBoard,
  readVotedSuggestionIds,
  unvote,
  vote,
} from "../../../db/board";

type Action =
  | { action: "addPerson"; name?: string }
  | { action: "addSuggestion"; personId?: string; label?: string }
  | { action: "vote"; suggestionId?: string }
  | { action: "unvote"; suggestionId?: string }
  | { action: "deletePerson"; personId?: string }
  | { action: "deleteSuggestion"; suggestionId?: string };

const voterCookie = "sifi_fadder_voter";

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function readVoter(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${voterCookie}=([a-zA-Z0-9-]{16,64})`));
  return match?.[1] ?? crypto.randomUUID();
}

async function boardResponse(request: Request, voterId: string) {
  const headers = new Headers();
  if (!(request.headers.get("cookie") ?? "").includes(`${voterCookie}=`)) {
    const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
    headers.set("Set-Cookie", `${voterCookie}=${voterId}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax${secure}`);
  }
  return Response.json(
    { people: await readBoard(), votedSuggestionIds: await readVotedSuggestionIds(voterId) },
    { headers },
  );
}

export async function GET(request: Request) {
  try {
    await ensureBoard();
    const voterId = readVoter(request);
    return await boardResponse(request, voterId);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Kunne ikke laste inn navnene." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureBoard();
    const voterId = readVoter(request);
    const payload = (await request.json()) as Action;

    if (payload.action === "addPerson") {
      const name = cleanText(payload.name, 50);
      if (!name) return Response.json({ error: "Skriv inn navnet på personen." }, { status: 400 });
      await addPerson(name);
    } else if (payload.action === "addSuggestion") {
      const personId = cleanText(payload.personId, 100);
      const label = cleanText(payload.label, 60);
      if (!personId || !label) return Response.json({ error: "Skriv inn et navneforslag." }, { status: 400 });
      if (!(await addSuggestion(personId, label))) {
        return Response.json({ error: "Personen finnes ikke lenger." }, { status: 404 });
      }
    } else if (payload.action === "vote") {
      const suggestionId = cleanText(payload.suggestionId, 100);
      if (!suggestionId) return Response.json({ error: "Velg et navn å stemme på." }, { status: 400 });
      if (!(await vote(suggestionId, voterId))) {
        return Response.json({ error: "Navneforslaget finnes ikke lenger." }, { status: 404 });
      }
    } else if (payload.action === "unvote") {
      const suggestionId = cleanText(payload.suggestionId, 100);
      if (!suggestionId) return Response.json({ error: "Velg en stemme å fjerne." }, { status: 400 });
      await unvote(suggestionId, voterId);
    } else if (payload.action === "deletePerson") {
      const personId = cleanText(payload.personId, 100);
      if (!personId) return Response.json({ error: "Velg en person å fjerne." }, { status: 400 });
      await deletePerson(personId);
    } else if (payload.action === "deleteSuggestion") {
      const suggestionId = cleanText(payload.suggestionId, 100);
      if (!suggestionId) return Response.json({ error: "Velg et navn å fjerne." }, { status: 400 });
      await deleteSuggestion(suggestionId);
    } else {
      return Response.json({ error: "Ukjent handling." }, { status: 400 });
    }

    return await boardResponse(request, voterId);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Kunne ikke lagre endringen." }, { status: 500 });
  }
}
