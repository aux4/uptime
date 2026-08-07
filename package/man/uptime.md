#### Description

The `uptime` command group monitors things from the command line — HTTP URLs or arbitrary commands — records every check, and renders the status-page-style uptime strip. It is glue over existing aux4 packages: `aux4/curl` probes URLs, `aux4/repository` stores each check as a record, `aux4/config` keeps the monitor registry in a YAML file, `aux4/chart` draws the strip (the `chart uptime` type), and `aux4/cron` runs the checks on a schedule.

Register monitors with `add` (a `--url` for an HTTP check, or a `--command` for a command check), probe them with `check` / `check-all`, inspect the current state with `status`, visualise history with `chart`, and keep it all running with `schedule`. The registry defaults to `uptime.yaml` (override with `--configFile`) and the check history to `~/.aux4.config/uptime.db` (override with `--db`). Every command also accepts `--config <profile>` to scope both the registry and the stored checks under a named section, so one file can hold several independent monitor sets (e.g. `test` vs `prod`).

A monitor is **up** when its check passes: for a URL, when the HTTP response matches `--expectedStatus` (default `2XX`); for a command, when it exits with the expected code (default `0`) and, if set, its output matches `--expect`. Anything else — 4xx/5xx, connection/DNS/TLS failures, a non-zero exit, or a timeout past `--timeout` (default 10000 ms) — is recorded as down.

Available subcommands:

- **add** — register a monitor (a URL or a command)
- **remove** — unregister a monitor by name
- **list** — list registered monitors
- **check** — probe one monitor now and record it (exits non-zero when down)
- **check-all** — probe every monitor (the command to schedule; always exits 0)
- **status** — current up/down, last result, and rolling uptime
- **chart** — render the uptime status strip
- **schedule** — schedule recurring `check-all` runs via cron
- **unschedule** — remove the schedule

#### Usage

```bash
aux4 uptime <command> [--configFile <file>] [--db <file>] [--config <profile>]
```

#### Example

```bash
aux4 uptime add --url https://api.example.com/health --name api --expectedStatus 200
aux4 uptime check-all
aux4 uptime status
```

```text
NAME  STATUS  LAST     UPTIME   CHECKED
api   UP      200      100.00%  2026-08-06T12:00:00.000Z
```
