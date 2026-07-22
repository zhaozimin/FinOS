/**
 * [INPUT]: 依赖浏览器 token、Finance Node HTTP API 与共享领域类型。
 * [OUTPUT]: 对外提供认证请求、账本查询及配置保存方法。
 * [POS]: web-dashboard 的唯一 HTTP 边界；页面不直接调用 fetch。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

const TOKEN_STORAGE_KEY = "finance-node-token";

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export function getToken(): string {
  return localStorage.getItem(TOKEN_STORAGE_KEY) || "";
}

export function setToken(token: string): void {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token.trim());
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

function buildUrl(path: string, params?: Record<string, string | number | undefined | null>): string {
  const url = new URL(path, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.pathname + url.search;
}

async function request<T>(
  method: string,
  path: string,
  options: { body?: unknown; params?: Record<string, string | number | undefined | null> } = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(buildUrl(path, options.params), {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const isJson = (response.headers.get("Content-Type") || "").includes("application/json");
  const payload = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    const message =
      (payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: string }).error)
        : null) || `${method} ${path} failed (${response.status})`;
    throw new ApiError(response.status, message, payload);
  }
  return payload as T;
}

export const api = {
  health() {
    return request<{ status: string; nodeName: string; version: string; lastIngestedAt?: string }>(
      "GET",
      "/v1/health",
    );
  },

  configuration() {
    return request<import("../types").Configuration>("GET", "/v1/configuration");
  },

  putConfiguration(payload: import("../types").Configuration) {
    return request<import("../types").Configuration>("PUT", "/v1/configuration", { body: payload });
  },

  listTransactions(params: {
    view?: import("../types").ViewMode;
    month?: string;
    kind?: string;
    reimbursementStatus?: string;
    tag?: string;
    q?: string;
    categoryId?: string;
    accountName?: string;
    includeDeleted?: 0 | 1;
    limit?: number;
  }) {
    return request<import("../types").Transaction[]>("GET", "/v1/transactions", { params });
  },

  createTransaction(payload: Partial<import("../types").Transaction>) {
    return request<import("../types").Transaction>("POST", "/v1/transactions", { body: payload });
  },

  updateTransaction(id: string, payload: Partial<import("../types").Transaction>) {
    return request<import("../types").Transaction>("PUT", `/v1/transactions/${encodeURIComponent(id)}`, {
      body: payload,
    });
  },

  deleteTransaction(id: string) {
    return request<{ ok: true; id: string }>("DELETE", `/v1/transactions/${encodeURIComponent(id)}`);
  },

  updateReimbursement(id: string, status: import("../types").ReimbursementStatus) {
    return request<{ ok: true; id: string; status: string }>(
      "PATCH",
      `/v1/transactions/${encodeURIComponent(id)}/reimbursement`,
      { body: { status } },
    );
  },

  /** 回款核销：一笔报销回款收入 ↔ 多笔垫付支出的批量对账 */
  settleReimbursement(payload: { incomeId: string; settleIds: string[]; unsettleIds: string[] }) {
    return request<{ ok: true; incomeId: string; settled: number; unsettled: number; invalid: string[] }>(
      "POST",
      "/v1/reimbursements/settle",
      { body: payload },
    );
  },

  summaryMonth(params: { view?: import("../types").ViewMode; month?: string }) {
    return request<import("../types").MonthSummary>("GET", "/v1/summary/month", { params });
  },

  dashboardOverview(params: { view?: import("../types").ViewMode } = {}) {
    return request<import("../types").DashboardOverview>("GET", "/v1/dashboard/overview", { params });
  },

  /** 1.1 预算管理：返回当月有预算的分类的实际花费 / 占比 */
  budgetStatus(params: { month?: string } = {}) {
    return request<import("../types").BudgetStatus>("GET", "/v1/budget/status", { params });
  },

  /** 1.2 周期性交易 CRUD */
  listRecurring() {
    return request<import("../types").RecurringRule[]>("GET", "/v1/recurring");
  },

  createRecurring(payload: Partial<import("../types").RecurringRule>) {
    return request<import("../types").RecurringRule>("POST", "/v1/recurring", { body: payload });
  },

  updateRecurring(id: string, payload: Partial<import("../types").RecurringRule>) {
    return request<import("../types").RecurringRule>(
      "PUT",
      `/v1/recurring/${encodeURIComponent(id)}`,
      { body: payload },
    );
  },

  deleteRecurring(id: string) {
    return request<{ ok: true; id: string }>("DELETE", `/v1/recurring/${encodeURIComponent(id)}`);
  },

  /** W3-G 汇率手动拉取 */
  refreshExchangeRates() {
    return request<import("../types").ExchangeRates>("POST", "/v1/rates/refresh", { body: {} });
  },

  /** 1.4 账单导入 */
  async importPreview(template: string, file: File) {
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const idx = result.indexOf(",");
        resolve(idx >= 0 ? result.slice(idx + 1) : result);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    return request<{
      transactions: Array<Partial<import("../types").Transaction>>;
      warnings: string[];
      detected_columns: Record<string, number | null>;
      headers?: string[];
      template: string;
    }>("POST", "/v1/import/preview", { body: { template, content: data } });
  },

  importCommit(transactions: Array<Partial<import("../types").Transaction>>) {
    return request<{ imported: number; failed: number; errors: Array<{ index: number; error: string }> }>(
      "POST",
      "/v1/import/commit",
      { body: { transactions } },
    );
  },

  /** Build a download URL for the Excel export — opens in new tab. */
  exportXlsxUrl(params: {
    view?: import("../types").ViewMode;
    from?: string;
    to?: string;
  } = {}): string {
    const url = buildUrl("/v1/export/xlsx", params);
    const token = getToken();
    if (!token) return url;
    // 浏览器无法把 Header 加进 download，所以使用 fetch + blob 下载（见 downloadXlsx 函数）
    return url;
  },

  /** 1.6 附件 */
  attachmentUrl(id: string): string {
    const token = getToken();
    return buildUrl(`/v1/attachments/${encodeURIComponent(id)}`, token ? { token } : undefined);
  },

  async uploadAttachment(transactionId: string, file: File): Promise<import("../types").AttachmentRef> {
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // strip "data:<mime>;base64," prefix
        const idx = result.indexOf(",");
        resolve(idx >= 0 ? result.slice(idx + 1) : result);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    return request<import("../types").AttachmentRef>(
      "POST",
      `/v1/transactions/${encodeURIComponent(transactionId)}/attachments`,
      { body: { filename: file.name, mime: file.type || "application/octet-stream", data } },
    );
  },

  deleteAttachment(id: string) {
    return request<{ ok: true; id: string }>("DELETE", `/v1/attachments/${encodeURIComponent(id)}`);
  },

  /** 2.3 税务报表导出 */
  async downloadTaxReport(params: { year: number; quarter?: number }): Promise<{ blob: Blob; filename: string }> {
    const token = getToken();
    const response = await fetch(buildUrl("/v1/export/tax-report", params), {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new ApiError(response.status, text || "Tax report export failed");
    }
    const disposition = response.headers.get("Content-Disposition") || "";
    const match = /filename="([^"]+)"/.exec(disposition);
    const filename = match ? match[1] : `tax-report-${params.year}.xlsx`;
    const blob = await response.blob();
    return { blob, filename };
  },

  async downloadXlsx(params: {
    view?: import("../types").ViewMode;
    from?: string;
    to?: string;
  }): Promise<{ blob: Blob; filename: string }> {
    const token = getToken();
    const response = await fetch(buildUrl("/v1/export/xlsx", params), {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new ApiError(response.status, text || "Excel export failed");
    }
    const disposition = response.headers.get("Content-Disposition") || "";
    const match = /filename="([^"]+)"/.exec(disposition);
    const filename = match ? match[1] : "finance.xlsx";
    const blob = await response.blob();
    return { blob, filename };
  },
};
