#### Description

The `schedule` command sets up recurring monitoring by registering jobs with `aux4/cron`. It starts the uptime scheduler if needed (see `aux4 uptime start`) and registers **two** jobs: `uptime-check`, which probes every monitor at `--interval`, and `uptime-prune`, which physically removes expired checks every `--pruneEvery` (default `1 day`) so a scheduled monitor maintains its own history. Disable the prune job with `--pruneEvery ""` (or `off`). Intervals are human-readable: `30s`, `5 min` (the default), `2 hours`, etc.

> The scheduler runs in a background daemon that does not survive a machine reboot. After a reboot, run `aux4 uptime start` to bring it back up; while it is down, no checks run.

When you scope with `--config <profile>`, the schedule targets that profile's monitors and stored checks, and the cron job is named per profile so profiles can be scheduled independently.

#### Usage

```bash
aux4 uptime schedule [--interval <every>] [--port <port>] [--configFile <file>] [--db <file>] [--config <profile>]
```

--interval    How often to probe, e.g. '5 min', '2 hours', '30s' (default: 5 min).
--pruneEvery  How often to auto-prune expired checks (default: 1 day). Set to '' or 'off' to disable the prune job.
--port        Scheduler cron daemon port (default: registry `port`, else 8422). Set it to share an existing cron daemon.
--configFile  Registry YAML file that stores the monitors (default: uptime.yaml).
--db          aux4/repository database file where checks are stored (default: ~/.aux4.config/uptime.db).
--config      Scope the registry and stored checks under a named profile; names the cron job per profile.

#### Example

```bash
aux4 uptime schedule --interval "5 min"
```

```text
Scheduled uptime-check every 5 min
```
