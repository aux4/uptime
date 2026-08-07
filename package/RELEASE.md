# Release Notes

## Features

- **Monitor anything** — register a URL (HTTP check) or an arbitrary command (a DB query, a script, any aux4 command). A monitor is a URL check when it has `--url`, a command check when it has `--command`.
- **Flexible "up" rules** — for URLs, `--expectedStatus` accepts an exact code (`200`), a class (`2XX`), a numeric range (`200-402`), or a comma-separated union (`200-399,405`). For commands, up means exit code `0` (override with `--exit`) plus an optional `--expect` match on the output, using the same notation plus comparisons (`>0`, `>=1`, `<100`, `=5`), `regex:<pattern>`, or a substring.
- **Registry in YAML** — `add` / `remove` / `list` manage a human-editable `uptime.yaml` (via aux4/config). `--config <profile>` scopes monitors under a named section so one file can hold several independent sets (e.g. `test` vs `prod`).
- **Probe + record** — `check` (one monitor) and `check-all` (all; the scheduled command) probe and store every result in aux4/repository, with response time and a per-probe timeout. URL probes use `aux4 curl request --status --maxTime`.
- **Status** — `status` shows current up/down, last result, response time, and rolling uptime for one monitor or all; pass `--chart` to also draw the strips.
- **Charts** — `chart` renders the status-page-style uptime strip via aux4/chart. With `--name` it charts that monitor; without, it charts every monitor (one strip each, titled by name), inline in the terminal by default or to files with `--output`. Daily and per-check aggregation; days with no data render neutral.
- **Scheduling** — `start` / `stop` manage a dedicated aux4/cron scheduler daemon (its own port, so stopping never touches other cron jobs); `schedule` / `unschedule` register recurring `check-all` runs on an interval (per-profile jobs).
- **Alerting** — set `alertAfter` plus `onAlert` / `onRecover` command hooks (globally or per-monitor) to be notified on consecutive failures and recovery. Hooks run through aux4/jobs with the check context in `$UPTIME_*` environment variables, edge-triggered so a sustained outage alerts once.
