#### Description

The `check-all` command probes every registered monitor in turn and records each result in the check database. This is the command to run on a schedule — `uptime schedule` registers exactly this. Unlike `check`, it **always exits 0**, so a single failing probe never aborts a scheduled run; each monitor's up/down state is captured in its own record. Each probe is bounded by `--timeout` (default 10000 ms). Any monitor with `alertAfter`/`onAlert` configured in the registry may fire its alert hook here when consecutive failures reach the threshold.

#### Usage

```bash
aux4 uptime check-all [--timeout <ms>] [--configFile <file>] [--db <file>] [--config <profile>]
```

--timeout     Per-probe timeout in milliseconds; a slower response is recorded as down (default: 10000).
--configFile  Registry YAML file that stores the monitors (default: uptime.yaml).
--db          aux4/repository database file where checks are stored (default: ~/.aux4.config/uptime.db).
--config      Scope the registry and stored checks under a named profile.

#### Example

```bash
aux4 uptime check-all
```

```text
example.com  UP    200  92ms
api          UP    200  143ms
staging      DOWN  503  310ms
```
