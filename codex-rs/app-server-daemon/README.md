# deepseekx app-server daemon

> `codex-app-server-daemon` is experimental and its lifecycle contract may
> change while the remote-management flow is still being developed.

The daemon backs the machine-readable `deepseekx app-server` lifecycle commands
used by remote clients. It is intended for DeepSeekX instances launched over
SSH, including fresh developer machines that should expose app-server with
`remote_control` enabled.

## Platform support

The current daemon implementation is Unix-only. It uses pidfile-backed
daemonization plus Unix process and file-locking primitives, and does not yet
support Windows lifecycle management.

## Commands

```sh
deepseekx app-server daemon start
deepseekx app-server daemon restart
deepseekx app-server daemon enable-remote-control
deepseekx app-server daemon disable-remote-control
deepseekx app-server daemon stop
deepseekx app-server daemon version
deepseekx app-server daemon bootstrap --remote-control
```

On success, every command writes exactly one JSON object to stdout. Consumers
should parse that JSON rather than relying on human-readable text. Lifecycle
responses report the resolved backend, socket path, local CLI version, and
running app-server version when applicable.

## Bootstrap flow

For a new remote machine, install DeepSeekX through a DeepSeekX-owned
distribution channel, then run:

```sh
$HOME/.deepseekx/packages/standalone/current/deepseekx app-server daemon bootstrap --remote-control
```

`bootstrap` requires the standalone managed DeepSeekX install. It records the
daemon settings under `DEEPSEEKX_HOME/app-server-daemon/` and starts
app-server as a pidfile-backed detached process. Auto update is disabled until
a DeepSeekX-owned updater exists; the daemon refuses to run the OpenAI Codex
installer.

## Installation and update cases

The daemon launches the standalone managed binary under `DEEPSEEKX_HOME`.
It never fetches or runs the OpenAI Codex installer.

| Situation | What starts | Does this daemon fetch new binaries? | Does a running app-server eventually move to a newer binary on its own? |
| --- | --- | --- | --- |
| Managed DeepSeekX install exists, but only `start` is used | `start` uses `DEEPSEEKX_HOME/packages/standalone/current/deepseekx` | No | No. The managed path is used when starting or restarting. |
| Managed DeepSeekX install exists, then `bootstrap` is used | The pidfile backend uses `DEEPSEEKX_HOME/packages/standalone/current/deepseekx` | No | No. Bootstrap persists settings and starts app-server, but reports `autoUpdateEnabled: false`. |
| Some other tool updates the managed binary path | The next fresh start or restart uses the updated file at that path | No | No. A currently running app-server remains on the old executable image until an explicit `restart`. |

### Standalone installs

For standalone DeepSeekX installs:

- lifecycle commands always use the standalone managed binary path
- `bootstrap` is supported
- `bootstrap` does not start an updater
- `autoUpdateEnabled` is always `false` until a DeepSeekX updater is added

### Out-of-band updates

This daemon does not watch arbitrary executable files for replacement. If some
other tool updates the managed binary path:

a currently running app-server remains on the old executable image until an
explicit `restart`.

## Lifecycle semantics

`start` is idempotent and returns after app-server is ready to answer the normal
JSON-RPC initialize handshake on the Unix control socket.

`restart` stops any managed daemon and starts it again.

`enable-remote-control` and `disable-remote-control` persist the launch setting
for future starts. If a managed app-server is already running, they restart it
so the new setting takes effect immediately.

Top-level `deepseekx remote-control` bootstraps with `--remote-control` when
daemon settings are missing. Otherwise it enables remote control and starts the
daemon normally.

`stop` sends a graceful termination request first, then sends a second
termination signal after the grace window if the process is still alive.

All mutating lifecycle commands are serialized per `DEEPSEEKX_HOME`, so a concurrent
`start`, `restart`, `enable-remote-control`, `disable-remote-control`, `stop`,
or `bootstrap` does not race another in-flight lifecycle operation.

## State

The daemon stores its local state under `DEEPSEEKX_HOME/app-server-daemon/`:

- `settings.json` for persisted launch settings
- `app-server.pid` for the app-server process record
- `daemon.lock` for daemon-wide lifecycle serialization
