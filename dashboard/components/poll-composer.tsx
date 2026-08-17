"use client";

import { useActionState, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  CirclePlus,
  ExternalLink,
  LoaderCircle,
  LockKeyhole,
  Radio,
  Send,
  Trash2,
} from "lucide-react";
import { publishPoll } from "@/app/actions";
import { botDeepLink, normalizeCampaign, type PollActionState } from "@/lib/poll";
import type { PollPublisherStatus } from "@/lib/telegram-publisher";

const initialState: PollActionState = { status: "idle" };
const starterOptions = ["每次都会", "会看，但不确定方法", "很少检查", "不知道怎么查"];

export function PollComposer({
  publisher,
  defaultCampaign,
}: {
  publisher: PollPublisherStatus;
  defaultCampaign: string;
}) {
  const [state, formAction, isPending] = useActionState(publishPoll, initialState);
  const [target, setTarget] = useState<"test" | "production">("test");
  const [question, setQuestion] = useState("你买过期域名前，会检查历史吗？");
  const [options, setOptions] = useState(starterOptions);
  const [campaign, setCampaign] = useState(defaultCampaign);
  const [buttonText, setButtonText] = useState("🔍 免费检查我的域名");
  const cleanCampaign = useMemo(() => normalizeCampaign(campaign), [campaign]);
  const deepLink = botDeepLink(publisher.botUsername, cleanCampaign || "campaign");

  function updateOption(index: number, value: string) {
    setOptions((current) => current.map((option, optionIndex) => optionIndex === index ? value : option));
  }

  function removeOption(index: number) {
    setOptions((current) => current.filter((_, optionIndex) => optionIndex !== index));
  }

  return (
    <div className="poll-workspace">
      <form action={formAction} className="poll-editor-card">
        <div className="poll-card-heading">
          <div>
            <p className="card-kicker">CAMPAIGN COMPOSER</p>
            <h2>创建频道 Poll</h2>
          </div>
          <span className="secure-chip"><LockKeyhole size={12} /> Server protected</span>
        </div>

        {!publisher.configured ? (
          <div className="publisher-notice warning">
            <AlertTriangle size={16} />
            <div><strong>还差一个 Vercel 环境变量</strong><span>在 Growth Dashboard 项目加入 TELEGRAM_BOT_TOKEN 后即可发布。</span></div>
          </div>
        ) : (
          <div className="publisher-notice ready">
            <Check size={16} />
            <div><strong>发布器已就绪</strong><span>Token 只在服务器端使用，不会发送到浏览器。</span></div>
          </div>
        )}

        <fieldset className="target-picker">
          <legend>发布目标</legend>
          <label className={target === "test" ? "selected" : ""}>
            <input type="radio" name="target" value="test" checked={target === "test"} onChange={() => setTarget("test")} />
            <span><Radio size={15} /><strong>测试频道</strong><small>{publisher.testTarget}</small></span>
          </label>
          <label className={target === "production" ? "selected production" : ""}>
            <input type="radio" name="target" value="production" checked={target === "production"} onChange={() => setTarget("production")} />
            <span><Send size={15} /><strong>正式频道</strong><small>{publisher.productionTarget}</small></span>
          </label>
        </fieldset>

        <div className="poll-field">
          <label htmlFor="poll-question"><span>问题</span><small>{question.length}/300</small></label>
          <textarea id="poll-question" name="question" value={question} maxLength={300} rows={3} onChange={(event) => setQuestion(event.target.value)} required />
        </div>

        <div className="poll-field">
          <div className="field-label"><span>选项</span><small>2–12 个</small></div>
          <div className="poll-options-editor">
            {options.map((option, index) => (
              <div className="option-editor-row" key={index}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <input name="option" value={option} maxLength={100} aria-label={`选项 ${index + 1}`} onChange={(event) => updateOption(index, event.target.value)} required />
                <button type="button" aria-label={`删除选项 ${index + 1}`} disabled={options.length <= 2} onClick={() => removeOption(index)}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
          {options.length < 12 ? (
            <button className="add-option-button" type="button" onClick={() => setOptions((current) => [...current, ""])}><CirclePlus size={14} /> 添加选项</button>
          ) : null}
        </div>

        <div className="poll-form-grid">
          <div className="poll-field">
            <label htmlFor="campaign"><span>来源代号</span><small>Dashboard attribution</small></label>
            <div className="prefix-input"><span>src_</span><input id="campaign" name="campaign" value={campaign} maxLength={32} onChange={(event) => setCampaign(normalizeCampaign(event.target.value))} required /></div>
          </div>
          <div className="poll-field">
            <label htmlFor="button-text"><span>按钮文字</span><small>{buttonText.length}/64</small></label>
            <input id="button-text" name="buttonText" value={buttonText} maxLength={64} onChange={(event) => setButtonText(event.target.value)} required />
          </div>
        </div>

        <div className="source-preview"><span>BOT DEEP LINK</span><code>{deepLink}</code></div>

        {target === "production" ? (
          <label className="production-confirm">
            <input type="checkbox" name="confirmProduction" value="yes" />
            <span>我已检查内容，确认立即发布到 {publisher.productionTarget}</span>
          </label>
        ) : null}

        {state.status !== "idle" ? (
          <div className={`poll-result ${state.status}`} role="status">
            {state.status === "success" ? <Check size={16} /> : <AlertTriangle size={16} />}
            <div><strong>{state.message}</strong>{state.source ? <span>归因来源：{state.source}</span> : null}</div>
            {state.messageUrl ? <a href={state.messageUrl} target="_blank" rel="noreferrer">查看消息 <ExternalLink size={12} /></a> : null}
          </div>
        ) : null}

        <div className="poll-submit-row">
          <div><span className="status-pulse" />{target === "test" ? "建议先测试，再切换正式频道" : "提交后会立即对外发布"}</div>
          <button type="submit" className={target === "production" ? "production-button" : ""} disabled={isPending || !publisher.configured}>
            {isPending ? <LoaderCircle className="spin" size={15} /> : <Send size={15} />}
            {isPending ? "正在发送…" : target === "test" ? "发送测试 Poll" : "发布到正式频道"}
          </button>
        </div>
      </form>

      <aside className="poll-preview-panel">
        <div className="preview-heading"><div><p className="card-kicker">LIVE PREVIEW</p><h2>Telegram 预览</h2></div><span>ANONYMOUS POLL</span></div>
        <div className="telegram-frame">
          <div className="telegram-channel"><div className="telegram-avatar">J</div><div><strong>JUYU 聚域｜域名情报局</strong><span>投票</span></div></div>
          <div className="telegram-poll">
            <strong>{question || "请输入 Poll 问题"}</strong>
            <span className="poll-type">匿名投票</span>
            <div className="telegram-options">
              {options.filter(Boolean).map((option, index) => <div key={`${option}-${index}`}><i /><span>{option}</span></div>)}
            </div>
            <small>尚无人投票</small>
          </div>
          <div className="telegram-cta">{buttonText || "按钮文字"}</div>
        </div>
        <div className="preview-meta">
          <div><span>目标</span><strong>{target === "test" ? publisher.testTarget : publisher.productionTarget}</strong></div>
          <div><span>来源</span><strong>src_{cleanCampaign || "campaign"}</strong></div>
          <div><span>入口</span><strong>@{publisher.botUsername}</strong></div>
        </div>
        <p className="preview-footnote">按钮点击会打开 Bot；新用户的启动、域名提交与报告解锁都会归到这个来源代号。</p>
      </aside>
    </div>
  );
}
