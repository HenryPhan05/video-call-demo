# Socket.IO events

The client connects with cookies (`withCredentials: true`). The server validates the JWT during the Socket.IO handshake and joins the user to each `conversation:{id}` room.

| Event         | Direction     | Payload                          |
| ------------- | ------------- | -------------------------------- |
| `message:new` | server → room | Message object after persistence |

WebRTC signaling extends this same authenticated room with `call:offer`, `call:answer`, and `call:ice-candidate`; media travels directly between peers (or via TURN), never through Socket.IO.
