# uptime retention, prune, and window

## retention ttl, prune, and windowed status

```beforeAll
aux4 uptime add --command "true" --name svc --configFile rt.yaml >/dev/null
aux4 uptime check-all --configFile rt.yaml --db rt.db --retention 30 >/dev/null 2>&1
```

```afterAll
rm -f rt.yaml rt.db
```

### a check written with --retention carries a ttl expiry

```execute
aux4 repository find checks --db rt.db --expr "name = 'svc'" --raw --render none | grep -o '"ttl":[0-9]' | head -1
```

```expect
"ttl":1
```

### prune removes expired records and reports the database

```execute
aux4 uptime prune --db rt.db | grep -o "Pruned expired checks"
```

```expect
Pruned expired checks
```

### status honors a rolling --window and still sees the recent check

```execute
aux4 uptime status --name svc --window 1 --configFile rt.yaml --db rt.db | grep -o '"windowDays":1'
```

```expect
"windowDays":1
```

### the recent check counts as up within the window

```execute
aux4 uptime status --name svc --window 1 --configFile rt.yaml --db rt.db | grep -o '"state":"up"'
```

```expect
"state":"up"
```
