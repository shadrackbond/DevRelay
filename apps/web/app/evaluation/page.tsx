import { BENCHMARK_CASES } from "../../evaluation/benchmarks";
import { runEvaluationSuite } from "../../evaluation/harness";
import {
  assertEvaluationThresholds,
  evaluateThresholds,
} from "../../evaluation/thresholds";

export const metadata = { title: "Evaluation" };

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export default function EvaluationPage() {
  const report = runEvaluationSuite(BENCHMARK_CASES);
  const checks = evaluateThresholds(report);

  if (process.env.CI === "true") {
    console.log(
      "DEVRELAY_EVAL_REPORT=" +
        JSON.stringify({
          metrics: report.metrics,
          cases: report.cases.map((item) => ({
            id: item.id,
            name: item.name,
            category: item.category,
            expectedCandidateId: item.expectedCandidateId,
            predictedCandidateId: item.predictedCandidateId,
            shouldAbstain: item.shouldAbstain,
            abstained: item.abstained,
            correctTop1: item.correctTop1,
            correctTop3: item.correctTop3,
            rank: item.rank,
            confidence: item.confidence,
            evidencePrecision: item.evidencePrecision,
            evidenceRecall: item.evidenceRecall,
            approvalGateCorrect: item.approvalGateCorrect,
            unsafeActionCount: item.unsafeActionCount,
            relayInvariantValid: item.relayInvariantValid,
            durationMs: item.durationMs,
          })),
        }),
    );
  }

  // CI's Next.js build renders this page. Critical regressions fail the build.
  assertEvaluationThresholds(report);

  const metrics = report.metrics;

  return (
    <>
      <header className="pageHeader">
        <div>
          <h1>DevRelay effectiveness</h1>
          <p className="muted">
            Labeled synthetic incidents evaluated against the production Reasoning
            Agent and Borderless Relay.
          </p>
        </div>
        <span className="evaluationPass">All quality gates passing</span>
      </header>

      <div className="evaluationMetricGrid">
        <article><span>Top-1 accuracy</span><strong>{pct(metrics.top1Accuracy)}</strong></article>
        <article><span>Top-3 accuracy</span><strong>{pct(metrics.top3Accuracy)}</strong></article>
        <article><span>Correct abstention</span><strong>{pct(metrics.correctAbstentionRate)}</strong></article>
        <article><span>Evidence recall</span><strong>{pct(metrics.evidenceRecall)}</strong></article>
        <article><span>Evidence precision</span><strong>{pct(metrics.evidencePrecision)}</strong></article>
        <article><span>Approval integrity</span><strong>{pct(metrics.approvalGateIntegrity)}</strong></article>
        <article><span>Relay invariants</span><strong>{pct(metrics.borderlessInvariantPreservation)}</strong></article>
        <article><span>Unsafe actions</span><strong>{pct(metrics.unsafeActionRate)}</strong></article>
        <article><span>Brier score</span><strong>{metrics.brierScore.toFixed(3)}</strong></article>
        <article><span>Mean reasoning latency</span><strong>{metrics.meanReasoningLatencyMs.toFixed(2)} ms</strong></article>
      </div>

      <section className="panel">
        <div className="panelTitle">
          <div>
            <span className="sectionLabel">Quality gates</span>
            <h2>CI thresholds</h2>
          </div>
          <span className="statusBadge">{checks.length} checks</span>
        </div>
        <div className="qualityGateList">
          {checks.map((check) => (
            <div key={check.metric}>
              <div>
                <strong>{check.label}</strong>
                <span>
                  {check.direction === "minimum" ? "≥" : "≤"}{" "}
                  {check.metric === "brierScore"
                    ? check.threshold.toFixed(2)
                    : pct(check.threshold)}
                </span>
              </div>
              <b className={check.passed ? "gatePass" : "gateFail"}>
                {check.metric === "brierScore"
                  ? check.value.toFixed(3)
                  : pct(check.value)}
              </b>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panelTitle">
          <div>
            <span className="sectionLabel">Benchmark cases</span>
            <h2>{metrics.totalCases} labeled incidents</h2>
          </div>
        </div>

        <table className="benchmarkTable">
          <thead><tr>
            <th scope="col">Case</th>
            <th scope="col">Category</th>
            <th scope="col">Expected</th>
            <th scope="col">Predicted</th>
            <th scope="col">Confidence</th>
            <th scope="col">Result</th>
          </tr></thead>
          <tbody>
            {report.cases.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.id}</strong><small>{item.name}</small></td>
                <td data-label="Category">{item.category}</td>
                <td data-label="Expected"><code>{item.shouldAbstain ? "ABSTAIN" : item.expectedCandidateId}</code></td>
                <td data-label="Predicted"><code>{item.abstained ? "ABSTAIN" : item.predictedCandidateId}</code></td>
                <td data-label="Confidence">{pct(item.confidence)}</td>
                <td data-label="Result"><b className={item.correctTop1 ? "gatePass" : "gateFail"}>{item.correctTop1 ? "PASS" : "FAIL"}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <span className="sectionLabel">Interpretation</span>
        <h2>What this harness proves</h2>
        <div className="evaluationNotes">
          <p>
            <strong>Accuracy:</strong> whether the correct root-cause candidate is
            ranked first or within the top three.
          </p>
          <p>
            <strong>Abstention:</strong> whether DevRelay refuses to promote a cause
            when evidence is contradictory or insufficient.
          </p>
          <p>
            <strong>Evidence quality:</strong> whether emitted evidence overlaps the
            labeled ground-truth evidence set.
          </p>
          <p>
            <strong>Safety:</strong> risky actions must remain human-approval gated.
          </p>
          <p>
            <strong>Borderless consistency:</strong> every representation must preserve
            the CRP invariants.
          </p>
        </div>
      </section>
    </>
  );
}
