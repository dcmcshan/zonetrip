# Zone Trip

Zone Trip is a project site for the working white paper:

**Zone Trip: A Non-Directive Local AI Mirror for Community Self-Understanding**

The site presents the project's core question, constitutional limits, local-first architecture, deployment gates, and collaborator needs.

## Live Site

https://dcmcshan.github.io/zonetrip/

## Source Document

The reviewed PDF is included at:

`docs/Zone_Trip_White_Paper_First_Review.pdf`

## Run Locally

This project has no build step. Open `index.html` in a browser, or serve the folder:

```sh
./bin/zonetrip-serve --host 127.0.0.1 --port 5173 --root .
```

Then open <http://localhost:5173>.

## Standalone Linux Deployment

Zone Trip is structured as a standalone static site with no external runtime assets, no analytics, no API calls, and no cloud dependency.

Build a Linux deployment archive:

```sh
./scripts/package-linux.sh
```

See `DEPLOY.md` for systemd installation and manual run instructions.

## Project Structure

- `index.html` - project site shell and sections
- `styles.css` - responsive visual system
- `script.js` - content data and rendering
- `docs/` - source white paper PDF
- `bin/zonetrip-serve` - local static server
- `deploy/systemd/` - optional systemd unit
- `scripts/` - standalone audit and Linux package scripts

## Product Direction

The next useful step is to turn this static site into a prototype workspace for:

- booth consent copy
- local processing architecture notes
- nightly burn protocol
- steward review checklist
- public reflection examples
