# uptime registry (add / list / remove / profiles)

## add

```afterAll
rm -f reg.yaml
```

### should register a URL check and derive the name from the host

```execute
aux4 uptime add --url https://example.com --configFile reg.yaml && aux4 uptime list --configFile reg.yaml | cat
```

```expect
Added monitor "example.com" -> https://example.com (expects 2XX)
[{"name":"example.com","url":"https://example.com","expectedStatus":"2XX"}]
```

### should register a command check with an explicit name and expect

```execute
aux4 uptime add --command "true" --name worker --expect ">0" --configFile reg.yaml >/dev/null && aux4 uptime list --configFile reg.yaml | grep -oF '"name":"worker","command":"true","expect":{"output":">0"}'
```

```expect
"name":"worker","command":"true","expect":{"output":">0"}
```

### should reject a command check without a name

```execute
aux4 uptime add --command "true" --configFile reg.yaml
```

```error:partial
a command monitor needs a --name
```

### should reject providing both --url and --command

```execute
aux4 uptime add --url https://x.com --command "true" --name both --configFile reg.yaml
```

```error:partial
provide either --url or --command, not both
```

### should reject a duplicate monitor name

```execute
aux4 uptime add --url https://example.com --name example.com --configFile reg.yaml
```

```error:partial
already exists
```

## remove

```afterAll
rm -f rm.yaml keep.yaml
```

### should remove a monitor

```execute
aux4 uptime add --url https://a.com --name a --configFile rm.yaml >/dev/null && aux4 uptime add --url https://b.com --name b --configFile rm.yaml >/dev/null && aux4 uptime remove --name a --configFile rm.yaml && aux4 uptime list --configFile rm.yaml | cat
```

```expect
Removed monitor "a"
[{"name":"b","url":"https://b.com","expectedStatus":"2XX"}]
```

### should error removing an unknown monitor

```execute
aux4 uptime remove --name nope --configFile rm.yaml
```

```error:partial
no monitor named "nope"
```

### removing one monitor preserves the global alert fields

```execute
aux4 uptime add --url https://a.com --name a --configFile keep.yaml >/dev/null && aux4 uptime add --url https://b.com --name b --configFile keep.yaml >/dev/null && aux4 config set --name alertAfter --value 3 --file keep.yaml >/dev/null && aux4 uptime remove --name a --configFile keep.yaml >/dev/null && aux4 config get alertAfter --file keep.yaml
```

```expect
3
```

### and the other monitor survives the removal

```execute
aux4 uptime list --configFile keep.yaml | grep -o '"name":"b"'
```

```expect
"name":"b"
```

## profiles (--config)

```afterAll
rm -f prof.yaml
```

### should scope monitors under a named profile, isolated from other profiles

```execute
aux4 uptime add --config test --url https://staging.example.com --name stg --configFile prof.yaml >/dev/null && aux4 uptime add --config prod --url https://example.com --name www --configFile prof.yaml >/dev/null && aux4 uptime list --config test --configFile prof.yaml | cat
```

```expect
[{"name":"stg","url":"https://staging.example.com","expectedStatus":"2XX"}]
```

### the other profile has its own monitors

```execute
aux4 uptime list --config prod --configFile prof.yaml | cat
```

```expect
[{"name":"www","url":"https://example.com","expectedStatus":"2XX"}]
```
