"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { updateLeadFollowUp } from "@/app/actions";
import type { DashboardData } from "@/lib/dashboard-data";
import { leadStatuses, type LeadActionState } from "@/lib/lead-follow-up";
import { sourceLabel } from "@/lib/source-label";
import { telegramContactUrl } from "@/lib/telegram-contact";

type Lead = DashboardData["leads"]["records"][number];
const dateTime = (value: string) => new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
}).format(new Date(value));
const typeLabel = (lead: Lead) => lead.service === "register" ? "协助注册" : lead.leadType === "buy" ? "委托购买" : lead.leadType === "sell" ? "提交出售" : "联系 JUYU";

export function LeadWorkspace({ records }: { records: Lead[] }) {
  const [mode, setMode] = useState("real");
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const onSaved = useCallback((id: number) => setNotice(`Lead #${id} 已保存。如标记为测试，可切换到“测试记录”查看。`), []);
  const filtered = useMemo(() => records.filter((lead) => {
    if (mode === "real" && lead.isTest || mode === "test" && !lead.isTest) return false;
    if (status !== "all" && lead.followUpStatus !== status) return false;
    const term = query.trim().toLowerCase();
    return !term || [lead.id, lead.telegramUserId, lead.domain, lead.username, lead.contact, lead.notes, lead.budget, lead.price, lead.source]
      .some((value) => String(value ?? "").toLowerCase().includes(term));
  }), [records, mode, status, query]);
  const selected = filtered.find((lead) => lead.stableKey === selectedKey) ?? filtered[0] ?? null;
  return <section className="lead-workspace">
    <div className="lead-toolbar">
      <div className="filter-tabs" role="tablist" aria-label="线索分类">
        {[["real", "真实线索"], ["test", "测试记录"], ["all", "全部记录"]].map(([value, label]) =>
          <button type="button" key={value} role="tab" aria-selected={mode === value} className={mode === value ? "active" : ""} onClick={() => setMode(value)}>{label}</button>)}
      </div>
      <label>跟进状态<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">全部状态</option>{Object.entries(leadStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="lead-search">搜索线索<input type="search" placeholder="域名、Telegram、编号或联系方式" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
    </div>
    <p className="lead-scope-note">商业线索统计不含手动标记的测试申请；其他页面的用户行为统计保持原样。列表最多显示本周期最近 100 条。</p>
    {notice ? <p role="status" className="lead-scope-note">{notice}</p> : null}
    <div className="ops-panel compact-table-panel">
      <table className="compact-ops-table lead-records-table">
        <thead><tr><th>Lead／状态</th><th>需求</th><th>Telegram 用户</th><th>预算／售价</th><th>来源</th><th>提交时间</th><th>操作</th></tr></thead>
        <tbody>{filtered.length ? filtered.map((lead) => <tr key={lead.stableKey} className={selected?.stableKey === lead.stableKey ? "selected" : ""}>
          <td><strong>#{lead.id}</strong><small className="table-subline">{leadStatuses[lead.followUpStatus]}{lead.isTest ? " · 测试" : ""}</small></td>
          <td><strong>{lead.domain ?? "咨询需求"}</strong><small className="table-subline">{typeLabel(lead)}</small></td>
          <td>{lead.username ? <a className="id-link" href={telegramContactUrl(lead)} target="_blank" rel="noreferrer">@{lead.username}</a> : <strong>{lead.telegramUserId}</strong>}<small className="table-subline">ID {lead.telegramUserId}</small></td>
          <td>{lead.leadType === "sell" ? lead.price ?? "未提供售价" : lead.budget ?? "未提供预算"}</td>
          <td>{sourceLabel(lead.source)}<small className="table-subline">{lead.databaseSource === "legacy" ? "旧 Bot 历史（只读）" : "统一 Bot"}</small></td>
          <td>{dateTime(lead.createdAt)}</td>
          <td><button className="id-link" type="button" onClick={() => setSelectedKey(lead.stableKey)}>查看 #{lead.id}</button></td>
        </tr>) : <tr><td colSpan={7} className="compact-empty-row">没有符合条件的线索。可切换分类或清除搜索。</td></tr>}</tbody>
      </table>
    </div>
    {selected ? <LeadDetail key={selected.stableKey} lead={selected} onSaved={onSaved} /> : null}
  </section>;
}

function LeadDetail({ lead, onSaved }: { lead: Lead; onSaved: (id: number) => void }) {
  return <section className="ops-panel lead-detail" aria-label={`Lead #${lead.id} 详情`}>
    <header><div><p>客户需求详情</p><h2>#{lead.id} · {lead.domain ?? typeLabel(lead)}</h2></div><span>{lead.isTest ? "测试申请" : "真实线索"}</span></header>
    <dl className="lead-detail-grid">
      <Field label="需求类型" value={typeLabel(lead)} />
      <Field label="Telegram 用户 ID" value={String(lead.telegramUserId)} />
      <Field label="购买预算" value={lead.budget} /><Field label="期望售价" value={lead.price} />
      <Field label="用途" value={lead.purpose} /><Field label="是否接受议价" value={lead.negotiable} />
      <Field label="其他平台挂牌" value={lead.listed} /><Field label="联系方式" value={lead.contact} />
      <Field label="咨询内容" value={lead.message} /><Field label="来源" value={`${sourceLabel(lead.source)}（${lead.source}）`} />
      <Field label="提交时间" value={dateTime(lead.createdAt)} />
      <Field label="跟进更新时间" value={lead.followUpUpdatedAt ? dateTime(lead.followUpUpdatedAt) : "尚未更新"} />
    </dl>
    <a className="lead-contact-button" href={telegramContactUrl(lead)} target="_blank" rel="noreferrer">{lead.username ? `打开 @${lead.username}` : "尝试打开 Telegram 用户"}</a>
    {!lead.username ? <p className="lead-scope-note">没有公开用户名时，Telegram 可能无法通过 ID 打开个人主页；请优先使用客户留下的联系方式。</p> : null}
    {lead.databaseSource === "check" ? <LeadEditor lead={lead} onSaved={onSaved} /> : <p className="lead-scope-note">旧库记录只读，本次不会修改旧 Commerce 数据库。</p>}
  </section>;
}
function Field({ label, value }: { label: string; value: string | null }) {
  return <div><dt>{label}</dt><dd>{value || "未提供"}</dd></div>;
}
function LeadEditor({ lead, onSaved }: { lead: Lead; onSaved: (id: number) => void }) {
  const router = useRouter();
  const [status, setStatus] = useState(lead.followUpStatus);
  const [notes, setNotes] = useState(lead.notes);
  const [isTest, setIsTest] = useState(lead.isTest);
  const [state, setState] = useState<LeadActionState>({ status: "idle" });
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      const result = await updateLeadFollowUp({ status: "idle" }, form);
      setState(result);
      if (result.status === "saved") { onSaved(lead.id); router.refresh(); }
    } catch {
      setState({ status: "error", message: "无法确认是否保存。请先复制当前备注，再刷新核对最新记录。" });
    } finally { setPending(false); }
  }
  // A function-valued form action resets native selects even after a returned error.
  // Submit explicitly so failed/conflicting edits retain every draft field.
  return <form onSubmit={submit} className="lead-editor">
    <input type="hidden" name="leadId" value={lead.id} /><input type="hidden" name="revision" value={lead.revision} />
    <label>跟进状态<select name="status" value={status} onChange={(event) => setStatus(event.target.value as typeof status)} disabled={pending}>{Object.entries(leadStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label className="lead-test-toggle"><input type="checkbox" name="isTest" checked={isTest} onChange={(event) => setIsTest(event.target.checked)} disabled={pending} />这是测试申请（保留记录，不计入商业线索统计）</label>
    <label>跟进备注<textarea name="notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} rows={4} placeholder="记录联系情况、客户回应与下一步，不自动发送给客户。" disabled={pending} /></label>
    <div className="lead-save-row"><button type="submit" disabled={pending}>{pending ? "保存中…" : "保存跟进"}</button><p role="status" className={state.status === "error" ? "lead-save-error" : ""}>{state.message}</p></div>
  </form>;
}
