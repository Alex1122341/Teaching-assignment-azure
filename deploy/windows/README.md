# PAWS University Windows Service Packaging (inactive design)

This directory documents a future service package only. Nothing here installs a wrapper, changes the registered PAWSApi binary path, enables the service, or starts it.

## Runtime

- Entry point: `server/src/runtime/university-api.js`
- Node.js: 22.x
- Listener: `127.0.0.1:8787` by default; the runtime rejects non-loopback hosts.
- SQL uses the existing `createSwaSqlRuntime` with `msnodesqlv8`, Windows integrated authentication, encryption enabled, and `TrustServerCertificate=False`.
- Firebase token verification remains inside the existing runtime.
- Request bodies are limited to 64 KiB by default and at most 1 MiB by configuration.
- CORS uses exact origins from `PAWS_API_ALLOWED_ORIGINS`. An unset value permits no cross-origin browser requests.
- Shutdown drains HTTP connections, then closes the SQL pool.

## Future wrapper configuration

Use an organization-approved, signed Windows service wrapper (for example, a vetted WinSW package) alongside the deployed Node 22 runtime. The wrapper must run the entry point with working directory set to the repository's `server` folder, forward stop signals, capture bounded rotating logs, and use the existing virtual service identity `NT SERVICE\PAWSApi`.

Required environment values must be provisioned through the organization's machine/service secret-management process. Do not put Firebase service-account keys or any other secret in this repository or wrapper XML. The SQL endpoint contains no SQL password; authentication is the PAWSApi Windows service identity.

The SQL login handoff is separate: `C:\PAWS\Migration\Evidence\create-pawsapi-login.sql` creates only the Windows login, and `provision-paws-runtime.sql` grants the reviewed database contract after that login exists. Neither script is run by the service package.

## Current server state

ITAPPVETOPSDB01 has a PAWSApi service entry registered with `NT SERVICE\PAWSApi`, but it is disabled and stopped. Its current image path is an inert `cmd.exe /c exit 0` placeholder. Do not start or enable it, and do not configure the wrapper until SQL login provisioning, TLS activation/strict validation, and a separately reviewed service activation change are complete.
