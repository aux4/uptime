# uptime chart & status

## chart and status over recorded checks

```beforeAll
aux4 uptime add --command "true"  --name ok  --configFile ct.yaml >/dev/null
aux4 uptime add --command "false" --name bad --configFile ct.yaml >/dev/null
aux4 uptime check-all --configFile ct.yaml --db ct.db --timeout 5000 >/dev/null 2>&1
aux4 uptime check-all --configFile ct.yaml --db ct.db --timeout 5000 >/dev/null 2>&1
```

```afterAll
rm -f ct.yaml ct.db ct.png ct-all-ok.png ct-all-bad.png st-ok.png st-bad.png fresh.yaml fresh.db fresh.png
```

### reports rolling uptime for an always-up monitor

```execute
aux4 uptime status --name ok --configFile ct.yaml --db ct.db | grep -o '"uptimePct":100'
```

```expect
"uptimePct":100
```

### reports 0% for an always-down monitor

```execute
aux4 uptime status --name bad --configFile ct.yaml --db ct.db | grep -o '"uptimePct":0'
```

```expect
"uptimePct":0
```

### charts a single monitor to a PNG

```execute
aux4 uptime chart --name ok --configFile ct.yaml --db ct.db --output ct.png >/dev/null 2>&1 && xxd -p -l 4 ct.png
```

```expect
89504e47
```

### charts every monitor, inserting the name into the filename

```execute
aux4 uptime chart --configFile ct.yaml --db ct.db --output ct-all.png >/dev/null 2>&1 && xxd -p -l 4 ct-all-ok.png && xxd -p -l 4 ct-all-bad.png
```

```expect
89504e47
89504e47
```

### status --chart renders a strip per monitor

```execute
aux4 uptime status --chart true --configFile ct.yaml --db ct.db --output st.png >/dev/null 2>&1 && xxd -p -l 4 st-ok.png && xxd -p -l 4 st-bad.png
```

```expect
89504e47
89504e47
```

### charts a monitor with no history (renders neutral, still a valid PNG)

```execute
aux4 uptime add --command "true" --name new --configFile fresh.yaml >/dev/null && aux4 uptime chart --name new --configFile fresh.yaml --db fresh.db --output fresh.png >/dev/null 2>&1 && xxd -p -l 4 fresh.png
```

```expect
89504e47
```
