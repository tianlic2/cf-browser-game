# Public friend-room server

Run locally with `npm run multiplayer:server`. The browser connects to
`ws://127.0.0.1:8787/ws` by default. For public play, deploy this directory with
the root `render.yaml`, then paste the resulting `wss://<host>/ws` address into
the lobby's **公网 1V1** panel.

The server owns room membership, hit tests, health, score, spawn protection and
three-second respawns. The first release intentionally supports two players on
Transport Ship so networking behaviour can be verified before larger rooms and
additional maps are enabled.
