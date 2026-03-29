package integration

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/raznak/abbado/internal/database"
	"github.com/raznak/abbado/internal/server"
)

func setupTestServer(t *testing.T) *httptest.Server {
	t.Helper()
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "test.db")
	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("Failed to open test DB: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	handler := server.New(db, "0")
	return httptest.NewServer(handler)
}

func TestHealthEndpoint(t *testing.T) {
	ts := setupTestServer(t)
	defer ts.Close()

	resp, err := http.Get(ts.URL + "/api/health")
	if err != nil {
		t.Fatalf("GET /api/health failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Status = %d, want %d", resp.StatusCode, http.StatusOK)
	}

	var body map[string]string
	json.NewDecoder(resp.Body).Decode(&body)
	if body["status"] != "ok" {
		t.Errorf("status = %q, want %q", body["status"], "ok")
	}
}

func TestAgentEndpoints(t *testing.T) {
	ts := setupTestServer(t)
	defer ts.Close()

	// List (empty)
	resp, _ := http.Get(ts.URL + "/api/agents")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("GET /api/agents: status = %d", resp.StatusCode)
	}

	// Create
	body := `{"name":"Test Agent","cli_name":"claude-code","model":"claude-sonnet-4-6"}`
	resp, _ = http.Post(ts.URL+"/api/agents", "application/json", bytes.NewBufferString(body))
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("POST /api/agents: status = %d", resp.StatusCode)
	}

	var agent map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&agent)
	agentID := agent["id"].(string)

	if agent["name"] != "Test Agent" {
		t.Errorf("name = %v, want Test Agent", agent["name"])
	}

	// List (1 agent)
	resp, _ = http.Get(ts.URL + "/api/agents")
	var agents []map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&agents)
	if len(agents) != 1 {
		t.Errorf("List returned %d agents, want 1", len(agents))
	}

	// Delete
	req, _ := http.NewRequest(http.MethodDelete, ts.URL+"/api/agents/"+agentID, nil)
	resp, _ = http.DefaultClient.Do(req)
	if resp.StatusCode != http.StatusNoContent {
		t.Errorf("DELETE /api/agents/%s: status = %d", agentID, resp.StatusCode)
	}
}

func TestAgentCreateValidation(t *testing.T) {
	ts := setupTestServer(t)
	defer ts.Close()

	// Empty name
	body := `{"name":"","cli_name":"claude-code"}`
	resp, _ := http.Post(ts.URL+"/api/agents", "application/json", bytes.NewBufferString(body))
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("POST with empty name: status = %d, want %d", resp.StatusCode, http.StatusBadRequest)
	}

	// Invalid JSON
	resp, _ = http.Post(ts.URL+"/api/agents", "application/json", bytes.NewBufferString("not json"))
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("POST with invalid JSON: status = %d, want %d", resp.StatusCode, http.StatusBadRequest)
	}
}

func TestFilesystemDirs(t *testing.T) {
	ts := setupTestServer(t)
	defer ts.Close()

	resp, err := http.Get(ts.URL + "/api/filesystem/dirs?path=/tmp")
	if err != nil {
		t.Fatalf("GET /api/filesystem/dirs failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("Status = %d, want %d", resp.StatusCode, http.StatusOK)
	}
}
