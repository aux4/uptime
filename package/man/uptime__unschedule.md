#### Description

The `unschedule` command removes the recurring `uptime-check` schedule from `aux4/cron`, stopping further automatic probes. The cron daemon and any other jobs are left running; only the uptime job is removed. Registered monitors and their stored check history are untouched — resume later with `uptime schedule`.

#### Usage

```bash
aux4 uptime unschedule
```

#### Example

```bash
aux4 uptime unschedule
```

```text
Removed schedule uptime-check
```
