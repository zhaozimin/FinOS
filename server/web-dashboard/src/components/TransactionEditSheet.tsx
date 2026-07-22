import { useEffect, useMemo, useRef, useState } from "react";
import { Paperclip, Repeat, Trash2 } from "lucide-react";
import { Button } from "./ui/Button";
import { TextInput } from "./ui/TextInput";
import { Autocomplete } from "./ui/Autocomplete";
import { CategoryTabs } from "./ui/Tabs";
import { Badge } from "./ui/Badge";
import { Modal } from "./ui/Modal";
import { AttachmentLightbox } from "./AttachmentLightbox";
import { AuthedImage } from "./AuthedImage";
import { api } from "../api/client";
import { useApi } from "../lib/useApi";
import type { AttachmentRef, RecurringFrequency, ReimbursementStatus, TaxCategory, Transaction, TransactionKind } from "../types";

const FREQ_OPTIONS: Array<{ value: RecurringFrequency; label: string }> = [
  { value: "daily", label: "每天" },
  { value: "weekly", label: "每周" },
  { value: "monthly", label: "每月" },
  { value: "yearly", label: "每年" },
];

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: (tx: Transaction) => void;
  onDeleted?: (id: string) => void;
  initial?: Partial<Transaction> | null;
}

const KIND_OPTIONS: Array<{ value: TransactionKind; label: string }> = [
  { value: "expense", label: "支出" },
  { value: "income", label: "收入" },
  { value: "transfer", label: "转账" },
];

const REIMBURSEMENT_OPTIONS: Array<{ value: ReimbursementStatus; label: string }> = [
  { value: "notApplicable", label: "无需报销" },
  { value: "draft", label: "待报销" },
  { value: "submitted", label: "已提交" },
  { value: "reimbursed", label: "已报销" },
  { value: "rejected", label: "已驳回" },
];

const TAX_CATEGORY_OPTIONS: Array<{ value: TaxCategory; label: string }> = [
  { value: "personal", label: "个人 / 不参与税务" },
  { value: "business-income", label: "经营收入（计税）" },
  { value: "business-expense-deductible", label: "可抵扣支出" },
  { value: "business-expense-nondeductible", label: "不可抵扣支出" },
  { value: "transfer", label: "内部往来 / 不计税" },
];

export function TransactionEditSheet({ open, onClose, onSaved, onDeleted, initial }: Props) {
  const { data: configuration } = useApi(() => api.configuration(), [open]);
  const [kind, setKind] = useState<TransactionKind>("expense");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [accountName, setAccountName] = useState("");
  const [toAccountName, setToAccountName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [note, setNote] = useState("");
  const [tags, setTags] = useState("");
  const [reimbursementStatus, setReimbursementStatus] = useState<ReimbursementStatus>("notApplicable");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<AttachmentRef[]>([]);
  const [uploading, setUploading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(-1); // -1 = closed
  const [counterpartyId, setCounterpartyId] = useState("");
  const [invoiceIssued, setInvoiceIssued] = useState(false);
  const [invoiceAttachmentId, setInvoiceAttachmentId] = useState<string | null>(null);
  const [taxCategory, setTaxCategory] = useState<TaxCategory>("personal");
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [recurringFreq, setRecurringFreq] = useState<RecurringFrequency>("monthly");
  const [recurringStart, setRecurringStart] = useState(todayIso());
  const [recurringName, setRecurringName] = useState("");
  const [recurringSaving, setRecurringSaving] = useState(false);
  const [recurringMsg, setRecurringMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setKind((initial?.kind as TransactionKind) || "expense");
      setTitle(initial?.title || "");
      setAmount(initial?.amount ? String(initial.amount) : "");
      setAccountName(initial?.accountName || initial?.fromAccountName || "");
      setToAccountName(initial?.toAccountName || "");
      setCategoryId(initial?.category?.id || "");
      setProjectName(initial?.projectName || "");
      setNote(initial?.note || "");
      setTags((initial?.tags || []).join(", "));
      setReimbursementStatus((initial?.reimbursementStatus as ReimbursementStatus) || "notApplicable");
      setConfirmDelete(false);
      setError(null);
      setAttachments(initial?.attachments || []);
      setLightboxIndex(-1);
      setCounterpartyId(initial?.counterpartyId || "");
      setInvoiceIssued(Boolean(initial?.invoiceIssued));
      setInvoiceAttachmentId(initial?.invoiceAttachmentId || null);
      setTaxCategory((initial?.taxCategory as TaxCategory) || "personal");
      setRecurringOpen(false);
      setRecurringMsg(null);
      setRecurringName(initial?.title || "");
      setRecurringStart(todayIso());
      setRecurringFreq("monthly");
    }
  }, [open, initial]);

  const transactionId = initial?.id;
  const onPickFiles = async (files: FileList | null) => {
    if (!files || !transactionId) return;
    setUploading(true);
    try {
      const uploaded: AttachmentRef[] = [];
      for (const file of Array.from(files)) {
        const ref = await api.uploadAttachment(transactionId, file);
        uploaded.push(ref);
      }
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setError(`附件上传失败：${(err as Error).message || "未知错误"}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const accountOptions = useMemo(
    () =>
      (configuration?.accounts || []).map((a) => ({ value: a.name, label: a.name })),
    [configuration],
  );
  const categoryOptions = useMemo(
    () => [
      { value: "", label: "（不指定）" },
      ...(configuration?.categories || []).map((c) => ({ value: c.id || "", label: c.name })),
    ],
    [configuration],
  );
  const projectOptions = useMemo(
    () => [
      { value: "", label: "（不指定）" },
      ...(configuration?.settings.projects || []).map((p) => ({ value: p.name, label: p.name })),
    ],
    [configuration],
  );
  const counterpartyOptions = useMemo(
    () => [
      { value: "", label: "（不指定）" },
      ...(configuration?.settings.counterparties || []).map((cp) => ({ value: cp.id, label: cp.name })),
    ],
    [configuration],
  );

  const submit = async () => {
    setError(null);
    if (!title.trim()) return setError("请填写标题");
    const amountNum = parseFloat(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) return setError("金额需为大于 0 的数字");
    if (kind !== "income" && !accountName) return setError("请选择出账账户");
    if (kind === "transfer" && !toAccountName) return setError("请选择转入账户");
    if (kind === "income" && !accountName) return setError("请选择入账账户");

    const cat = (configuration?.categories || []).find((c) => c.id === categoryId);

    const payload: Partial<Transaction> = {
      title: title.trim(),
      amount: amountNum,
      kind,
      accountName,
      fromAccountName: kind === "income" ? null : accountName,
      toAccountName: kind === "expense" ? null : toAccountName || accountName,
      category: cat ? { id: cat.id, name: cat.name } : { id: "", name: "" },
      projectName: projectName || null,
      note,
      tags: tags
        .split(/[,，、]/)
        .map((s) => s.trim())
        .filter(Boolean),
      reimbursementStatus,
      source: "manual",
      counterpartyId: counterpartyId || null,
      invoiceIssued,
      invoiceAttachmentId: invoiceAttachmentId || null,
      taxCategory,
    };

    setBusy(true);
    try {
      const saved = initial?.id
        ? await api.updateTransaction(initial.id, payload)
        : await api.createTransaction(payload);
      onSaved?.(saved);
    } catch (err) {
      const message = err && typeof err === "object" && "message" in err ? String((err as Error).message) : "保存失败";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const saveAsRecurring = async () => {
    setError(null);
    setRecurringMsg(null);
    if (!title.trim()) {
      setError("请先填写标题");
      return;
    }
    const amountNum = parseFloat(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setError("金额需为大于 0 的数字");
      return;
    }
    const cat = (configuration?.categories || []).find((c) => c.id === categoryId);
    setRecurringSaving(true);
    try {
      await api.createRecurring({
        name: recurringName.trim() || title.trim(),
        frequency: recurringFreq,
        intervalN: 1,
        startDate: recurringStart,
        nextDueAt: recurringStart,
        enabled: true,
        template: {
          title: title.trim(),
          amount: amountNum,
          kind,
          accountName,
          fromAccountName: kind === "income" ? null : accountName,
          toAccountName: kind === "expense" ? null : toAccountName || accountName,
          merchant: title.trim(),
          note,
          tags: tags.split(/[,，、]/).map((s) => s.trim()).filter(Boolean),
          category: cat ? { id: cat.id, name: cat.name, tintHex: cat.tintHex } : { name: "未分类" },
          projectName: projectName || null,
          counterpartyId: counterpartyId || null,
          taxCategory,
        },
      });
      setRecurringMsg(`已保存为${FREQ_OPTIONS.find((f) => f.value === recurringFreq)?.label}规则，下次触发：${recurringStart}`);
      setRecurringOpen(false);
    } catch (err) {
      const message = err && typeof err === "object" && "message" in err ? String((err as Error).message) : "保存周期规则失败";
      setError(message);
    } finally {
      setRecurringSaving(false);
    }
  };

  const removeTransaction = async () => {
    if (!initial?.id) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      setError(null);
      return;
    }

    setDeleting(true);
    setError(null);
    try {
      await api.deleteTransaction(initial.id);
      onDeleted?.(initial.id);
    } catch (err) {
      const message = err && typeof err === "object" && "message" in err ? String((err as Error).message) : "删除失败";
      setError(message);
    } finally {
      setDeleting(false);
    }
  };

  const isEdit = Boolean(initial?.id);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "编辑交易" : "新增交易"}
      description="数据写入后立即对仪表板可见"
      size="lg"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <div className="min-h-9">
            {isEdit && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant={confirmDelete ? "destructive" : "outline"}
                  leading={<Trash2 size={14} />}
                  onClick={removeTransaction}
                  loading={deleting}
                  disabled={busy}
                >
                  {confirmDelete ? "确认删除" : "删除交易"}
                </Button>
                {confirmDelete && (
                  <span className="text-[12px] text-muted-foreground">
                    会从 Finance Node 数据库删除这笔交易
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <Button variant="outline" onClick={onClose} disabled={busy || deleting}>
              取消
            </Button>
            <Button onClick={submit} loading={busy} disabled={deleting}>
              {isEdit ? "保存修改" : "保存交易"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3.5 py-2.5 text-[13px] text-destructive">
            {error}
          </div>
        )}

        <div>
          <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground block mb-1.5">类型</span>
          <CategoryTabs value={kind} onChange={setKind} options={KIND_OPTIONS} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextInput
            label="标题"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例：午饭 / 小红书提现"
          />
          <TextInput
            label="金额（人民币）"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            placeholder="0.00"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Autocomplete
            label={kind === "income" ? "入账账户" : "出账账户"}
            value={accountName}
            onChange={(value) => setAccountName(value)}
            options={[{ value: "", label: "（请选择）" }, ...accountOptions]}
            placeholder="选择账户…"
            searchPlaceholder="搜索账户…"
          />
          {kind === "transfer" && (
            <Autocomplete
              label="转入账户"
              value={toAccountName}
              onChange={(value) => setToAccountName(value)}
              options={[{ value: "", label: "（请选择）" }, ...accountOptions]}
              placeholder="选择账户…"
              searchPlaceholder="搜索账户…"
            />
          )}
          {kind !== "transfer" && (
            <Autocomplete
              label="分类"
              value={categoryId}
              onChange={(value) => setCategoryId(value)}
              options={categoryOptions}
              placeholder="选择分类…"
              searchPlaceholder="搜索分类…"
            />
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Autocomplete
            label="项目"
            value={projectName}
            onChange={(value) => setProjectName(value)}
            options={projectOptions}
            placeholder="选择项目…"
            searchPlaceholder="搜索项目…"
          />
          <Autocomplete
            label="对手方 / 客户"
            value={counterpartyId}
            onChange={(value) => setCounterpartyId(value)}
            options={counterpartyOptions}
            placeholder="选择对手方…"
            searchPlaceholder="搜索对手方…"
          />
        </div>

        <TextInput
          label="标签（逗号分隔）"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="出差, 客户"
        />

        <TextInput
          label="备注"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="可选 — 用途、对方、上下文"
        />

        {transactionId && (
          <div>
            <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground block mb-1.5">
              附件 / 发票
            </span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {attachments.map((att, i) => (
                <button
                  key={att.id}
                  type="button"
                  onClick={() => setLightboxIndex(i)}
                  className="group relative flex h-24 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/30 transition hover:border-ring"
                  title={att.originalName}
                >
                  {att.mime?.startsWith("image/") ? (
                    <AuthedImage
                      id={att.id}
                      alt={att.originalName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="px-2 text-center text-[11px] text-muted-foreground">
                      {att.originalName.slice(0, 20)}
                    </span>
                  )}
                  <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/80 to-transparent px-1.5 py-1 text-left text-[10px] text-white opacity-0 transition group-hover:opacity-100">
                    {att.originalName}
                  </span>
                </button>
              ))}
              <label
                className={`flex h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border bg-muted/20 text-muted-foreground transition hover:border-ring hover:text-foreground ${uploading ? "pointer-events-none opacity-50" : ""}`}
              >
                <Paperclip size={18} />
                <span className="text-[11px]">{uploading ? "上传中…" : "添加附件"}</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => onPickFiles(e.target.files)}
                  disabled={uploading}
                />
              </label>
            </div>
          </div>
        )}

        {kind === "expense" && (
          <div>
            <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground block mb-1.5">报销状态</span>
            <CategoryTabs
              value={reimbursementStatus}
              onChange={setReimbursementStatus}
              options={REIMBURSEMENT_OPTIONS}
              size="sm"
            />
            {reimbursementStatus !== "notApplicable" && (
              <Badge tone="warning" className="mt-2">
                这笔将进入报销跟踪
              </Badge>
            )}
          </div>
        )}

        {(kind === "income" || kind === "expense") && (
          <div className="rounded-md border border-border/60 bg-background/30 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">发票</span>
              <label className="inline-flex cursor-pointer items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={invoiceIssued}
                  onChange={(e) => setInvoiceIssued(e.target.checked)}
                />
                <span>已开 / 应开发票</span>
              </label>
            </div>
            {invoiceIssued && (
              <div className="space-y-2 text-[12.5px] text-muted-foreground">
                {invoiceAttachmentId ? (
                  <div className="flex items-center justify-between gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
                    <span>已绑定发票附件 · ID {invoiceAttachmentId.slice(0, 8)}…</span>
                    <button type="button" onClick={() => setInvoiceAttachmentId(null)} className="text-[12px] text-destructive hover:underline">
                      解除绑定
                    </button>
                  </div>
                ) : attachments.length > 0 ? (
                  <div>
                    <div className="mb-1">从已上传的附件中选一个作为发票：</div>
                    <Autocomplete
                      size="sm"
                      ariaLabel="选择发票附件"
                      value=""
                      onChange={(value) => setInvoiceAttachmentId(value || null)}
                      placeholder="— 选择发票附件 —"
                      options={attachments.map((a) => ({ value: a.id, label: a.originalName }))}
                    />
                  </div>
                ) : (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-700 dark:text-amber-300">
                    未上传发票附件 · 在上方"附件 / 发票"区上传后即可在这里绑定
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {(kind === "income" || kind === "expense") && (
          <Autocomplete
            label="税务分类"
            value={taxCategory}
            onChange={(value) => setTaxCategory(value as TaxCategory)}
            options={TAX_CATEGORY_OPTIONS}
          />
        )}

        <div className="rounded-md border border-border/60 bg-background/30 p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">周期规则</span>
            <Button
              variant="outline"
              size="sm"
              leading={<Repeat size={13} />}
              onClick={() => setRecurringOpen((prev) => !prev)}
            >
              {recurringOpen ? "收起" : "另存为周期规则"}
            </Button>
          </div>
          {recurringMsg && (
            <div className="mt-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[12.5px] text-emerald-700 dark:text-emerald-300">
              {recurringMsg}
            </div>
          )}
          {recurringOpen && (
            <div className="mt-3 grid grid-cols-1 gap-3">
              <TextInput
                label="规则名称"
                value={recurringName}
                onChange={(e) => setRecurringName(e.target.value)}
                placeholder="例：Netflix 月度订阅"
              />
              <div className="grid grid-cols-2 gap-3">
                <Autocomplete
                  label="频率"
                  value={recurringFreq}
                  onChange={(value) => setRecurringFreq(value as RecurringFrequency)}
                  options={FREQ_OPTIONS}
                />
                <TextInput
                  label="起始日期 / 下次触发"
                  type="date"
                  value={recurringStart}
                  onChange={(e) => setRecurringStart(e.target.value)}
                />
              </div>
              <div className="text-[12px] text-muted-foreground">
                创建后会立刻按该日期前 catchup 一次（如选过去日期会立刻生成补差交易）。
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setRecurringOpen(false)} disabled={recurringSaving}>
                  取消
                </Button>
                <Button size="sm" leading={<Repeat size={13} />} loading={recurringSaving} onClick={saveAsRecurring}>
                  保存为周期规则
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <AttachmentLightbox
        open={lightboxIndex >= 0}
        attachments={attachments}
        initialIndex={Math.max(0, lightboxIndex)}
        onClose={() => setLightboxIndex(-1)}
        onDelete={(id) => setAttachments((prev) => prev.filter((a) => a.id !== id))}
      />
    </Modal>
  );
}
