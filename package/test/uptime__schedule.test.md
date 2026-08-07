# uptime scheduler (start / schedule / unschedule / stop)

## scheduler lifecycle

```beforeAll
aux4 uptime add --url https://example.com --name site --configFile sc.yaml >/dev/null
aux4 uptime start >/dev/null 2>&1
```

```afterAll
aux4 uptime unschedule >/dev/null 2>&1
aux4 uptime stop >/dev/null 2>&1
rm -f sc.yaml sc.db
```

```timeout
60000
```

### schedule registers a recurring cron job on the uptime port

```execute
aux4 uptime schedule --interval "10 min" --configFile sc.yaml --db sc.db >/dev/null 2>&1 && aux4 cron list --port 8422 | grep -o '"name":"uptime-check"'
```

```expect
"name":"uptime-check"
```

### unschedule removes the job

```execute
aux4 uptime unschedule >/dev/null 2>&1 && aux4 cron list --port 8422 | grep -c "uptime-check" || true
```

```expect
0
```
