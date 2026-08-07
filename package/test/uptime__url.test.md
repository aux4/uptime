# uptime url checks

## against a local HTTP server

```beforeAll
node -e 'require("http").createServer((q,r)=>{const c=q.url==="/ok"?200:503;r.writeHead(c);r.end(String(c))}).listen(8477,()=>{});setTimeout(()=>process.exit(0),20000).unref()' uptime-test-httpd >/dev/null 2>&1 </dev/null &
sleep 1
aux4 uptime add --url http://127.0.0.1:8477/ok   --name up200   --expectedStatus 200 --configFile srv.yaml >/dev/null
aux4 uptime add --url http://127.0.0.1:8477/down --name down503 --expectedStatus 200 --configFile srv.yaml >/dev/null
aux4 uptime add --url http://127.0.0.1:8477/down --name any3xx --expectedStatus "200-599" --configFile srv.yaml >/dev/null
aux4 uptime add --url http://127.0.0.1:8477/ok   --name bodyok  --expectedStatus 200 --expectBody "200" --configFile srv.yaml >/dev/null
aux4 uptime add --url http://127.0.0.1:8477/ok   --name bodybad --expectedStatus 200 --expectBody "zzz" --configFile srv.yaml >/dev/null
aux4 uptime check-all --configFile srv.yaml --db srv.db --timeout 5000 >/dev/null 2>&1
```

```afterAll
pkill -f uptime-test-httpd 2>/dev/null
rm -f srv.yaml srv.db
```

### a 200 matching the expected status is up

```execute
aux4 uptime status --name up200 --configFile srv.yaml --db srv.db | grep -o '"state":"up"'
```

```expect
"state":"up"
```

### a 503 when 200 is expected is down

```execute
aux4 uptime status --name down503 --configFile srv.yaml --db srv.db | grep -o '"state":"down"'
```

```expect
"state":"down"
```

### the recorded http status is the real code

```execute
aux4 uptime status --name down503 --configFile srv.yaml --db srv.db | grep -o '"lastResult":503'
```

```expect
"lastResult":503
```

### a wide expected range accepts the 503 (up)

```execute
aux4 uptime status --name any3xx --configFile srv.yaml --db srv.db | grep -o '"state":"up"'
```

```expect
"state":"up"
```

### expectBody matching the response body is up

```execute
aux4 uptime status --name bodyok --configFile srv.yaml --db srv.db | grep -o '"state":"up"'
```

```expect
"state":"up"
```

### expectBody NOT matching the body is down (even with a 200)

```execute
aux4 uptime status --name bodybad --configFile srv.yaml --db srv.db | grep -o '"state":"down"'
```

```expect
"state":"down"
```

## unreachable host

```beforeAll
aux4 uptime add --url http://127.0.0.1:1/ --name dead --configFile dead.yaml >/dev/null
aux4 uptime check-all --configFile dead.yaml --db dead.db --timeout 3000 >/dev/null 2>&1
```

```afterAll
rm -f dead.yaml dead.db
```

### a connection failure is recorded as down (unreachable)

```execute
aux4 uptime status --name dead --configFile dead.yaml --db dead.db | grep -o '"state":"down"'
```

```expect
"state":"down"
```

### the check is stored as an http-type record

```execute
aux4 uptime status --name dead --configFile dead.yaml --db dead.db | grep -o '"type":"http"'
```

```expect
"type":"http"
```
