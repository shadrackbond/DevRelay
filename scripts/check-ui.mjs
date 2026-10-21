import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

// With agent-browser on PATH: node scripts/check-ui.mjs http://127.0.0.1:3005
const base = process.argv[2] ?? "http://127.0.0.1:3005";
assert(["127.0.0.1", "localhost"].includes(new URL(base).hostname), "Use a local test server");
const session = `devrelay-check-${process.pid}`;
function browser(...args) {
  return execFileSync("agent-browser", ["--session", session, ...args], {
    encoding: "utf8", timeout: 90_000, maxBuffer: 4 * 1024 * 1024,
  }).trim();
}
function check(expression) {
  browser("eval", `if (!(${expression})) throw new Error(${JSON.stringify(expression)}); true`);
}
function open(path) {
  browser("open", `${base}${path}`);
  browser("wait", "h1");
}
const routes = [
  ["/", "/"], ["/incidents", "/incidents"],
  ["/investigations", "/investigations"], ["/investigations/new", "/investigations"],
  ["/agents", "/agents"], ["/integrations", "/integrations"],
  ["/audit", "/audit"], ["/evaluation", "/evaluation"], ["/incidents/1042", "/incidents"],
];

try {
  for (const width of [320, 375, 768, 1024, 1440]) {
    browser("set", "viewport", String(width), "1000");
    for (const [path, active] of routes) {
      open(path);
      check([
        "document.documentElement.scrollWidth <= innerWidth",
        "document.querySelectorAll('main').length === 1 && document.querySelectorAll('h1').length === 1",
        `document.querySelector('nav a[aria-current="page"]')?.getAttribute('href') === ${JSON.stringify(active)}`,
        "[...document.querySelectorAll('nav a')].every(a => a.getBoundingClientRect().height >= 44)",
        "document.title.length > 0 && document.title !== 'DevRelay'",
      ].join(" && "));
      if (width === 375 || width === 1440) {
        const report = JSON.parse(browser("a11y", "--json"));
        assert.equal(report.data.counts.violations, 0, JSON.stringify(report.data.violations));
      }
    }
    console.log(`PASS: all routes at ${width}px`);
  }

  open("/");
  browser("press", "Tab");
  check("document.activeElement.classList.contains('skipLink')");
  browser("press", "Enter");
  check("document.activeElement.id === 'main-content'");
  browser("click", 'nav a[href="/investigations"]');
  browser("wait", "--text", "Investigation workspace");
  check(`document.querySelector('nav a[aria-current="page"]').getAttribute('href') === '/investigations'`);

  open("/incidents/1042");
  browser("find", "role", "button", "click", "--name", "Approve action");
  browser("wait", "--text", "Action approved");
  open("/incidents/1042");
  browser("find", "role", "button", "click", "--name", "Reject action", "--exact");
  browser("wait", "--text", "Action rejected");
  console.log("PASS: keyboard navigation and both approval outcomes");

  open("/investigations/new");
  browser("find", "role", "button", "click", "--name", "Create investigation");
  check("document.activeElement.name === 'title' && !document.querySelector('form').checkValidity()");
  browser("fill", 'input[name="title"]', "UI verification: checkout requests timing out");
  browser("fill", 'input[name="service"]', "checkout-service");
  browser("fill", 'input[name="repository"]', "not-a-repository");
  browser("fill", 'textarea[name="description"]', "Local browser verification of incident intake and provider failure feedback.");
  browser("select", 'select[name="severity"]', "critical");
  browser("find", "role", "button", "click", "--name", "Create investigation");
  browser("wait", "--text", "Repository inspection failed");
  check("location.pathname.startsWith('/incidents/INC-')");
  check("document.querySelector('h1').textContent === 'UI verification: checkout requests timing out'");
  browser("set", "viewport", "375", "812");
  check("document.documentElement.scrollWidth <= innerWidth");
  browser("click", 'nav a[href="/incidents"]');
  browser("wait", "--text", "Incident queue");
  check("document.querySelector('tbody').textContent.includes('UI verification: checkout requests timing out')");
  browser("click", 'nav a[href="/"]');
  browser("wait", ".overviewStrip");
  check("document.querySelector('.overviewStrip strong').textContent === '1'");
  console.log("PASS: native validation, submission, provider failure, persistence, and dashboard count");

  browser("set", "media", "light", "reduced-motion");
  check("matchMedia('(prefers-reduced-motion: reduce)').matches");
  open("/incidents/missing-incident");
  browser("wait", "--text", "There’s nothing here yet");
  check("document.querySelectorAll('main').length === 1");
  console.log("PASS: reduced motion and missing incident recovery");
} finally {
  browser("close");
}
