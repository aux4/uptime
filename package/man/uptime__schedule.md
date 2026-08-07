#### Description

The `schedule` command sets up recurring monitoring by registering a `check-all` run with `aux4/cron`. It ensures the cron daemon is running and registers a job named `uptime-check` that probes every monitor at `--interval`. Intervals are human-readable: `30s`, `5 min` (the default), `2 hours`, etc.

> The cron daemon lives in a background process. After a machine reboot it must be started again (`aux4 cron start`); while it is down, no checks run.

When you scope with `--config <profile>`, the schedule targets that profile's monitors and stored checks, and the cron job is named per profile so profiles can be scheduled independently.

#### Usage

```bash
aux4 uptime schedule [--interval <every>] [--configFile <file>] [--db <file>] [--config <profile>]
```

--interval    How often to probe, e.g. '5 min', '2 hours', '30s' (default: 5 min).
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
