package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func newMux() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(map[string]string{
			"status":  "ok",
			"service": "tracker",
		}); err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
		}
	})
	return mux
}

func TestHealthEndpoint(t *testing.T) {
	srv := httptest.NewServer(newMux())
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/health")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.StatusCode)
	}

	var body map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if body["status"] != "ok" {
		t.Errorf("expected status 'ok', got %q", body["status"])
	}
	if body["service"] != "tracker" {
		t.Errorf("expected service 'tracker', got %q", body["service"])
	}
}

func TestUnknownPathReturns404(t *testing.T) {
	srv := httptest.NewServer(newMux())
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/unknown")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d", resp.StatusCode)
	}
}
