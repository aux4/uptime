#### Description

The `list` command shows the monitors registered in the registry YAML file. On a terminal it prints an aligned table; when the output is piped or redirected it emits a JSON array instead, so it composes with other tools. Pass `--config <profile>` to list a named profile's monitors.

#### Usage

```bash
aux4 uptime list [--configFile <file>] [--config <profile>]
```

--configFile  Registry YAML file that stores the monitors (default: uptime.yaml).
--config      Scope the registry under a named profile, e.g. prod or test.

#### Example

```bash
aux4 uptime list
```

```text
NAME         URL                                EXPECTED
example.com  https://example.com                2XX
api          https://api.example.com/health     200
```
