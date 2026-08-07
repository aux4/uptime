#### Description

The `start` command starts the **uptime scheduler** — a dedicated `aux4/cron` daemon (its own directory and port, `8422`, separate from cron's default) that runs the scheduled `check-all` jobs registered with `aux4 uptime schedule`.

It is idempotent: if the scheduler is already running it reports so and does nothing. Because the daemon is a background process that does not survive a machine reboot, run `start` once to enable scheduling and again after each reboot so scheduled checks keep firing.

Using a dedicated port means `aux4 uptime stop` only ever affects uptime's scheduler, never other `aux4/cron` jobs you may be running.

The daemon port defaults to `8422`, but can be overridden with `--port` or a `port` value in the registry (resolution: `--port` → registry `port` → `8422`). Each distinct port gets its own daemon directory so multiple schedulers never clash.

#### Usage

```bash
aux4 uptime start [--port <port>] [--configFile <file>] [--config <profile>]
```

--port        Scheduler cron daemon port (default: registry `port`, else 8422).
--configFile  Registry YAML file used to source the `port` (default: uptime.yaml).
--config      Scope to a named profile; selects a per-profile `port` if set.

#### Example

```bash
aux4 uptime start
```

```text
Started the uptime scheduler (cron daemon on port 8422, dir ~/.aux4.config/uptime).
```
