# uptime url checks

## unreachable host

```beforeAll
aux4 uptime add --url http://127.0.0.1:1/ --name dead --configFile url.yaml >/dev/null
aux4 uptime check-all --configFile url.yaml --db url.db --timeout 3000 >/dev/null 2>&1
```

```afterAll
rm -f url.yaml url.db
```

### a connection failure is recorded as down (unreachable)

```execute
aux4 uptime status --name dead --configFile url.yaml --db url.db | grep -o '"state":"down"'
```

```expect
"state":"down"
```

### the check is stored as an http-type record

```execute
aux4 uptime status --name dead --configFile url.yaml --db url.db | grep -o '"type":"http"'
```

```expect
"type":"http"
```
