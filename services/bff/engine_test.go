package main

import (
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

// post answers the status and the body of a POST to /api/calc.
func post(t *testing.T, srv *httptest.Server, body string) (int, string) {
	t.Helper()
	var (
		res  *http.Response
		read []byte
		err  error
	)
	if res, err = http.Post(srv.URL+"/api/calc", "application/json", strings.NewReader(body)); err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if read, err = io.ReadAll(res.Body); err != nil {
		t.Fatal(err)
	}
	return res.StatusCode, string(read)
}

func TestEngine_Evaluate(t *testing.T) {
	var (
		srv          = serve(t, testCmd(t))
		status, body = post(t, srv, `{"evaluate": {"text": "(x + 3) * y", "bindings": [{"name": "x", "value": 5}, {"name": "y", "value": 1}]}}`)
	)
	if status != http.StatusOK || body != `{"evaluated":{"value":8,"printed":"((x + 3) * y)"}}` {
		t.Fatalf("evaluate = %d %s", status, body)
	}
}

// TestEngine_ErrorIs200: an engine error is the protocol's error
// branch, with a 200.
func TestEngine_ErrorIs200(t *testing.T) {
	var (
		srv          = serve(t, testCmd(t))
		status, body = post(t, srv, `{"evaluate": {"text": "10 / 0", "bindings": []}}`)
	)
	if status != http.StatusOK || body != `{"error":{"message":"division by zero: 10 / 0","at":{"nothing":null}}}` {
		t.Fatalf("evaluate = %d %s", status, body)
	}
}

// TestEngine_Transport: only a transport failure is not a 200.
func TestEngine_Transport(t *testing.T) {
	var (
		srv    = serve(t, testCmd(t))
		status int
	)
	if status, _ = get(t, srv.URL+"/api/calc"); status != http.StatusMethodNotAllowed {
		t.Fatalf("GET /api/calc = %d, want 405", status)
	}
	if status, _ = post(t, srv, strings.Repeat(" ", maxRequestBytes+1)); status != http.StatusRequestEntityTooLarge {
		t.Fatalf("a large body = %d, want 413", status)
	}
}

// TestEngine_PutPersists: a put reaches the file, and a second bff on
// the same file reads it back.
func TestEngine_PutPersists(t *testing.T) {
	var (
		c            = testCmd(t)
		first        = serve(t, c)
		status, body = post(t, first, `{"put": {"id": "", "name": "kept", "text": "6 * 7"}}`)
		data         []byte
		second       *httptest.Server
		err          error
	)
	if status != http.StatusOK || !strings.Contains(body, `"id":"4"`) {
		t.Fatalf("put = %d %s", status, body)
	}
	if data, err = os.ReadFile(c.Store); err != nil {
		t.Fatalf("the put did not reach the file: %v", err)
	}
	if !strings.Contains(string(data), `"text": "6 * 7"`) {
		t.Fatalf("the file = %s", data)
	}
	second = serve(t, c)
	if status, body = post(t, second, `{"get": "4"}`); status != http.StatusOK || !strings.Contains(body, `"name":"kept"`) {
		t.Fatalf("get 4 from a second bff = %d %s", status, body)
	}
	if status, body = post(t, second, `{"delete": "1"}`); body != `{"deleted":"1"}` {
		t.Fatalf("delete 1 = %d %s", status, body)
	}
	if data, err = os.ReadFile(c.Store); err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(data), `"id": "1"`) {
		t.Fatalf("the delete did not reach the file: %s", data)
	}
}
