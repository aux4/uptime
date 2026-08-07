#### Description

The `add` command registers something to monitor and saves it to the registry YAML file (`uptime.yaml` by default). There are two kinds of monitor and you provide exactly one:

A **URL check** (`--url`) probes an HTTP endpoint with `aux4/curl`. Only `--url` is required — the monitor name defaults to the URL host — and `--expectedStatus` decides which responses count as up. It accepts an exact code (`200`), a class (`2XX`, the default), a numeric range (`200-402`), or a comma-separated union (`200-399,405`). Anything outside the expected set — including 4xx/5xx, connection/DNS/TLS failures, and timeouts — is down. `2XX` is the default because a healthy endpoint may legitimately answer `201`/`204`/`301`; use `--expectedStatus 200` for a strict health endpoint.

A **command check** (`--command`) runs an arbitrary command — a DB query, a script, any aux4 command — and is up when it exits with the expected code. `--name` is **required** for a command check. `--exit` sets the exit code that counts as up (default `0`), and `--expect` adds an optional match on the command's output: the same notation as `--expectedStatus` (`200` / `2XX` / `200-402`), plus comparisons (`>0`, `>=1`, `<100`, `=5`), `regex:<pattern>`, or a plain substring.

Every command accepts `--config <profile>` to scope the registry under a named section, so one file can hold several independent monitor sets (e.g. `test` vs `prod`). Stored checks are scoped to the profile too, so profiles never mix.

#### Usage

```bash
aux4 uptime add --url <url> [--name <name>] [--expectedStatus <spec>] [--expectBody <spec>] [--configFile <file>] [--config <profile>]
aux4 uptime add --command <cmd> --name <name> [--expect <spec>] [--exit <code>] [--configFile <file>] [--config <profile>]
```

--url             The URL to monitor (HTTP check). Provide this OR --command.
--command         A command to run as the check (command check) — a DB query, a script, any aux4 command. Up when it exits 0 (see --expect/--exit). Provide this OR --url.
--name            A short name for the monitor. Defaults to the URL host for --url; required for --command.
--expectedStatus  URL check: which HTTP responses count as up — an exact code (200), a class (2XX), a numeric range (200-402), or a comma-separated union (200-399,405). Default: 2XX.
--expectBody      URL check: an optional match on the response body for it to count as up, in addition to the status. Same notation as --expect (regex:<pattern>, a substring, or a numeric comparison); triggers a body fetch only when set.
--expect          Command check: an optional match on the command's output — same notation as --expectedStatus, plus comparisons (>0, >=1, <100, =5), regex:<pattern>, or a plain substring.
--exit            Command check: the exit code that counts as up (default: 0).
--configFile      Registry YAML file that stores the monitors (default: uptime.yaml).
--config          Scope the registry (and stored checks) under a named profile, e.g. prod or test.

#### Example

```bash
aux4 uptime add --url https://api.example.com/health --name api --expectedStatus 200
aux4 uptime add --url https://api.example.com/health --name api-body --expectBody healthy
aux4 uptime add --command "aux4 db sqlite execute --file app.db --query 'SELECT 1'" --name db-reachable
aux4 uptime add --command "aux4 repository count --db app.db --table orders" --name has-orders --expect ">0"
```

```text
Added monitor api (https://api.example.com/health)
```
