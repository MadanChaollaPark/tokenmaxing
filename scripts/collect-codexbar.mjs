#!/usr/bin/env node
import { execFile } from "node:child_process";
import os from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const codexbarBin = process.env.CODEXBAR_BIN || "codexbar";
const endpoint = process.env.TOKENMAXING_ENDPOINT || "http://127.0.0.1:3000/api/usage/ingest";
const ingestToken = process.env.TOKENMAXING_INGEST_TOKEN;
const userId = process.env.TOKENMAXING_USER_ID || os.userInfo().username || "local";
const displayName = process.env.TOKENMAXING_DISPLAY_NAME || userId;
const team = process.env.TOKENMAXING_TEAM || "Unassigned";
const role = process.env.TOKENMAXING_ROLE || "Builder";
const region = process.env.TOKENMAXING_REGION || "Local";

const { stdout } = await execFileAsync(
  codexbarBin,
  ["cost", "--provider", "both", "--format", "json"],
  { maxBuffer: 10 * 1024 * 1024 }
);

const codexbarPayload = JSON.parse(stdout);
const samples = codexbarPayload.filter((entry) => !entry.error).map(toUsageSample);

if (!samples.length) {
  throw new Error("CodexBar returned no usable cost payloads.");
}

const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    ...(ingestToken ? { authorization: `Bearer ${ingestToken}` } : {})
  },
  body: JSON.stringify({ samples })
});

if (!response.ok) {
  const text = await response.text();
  throw new Error(`Ingest failed: ${response.status} ${text}`);
}

const result = await response.json();
console.log(JSON.stringify(result, null, 2));

function toUsageSample(entry) {
  const provider = normalizeProvider(entry.provider);
  const daily = (entry.daily || []).map((day) => ({
    date: String(day.date).slice(0, 10),
    provider,
    inputTokens: number(day.inputTokens),
    outputTokens: number(day.outputTokens),
    cacheReadTokens: number(day.cacheReadTokens),
    cacheCreationTokens: number(day.cacheCreationTokens),
    totalTokens: number(day.totalTokens),
    totalCost: number(day.totalCost),
    models: (day.modelBreakdowns || []).map((model) => ({
      provider,
      modelName: model.modelName || "unknown",
      totalTokens: number(model.totalTokens),
      totalCost: number(model.cost)
    }))
  }));

  const totals = entry.totals
    ? {
        inputTokens: number(entry.totals.inputTokens),
        outputTokens: number(entry.totals.outputTokens),
        cacheReadTokens: number(entry.totals.cacheReadTokens),
        cacheCreationTokens: number(entry.totals.cacheCreationTokens),
        totalTokens: number(entry.totals.totalTokens),
        totalCost: number(entry.totals.totalCost)
      }
    : daily.reduce(
        (acc, day) => ({
          inputTokens: acc.inputTokens + day.inputTokens,
          outputTokens: acc.outputTokens + day.outputTokens,
          cacheReadTokens: acc.cacheReadTokens + day.cacheReadTokens,
          cacheCreationTokens: acc.cacheCreationTokens + day.cacheCreationTokens,
          totalTokens: acc.totalTokens + day.totalTokens,
          totalCost: acc.totalCost + day.totalCost
        }),
        {
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
          totalTokens: 0,
          totalCost: 0
        }
      );

  return {
    userId,
    displayName,
    team,
    role,
    region,
    provider,
    source: entry.source || "codexbar",
    updatedAt: entry.updatedAt || new Date().toISOString(),
    totals,
    daily
  };
}

function normalizeProvider(value) {
  if (value === "codex" || value === "claude") return value;
  return "other";
}

function number(value) {
  return Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
}
