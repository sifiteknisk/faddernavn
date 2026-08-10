import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Faddernavn ships its finished product surface", async () => {
  const [page, layout, vercel] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../vercel.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /Faddernavn/);
  assert.match(page, /addSuggestion/);
  assert.match(page, /votedSuggestionIds/);
  assert.match(layout, /Faddernavn/);
  assert.doesNotMatch(layout, /Starter Project/);
  assert.equal(JSON.parse(vercel).framework, "nextjs");
});
