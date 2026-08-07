# uptime profiles (--config isolation)

## profile-scoped registry, checks, and status

```beforeAll
aux4 uptime add --config p1 --command "true" --name a --configFile pf.yaml >/dev/null
aux4 uptime add --config p2 --command "true" --name b --configFile pf.yaml >/dev/null
aux4 uptime check-all --config p1 --configFile pf.yaml --db pf.db --timeout 4000 >/dev/null 2>&1
aux4 uptime check-all --config p2 --configFile pf.yaml --db pf.db --timeout 4000 >/dev/null 2>&1
```

```afterAll
rm -f pf.yaml pf.db
```

### list is scoped to the profile

```execute
aux4 uptime list --config p1 --configFile pf.yaml | grep -o '"name":"a"'
```

```expect
"name":"a"
```

### status shows only the profile's own monitor

```execute
aux4 uptime status --config p1 --configFile pf.yaml --db pf.db | grep -o '"name":"a"'
```

```expect
"name":"a"
```

### the other profile's monitor is not visible

```execute
aux4 uptime status --config p1 --configFile pf.yaml --db pf.db | grep -c '"name":"b"' || true
```

```expect
0
```
