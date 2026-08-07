#### Description

The `remove` command unregisters a monitor from the registry YAML file by name. The monitor's stored check history in the database is left untouched. Pass `--config <profile>` to remove from a named profile's registry section.

#### Usage

```bash
aux4 uptime remove --name <name> [--configFile <file>] [--config <profile>]
```

--name        The monitor name to remove (required).
--configFile  Registry YAML file that stores the monitors (default: uptime.yaml).
--config      Scope the registry under a named profile, e.g. prod or test.

#### Example

```bash
aux4 uptime remove --name api
```

```text
Removed monitor api
```
