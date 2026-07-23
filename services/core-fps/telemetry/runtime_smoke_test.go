package main

import (
	"context"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/cfoust/sour/pkg/game/protocol"
	"github.com/fxamacker/cbor/v2"
	"nhooyr.io/websocket"
)

type smokeConnectMessage struct {
	Op     int
	Target string
}

type smokeResponseEnvelope struct {
	Op     int
	Server string
}

type smokePacketEnvelope struct {
	Op      int
	Channel int
	Data    []byte
}

func TestRuntimeSharedLobby(t *testing.T) {
	target := os.Getenv("CORE_FPS_SMOKE_WS_URL")
	if target == "" {
		t.Skip("CORE_FPS_SMOKE_WS_URL is not set")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	headers := http.Header{}
	if cookie := os.Getenv("CORE_FPS_SMOKE_COOKIE"); cookie != "" {
		headers.Set("Cookie", cookie)
	}
	connection, response, err := websocket.Dial(ctx, target, &websocket.DialOptions{
		HTTPHeader: headers,
	})
	if err != nil {
		if response != nil {
			t.Fatalf("dial runtime: %v (status %d)", err, response.StatusCode)
		}
		t.Fatalf("dial runtime: %v", err)
	}
	defer connection.Close(websocket.StatusNormalClosure, "")

	if _, _, err := connection.Read(ctx); err != nil {
		t.Fatalf("read runtime server list: %v", err)
	}
	request, err := cbor.Marshal(smokeConnectMessage{
		Op:     7,
		Target: "lobby",
	})
	if err != nil {
		t.Fatalf("encode lobby join: %v", err)
	}
	if err := connection.Write(ctx, websocket.MessageBinary, request); err != nil {
		t.Fatalf("send lobby join: %v", err)
	}

	connectSent := false
	mapVoteSent := false
	botSeen := false
	sendPacket := func(messages ...protocol.Message) {
		data, encodeErr := protocol.Encode(messages...)
		if encodeErr != nil {
			t.Fatalf("encode game packet: %v", encodeErr)
		}
		request, marshalErr := cbor.Marshal(smokePacketEnvelope{
			Op:      11,
			Channel: 1,
			Data:    data,
		})
		if marshalErr != nil {
			t.Fatalf("encode game packet: %v", marshalErr)
		}
		if err := connection.Write(ctx, websocket.MessageBinary, request); err != nil {
			t.Fatalf("send game packet: %v", err)
		}
	}
	sendGameJoin := func() {
		sendPacket(protocol.Connect{
			Name:  "SmokePlayer",
			Model: 0,
		})
		connectSent = true
	}

	for {
		messageType, message, err := connection.Read(ctx)
		if err != nil {
			t.Fatalf("wait for lobby connection: %v", err)
		}
		if messageType != websocket.MessageBinary {
			continue
		}
		var response smokeResponseEnvelope
		if err := cbor.Unmarshal(message, &response); err == nil && response.Op == 1 {
			if response.Server == "" {
				t.Fatal("runtime returned an empty lobby server identifier")
			}
			if !connectSent {
				sendGameJoin()
			}
		}

		var packet smokePacketEnvelope
		if err := cbor.Unmarshal(message, &packet); err != nil || packet.Op != 11 {
			continue
		}
		messages, err := protocol.Decode(packet.Data, false)
		if err != nil {
			continue
		}
		for _, gameMessage := range messages {
			if serverMessage, ok := gameMessage.(protocol.ServerMessage); ok {
				if botSeen && serverMessage.Text == "Bouncecore selected dust2 for this lobby" {
					return
				}
			}
			if bot, ok := gameMessage.(protocol.InitAI); ok {
				if bot.Name != "Bounce Bot" || bot.Aitype != 1 || bot.Aiskill < 1 {
					t.Fatalf("invalid solo bot initialization: %#v", bot)
				}
				botSeen = true
				if !mapVoteSent {
					sendPacket(protocol.MapVote{
						Map:  "dust2",
						Mode: 0,
					})
					mapVoteSent = true
				}
			}
			if mapChange, ok := gameMessage.(protocol.MapChange); ok && mapVoteSent {
				if mapChange.Name != "dust2" {
					t.Fatalf("runtime selected %q instead of lobby map dust2", mapChange.Name)
				}
				if !botSeen {
					t.Fatal("map changed before the solo bot was initialized")
				}
				return
			}
		}
	}
}
