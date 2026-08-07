# uptime alerting (consecutive failures)

## edge-triggered alert + recovery

```beforeAll
rm -f /tmp/uptime-test-alert /tmp/uptime-test-recover
aux4 uptime add --command "false" --name svc --configFile al.yaml >/dev/null
aux4 config set --name alertAfter --value 2 --file al.yaml >/dev/null
aux4 config set --name onAlert   --value 'printf "ALERT %s %s\n" "$UPTIME_NAME" "$UPTIME_FAILS" > /tmp/uptime-test-alert' --file al.yaml >/dev/null
aux4 config set --name onRecover --value 'printf "RECOVER %s\n" "$UPTIME_NAME" > /tmp/uptime-test-recover' --file al.yaml >/dev/null
# 1st down: fails=1 (no alert). 2nd down: fails=2 == threshold -> alert fires once.
aux4 uptime check-all --configFile al.yaml --db al.db --timeout 4000 >/dev/null 2>&1
aux4 uptime check-all --configFile al.yaml --db al.db --timeout 4000 >/dev/null 2>&1
for i in $(seq 1 50); do [ -f /tmp/uptime-test-alert ] && break; sleep 0.2; done
# now recover: point svc at a passing command, check once -> onRecover fires.
aux4 uptime remove --name svc --configFile al.yaml >/dev/null
aux4 uptime add --command "true" --name svc --configFile al.yaml >/dev/null
aux4 uptime check-all --configFile al.yaml --db al.db --timeout 4000 >/dev/null 2>&1
for i in $(seq 1 50); do [ -f /tmp/uptime-test-recover ] && break; sleep 0.2; done
```

```afterAll
rm -f al.yaml al.db /tmp/uptime-test-alert /tmp/uptime-test-recover
```

```timeout
60000
```

### onAlert fires once, on the check that reaches the threshold

```execute
cat /tmp/uptime-test-alert
```

```expect
ALERT svc 2
```

### onRecover fires when the monitor comes back up

```execute
cat /tmp/uptime-test-recover
```

```expect
RECOVER svc
```
