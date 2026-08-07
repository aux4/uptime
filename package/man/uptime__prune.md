#### Description

The `prune` command physically deletes expired checks — those past their retention ttl — from the check database (`~/.aux4.config/uptime.db` by default) to reclaim disk. Expired checks are already hidden from every read (`status`, `chart`, and the uptime percentage skip them), so pruning changes nothing you see; it just removes them for good.

Retention is set per check when it is recorded, via `--retention` on `check`/`check-all` (default 90 days; `0` keeps forever). Run `prune` occasionally — or on a schedule — to keep the database compact.

#### Usage

```bash
aux4 uptime prune [--db <file>]
```

--db  aux4/repository database file where checks are stored (default: ~/.aux4.config/uptime.db).

#### Example

```bash
aux4 uptime prune
```

```text
Pruned expired checks from ~/.aux4.config/uptime.db.
```
