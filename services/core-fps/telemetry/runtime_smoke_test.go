package main

import (
	"context"
	"net/http"
	"os"
	"testing"
	"time"

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

	for {
		messageType, message, err := connection.Read(ctx)
		if err != nil {
			t.Fatalf("wait for lobby connection: %v", err)
		}
		if messageType != websocket.MessageBinary {
			continue
		}
		var response smokeResponseEnvelope
		if err := cbor.Unmarshal(message, &response); err != nil {
			continue
		}
		if response.Op == 1 {
			if response.Server != "lobby" {
				t.Fatalf("connected to %q instead of lobby", response.Server)
			}
			return
		}
	}
}
