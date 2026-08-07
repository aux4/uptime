# uptime url request headers

## a URL check that requires an Authorization header

```beforeAll
node -e 'require("http").createServer((q,r)=>{const ok=q.headers["authorization"]==="Bearer TOK";r.writeHead(ok?200:401);r.end(ok?"ok":"no")}).listen(8483,()=>{});setTimeout(()=>process.exit(0),20000).unref()' uptime-hdr-httpd >/dev/null 2>&1 </dev/null &
sleep 1
aux4 uptime add --url http://127.0.0.1:8483/ --name withhdr --expectedStatus 200 --header "Authorization: Bearer TOK" --configFile hd.yaml >/dev/null
aux4 uptime add --url http://127.0.0.1:8483/ --name nohdr   --expectedStatus 200 --configFile hd.yaml >/dev/null
aux4 uptime check-all --configFile hd.yaml --db hd.db --timeout 5000 >/dev/null 2>&1
```

```afterAll
pkill -f uptime-hdr-httpd 2>/dev/null
rm -f hd.yaml hd.db
```

### the header is stored on the monitor

```execute
aux4 uptime list --configFile hd.yaml | grep -oF '"headers":["Authorization: Bearer TOK"]'
```

```expect
"headers":["Authorization: Bearer TOK"]
```

### sending the required header is up

```execute
aux4 uptime status --name withhdr --configFile hd.yaml --db hd.db | grep -o '"state":"up"'
```

```expect
"state":"up"
```

### without the header the endpoint returns 401 (down)

```execute
aux4 uptime status --name nohdr --configFile hd.yaml --db hd.db | grep -o '"state":"down"'
```

```expect
"state":"down"
```
