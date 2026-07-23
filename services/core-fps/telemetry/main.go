package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/cfoust/sour/pkg/game/protocol"
	"github.com/fxamacker/cbor/v2"
	"nhooyr.io/websocket"
)

const (
	packetOp            = 11
	maxWebSocketMessage = 64 << 20
)

type packetEnvelope struct {
	Op      int
	Channel int
	Data    []byte
}

type telemetryPayload struct {
	Damage    int    `json:"damage"`
	Deaths    int    `json:"deaths"`
	Flags     int    `json:"flags"`
	Frags     int    `json:"frags"`
	MapName   string `json:"mapName,omitempty"`
	ModeName  string `json:"modeName,omitempty"`
	Observed  string `json:"observedAt"`
	SessionID string `json:"sessionId"`
	Status    string `json:"status"`
	TeamKills int    `json:"teamKills"`
	UserID    string `json:"userId"`
}

type tracker struct {
	closed       bool
	damage       int
	deaths       int
	flags        int
	frags        int
	httpClient   *http.Client
	mapName      string
	modeName     string
	mu           sync.Mutex
	ownClient    int32
	pending      bool
	playerName   string
	postMu       sync.Mutex
	sessionID    string
	teams        map[int32]string
	teamKills    int
	telemetryURL string
	telemetryKey string
	userID       string
}

func requiredEnv(name string) string {
	value := strings.TrimSpace(os.Getenv(name))
	if value == "" {
		log.Fatalf("%s is required", name)
	}
	return value
}

func gameModeName(mode int32) string {
	names := map[int32]string{
		0:  "FFA",
		1:  "Co-op edit",
		2:  "Team play",
		3:  "Instagib",
		4:  "Instagib team",
		5:  "Efficiency",
		6:  "Efficiency team",
		7:  "Tactics",
		8:  "Tactics team",
		9:  "Capture",
		10: "Regen capture",
		11: "CTF",
		12: "Instagib CTF",
		13: "Protect",
		14: "Instagib protect",
		15: "Hold",
		16: "Instagib hold",
		17: "Collect",
		18: "Instagib collect",
	}
	if name, ok := names[mode]; ok {
		return name
	}
	return "Mode " + strconv.Itoa(int(mode))
}

func nonNegative(value int32) int {
	if value < 0 {
		return 0
	}
	return int(value)
}

func (t *tracker) snapshot(status string) telemetryPayload {
	t.mu.Lock()
	defer t.mu.Unlock()
	return telemetryPayload{
		Damage:    t.damage,
		Deaths:    t.deaths,
		Flags:     t.flags,
		Frags:     t.frags,
		MapName:   t.mapName,
		ModeName:  t.modeName,
		Observed:  time.Now().UTC().Format(time.RFC3339Nano),
		SessionID: t.sessionID,
		Status:    status,
		TeamKills: t.teamKills,
		UserID:    t.userID,
	}
}

func (t *tracker) post(ctx context.Context, status string) {
	t.postMu.Lock()
	defer t.postMu.Unlock()
	payload, err := json.Marshal(t.snapshot(status))
	if err != nil {
		return
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, t.telemetryURL, bytes.NewReader(payload))
	if err != nil {
		return
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Core-Telemetry-Secret", t.telemetryKey)
	response, err := t.httpClient.Do(request)
	if err != nil {
		log.Printf("score telemetry failed for session %s: %v", t.sessionID, err)
		return
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		log.Printf("score telemetry rejected for session %s with status %d", t.sessionID, response.StatusCode)
	}
}

func (t *tracker) schedule() {
	t.mu.Lock()
	if t.closed || t.pending {
		t.mu.Unlock()
		return
	}
	t.pending = true
	t.mu.Unlock()

	time.AfterFunc(750*time.Millisecond, func() {
		t.mu.Lock()
		if t.closed {
			t.pending = false
			t.mu.Unlock()
			return
		}
		t.pending = false
		t.mu.Unlock()
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		t.post(ctx, "active")
	})
}

func (t *tracker) close() {
	t.mu.Lock()
	t.closed = true
	t.pending = false
	t.mu.Unlock()
}

func (t *tracker) observe(frame []byte) {
	var envelope packetEnvelope
	if err := cbor.Unmarshal(frame, &envelope); err != nil || envelope.Op != packetOp || envelope.Channel != 1 {
		return
	}
	messages, err := protocol.Decode(envelope.Data, false)
	if err != nil {
		return
	}

	changed := false
	t.mu.Lock()
	for _, raw := range messages {
		switch message := raw.(type) {
		case protocol.ServerInfo:
			t.ownClient = message.Client
			changed = true
		case protocol.InitClient:
			t.teams[message.Client] = message.Team
		case protocol.SetTeam:
			t.teams[message.Client] = message.Team
		case protocol.MapChange:
			t.damage = 0
			t.deaths = 0
			t.flags = 0
			t.frags = 0
			t.mapName = message.Name
			t.modeName = gameModeName(message.Mode)
			t.teamKills = 0
			changed = true
		case protocol.Resume:
			for _, client := range message.Clients {
				if client.Id != t.ownClient {
					continue
				}
				t.deaths = nonNegative(client.Deaths)
				t.flags = nonNegative(client.Flags)
				t.frags = nonNegative(client.Frags)
				changed = true
			}
		case protocol.Damage:
			if message.Aggressor == t.ownClient && message.Client != t.ownClient {
				t.damage += nonNegative(message.Damage)
				changed = true
			}
		case protocol.Died:
			if message.Killer == t.ownClient && message.Client != message.Killer {
				killerTeam := t.teams[message.Killer]
				victimTeam := t.teams[message.Client]
				if killerTeam != "" && killerTeam == victimTeam {
					t.teamKills++
				} else {
					t.frags++
				}
				changed = true
			}
			if message.Client == t.ownClient {
				t.deaths++
				changed = true
			}
		case protocol.ScoreFlag:
			if message.Client == t.ownClient {
				t.flags = nonNegative(message.Oflags)
				changed = true
			}
		case protocol.ClientDisconnected:
			delete(t.teams, message.Client)
		}
	}
	t.mu.Unlock()
	if changed {
		t.schedule()
	}
}

type server struct {
	telemetryKey string
	telemetryURL string
	upstreamURL  string
}

func copyWebSocket(ctx context.Context, destination, source *websocket.Conn, inspect func([]byte)) error {
	for {
		messageType, message, err := source.Read(ctx)
		if err != nil {
			return err
		}
		if inspect != nil && messageType == websocket.MessageBinary {
			inspect(message)
		}
		if err := destination.Write(ctx, messageType, message); err != nil {
			return err
		}
	}
}

func (s *server) serveWebSocket(w http.ResponseWriter, r *http.Request) {
	userID := strings.TrimSpace(r.Header.Get("X-Core-User-Id"))
	sessionID := strings.TrimSpace(r.Header.Get("X-Core-Session-Id"))
	playerName := strings.TrimSpace(r.Header.Get("X-Core-Player-Name"))
	if userID == "" || sessionID == "" || playerName == "" {
		http.Error(w, "missing verified Core identity", http.StatusUnauthorized)
		return
	}

	upstream, _, err := websocket.Dial(r.Context(), s.upstreamURL, nil)
	if err != nil {
		http.Error(w, "game runtime unavailable", http.StatusBadGateway)
		return
	}
	defer upstream.Close(websocket.StatusNormalClosure, "")

	client, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		CompressionMode: websocket.CompressionDisabled,
		OriginPatterns:  []string{"*"},
	})
	if err != nil {
		return
	}
	defer client.Close(websocket.StatusNormalClosure, "")
	client.SetReadLimit(maxWebSocketMessage)
	upstream.SetReadLimit(maxWebSocketMessage)

	gameTracker := &tracker{
		httpClient:   &http.Client{Timeout: 5 * time.Second},
		ownClient:    -1,
		playerName:   playerName,
		sessionID:    sessionID,
		teams:        make(map[int32]string),
		telemetryKey: s.telemetryKey,
		telemetryURL: s.telemetryURL,
		userID:       userID,
	}
	defer func() {
		gameTracker.close()
		finishedCtx, finishedCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer finishedCancel()
		gameTracker.post(finishedCtx, "disconnected")
	}()
	connectedCtx, connectedCancel := context.WithTimeout(context.Background(), 5*time.Second)
	gameTracker.post(connectedCtx, "connected")
	connectedCancel()

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()
	errorsChannel := make(chan error, 2)
	go func() {
		errorsChannel <- copyWebSocket(ctx, upstream, client, nil)
	}()
	go func() {
		errorsChannel <- copyWebSocket(ctx, client, upstream, gameTracker.observe)
	}()

	heartbeat := time.NewTicker(20 * time.Second)
	defer heartbeat.Stop()
	for {
		select {
		case err := <-errorsChannel:
			if err != nil && !errors.Is(err, context.Canceled) && websocket.CloseStatus(err) == -1 {
				log.Printf("game websocket ended for session %s: %v", sessionID, err)
			}
			cancel()
			return
		case <-heartbeat.C:
			heartbeatCtx, heartbeatCancel := context.WithTimeout(context.Background(), 5*time.Second)
			gameTracker.post(heartbeatCtx, "active")
			heartbeatCancel()
		case <-ctx.Done():
			return
		}
	}
}

func main() {
	listenAddress := strings.TrimSpace(os.Getenv("CORE_FPS_TELEMETRY_LISTEN"))
	if listenAddress == "" {
		listenAddress = "0.0.0.0:1338"
	}
	service := &server{
		telemetryKey: requiredEnv("CORE_FPS_TELEMETRY_SECRET"),
		telemetryURL: requiredEnv("CORE_FPS_TELEMETRY_URL"),
		upstreamURL:  requiredEnv("CORE_FPS_RUNTIME_WS_URL"),
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		fmt.Fprintln(w, "ok")
	})
	mux.HandleFunc("/ws/", service.serveWebSocket)

	httpServer := &http.Server{
		Addr:              listenAddress,
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
	}
	log.Printf("Core FPS telemetry relay listening on %s", listenAddress)
	if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}
