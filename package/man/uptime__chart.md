#### Description

The `chart` command renders the **uptime status strip** — the familiar public status-page widget — from the stored check history, using the `aux4/chart` `uptime` type. With `--name` it charts that one monitor; without `--name` it charts **every** registered monitor, one strip each, titled by name, so you see them all at once.

Two aggregations: `--period daily` (the default) draws one bar per calendar day, where `uptime% = up-checks / total-checks` that day — the classic 90-day status strip; use `--days` to change the window. `--period check` draws one bar per individual probe (up = 100, down = 0), showing the last `--bars` checks. Oldest is on the left, most recent on the right.

By default the strip previews inline in a supported terminal (Ghostty, Kitty, iTerm2). Pass `--output` to save to a file instead — the extension (`.png` / `.svg`) picks the format, and when charting several monitors the monitor name is inserted into the filename so each gets its own file. `--width`/`--height`, `--theme` (`light`/`dark`), and an explicit `--format` are passed through to the chart renderer. Pass `--config <profile>` to chart a named profile's monitors and checks.

#### Usage

```bash
aux4 uptime chart [--name <name>] [--period <daily|check>] [--days <n>] [--bars <n>] [--output <file>] [--width <px>] [--height <px>] [--theme <light|dark>] [--format <png|svg>] [--configFile <file>] [--db <file>] [--config <profile>]
```

--name        Chart a single monitor. Omit to chart every registered monitor (one strip each).
--period      Aggregation: 'daily' (one bar per day, uptime% = up/total) or 'check' (one bar per probe). Default: daily.
--days        Daily period: how many days the strip covers, oldest left, today right (default: 90).
--bars        Check period: how many of the most recent probes to show (default: 90).
--output      Where the chart goes: a file path (.png or .svg) saves it; '-' writes raw bytes to stdout; omitting it previews inline. For multiple monitors the name is inserted into the filename.
--width       Chart width in pixels.
--height      Chart height in pixels.
--theme       Visual theme: light or dark.
--format      Output format override: png or svg.
--configFile  Registry YAML file that stores the monitors (default: uptime.yaml).
--db          aux4/repository database file where checks are stored (default: ~/.aux4.config/uptime.db).
--config      Scope the registry and stored checks under a named profile.

#### Example

```bash
aux4 uptime chart --name api --days 90 --output api-uptime.png
```

```text
Saved PNG chart to api-uptime.png (1000x160)
```
