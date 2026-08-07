#### Description

The `check-all` command probes every registered monitor and records each result in the check database. Monitors are probed **concurrently**, so a run takes about as long as the slowest single probe rather than the sum of them all. This is the command to run on a schedule — `uptime schedule` registers exactly this. Unlike `check`, it **always exits 0**, so a single failing probe never aborts a scheduled run; each monitor's up/down state is captured in its own record. Each probe is bounded by `--timeout` (default 10000 ms). Any monitor with `alertAfter`/`onAlert` configured in the registry may fire its alert hook here when consecutive failures reach the threshold.

Each recorded check is stored with a retention ttl (`--retention`, default 90 days): older checks are hidden from reads once they expire and can be removed for good with `aux4 uptime prune`.

#### Usage

```bash
aux4 uptime check-all [--timeout <ms>] [--retention <days>] [--configFile <file>] [--db <file>] [--config <profile>]
```

--timeout     Per-probe timeout in milliseconds; a slower response is recorded as down (default: 10000).
--retention   Days to keep each check before it auto-expires (0 = keep forever). Older checks are hidden from reads and removable with `aux4 uptime prune` (default: 90).
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
