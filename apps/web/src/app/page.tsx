"use client";

import { useMemo, useState } from "react";

const questions = [
  "Show revenue by month",
  "Show active customers by status",
  "SELECT * FROM analytics_orders"
];

const events = [
  {
    time: "00:00",
    event: "analysis.accepted",
    detail: "Requester, org slug, and semantic profile validated"
  },
  { time: "00:01", event: "planner.resolved", detail: "Question mapped to governed monthly_revenue metric" },
  {
    time: "00:02",
    event: "sql.validated",
    detail: "Read-only SELECT, allowed tables, static limit, no wildcard"
  },
  { time: "00:04", event: "chart.persisted", detail: "Payload stored with row count and execution timing" }
];

export default function Home() {
  const [question, setQuestion] = useState(questions[0]);
  const [organizationSlug, setOrganizationSlug] = useState("demo-co");
  const [status, setStatus] = useState<"queued" | "completed" | "rejected">("completed");

  const sql = useMemo(() => {
    if (/active customers/i.test(question)) {
      return "SELECT status, COUNT(*) AS customer_count FROM analytics_customers WHERE organization_id = 1 GROUP BY status ORDER BY status LIMIT 10";
    }
    if (/select \*/i.test(question)) {
      return "Rejected: wildcard projection is blocked before execution";
    }
    return "SELECT order_month, SUM(revenue_cents) AS revenue_cents FROM analytics_orders WHERE organization_id = 1 GROUP BY order_month ORDER BY order_month LIMIT 12";
  }, [question]);

  function runAnalysis() {
    setStatus(
      sql.startsWith("Rejected") || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(organizationSlug)
        ? "rejected"
        : "queued"
    );
    window.setTimeout(() => {
      if (!sql.startsWith("Rejected") && /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(organizationSlug)) {
        setStatus("completed");
      }
    }, 450);
  }

  return (
    <main className="appShell">
      <section className="topbar" aria-label="Workspace summary">
        <div>
          <p className="eyebrow">Governed analytics agent</p>
          <h1>Text-to-SQL Proactive Data Analyst Engine</h1>
          <p className="subtitle">
            Accept channel events, resolve questions through a semantic layer, validate SQL with fail-closed
            governance, and return chart payloads without leaking cross-org data.
          </p>
        </div>
        <button className="primaryButton" onClick={runAnalysis} type="button">
          Run analysis
        </button>
      </section>

      <section className="metricsGrid" aria-label="Governance metrics">
        <Metric label="Request status" value={status} detail="Async API lifecycle" />
        <Metric label="Allowed tables" value="2" detail="analytics_orders/customers only" />
        <Metric label="Max row limit" value="1000" detail="Static limit required" />
        <Metric label="Dead-letter stream" value="on" detail="Invalid queue payloads are inspectable" />
      </section>

      <section className="workArea">
        <form className="panel formGrid" onSubmit={(event) => event.preventDefault()}>
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Admission</p>
              <h2>Channel request</h2>
            </div>
            <span className={`statePill ${status}`}>{status}</span>
          </div>

          <label className="field">
            <span className="fieldLabel">Organization slug</span>
            <input value={organizationSlug} onChange={(event) => setOrganizationSlug(event.target.value)} />
          </label>

          <label className="field">
            <span className="fieldLabel">Question</span>
            <select value={question} onChange={(event) => setQuestion(event.target.value)}>
              {questions.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>

          <button className="primaryButton" onClick={runAnalysis} type="button">
            Plan and validate
          </button>
        </form>

        <section className="panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">SQL plan</p>
              <h2>Validator output</h2>
            </div>
            <span className={`statePill ${sql.startsWith("Rejected") ? "rejected" : "accepted"}`}>
              {sql.startsWith("Rejected") ? "blocked" : "accepted"}
            </span>
          </div>

          <pre className="sqlBox">{sql}</pre>
        </section>

        <aside className="panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Audit trail</p>
              <h2>Governance events</h2>
            </div>
          </div>

          <div className="timeline">
            {events.map((item) => (
              <article className="timelineItem" key={item.event}>
                <span>{item.time}</span>
                <strong>{item.event}</strong>
                <small>{item.detail}</small>
              </article>
            ))}
          </div>

          <div className="governanceList">
            {[
              "No comments or semicolons",
              "No CTE/UNION/wildcard leakage",
              "Only approved aggregate functions"
            ].map((item) => (
              <article className="governanceItem" key={item}>
                <strong>{item}</strong>
              </article>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="metricCard">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}
