import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const people = sqliteTable(
  "people",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_people_position").on(table.position)],
);

export const suggestions = sqliteTable(
  "suggestions",
  {
    id: text("id").primaryKey(),
    personId: text("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    points: integer("points").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_suggestions_person_points").on(table.personId, table.points)],
);

export const votes = sqliteTable(
  "votes",
  {
    suggestionId: text("suggestion_id").notNull().references(() => suggestions.id, { onDelete: "cascade" }),
    voterId: text("voter_id").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    primaryKey({ columns: [table.suggestionId, table.voterId] }),
    index("idx_votes_voter_id").on(table.voterId),
  ],
);
