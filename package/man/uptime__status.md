#### Description

The `status` command reports the current state of your monitors: whether each is up or down right now, its last recorded response, and its rolling uptime percentage. The uptime percentage is computed over the `--window` (default 90 days), which also bounds how many stored checks are read (`0` = all retained). With `--name` it reports one monitor; omit `--name` to report them all. On a terminal it prints an aligned table; when piped it emits JSON.

Pass `--chart` to also draw the uptime strip for each monitor in scope (each strip titled by its monitor name) — inline in a supported terminal (Ghostty, Kitty, iTerm2), or to files with `--output` (the monitor name is inserted into the filename when there are several). The chart passthrough flags mirror `uptime chart`: `--period` (`daily` or `check`), `--days` (window for the daily period), `--theme` (`light`/`dark`), and `--output`. Without `--chart`, those flags have no effect.

#### Usage

```bash
aux4 uptime status [--name <name>] [--window <days>] [--chart] [--period <daily|check>] [--days <n>] [--output <file>] [--theme <light|dark>] [--configFile <file>] [--db <file>] [--config <profile>]
```

--name        Limit to a single monitor. Omit for all monitors.
--window      Rolling uptime window in days; also bounds how many stored checks are read (0 = all retained) (default: 90).
--chart       Also render the uptime strip for each monitor in scope (titled by name). Inline, or to files with --output.
--period      With --chart: aggregation, 'daily' or 'check' (default: daily).
--days        With --chart and daily period: how many days the strip covers (default: 90).
--output      With --chart: save the strip(s) to a file instead of previewing inline. For multiple monitors the name is inserted into the filename.
--theme       With --chart: visual theme, light or dark.
--configFile  Registry YAML file that stores the monitors (default: uptime.yaml).
--db          aux4/repository database file where checks are stored (default: ~/.aux4.config/uptime.db).
--config      Scope the registry and stored checks under a named profile.

#### Example

```bash
aux4 uptime status
```

```text
NAME         STATUS  LAST     UPTIME   CHECKED
example.com  UP      200      99.98%   2026-08-06T12:00:00.000Z
api          UP      200      100.00%  2026-08-06T12:00:00.000Z
staging      DOWN    503      97.41%   2026-08-06T12:00:00.000Z
```
