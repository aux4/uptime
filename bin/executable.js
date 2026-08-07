#!/usr/bin/env node

// aux4/uptime — a URL uptime monitor that orchestrates existing aux4 packages:
//   - aux4/curl        probes each URL (`curl request --status --maxTime`)
//   - aux4/repository  stores every check as a schemaless JSON record
//   - aux4/config      keeps the monitor registry in a human-editable YAML file
//   - aux4/chart       renders the uptime status strip (the `chart uptime` type)
//   - aux4/cron        schedules the recurring `check-all` run
//
// This file is the single Node entrypoint. aux4 invokes it as
//   node lib/uptime.mjs <subcommand> <paramsJson>
// where <paramsJson> is aux4's value(*) blob (every flag as one JSON object).

import { spawn, spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

// ---------------------------------------------------------------------------
// small utilities
// ---------------------------------------------------------------------------

function fail(message, code) {
  process.stderr.write(`uptime: ${message}\n`);
  process.exit(code || 1);
}

// Expand a leading ~ and resolve to an absolute path (cron/jobs may run the
// scheduled command from a different working directory, so relative paths and
// ~ must be pinned before they are stored or handed off).
function resolvePath(p) {
  if (!p) return p;
  let out = p;
  if (out === "~" || out.startsWith("~/")) out = path.join(os.homedir(), out.slice(1));
  return path.resolve(out);
}

// aux4's value(*) hands us every variable as one JSON object argument. Parse it
// leniently so a missing/blank blob just yields an empty params object.
function parseParams(raw) {
  if (!raw || typeof raw !== "string" || !raw.trim()) return {};
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
  } catch {
    return {};
  }
}

// Treat aux4's empty-string defaults as "not provided".
function opt(params, name, fallback) {
  const v = params[name];
  if (v === undefined || v === null || v === "") return fallback;
  return v;
}

// Interpret a flag value as a boolean (aux4 passes booleans as strings).
function truthy(v) {
  return v === true || ["true", "1", "yes", "on"].includes(String(v).toLowerCase());
}

// ---------------------------------------------------------------------------
// status-code matching
// ---------------------------------------------------------------------------

// Parse an expectedStatus spec into a list of inclusive [lo, hi] numeric ranges.
// Accepts, comma-separated and mixable:
//   - an exact code:      "200"       -> [200, 200]
//   - a class shorthand:  "2XX"/"2xx" -> [200, 299]
//   - a numeric range:    "200-402"   -> [200, 402]   (any bounds, inclusive)
// e.g. "200-399,405" -> [[200,399],[405,405]]. Invalid tokens are ignored.
function parseStatusSpec(spec) {
  const ranges = [];
  const text = spec === undefined || spec === null || spec === "" ? "2XX" : String(spec);
  for (const raw of text.split(",")) {
    const token = raw.trim();
    if (!token) continue;
    let m;
    if ((m = token.match(/^(\d)xx$/i))) {
      const d = Number(m[1]) * 100;
      ranges.push([d, d + 99]);
    } else if ((m = token.match(/^(\d+)\s*-\s*(\d+)$/))) {
      ranges.push([Number(m[1]), Number(m[2])]);
    } else if (/^\d+$/.test(token)) {
      const n = Number(token);
      ranges.push([n, n]);
    }
  }
  return ranges;
}

// Match a value (an HTTP status code, or a command's stdout) against a spec.
// The same matcher backs a URL check's `expectedStatus` and a command check's
// `expect.output`, so the notation is identical everywhere:
//   - status / range:  200 · 2XX · 200-402 · 200-399,405  (a number in any range)
//   - comparison:      >0 · >=1 · <100 · <=5 · =200        (numeric compare)
//   - regex:<pattern>  -> RegExp test against the raw text
//   - anything else    -> substring "contains" match
// An empty spec matches anything.
function outputMatches(value, spec) {
  const s = String(spec === undefined || spec === null ? "" : spec).trim();
  if (!s) return true;
  const text = String(value);
  const trimmed = text.trim();

  let m;
  if ((m = s.match(/^(>=|<=|>|<|=)\s*(-?\d+(?:\.\d+)?)$/))) {
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return false;
    const t = Number(m[2]);
    if (m[1] === ">") return n > t;
    if (m[1] === ">=") return n >= t;
    if (m[1] === "<") return n < t;
    if (m[1] === "<=") return n <= t;
    return n === t;
  }
  if (/^(\d+|\d[xX]{2}|\d+\s*-\s*\d+)(\s*,\s*(\d+|\d[xX]{2}|\d+\s*-\s*\d+))*$/.test(s)) {
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return false;
    return parseStatusSpec(s).some(([lo, hi]) => n >= lo && n <= hi);
  }
  if (s.startsWith("regex:")) {
    try {
      return new RegExp(s.slice(6)).test(text);
    } catch {
      return false;
    }
  }
  return text.includes(s);
}

// Normalize a command check's `expect` into { exit, output }. Accepts an object
// ({exit, output}), a bare string (treated as the output matcher), or nothing
// (defaults to a required exit code of 0 and no output constraint).
function normalizeExpect(expect) {
  if (expect === undefined || expect === null || expect === "") return { exit: 0, output: undefined };
  if (typeof expect === "string") return { exit: 0, output: expect };
  const exit = expect.exit !== undefined && expect.exit !== null && expect.exit !== "" ? Number(expect.exit) : 0;
  const output = expect.output !== undefined && expect.output !== null && expect.output !== "" ? expect.output : undefined;
  return { exit, output };
}

// ---------------------------------------------------------------------------
// the registry (aux4/config-backed YAML)
// ---------------------------------------------------------------------------

// The registry is stored and managed entirely by aux4/config. A `--config`
// profile scopes everything under a named section (`config.<profile>.…`), so
// one file can hold several independent monitor sets; without it, values live
// at the root (`config.<key>`). The profile is just a name-path prefix.
function cfgPath(profile, name) {
  return profile ? `${profile}/${name}` : name;
}

// Read a single registry value via `aux4 config get`. Returns the trimmed
// string, or "" when the file/key is absent.
function getConfigValue(configFile, profile, name) {
  const res = spawnSync("aux4", ["config", "get", cfgPath(profile, name), "--file", configFile], {
    encoding: "utf8"
  });
  return (res.stdout || "").trim();
}

// aux4/config's `set` needs the file to already exist; seed a minimal one.
function ensureConfigFile(configFile) {
  if (!fs.existsSync(configFile)) {
    fs.mkdirSync(path.dirname(path.resolve(configFile)), { recursive: true });
    fs.writeFileSync(configFile, "config:\n");
  }
}

// Persist the monitors array via `aux4 config set`. Passing the JSON as one argv
// keeps it safe from shell quoting; aux4/config reads it back as an array.
function setMonitors(configFile, profile, monitors) {
  ensureConfigFile(configFile);
  const res = spawnSync(
    "aux4",
    ["config", "set", "--name", cfgPath(profile, "monitors"), "--value", JSON.stringify(monitors), "--file", configFile],
    { encoding: "utf8" }
  );
  if (res.status !== 0) {
    fail(`could not update the registry (${configFile}). ${(res.stderr || "").trim()}`, 5);
  }
}

// Read the whole registry for a profile: the monitors array plus the optional
// global alert fields (alertAfter / onAlert / onRecover).
function readConfig(configFile, profile) {
  let monitors = [];
  const raw = getConfigValue(configFile, profile, "monitors");
  if (raw) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) monitors = arr;
    } catch {
      /* leave empty */
    }
  }
  return {
    profile,
    alertAfter: getConfigValue(configFile, profile, "alertAfter"),
    onAlert: getConfigValue(configFile, profile, "onAlert"),
    onRecover: getConfigValue(configFile, profile, "onRecover"),
    monitors
  };
}

function findMonitor(monitors, name) {
  return monitors.find(m => String(m.name) === String(name));
}

// Derive a friendly monitor name from a URL's host when none is given.
function nameFromUrl(url) {
  try {
    return new URL(url).hostname || url;
  } catch {
    return url;
  }
}

// ---------------------------------------------------------------------------
// the probe (aux4/curl-backed, with our own timing + timeout)
// ---------------------------------------------------------------------------

// Dispatch a monitor to the right probe: a `command` monitor runs an arbitrary
// command (up = expected exit code, optionally an output match); otherwise it is
// a URL monitor probed over HTTP. Both share the timer/timeout wrapper.
function runCheck(monitor, timeoutMs) {
  if (monitor.command) return probeCommand(monitor.command, monitor.expect, timeoutMs);
  return probeUrl(monitor.url, monitor.expectedStatus || "2XX", timeoutMs);
}

// Probe a URL via `aux4 curl request --status`, which prints just the numeric
// HTTP status (exit 0 for any status class) or exits non-zero with empty stdout
// on a transport failure (DNS/refused/TLS/timeout). curl's `--maxTime` bounds
// the request; we still measure the round trip ourselves and keep a hard-kill
// backstop. Resolves to a check result and never rejects.
function probeUrl(url, expectedStatus, timeoutMs) {
  return new Promise(resolve => {
    const started = Date.now();
    let settled = false;
    let out = "";
    const maxTime = Math.max(1, Math.ceil(timeoutMs / 1000));
    const child = spawn(
      "aux4",
      ["curl", "request", "--method", "GET", "--status", "true", "--maxTime", String(maxTime), url],
      { stdio: ["ignore", "pipe", "ignore"] }
    );

    const finish = (status, timedOut) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const responseMs = Date.now() - started;
      const up = !timedOut && status !== 0 && outputMatches(status, expectedStatus) ? 1 : 0;
      resolve({
        kind: "http",
        httpStatus: status,
        up,
        responseMs,
        timedOut: !!timedOut,
        checkedAt: new Date().toISOString()
      });
    };

    // Backstop in case curl itself hangs past its own --maxTime.
    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        /* ignore */
      }
      finish(0, true);
    }, timeoutMs + 1000);

    child.stdout.on("data", d => (out += d));
    child.on("error", () => finish(0, false)); // e.g. aux4 not on PATH
    child.on("close", () => {
      // Just the status code on success; empty (exit non-zero) on transport
      // failure or curl's own timeout -> status 0 (down / unreachable).
      const trimmed = out.trim();
      finish(/^\d+$/.test(trimmed) ? Number(trimmed) : 0, false);
    });
  });
}

// Probe by running an arbitrary command (a DB query, a script, another aux4
// command — anything). Up requires the expected exit code (default 0) and, when
// `expect.output` is set, an output match. Timed + timeout-guarded like the URL
// probe. Resolves to a check result and never rejects.
function probeCommand(command, expect, timeoutMs) {
  const norm = normalizeExpect(expect);
  return new Promise(resolve => {
    const started = Date.now();
    let settled = false;
    let out = "";
    const child = spawn(command, { shell: true, stdio: ["ignore", "pipe", "ignore"] });

    const finish = (exitCode, timedOut) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const responseMs = Date.now() - started;
      const okExit = !timedOut && exitCode === norm.exit;
      const okOutput = !timedOut && (norm.output === undefined || outputMatches(out, norm.output));
      resolve({
        kind: "command",
        exitCode: timedOut ? null : exitCode,
        output: out.trim().slice(0, 200),
        up: okExit && okOutput ? 1 : 0,
        responseMs,
        timedOut: !!timedOut,
        checkedAt: new Date().toISOString()
      });
    };

    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        /* ignore */
      }
      finish(null, true);
    }, timeoutMs);

    child.stdout.on("data", d => (out += d));
    child.on("error", () => finish(null, false));
    child.on("close", code => finish(code, false));
  });
}

// Persist a check to aux4/repository. `up` is stored as 1/0 so repository's
// numeric --expr comparisons behave. Returns true on success.
function recordCheck(db, monitor, result, profile) {
  const record = {
    profile: profile || "",
    name: monitor.name,
    type: monitor.command ? "command" : "http",
    up: result.up,
    responseMs: result.responseMs,
    timedOut: result.timedOut ? 1 : 0,
    checkedAt: result.checkedAt
  };
  if (monitor.command) {
    record.command = monitor.command;
    record.exitCode = result.exitCode;
  } else {
    record.url = monitor.url;
    record.expectedStatus = monitor.expectedStatus;
    record.httpStatus = result.httpStatus;
  }
  const res = spawnSync(
    "aux4",
    ["repository", "write", "checks", "--db", db, "--data", JSON.stringify(record)],
    { stdio: ["ignore", "ignore", "inherit"] }
  );
  return res.status === 0;
}

// ---------------------------------------------------------------------------
// alerting (command hook on N consecutive failures)
// ---------------------------------------------------------------------------

function firstDefined(...vals) {
  for (const v of vals) if (v !== undefined && v !== null && v !== "") return v;
  return undefined;
}

// Run a user-configured hook command through aux4/jobs (so it is tracked/logged
// like any other background job), passing the check context as env vars. The
// command references them as $UPTIME_NAME, $UPTIME_STATUS, etc.
function dispatch(command, context) {
  spawnSync("aux4", ["jobs", "run", command], {
    env: { ...process.env, ...context },
    stdio: "ignore"
  });
}

function alertContext(monitor, result, fails) {
  return {
    UPTIME_NAME: String(monitor.name),
    UPTIME_URL: String(monitor.url),
    UPTIME_STATUS: String(result.httpStatus),
    UPTIME_UP: String(result.up),
    UPTIME_FAILS: String(fails),
    UPTIME_RESPONSE_MS: String(result.responseMs),
    UPTIME_EXPECTED: String(monitor.expectedStatus),
    UPTIME_CHECKED_AT: String(result.checkedAt)
  };
}

// Decide whether this check crosses an alert edge and fire the matching hook.
// Edge-triggered so a sustained outage alerts ONCE (when consecutive failures
// first reach the threshold), and recovery fires once when it comes back up.
function evaluateAlerts(db, monitor, globals, result) {
  const threshold = Number(firstDefined(monitor.alertAfter, globals.alertAfter)) || 0;
  if (threshold <= 0) return;
  const onAlert = firstDefined(monitor.onAlert, globals.onAlert);
  const onRecover = firstDefined(monitor.onRecover, globals.onRecover);
  if (!onAlert && !onRecover) return;

  const checks = readChecks(db, monitor.name, globals.profile); // newest-first, includes this check

  if (!result.up) {
    // Count the current consecutive-down streak (from newest).
    let fails = 0;
    for (const c of checks) {
      if (Number(c.up)) break;
      fails += 1;
    }
    if (onAlert && fails === threshold) dispatch(onAlert, alertContext(monitor, result, fails));
  } else if (onRecover) {
    // Recovered: measure the down streak that preceded this up-check ([0]).
    let prevFails = 0;
    for (let i = 1; i < checks.length; i++) {
      if (Number(checks[i].up)) break;
      prevFails += 1;
    }
    if (prevFails >= threshold) dispatch(onRecover, alertContext(monitor, result, prevFails));
  }
}

// Read every stored check for a monitor (or all monitors when name is null),
// scoped to the given profile, tolerating repository's exit-4-on-empty.
// Returns an array (possibly empty).
function readChecks(db, name, profile) {
  const esc = v => String(v).replace(/'/g, "");
  const parts = [name ? `name = '${esc(name)}'` : "up >= 0", `profile = '${esc(profile || "")}'`];
  const expr = parts.join(" and ");
  const res = spawnSync(
    "aux4",
    ["repository", "find", "checks", "--db", db, "--expr", expr, "--sort", "createdAt desc", "--render", "none"],
    { encoding: "utf8" }
  );
  const out = (res.stdout || "").trim();
  if (!out || out === "[]") return [];
  try {
    const arr = JSON.parse(out);
    if (!Array.isArray(arr)) return [];
    // Sort newest-first by our own ms-precision timestamp — more reliable than
    // repository's second-granularity created_at when checks land close together.
    return arr.map(normalizeRecord).sort((a, b) => String(b.checkedAt).localeCompare(String(a.checkedAt)));
  } catch {
    return [];
  }
}

// repository may return the document either flattened to the top level or nested
// under a `data` key — normalize so callers always see the fields directly.
function normalizeRecord(rec) {
  if (rec && typeof rec.data === "object" && rec.data) return { ...rec.data, ...rec };
  return rec;
}

// ---------------------------------------------------------------------------
// aggregation (repository has no GROUP BY — we bucket client-side)
// ---------------------------------------------------------------------------

function dayKey(iso) {
  return String(iso || "").slice(0, 10);
}

// Build a daily series ending today: uptime = 100 * up / total per calendar day,
// or null for a day with no checks (chart renders those neutral). Oldest first.
function aggregateDaily(records, days) {
  const bucket = new Map(); // 'YYYY-MM-DD' -> { up, total }
  for (const r of records) {
    const key = dayKey(r.checkedAt);
    if (!key) continue;
    const b = bucket.get(key) || { up: 0, total: 0 };
    b.total += 1;
    b.up += Number(r.up) ? 1 : 0;
    bucket.set(key, b);
  }
  const series = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const b = bucket.get(key);
    series.push({ day: key, uptime: b ? (100 * b.up) / b.total : null });
  }
  return series;
}

// Build a per-check series of the last N checks (up=100 / down=0). Oldest first.
function aggregatePerCheck(records, bars) {
  const asc = [...records].sort((a, b) => String(a.checkedAt).localeCompare(String(b.checkedAt)));
  const tail = asc.slice(-bars);
  return tail.map(r => ({
    label: String(r.checkedAt).slice(11, 16) || String(r.checkedAt),
    uptime: Number(r.up) ? 100 : 0
  }));
}

// Overall uptime across a record set, as a "NN.NN % uptime" caption string.
function overallSummary(records) {
  if (!records.length) return "no data";
  const up = records.reduce((n, r) => n + (Number(r.up) ? 1 : 0), 0);
  return `${((100 * up) / records.length).toFixed(2)} % uptime`;
}

// ---------------------------------------------------------------------------
// subcommands
// ---------------------------------------------------------------------------

function cmdAdd(params) {
  const configFile = opt(params, "configFile", "uptime.yaml");
  const profile = opt(params, "config", "");
  const url = opt(params, "url", "");
  const command = opt(params, "command", "");

  if (!url && !command) fail('add needs --url <url> or --command "<command>".', 2);
  if (url && command) fail("provide either --url or --command, not both.", 2);

  const name = opt(params, "name", url ? nameFromUrl(url) : "");
  if (!name) fail("a command monitor needs a --name.", 2);

  let monitor;
  let summary;
  if (url) {
    const expectedStatus = opt(params, "expectedStatus", "2XX");
    monitor = { name, url, expectedStatus };
    summary = `${url} (expects ${expectedStatus})`;
  } else {
    monitor = { name, command };
    const exit = opt(params, "exit", "");
    const output = opt(params, "expect", "");
    const expect = {};
    if (exit !== "") expect.exit = Number(exit);
    if (output !== "") expect.output = output;
    if (Object.keys(expect).length) monitor.expect = expect;
    const rule = output ? `output ${output}, exit ${expect.exit ?? 0}` : `exit ${expect.exit ?? 0}`;
    summary = `command \`${command}\` (up on ${rule})`;
  }

  const cfg = readConfig(configFile, profile);
  if (findMonitor(cfg.monitors, name)) {
    fail(`a monitor named "${name}" already exists. Use --name to pick another, or remove it first.`, 3);
  }
  cfg.monitors.push(monitor);
  setMonitors(configFile, profile, cfg.monitors);
  process.stdout.write(`Added monitor "${name}" -> ${summary}\n`);
}

function cmdRemove(params) {
  const configFile = opt(params, "configFile", "uptime.yaml");
  const profile = opt(params, "config", "");
  const name = opt(params, "name", "");
  if (!name) fail("remove needs --name <name>.", 2);
  const cfg = readConfig(configFile, profile);
  const next = cfg.monitors.filter(m => String(m.name) !== String(name));
  if (next.length === cfg.monitors.length) fail(`no monitor named "${name}".`, 3);
  setMonitors(configFile, profile, next);
  process.stdout.write(`Removed monitor "${name}"\n`);
}

function cmdList(params) {
  const configFile = opt(params, "configFile", "uptime.yaml");
  const profile = opt(params, "config", "");
  const monitors = readConfig(configFile, profile).monitors;
  if (!process.stdout.isTTY) {
    process.stdout.write(JSON.stringify(monitors) + "\n");
    return;
  }
  if (!monitors.length) {
    process.stdout.write("No monitors registered. Add one with: aux4 uptime add --url <url>\n");
    return;
  }
  for (const m of monitors) {
    if (m.command) {
      process.stdout.write(`${m.name}\tcommand: ${m.command}\n`);
    } else {
      process.stdout.write(`${m.name}\t${m.url}\t(expects ${m.expectedStatus})\n`);
    }
  }
}

async function cmdCheck(params) {
  const configFile = opt(params, "configFile", "uptime.yaml");
  const db = resolvePath(opt(params, "db", "~/.aux4.config/uptime.db"));
  const profile = opt(params, "config", "");
  const timeout = Number(opt(params, "timeout", 10000)) || 10000;
  const name = opt(params, "name", "");
  if (!name) fail("check needs --name <name>. (Use check-all for every monitor.)", 2);

  const cfg = readConfig(configFile, profile);
  const monitor = findMonitor(cfg.monitors, name);
  if (!monitor) fail(`no monitor named "${name}".`, 3);

  const result = await runCheck(monitor, timeout);
  recordCheck(db, monitor, result, profile);
  evaluateAlerts(db, monitor, cfg, result);
  process.stdout.write(formatCheckLine(monitor, result) + "\n");
  process.exit(result.up ? 0 : 1);
}

async function cmdCheckAll(params) {
  const configFile = opt(params, "configFile", "uptime.yaml");
  const db = resolvePath(opt(params, "db", "~/.aux4.config/uptime.db"));
  const profile = opt(params, "config", "");
  const timeout = Number(opt(params, "timeout", 10000)) || 10000;

  const cfg = readConfig(configFile, profile);
  if (!cfg.monitors.length) {
    process.stdout.write("No monitors registered. Add one with: aux4 uptime add --url <url>\n");
    return; // headless-safe: exit 0
  }
  for (const monitor of cfg.monitors) {
    const result = await runCheck(monitor, timeout);
    recordCheck(db, monitor, result, profile);
    evaluateAlerts(db, monitor, cfg, result);
    process.stdout.write(formatCheckLine(monitor, result) + "\n");
  }
}

function formatCheckLine(monitor, result) {
  const mark = result.up ? "✓" : "✗";
  const state = result.up ? "UP" : "DOWN";
  let detail;
  if (result.timedOut) {
    detail = "timeout";
  } else if (monitor.command) {
    detail = `exit ${result.exitCode}`;
  } else {
    detail = result.httpStatus || "unreachable";
  }
  return `${mark} ${monitor.name}  ${state}  ${detail}  ${result.responseMs}ms`;
}

async function cmdStatus(params) {
  const configFile = opt(params, "configFile", "uptime.yaml");
  const db = resolvePath(opt(params, "db", "~/.aux4.config/uptime.db"));
  const profile = opt(params, "config", "");
  const only = opt(params, "name", "");
  const monitors = readConfig(configFile, profile).monitors.filter(m => !only || String(m.name) === String(only));
  if (!monitors.length) fail(only ? `no monitor named "${only}".` : "no monitors registered.", 3);

  const rows = monitors.map(m => {
    const checks = readChecks(db, m.name, profile); // newest first
    const latest = checks[0];
    const total = checks.length;
    const up = checks.reduce((n, r) => n + (Number(r.up) ? 1 : 0), 0);
    const lastResult = latest ? (m.command ? `exit ${latest.exitCode}` : latest.httpStatus) : null;
    return {
      name: m.name,
      type: m.command ? "command" : "http",
      target: m.command || m.url,
      state: latest ? (latest.up ? "up" : "down") : "unknown",
      lastResult,
      lastResponseMs: latest ? latest.responseMs : null,
      lastCheckedAt: latest ? latest.checkedAt : null,
      uptimePct: total ? Number(((100 * up) / total).toFixed(2)) : null,
      checks: total
    };
  });

  if (!process.stdout.isTTY) {
    process.stdout.write(JSON.stringify(only ? rows[0] : rows) + "\n");
  } else {
    for (const r of rows) {
      const mark = r.state === "up" ? "✓" : r.state === "down" ? "✗" : "?";
      const pct = r.uptimePct === null ? "  -  " : `${r.uptimePct}%`;
      const last = r.lastResult === null ? "no checks yet" : `${r.lastResult} (${r.lastResponseMs}ms)`;
      process.stdout.write(`${mark} ${r.name}\t${r.state.toUpperCase()}\t${pct} over ${r.checks}\tlast: ${last}\n`);
    }
  }

  // With --chart, also draw the uptime strip for each in-scope monitor. Titled
  // by the monitor name. With --output and more than one monitor, the filename
  // gets the monitor name so the files don't overwrite each other.
  if (truthy(opt(params, "chart", ""))) {
    const period = opt(params, "period", "daily");
    const days = Number(opt(params, "days", 90)) || 90;
    const bars = Number(opt(params, "bars", 90)) || 90;
    const output = opt(params, "output", "");
    for (const m of monitors) {
      await renderChart({
        db,
        profile,
        name: m.name,
        period,
        days,
        bars,
        output: perMonitorOutput(output, m.name, monitors.length > 1),
        width: opt(params, "width", ""),
        height: opt(params, "height", ""),
        theme: opt(params, "theme", ""),
        format: opt(params, "format", ""),
        title: m.name
      });
    }
  }
}

// When charting several monitors to files, disambiguate the output path by
// inserting a filesystem-safe monitor name before the extension.
function perMonitorOutput(output, name, multiple) {
  if (!output || !multiple) return output;
  const safe = String(name).replace(/[^A-Za-z0-9._-]+/g, "-");
  const ext = path.extname(output);
  return `${output.slice(0, output.length - ext.length)}-${safe}${ext}`;
}

// Aggregate a monitor's stored checks and draw the strip by composing the
// existing `aux4 chart uptime` type. The chart title is the monitor's name (or
// "All monitors" for the overall strip). stdout/stderr are inherited so a
// --output save message or an inline terminal preview reaches the user.
// Resolves to the child's exit code; never rejects.
function renderChart({ db, profile, name, period, days, bars, output, width, height, theme, format, title }) {
  const records = readChecks(db, name || null, profile);

  let series;
  let xcol;
  let startLabel;
  let endLabel;
  if (period === "check") {
    series = aggregatePerCheck(records, bars);
    xcol = "label";
    startLabel = series.length ? `${series.length} checks ago` : "start";
    endLabel = "now";
  } else {
    series = aggregateDaily(records, days);
    xcol = "day";
    startLabel = `${days} days ago`;
    endLabel = "Today";
  }
  const summary = overallSummary(records);

  // Pass an explicit { categories, series } schema (not a records array) so that
  // null uptime values — days/checks with NO data — survive to the chart and
  // render as neutral "no data"; the records path would coerce them to 0 (red).
  const payload = {
    categories: series.map(pt => String(pt[xcol])),
    series: [{ name: "uptime", data: series.map(pt => pt.uptime) }]
  };

  const args = ["chart", "uptime", "--startLabel", startLabel, "--endLabel", endLabel, "--summary", summary];
  const chartTitle = title || name || "All monitors";
  if (chartTitle) args.push("--title", String(chartTitle));
  const extras = { output, width, height, theme, format };
  for (const flag of Object.keys(extras)) {
    const v = extras[flag];
    if (v !== undefined && v !== null && v !== "") args.push(`--${flag}`, String(v));
  }

  return new Promise(resolve => {
    const child = spawn("aux4", args, { stdio: ["pipe", "inherit", "inherit"] });
    child.on("error", () => resolve(1)); // aux4/chart missing
    child.on("close", code => resolve(code || 0));
    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

async function cmdChart(params) {
  const configFile = opt(params, "configFile", "uptime.yaml");
  const db = resolvePath(opt(params, "db", "~/.aux4.config/uptime.db"));
  const profile = opt(params, "config", "");
  const name = opt(params, "name", "");

  // With --name, chart that monitor. Without, chart EVERY registered monitor —
  // one strip each, titled by name — so you see them all at once. Output goes
  // to the terminal by default; --output saves to files instead.
  const monitors = name ? [{ name }] : readConfig(configFile, profile).monitors;
  if (!monitors.length) {
    fail(name ? `no monitor named "${name}".` : "no monitors registered. Add one with: aux4 uptime add --url <url>", 3);
  }

  const period = opt(params, "period", "daily");
  const days = Number(opt(params, "days", 90)) || 90;
  const bars = Number(opt(params, "bars", 90)) || 90;
  const output = opt(params, "output", "");
  let bad = 0;
  for (const m of monitors) {
    const code = await renderChart({
      db,
      profile,
      name: m.name,
      period,
      days,
      bars,
      output: perMonitorOutput(output, m.name, monitors.length > 1),
      width: opt(params, "width", ""),
      height: opt(params, "height", ""),
      theme: opt(params, "theme", ""),
      format: opt(params, "format", ""),
      title: m.name
    });
    if (code) bad = code;
  }
  if (bad) fail("failed to render chart — is aux4/chart installed?", 5);
}

// The uptime scheduler runs on its OWN aux4/cron daemon (a dedicated dir + port,
// separate from cron's default 8421) so `uptime stop` only ever affects uptime's
// schedule, never someone else's cron jobs.
const CRON_DIR = "~/.aux4.config/uptime";
const CRON_PORT = "8422";

function scheduleName(profile) {
  return profile ? `uptime-check-${profile}` : "uptime-check";
}

// Is the uptime cron daemon reachable? (a harmless `list` round-trips to it.)
function cronReachable() {
  return spawnSync("aux4", ["cron", "list", "--port", CRON_PORT], { stdio: "ignore" }).status === 0;
}

// Coarse synchronous sleep (this is a short-lived CLI process; blocking is fine).
function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// Start the uptime scheduler daemon if it isn't already up, and wait until it
// answers so a following `cron add` can't race it. Returns true when reachable.
function ensureCronRunning() {
  if (cronReachable()) return true;
  fs.mkdirSync(resolvePath(CRON_DIR), { recursive: true });
  // `cron start` blocks in the foreground, so launch it detached via aux4/jobs.
  spawnSync("aux4", ["jobs", "run", `aux4 cron start --dir ${resolvePath(CRON_DIR)} --port ${CRON_PORT}`], {
    stdio: "ignore"
  });
  for (let i = 0; i < 40; i++) {
    if (cronReachable()) return true;
    sleepMs(250);
  }
  return false;
}

function cmdStart() {
  if (cronReachable()) {
    process.stdout.write(`The uptime scheduler is already running (cron daemon on port ${CRON_PORT}).\n`);
    return;
  }
  if (!ensureCronRunning()) {
    fail("could not start the uptime scheduler (cron daemon did not come up).", 5);
  }
  process.stdout.write(`Started the uptime scheduler (cron daemon on port ${CRON_PORT}, dir ${CRON_DIR}).\n`);
}

function cmdStop() {
  if (!cronReachable()) {
    process.stdout.write("The uptime scheduler is not running.\n");
    return;
  }
  const res = spawnSync("aux4", ["cron", "stop", "--port", CRON_PORT], { encoding: "utf8" });
  if (res.status !== 0) {
    fail(`could not stop the uptime scheduler. ${(res.stderr || res.stdout || "").trim()}`, 5);
  }
  process.stdout.write("Stopped the uptime scheduler.\n");
}

function cmdSchedule(params) {
  const profile = opt(params, "config", "");
  const configFile = resolvePath(opt(params, "configFile", "uptime.yaml"));
  const db = resolvePath(opt(params, "db", "~/.aux4.config/uptime.db"));
  const interval = opt(params, "interval", "5 min");
  const jobName = scheduleName(profile);

  if (!ensureCronRunning()) {
    fail("could not reach the uptime scheduler. Try `aux4 uptime start` first.", 5);
  }

  let runCmd = `aux4 uptime check-all --configFile ${configFile} --db ${db}`;
  if (profile) runCmd += ` --config ${profile}`;
  const res = spawnSync(
    "aux4",
    ["cron", "add", "--port", CRON_PORT, "--name", jobName, "--every", String(interval), "--run", runCmd],
    { encoding: "utf8" }
  );
  if (res.status !== 0) {
    fail(`could not schedule. ${(res.stderr || res.stdout || "").trim()}`, 5);
  }
  process.stdout.write(`Scheduled "${jobName}" every ${interval}.\n`);
  process.stdout.write(`  runs: ${runCmd}\n`);
  process.stdout.write("Note: after a machine reboot, run `aux4 uptime start` to bring the scheduler back up.\n");
}

function cmdUnschedule(params) {
  const profile = opt(params, "config", "");
  const jobName = scheduleName(profile);
  if (!cronReachable()) {
    fail("the uptime scheduler is not running (nothing to unschedule). Start it with `aux4 uptime start`.", 5);
  }
  const res = spawnSync("aux4", ["cron", "remove", "--port", CRON_PORT, "--name", jobName], { encoding: "utf8" });
  if (res.status !== 0) {
    fail(`could not unschedule. ${(res.stderr || res.stdout || "").trim()}`, 5);
  }
  process.stdout.write(`Removed schedule "${jobName}".\n`);
}

// ---------------------------------------------------------------------------
// dispatch
// ---------------------------------------------------------------------------

async function main() {
  const subcommand = process.argv[2];
  const params = parseParams(process.argv[3]);

  switch (subcommand) {
    case "add":
      return cmdAdd(params);
    case "remove":
      return cmdRemove(params);
    case "list":
      return cmdList(params);
    case "check":
      return cmdCheck(params);
    case "check-all":
      return cmdCheckAll(params);
    case "status":
      return cmdStatus(params);
    case "chart":
      return cmdChart(params);
    case "start":
      return cmdStart(params);
    case "stop":
      return cmdStop(params);
    case "schedule":
      return cmdSchedule(params);
    case "unschedule":
      return cmdUnschedule(params);
    default:
      fail(`unknown or missing subcommand "${subcommand || ""}".`, 2);
  }
}

main().catch(e => fail(e && e.message ? e.message : String(e), 1));
