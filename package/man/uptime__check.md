#### Description

The `check` command probes one registered monitor right now and records the result in the check database (`~/.aux4.config/uptime.db` by default). For a URL check it makes the HTTP request and classifies the response against the monitor's `expectedStatus`; for a command check it runs the command and classifies the exit code (and optional output match). The probe is bounded by `--timeout` (default 10000 ms) — a slower response is recorded as down.

`check` **exits non-zero** when the monitor is down, so it fits a shell conditional or a health gate. To probe every monitor without aborting on the first failure, use `check-all` instead. If the monitor has `alertAfter`/`onAlert` configured in the registry, this check may fire the alert hook when consecutive failures reach the threshold.

Each recorded check is stored with a retention ttl (`--retention`, default 90 days): older checks are hidden from reads once they expire and can be removed for good with `aux4 uptime prune`.

#### Usage

```bash
aux4 uptime check --name <name> [--timeout <ms>] [--retention <days>] [--configFile <file>] [--db <file>] [--config <profile>]
```

--name        The monitor name to check (required).
--timeout     Per-probe timeout in milliseconds; a slower response is recorded as down (default: 10000).
--retention   Days to keep each check before it auto-expires (0 = keep forever). Older checks are hidden from reads and removable with `aux4 uptime prune` (default: 90).
--configFile  Registry YAML file that stores the monitors (default: uptime.yaml).
--db          aux4/repository database file where checks are stored (default: ~/.aux4.config/uptime.db).
--config      Scope the registry and stored checks under a named profile.

#### Example

```bash
aux4 uptime check --name api
```

```text
api  UP  200  143ms
```
