# speedtest for web download/upload in gigabit bandwidth

## Installation

```sh
npm install -g speedtest-gigabit-web
```

## Stupid Example

```sh
speedtest-gigabit-server &
speedtest-gigabit-client download http://localhost:8765/
speedtest-gigabit-client upload http://localhost:8765/
speedtest-gigabit-client websocket_upload http://localhost:8765/
```

OR open http://localhost:8765/ in browser. (upload is slower)
