package main

import (
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// distDir is a page's dist/ with an index.html and nothing else.
func distDir(t *testing.T) string {
	t.Helper()
	var (
		dir = t.TempDir()
		err error
	)
	if err = os.WriteFile(filepath.Join(dir, indexFile), []byte("<!doctype html><title>calc</title>"), 0o644); err != nil {
		t.Fatal(err)
	}
	return dir
}

// testCmd is bff's flags over temporary directories.
func testCmd(t *testing.T) *rootCmd {
	t.Helper()
	var c = newRootCmd()
	c.Dir = distDir(t)
	c.Store = filepath.Join(t.TempDir(), "calculations.json")
	c.Bugs = filepath.Join(t.TempDir(), ".bugreports")
	return c
}

// serve starts an httptest server over the whole mux of c.
func serve(t *testing.T, c *rootCmd) *httptest.Server {
	t.Helper()
	var (
		h        http.Handler
		closeAPI func() error
		srv      *httptest.Server
		err      error
	)
	if h, closeAPI, err = c.handler(t.Context(), log.New(io.Discard, "", 0)); err != nil {
		t.Fatal(err)
	}
	srv = httptest.NewServer(h)
	t.Cleanup(func() {
		srv.Close()
		_ = closeAPI()
	})
	return srv
}

// get answers the status and the body of a GET.
func get(t *testing.T, url string) (int, string) {
	t.Helper()
	var (
		res  *http.Response
		body []byte
		err  error
	)
	if res, err = http.Get(url); err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if body, err = io.ReadAll(res.Body); err != nil {
		t.Fatal(err)
	}
	return res.StatusCode, string(body)
}

// TestHandler_Serves: the page, its fallback, the health route and the
// config.
func TestHandler_Serves(t *testing.T) {
	var (
		c   = testCmd(t)
		srv *httptest.Server
	)
	c.MywURL = "http://127.0.0.1:8090/"
	srv = serve(t, c)
	for _, path := range []string{"/", "/a/route/of/the/page"} {
		if status, body := get(t, srv.URL+path); status != http.StatusOK || !strings.Contains(body, "<title>calc</title>") {
			t.Fatalf("GET %s = %d %q", path, status, body)
		}
	}
	if status, body := get(t, srv.URL+"/healthz"); status != http.StatusOK || body != "ok\n" {
		t.Fatalf("GET /healthz = %d %q", status, body)
	}
	if status, body := get(t, srv.URL+"/api/config"); status != http.StatusOK || body != `{"myw":"http://127.0.0.1:8090","bugs":true,"api":true}` {
		t.Fatalf("GET /api/config = %d %s", status, body)
	}
}

// TestHandler_Off: --api=false and --bugs= turn their routes off, and
// the config says so.
func TestHandler_Off(t *testing.T) {
	var (
		c   = testCmd(t)
		srv *httptest.Server
		res *http.Response
		err error
	)
	c.API = false
	c.Bugs = ""
	srv = serve(t, c)
	if status, body := get(t, srv.URL+"/api/config"); status != http.StatusOK || body != `{"myw":"","bugs":false,"api":false}` {
		t.Fatalf("GET /api/config = %d %s", status, body)
	}
	if res, err = http.Post(srv.URL+"/api/calc", "application/json", strings.NewReader(`{"list": null}`)); err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusNotFound {
		t.Fatalf("POST /api/calc with --api=false = %d, want 404", res.StatusCode)
	}
	if status, _ := get(t, srv.URL+"/api/bugreport"); status != http.StatusNotFound {
		t.Fatalf("GET /api/bugreport with --bugs= = %d, want 404", status)
	}
	if _, err = os.Stat(c.Store); err == nil {
		t.Fatal("--api=false wrote the store")
	}
}

func TestHandler_MissingDir(t *testing.T) {
	var (
		c   = testCmd(t)
		err error
	)
	c.Dir = filepath.Join(t.TempDir(), "nothing")
	if _, _, err = c.handler(t.Context(), log.New(io.Discard, "", 0)); err == nil || !strings.Contains(err.Error(), "task web:build") {
		t.Fatalf("handler over a missing dir = %v", err)
	}
}
