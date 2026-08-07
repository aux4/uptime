#### Description

The `stop` command stops the **uptime scheduler** daemon. Scheduled checks stop firing, but the schedule entries themselves persist — they resume automatically the next time you run `aux4 uptime start`.

Because the scheduler runs on its own dedicated `aux4/cron` daemon (port `8422`), stopping it only affects uptime's scheduled checks and never any other `aux4/cron` jobs. If the scheduler is not running, `stop` reports so and does nothing.

The port is resolved the same way as `start` (`--port` → registry `port` → `8422`), so stop targets the same daemon you started.

#### Usage

```bash
aux4 uptime stop [--port <port>] [--configFile <file>] [--config <profile>]
```

--port        Scheduler cron daemon port (default: registry `port`, else 8422).
--configFile  Registry YAML file used to source the `port` (default: uptime.yaml).
--config      Scope to a named profile; selects a per-profile `port` if set.

#### Example

```bash
aux4 uptime stop
```

```text
Stopped the uptime scheduler.
```
