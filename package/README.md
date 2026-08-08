# aux4/uptime

Uptime monitoring from the command line — for **anything**. Monitor a URL *or* an arbitrary command (a DB query, a script, any aux4 command); probe them on a schedule, record every check, chart the status-page-style uptime strip, and alert on consecutive failures — all by composing existing aux4 packages.

`aux4/uptime` is glue over these packages:

| Package | Role |
|---------|------|
| [`aux4/curl`](https://hub.aux4.io/aux4/curl) | probes each URL (`curl request --status --maxTime`) |
| [`aux4/repository`](https://hub.aux4.io/aux4/repository) | stores every check as a record |
| [`aux4/config`](https://hub.aux4.io/aux4/config) | keeps the monitor registry in a YAML file |
| [`aux4/chart`](https://hub.aux4.io/aux4/chart) | renders the uptime strip (the `chart uptime` type) |
| [`aux4/cron`](https://hub.aux4.io/aux4/cron) | schedules the recurring checks |
| [`aux4/jobs`](https://hub.aux4.io/aux4/jobs) | runs the alert hooks |

## Installation

```bash
aux4 pkger install aux4/uptime
```

## Quick Start

```bash
# 1a. Register a URL (HTTP check — name derived from the host when omitted)
aux4 uptime add --url https://example.com
aux4 uptime add --url https://api.example.com/health --name api --expectedStatus 200

# 1b. …or register a COMMAND check — monitor anything (DB query, script, any aux4 command)
aux4 uptime add --name "Shop DB" --command "aux4 db sqlite execute --database shop.db --query 'SELECT 1'"
aux4 uptime add --name "Open orders" --command "aux4 repository count orders --db shop.db --expr 'status = 1'" --expect ">0"

# 2. Probe everything now and record the results
aux4 uptime check-all

# 3. See the current state (add --chart to also draw the strips)
aux4 uptime status

# 4. Render the uptime strips — all monitors, inline in the terminal
aux4 uptime chart

# 5. Keep it running: probe every 5 minutes
aux4 uptime schedule --interval "5 min"
```

## Two kinds of check

A monitor is **either** a URL check or a command check — inferred by which field it has:

| Field | Check type | Up when | Best for |
|-------|-----------|---------|----------|
| `--url` | HTTP probe (curl) | the HTTP status matches `expectedStatus` | websites & APIs |
| `--command` | runs the command | it exits `0` (and, if set, `--expect` matches the output) | databases, queries, scripts — anything |

## The registry (config.yaml)

Monitors live in a human-editable YAML file (`uptime.yaml` by default, override with `--configFile`). `add` / `remove` edit it for you, but you can also hand-edit it:

```yaml
config:
  monitors:
    - name: example.com          # URL check
      url: https://example.com
      expectedStatus: 2XX
    - name: api
      url: https://api.example.com/health
      expectedStatus: 200
    - name: Shop DB              # command check
      command: "aux4 db sqlite execute --database shop.db --query 'SELECT 1'"
    - name: Open orders          # command check with an output threshold
      command: "aux4 repository count orders --db shop.db --expr 'status = 1'"
      expect: ">0"
```

## What counts as "up"

For a **URL check**, `expectedStatus` decides which HTTP responses are healthy. For a **command check**, up means exit code `0` — and, if you set `--expect`, its output must also match. Both use the same flexible notation:

| Notation | Means |
|----------|-------|
| `200` | exactly 200 |
| `2XX` | 200–299 (the **default** for URLs) |
| `200-402` | any value in an inclusive numeric range |
| `200-399,405` | a comma-separated union of codes/ranges |
| `>0` `>=1` `<100` `=5` | numeric comparison on the value/output |
| `regex:<pattern>` | the output matches the regular expression |
| any other text | the output contains that substring |

For URL checks, everything outside the expected set — including 4xx/5xx, connection/DNS/TLS failures, and timeouts — is recorded as **down**. `2XX` is the default because a healthy endpoint may legitimately answer `201`/`204`/`301`; use `--expectedStatus 200` for a strict health endpoint. Each probe has a timeout (`--timeout`, default 10000 ms); a slower response is recorded as down.

For command checks, `--exit` overrides the healthy exit code (default `0`). A numeric comparison like `>0` parses the command's stdout as a number — great for `aux4 repository count …` which prints a bare integer; for JSON output (e.g. `aux4 db … execute` returns `[{"n":2}]`) use a `regex:` match.

For URL checks, `--expectBody` additionally requires the **response body** to match (same notation), so a health endpoint that returns `200` with an unhealthy payload is still caught:

```bash
aux4 uptime add --url https://api.example.com/health --expectedStatus 200 --expectBody 'regex:"status":\s*"ok"'
```

To monitor an authenticated endpoint, pass request **headers** with `--header` (repeatable), stored on the monitor:

```bash
aux4 uptime add --url https://api.example.com/health --name api \
  --header "Authorization: Bearer $TOKEN" --header "X-Api-Key: abc123"
```

> Headers are stored in the registry file in plain text — keep it readable only by you if they carry secrets.

## Commands

| Command | What it does |
|---------|--------------|
| `aux4 uptime add --url <url>` | Register a URL check (`--name`, `--expectedStatus` optional) |
| `aux4 uptime add --command "<cmd>" --name <name>` | Register a command check (`--expect`, `--exit` optional) |
| `aux4 uptime remove --name <name>` | Unregister a monitor |
| `aux4 uptime list` | List registered monitors |
| `aux4 uptime check --name <name>` | Probe one monitor now and record it |
| `aux4 uptime check-all` | Probe every monitor concurrently (the scheduled command) |
| `aux4 uptime status [--name <name>] [--chart]` | Current up/down + rolling uptime over `--window` days (with `--chart`, also the strips) |
| `aux4 uptime chart [--name <name>]` | Render the uptime strip(s) — all monitors by default |
| `aux4 uptime prune` | Delete expired checks (past their retention) to reclaim disk |
| `aux4 uptime start` | Start the scheduler daemon (run after each reboot) |
| `aux4 uptime stop` | Stop the scheduler daemon |
| `aux4 uptime schedule --interval <every>` | Schedule recurring checks via cron |
| `aux4 uptime unschedule` | Remove the schedule |

Every command also accepts `--config <profile>` (see [Profiles](#profiles---config)).

## Profiles (`--config`)

Every command accepts `--config <profile>` to scope the registry under a named section, so one file can hold several independent monitor sets (e.g. `test` vs `prod`):

```bash
aux4 uptime add --config prod --url https://api.example.com/health --name api
aux4 uptime add --config test --url https://staging.example.com
aux4 uptime check-all --config prod
aux4 uptime chart --config prod --name api --output prod-api.png
```

```yaml
config:
  prod:
    alertAfter: 3
    monitors:
      - { name: api, url: https://api.example.com/health, expectedStatus: 200 }
  test:
    monitors:
      - { name: staging.example.com, url: https://staging.example.com, expectedStatus: 2XX }
```

Stored checks are scoped to the profile too, so profiles never mix — even in one database.

## Alerting on consecutive failures

Get notified when a monitor stays down. Set an `alertAfter` threshold and an `onAlert` command (and optionally `onRecover`) — globally or per-monitor — in the registry:

```yaml
config:
  alertAfter: 3
  onAlert: "aux4 slack send --channel ops --text 'DOWN: $UPTIME_NAME ($UPTIME_STATUS) x$UPTIME_FAILS'"
  onRecover: "aux4 slack send --channel ops --text 'RECOVERED: $UPTIME_NAME'"
  monitors:
    - name: api
      url: https://api.example.com/health
      expectedStatus: 200
      alertAfter: 5          # per-monitor override
```

- `onAlert` fires **once**, on the check where consecutive failures first reach `alertAfter` (not every check after) — no alert storms.
- `onRecover` fires once when the monitor comes back up after having alerted.
- The hook runs through [`aux4/jobs`](https://hub.aux4.io/aux4/jobs) (so it is tracked/logged) with the check context as environment variables:

  | Variable | Value |
  |----------|-------|
  | `$UPTIME_NAME` | monitor name |
  | `$UPTIME_URL` | monitor URL |
  | `$UPTIME_STATUS` | HTTP status (0 = unreachable) |
  | `$UPTIME_UP` | 1 or 0 |
  | `$UPTIME_FAILS` | consecutive failures |
  | `$UPTIME_RESPONSE_MS` | latency in ms |
  | `$UPTIME_EXPECTED` | the expectedStatus spec |
  | `$UPTIME_CHECKED_AT` | ISO timestamp |

The hook is just a command, so it can notify however you like — Slack, email (`aux4/gmail`), a webhook (`aux4/curl`), or enqueue to `aux4/queue` for durable delivery. `uptime` stays decoupled from any one channel.

## Storage

Checks are stored with [`aux4/repository`](https://hub.aux4.io/aux4/repository) in a SQLite file (`--db`, default `~/.aux4.config/uptime.db`), table `checks`. Each record is:

```json
// URL check
{ "profile": "", "name": "api", "type": "http", "up": 1, "responseMs": 143,
  "timedOut": 0, "checkedAt": "2026-08-06T12:00:00.000Z",
  "url": "https://api.example.com/health", "expectedStatus": "200", "httpStatus": 200 }

// command check
{ "profile": "", "name": "Shop DB", "type": "command", "up": 1, "responseMs": 29,
  "timedOut": 0, "checkedAt": "2026-08-06T12:00:05.000Z",
  "command": "aux4 db sqlite execute ...", "exitCode": 0 }
```

### Retention & history

Every check is written with a **retention ttl** — how long that record is kept before it auto-expires. The default comes from `check-all`'s `--retention` (**90 days**), but each monitor can override it, so different services keep different history:

```yaml
config:
  retention: 90                 # default for all monitors (or pass --retention)
  monitors:
    - name: api
      url: https://api.example.com/health   # keeps 90 days
    - name: audit
      url: https://…
      retention: 365            # this one keeps a year
    - name: scratch
      url: https://…
      retention: 0              # keep forever
```

Expired checks are automatically hidden from `status` and `chart`, so history never grows without bound and reads stay bounded to the window you actually query. To reclaim disk, physically delete expired rows — each is removed at **its own** retention ttl:

```bash
aux4 uptime prune            # aux4 repository clean under the hood
```

`aux4 uptime schedule` sets up a **daily prune automatically** (see below), so a scheduled monitor is self-maintaining. `status --window <days>` (default 90) is a separate, query-time knob for the rolling-uptime window — bounded by, but independent of, retention.

## Charting

`aux4 uptime chart` aggregates the stored checks and pipes them to `aux4 chart uptime`. Two aggregations:

- `--period daily` (default): one bar per calendar day, `uptime% = up-checks / total-checks` that day — the classic 90-day status strip. Use `--days` to change the window. Days with no checks render neutral ("no data").
- `--period check`: one bar per individual probe (up = 100, down = 0), showing the last `--bars` checks.

With `--name` it charts that monitor; **without `--name` it charts every registered monitor** — one strip each, titled by name. It previews **inline in the terminal by default** (Ghostty, Kitty, iTerm2); pass `--output uptime.png` to save instead (the monitor name is inserted into the filename when charting several). `aux4 uptime status --chart` prints the status table plus the same strips.

## Scheduling & the cron daemon

Scheduled checks run on the **uptime scheduler** — a dedicated [`aux4/cron`](https://hub.aux4.io/aux4/cron) daemon that uptime manages for you. Because it runs on its own directory (`~/.aux4.config/uptime`) and port (`8422`, separate from cron's default `8421`), `uptime stop` only ever affects uptime's schedule, never other cron jobs.

```bash
aux4 uptime start                        # start the scheduler daemon (idempotent)
aux4 uptime schedule --interval "5 min"  # register check-all + a daily prune (starts the scheduler if needed)
aux4 uptime unschedule                   # remove both jobs
aux4 uptime stop                         # stop the scheduler daemon
```

`schedule` registers **two** cron jobs: `uptime-check` (runs `check-all` every `--interval`) and `uptime-prune` (runs `prune` every `--pruneEvery`, default `1 day`) — so a scheduled monitor probes *and* trims its own history. Disable the prune job with `--pruneEvery ""` (or `off`). `unschedule` removes both. Intervals are human-readable: `30s`, `5 min`, `2 hours`, etc. With `--config <profile>`, the jobs are named per profile (`uptime-check-<profile>`, `uptime-prune-<profile>`) so profiles schedule independently.

**Choosing the port.** By default the scheduler owns port `8422` (dir `~/.aux4.config/uptime`). Override it with `--port`, or persist it in the registry so you set it once — resolution is **`--port` flag → registry `port` value → `8422`**:

```bash
aux4 config set --name port --value 8500 --file uptime.yaml   # persist per registry/profile
aux4 uptime start                                             # now uses 8500
aux4 uptime schedule --port 8421 --interval "5 min"           # or share an existing cron daemon on the fly
```

Each distinct port gets its own daemon directory, so multiple schedulers never clash.

> The scheduler is a background daemon and **does not survive a machine reboot**. After a reboot, run `aux4 uptime start` to bring it back up; while it is down, no checks run. (You can inspect it directly with `aux4 cron list --port <port>`.)

## License

Apache-2.0
