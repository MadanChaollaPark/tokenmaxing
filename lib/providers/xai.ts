import type { DailyUsage, UsageSample, UserSession } from "@/lib/types";

const xAiManagementBase = "https://management-api.x.ai/v1";

interface XaiInvoicesResponse {
  invoices?: XaiInvoice[];
}

interface XaiPreviewResponse {
  coreInvoice?: XaiInvoice;
}

interface XaiInvoice {
  monthly?: {
    billingCycle?: {
      year?: number;
      month?: number;
    };
  };
  lines?: XaiInvoiceLine[];
}

interface XaiInvoiceLine {
  description?: string;
  unitType?: string;
  numUnits?: number | string;
  amount?: number | string;
}

export async function fetchXaiUsageSample({
  days,
  identity,
  managementKey,
  teamId
}: {
  days: number;
  identity: UserSession;
  managementKey: string;
  teamId: string;
}): Promise<UsageSample> {
  const since = startOfTodayMinus(days - 1);
  const invoices = await fetchInvoiceTokenLines(teamId, managementKey, since);
  const daily = invoicesToDailyUsage(invoices, since);
  const totalTokens = daily.reduce((sum, day) => sum + day.totalTokens, 0);
  if (!totalTokens) {
    throw new Error("xAI billing returned no token line items for the selected window. Use manual submit for token ranking.");
  }

  return {
    userId: identity.userId,
    displayName: identity.displayName,
    team: identity.team,
    role: identity.role,
    region: identity.region,
    provider: "xai",
    source: "xai-management-invoices",
    updatedAt: new Date().toISOString(),
    totals: {
      inputTokens: daily.reduce((sum, day) => sum + day.inputTokens, 0),
      outputTokens: daily.reduce((sum, day) => sum + day.outputTokens, 0),
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      totalTokens,
      totalCost: Number(daily.reduce((sum, day) => sum + day.totalCost, 0).toFixed(6))
    },
    daily
  };
}

async function fetchInvoiceTokenLines(teamId: string, managementKey: string, since: Date) {
  const invoicesUrl = new URL(`${xAiManagementBase}/billing/teams/${encodeURIComponent(teamId)}/invoices`);
  invoicesUrl.searchParams.set("since.year", String(since.getFullYear()));
  invoicesUrl.searchParams.set("since.month", String(since.getMonth() + 1));

  const [invoices, preview] = await Promise.all([
    xAiGet<XaiInvoicesResponse>(invoicesUrl.toString(), managementKey),
    xAiGet<XaiPreviewResponse>(
      `${xAiManagementBase}/billing/teams/${encodeURIComponent(teamId)}/postpaid/invoice/preview`,
      managementKey
    ).catch(() => ({ coreInvoice: undefined }))
  ]);

  return [...(invoices.invoices || []), ...(preview.coreInvoice ? [preview.coreInvoice] : [])];
}

function invoicesToDailyUsage(invoices: XaiInvoice[], since: Date): DailyUsage[] {
  const byDate = new Map<string, DailyUsage>();
  for (const invoice of invoices) {
    const date = invoiceDate(invoice);
    if (parseDay(date) < startOfMonth(since)) continue;
    const bucket =
      byDate.get(date) ||
      ({
        date,
        provider: "xai" as const,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        totalTokens: 0,
        totalCost: 0,
        models: []
      } satisfies DailyUsage);

    for (const line of invoice.lines || []) {
      if (!isTokenLine(line)) continue;
      const tokens = Math.round(number(line.numUnits));
      const cost = number(line.amount);
      if (!tokens) continue;
      const output = isOutputLine(line);
      if (output) {
        bucket.outputTokens += tokens;
      } else {
        bucket.inputTokens += tokens;
      }
      bucket.totalTokens += tokens;
      bucket.totalCost += cost;
      bucket.models.push({
        provider: "xai",
        modelName: line.description || "xAI",
        totalTokens: tokens,
        totalCost: cost
      });
    }

    bucket.totalCost = Number(bucket.totalCost.toFixed(6));
    byDate.set(date, bucket);
  }

  return Array.from(byDate.values())
    .filter((day) => day.totalTokens > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function xAiGet<T>(url: string, managementKey: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${managementKey}`,
      "Content-Type": "application/json"
    },
    cache: "no-store"
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`xAI usage sync failed (${response.status}): ${body.slice(0, 180)}`);
  }
  return (await response.json()) as T;
}

function isTokenLine(line: XaiInvoiceLine) {
  return line.unitType?.toLowerCase().includes("token") || line.description?.toLowerCase().includes("token");
}

function isOutputLine(line: XaiInvoiceLine) {
  const haystack = `${line.unitType || ""} ${line.description || ""}`.toLowerCase();
  return haystack.includes("completion") || haystack.includes("output");
}

function invoiceDate(invoice: XaiInvoice) {
  const year = invoice.monthly?.billingCycle?.year || new Date().getFullYear();
  const month = invoice.monthly?.billingCycle?.month || new Date().getMonth() + 1;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function startOfTodayMinus(days: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - Math.max(days, 0));
  return date;
}

function startOfMonth(date: Date) {
  const month = new Date(date);
  month.setDate(1);
  month.setHours(0, 0, 0, 0);
  return month;
}

function parseDay(value: string) {
  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

function number(value: unknown) {
  return Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
}
