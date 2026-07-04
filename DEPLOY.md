# Linux Deployment

Zone Trip is designed to run as a standalone static site. The runtime site has no external scripts, fonts, images, analytics, API calls, CDN dependencies, or cloud processing.

## Runtime Boundary

- Static files only: `index.html`, `styles.css`, `script.js`, `docs/`, `.nojekyll`
- Local server only: `bin/zonetrip-serve`
- Default bind address: `127.0.0.1`
- Default port: `8080`
- No participant data capture
- No telemetry
- No external network requests from the page

## Package

From the repository root:

```sh
./scripts/package-linux.sh
```

This writes a standalone archive under `dist/`.

## Install On Linux

Copy the generated archive to the Linux host, then:

```sh
tar -xzf zonetrip-standalone-*.tar.gz
cd zonetrip-standalone-*
sudo ./install.sh
```

On a systemd host, this installs to `/opt/zonetrip`, creates a `zonetrip` system user if needed, enables `zonetrip.service`, and serves the site locally at:

```text
http://127.0.0.1:8080/
```

Place nginx, Caddy, Apache, or a local network reverse proxy in front of that loopback service if the site should be exposed beyond the machine.

## Manual Run

```sh
./bin/zonetrip-serve --host 127.0.0.1 --port 8080 --root .
```

Use `--host 0.0.0.0` only when the deployment boundary explicitly allows LAN exposure.

## Standalone Audit

Run this before packaging or deployment:

```sh
./scripts/audit-standalone.sh
```

The audit fails if runtime files contain external URL references, common browser network APIs, or missing required local files.

## One-Box AI Booth

For the full local booth, the same Linux box also runs the processor:

- Zone Trip UI: `http://127.0.0.1:8080/`
- Zone Trip processor: `http://127.0.0.1:8090/`
- Ollama: `http://127.0.0.1:11434/`

After `sudo ./install.sh`, run:

```sh
sudo ./scripts/install-local-ai.sh
```

See `PROCESSOR.md`.
