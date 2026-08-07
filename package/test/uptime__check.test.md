# uptime check (command checks)

## up / down classification

```beforeAll
aux4 uptime add --command "true"          --name ok    --configFile chk.yaml >/dev/null
aux4 uptime add --command "false"         --name bad   --configFile chk.yaml >/dev/null
aux4 uptime add --command "echo 5"        --name rows  --expect ">0"  --configFile chk.yaml >/dev/null
aux4 uptime add --command "echo 0"        --name empty --expect ">0"  --configFile chk.yaml >/dev/null
aux4 uptime add --command "echo 204"      --name code  --expect "2XX" --configFile chk.yaml >/dev/null
aux4 uptime add --command "echo hello"    --name sub   --expect "ell" --configFile chk.yaml >/dev/null
aux4 uptime add --command "exit 3"        --name exitc --exit 3       --configFile chk.yaml >/dev/null
aux4 uptime check-all --configFile chk.yaml --db chk.db --timeout 5000 >/dev/null 2>&1
```

```afterAll
rm -f chk.yaml chk.db
```

### exit 0 is up

```execute
aux4 uptime status --name ok --configFile chk.yaml --db chk.db | grep -o '"state":"up"'
```

```expect
"state":"up"
```

### non-zero exit is down

```execute
aux4 uptime status --name bad --configFile chk.yaml --db chk.db | grep -o '"state":"down"'
```

```expect
"state":"down"
```

### output `>0` matches a positive count (up)

```execute
aux4 uptime status --name rows --configFile chk.yaml --db chk.db | grep -o '"state":"up"'
```

```expect
"state":"up"
```

### output `>0` fails on zero (down)

```execute
aux4 uptime status --name empty --configFile chk.yaml --db chk.db | grep -o '"state":"down"'
```

```expect
"state":"down"
```

### output `2XX` matches 204 (up)

```execute
aux4 uptime status --name code --configFile chk.yaml --db chk.db | grep -o '"state":"up"'
```

```expect
"state":"up"
```

### output substring match (up)

```execute
aux4 uptime status --name sub --configFile chk.yaml --db chk.db | grep -o '"state":"up"'
```

```expect
"state":"up"
```

### a custom expected exit code (up)

```execute
aux4 uptime status --name exitc --configFile chk.yaml --db chk.db | grep -o '"state":"up"'
```

```expect
"state":"up"
```

## errors and edge cases

### check errors on an unknown monitor

```execute
aux4 uptime check --name ghost --configFile chk.yaml --db chk.db
```

```error:partial
no monitor named "ghost"
```

### check-all on an empty registry is a no-op (exit 0)

```execute
aux4 uptime check-all --configFile empty.yaml --db empty.db | grep -o "No monitors registered"
```

```expect
No monitors registered
```
