/**
 * Google Sheets persistence — writes each request to Historique_Compta.
 *
 * Auth: service account JSON (base64 in SHEETS_SERVICE_ACCOUNT_B64).
 * Disabled gracefully if env vars are not set (logs to console instead).
 *
 * Sheet schema (12 columns):
 *   timestamp, question_hash, question, orch_classification, gem_response,
 *   calc_results, reviewer_verdict, qg_annotations, final_response,
 *   latency_ms, cost_eur, user_feedback
 */

import { google } from "googleapis";
import { JWT } from "google-auth-library";
import { env } from "../env";
import type { SheetRow } from "../types";

const SHEET_TAB = "Historique_Compta";
const SHEET_RANGE = `${SHEET_TAB}!A:L`;

let _sheets: ReturnType<typeof google.sheets> | null = null;

function getSheetsClient() {
  if (_sheets) return _sheets;
  if (!env.SHEETS_ENABLED) {
    throw new Error("Sheets logging disabled — set SHEETS_ID and SHEETS_SERVICE_ACCOUNT_B64");
  }
  const credentialsJson = Buffer.from(
    env.SHEETS_SERVICE_ACCOUNT_B64,
    "base64",
  ).toString("utf8");
  const credentials = JSON.parse(credentialsJson) as {
    client_email: string;
    private_key: string;
  };

  const auth = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  _sheets = google.sheets({ version: "v4", auth });
  return _sheets;
}

function serializeRow(row: SheetRow): (string | number)[] {
  return [
    row.timestamp,
    row.question_hash,
    row.question,
    row.orch_classification ? JSON.stringify(row.orch_classification) : "",
    row.gem_response ? JSON.stringify(row.gem_response) : "",
    row.calc_results.length ? JSON.stringify(row.calc_results) : "",
    row.reviewer_verdict ? JSON.stringify(row.reviewer_verdict) : "",
    row.qg_annotations ? JSON.stringify(row.qg_annotations) : "",
    row.final_response,
    row.latency_ms,
    row.cost_eur,
    row.user_feedback ?? "",
  ];
}

export async function logToSheets(row: SheetRow): Promise<void> {
  if (!env.SHEETS_ENABLED) {
    console.log("[sheets] disabled — would write:", {
      ts: row.timestamp,
      hash: row.question_hash,
      latency_ms: row.latency_ms,
    });
    return;
  }
  try {
    const sheets = getSheetsClient();
    await sheets.spreadsheets.values.append({
      spreadsheetId: env.SHEETS_ID,
      range: SHEET_RANGE,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [serializeRow(row)] },
    });
  } catch (err) {
    // Never crash the request because of logging.
    console.error("[sheets] log failed:", err instanceof Error ? err.message : err);
  }
}

/** Ensure the header row exists. Call once during setup, idempotent. */
export const HEADER_ROW: string[] = [
  "timestamp",
  "question_hash",
  "question",
  "orch_classification",
  "gem_response",
  "calc_results",
  "reviewer_verdict",
  "qg_annotations",
  "final_response",
  "latency_ms",
  "cost_eur",
  "user_feedback",
];

export async function ensureHeader(): Promise<void> {
  if (!env.SHEETS_ENABLED) return;
  const sheets = getSheetsClient();
  const got = await sheets.spreadsheets.values.get({
    spreadsheetId: env.SHEETS_ID,
    range: `${SHEET_TAB}!A1:L1`,
  });
  if (!got.data.values || got.data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: env.SHEETS_ID,
      range: `${SHEET_TAB}!A1:L1`,
      valueInputOption: "RAW",
      requestBody: { values: [HEADER_ROW] },
    });
  }
}
