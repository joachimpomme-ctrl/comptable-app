import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  bigint,
  jsonb,
  pgEnum,
  primaryKey,
  uniqueIndex,
  index,
  date,
  numeric,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

/* ---------------------------------------------------------------------------
 * Enums
 * ------------------------------------------------------------------------- */

export const projectRoleEnum = pgEnum("project_role", ["viewer", "editor"]);
export const messageRoleEnum = pgEnum("message_role", [
  "user",
  "assistant",
  "tool",
  "system",
]);
export const modelEnum = pgEnum("ai_model", ["sonnet", "opus"]);
export const docFolderEnum = pgEnum("doc_folder", [
  "factures",
  "releves_bancaires",
  "analyses",
  "simulations",
  "documents_officiels",
  "autres",
]);
export const simulationTemplateEnum = pgEnum("simulation_template", [
  "pv_lmnp",
  "comparatif_micro_reel_bnc",
  "ifi",
  "deficit_foncier",
  "donation_simple",
  "comparatif_per",
  "declaration_2035_check",
]);

/* ---------------------------------------------------------------------------
 * Auth.js tables (Drizzle adapter shape)
 * Required by @auth/drizzle-adapter. We piggy-back `users` as our app users
 * table — extending it with our own columns (created_at, etc.).
 * ------------------------------------------------------------------------- */

export const users = pgTable("users", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date", withTimezone: true }),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.provider, t.providerAccountId] }),
    userIdx: index("accounts_user_idx").on(t.userId),
  }),
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.identifier, t.token] }),
  }),
);

/* ---------------------------------------------------------------------------
 * Projects + membership
 * ------------------------------------------------------------------------- */

export const projects = pgTable(
  "projects",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    // Google Drive folder ID hosting the project tree
    // ([Projet]/Factures, /Relevés bancaires, /Analyses, /Simulations,
    //  /Documents officiels). Null until the folder is provisioned.
    driveFolderId: text("drive_folder_id"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    ownerIdx: index("projects_owner_idx").on(t.ownerId),
  }),
);

export const projectMembers = pgTable(
  "project_members",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: projectRoleEnum("role").notNull().default("viewer"),
    invitedBy: uuid("invited_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.projectId, t.userId] }),
    userIdx: index("project_members_user_idx").on(t.userId),
  }),
);

/* ---------------------------------------------------------------------------
 * Conversations + messages
 * ------------------------------------------------------------------------- */

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    // A conversation can be project-scoped or "scratch" (null project)
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title"),
    model: modelEnum("model").notNull().default("sonnet"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("conversations_user_idx").on(t.userId),
    projectIdx: index("conversations_project_idx").on(t.projectId),
  }),
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: messageRoleEnum("role").notNull(),
    // Anthropic-shaped content blocks (text / tool_use / tool_result)
    content: jsonb("content").notNull(),
    // Per-message accounting (assistant messages only have these populated)
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    cacheReadTokens: integer("cache_read_tokens"),
    cacheWriteTokens: integer("cache_write_tokens"),
    latencyMs: integer("latency_ms"),
    costUsd: numeric("cost_usd", { precision: 10, scale: 6 }),
    model: text("model"),
    stopReason: text("stop_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    convIdx: index("messages_conversation_idx").on(t.conversationId, t.createdAt),
  }),
);

/* ---------------------------------------------------------------------------
 * Documents (Drive-backed pointers)
 * ------------------------------------------------------------------------- */

export const documents = pgTable(
  "documents",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    driveFileId: text("drive_file_id").notNull(),
    name: text("name").notNull(),
    mimeType: text("mime_type").notNull(),
    folder: docFolderEnum("folder").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    sha256: text("sha256"),
    // Optional extracted text cache for fast Claude prompting (truncated).
    extractedText: text("extracted_text"),
    uploadedBy: uuid("uploaded_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    projectIdx: index("documents_project_idx").on(t.projectId),
    driveUnique: uniqueIndex("documents_drive_file_unique").on(t.driveFileId),
  }),
);

/* ---------------------------------------------------------------------------
 * Simulations
 * ------------------------------------------------------------------------- */

export const simulations = pgTable(
  "simulations",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    template: simulationTemplateEnum("template").notNull(),
    title: text("title").notNull(),
    // Validated against the template's Zod schema before insert
    inputs: jsonb("inputs").notNull(),
    outputs: jsonb("outputs"),
    // Linked Google Sheet for the structured simulation
    driveSheetId: text("drive_sheet_id"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    projectIdx: index("simulations_project_idx").on(t.projectId),
  }),
);

/* ---------------------------------------------------------------------------
 * Audit log (security + ops)
 * ------------------------------------------------------------------------- */

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(), // e.g. "auth.signin", "project.create", "tool.create_simulation_sheet"
    resourceType: text("resource_type"), // "project", "conversation", "document", ...
    resourceId: text("resource_id"),
    metadata: jsonb("metadata"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("audit_log_user_idx").on(t.userId, t.createdAt),
    actionIdx: index("audit_log_action_idx").on(t.action, t.createdAt),
  }),
);

/* ---------------------------------------------------------------------------
 * Monthly API usage rollup (per user × month × model)
 * ------------------------------------------------------------------------- */

export const apiUsageMonthly = pgTable(
  "api_usage_monthly",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // First day of the month (UTC) acts as the bucket key
    month: date("month").notNull(),
    model: text("model").notNull(),
    inputTokens: bigint("input_tokens", { mode: "number" })
      .notNull()
      .default(0),
    outputTokens: bigint("output_tokens", { mode: "number" })
      .notNull()
      .default(0),
    cacheReadTokens: bigint("cache_read_tokens", { mode: "number" })
      .notNull()
      .default(0),
    cacheWriteTokens: bigint("cache_write_tokens", { mode: "number" })
      .notNull()
      .default(0),
    costUsd: numeric("cost_usd", { precision: 12, scale: 6 })
      .notNull()
      .default("0"),
    requestCount: integer("request_count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    bucket: uniqueIndex("api_usage_monthly_bucket").on(
      t.userId,
      t.month,
      t.model,
    ),
  }),
);

/* ---------------------------------------------------------------------------
 * Relations (used by Drizzle relational queries)
 * ------------------------------------------------------------------------- */

export const usersRelations = relations(users, ({ many }) => ({
  ownedProjects: many(projects),
  memberships: many(projectMembers),
  conversations: many(conversations),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, { fields: [projects.ownerId], references: [users.id] }),
  members: many(projectMembers),
  conversations: many(conversations),
  documents: many(documents),
  simulations: many(simulations),
}));

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, {
    fields: [projectMembers.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [projectMembers.userId],
    references: [users.id],
  }),
}));

export const conversationsRelations = relations(
  conversations,
  ({ one, many }) => ({
    project: one(projects, {
      fields: [conversations.projectId],
      references: [projects.id],
    }),
    user: one(users, {
      fields: [conversations.userId],
      references: [users.id],
    }),
    messages: many(messages),
  }),
);

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));
