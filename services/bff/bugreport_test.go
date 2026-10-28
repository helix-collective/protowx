package main

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestSlug(t *testing.T) {
	var cases = map[string]string{
		"The save button does nothing": "the-save-button-does-nothing",
		"  ../../etc/passwd  ":         "etc-passwd",
		"a\x00b/c.d":                   "a-b-c-d",
		"":                             "bug",
		"!!!":                          "bug",
		strings.Repeat("ab ", 30):      "ab-ab-ab-ab-ab-ab-ab-ab-ab-ab-ab-ab-ab-a",
	}
	for title, want := range cases {
		if got := slug(title); got != want {
			t.Errorf("slug(%q) = %q, want %q", title, got, want)
		}
	}
}

func TestReportFileName(t *testing.T) {
	var (
		now   = time.Date(2026, 10, 28, 17, 5, 0, 0, time.UTC)
		taken = map[string]bool{
			"20261028-1705__save.md":   true,
			"20261028-1705__save-2.md": true,
		}
		got = reportFileName("Save", now, ".md", func(n string) bool { return taken[n] })
	)
	if got != "20261028-1705__save-3.md" {
		t.Fatalf("reportFileName = %q", got)
	}
}

// postTo answers the status and the decoded path of a POST.
func postTo(t *testing.T, url string, body []byte) (int, string) {
	t.Helper()
	var (
		res   *http.Response
		read  []byte
		saved bugReportSaved
		err   error
	)
	if res, err = http.Post(url, "application/octet-stream", bytes.NewReader(body)); err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if read, err = io.ReadAll(res.Body); err != nil {
		t.Fatal(err)
	}
	if res.StatusCode == http.StatusCreated {
		if err = json.Unmarshal(read, &saved); err != nil {
			t.Fatal(err)
		}
	}
	return res.StatusCode, saved.Path
}

// TestBugReport_Writes: a report lands under --bugs with its
// screenshot and its narration.
func TestBugReport_Writes(t *testing.T) {
	var (
		c      = testCmd(t)
		srv    = serve(t, c)
		png    = append([]byte("\x89PNG\r\n\x1a\n"), "the pixels"...)
		wav    = []byte("RIFF\x04\x00\x00\x00WAVEdata")
		report []byte
		status int
		shot   string
		voice  string
		path   string
		files  []os.DirEntry
		data   []byte
		err    error
	)
	if status, shot = postTo(t, srv.URL+"/api/bugreport/screenshot?title=Save+fails", png); status != http.StatusCreated {
		t.Fatalf("screenshot = %d", status)
	}
	if status, voice = postTo(t, srv.URL+"/api/bugreport/audio?title=Save+fails", wav); status != http.StatusCreated {
		t.Fatalf("audio = %d", status)
	}
	if report, err = json.Marshal(bugReport{
		Title:    "Save fails",
		Markdown: "# Save fails\n\n![shot](" + filepath.Base(shot) + ")\n",
	}); err != nil {
		t.Fatal(err)
	}
	if status, path = postTo(t, srv.URL+"/api/bugreport", report); status != http.StatusCreated {
		t.Fatalf("report = %d", status)
	}
	if !strings.HasSuffix(path, "__save-fails.md") || !strings.HasSuffix(shot, "__save-fails.png") || !strings.HasSuffix(voice, "__save-fails.wav") {
		t.Fatalf("paths = %q, %q, %q", path, shot, voice)
	}
	if files, err = os.ReadDir(c.Bugs); err != nil || len(files) != 3 {
		t.Fatalf("--bugs holds %v, %v; want three files", files, err)
	}
	if data, err = os.ReadFile(filepath.Join(c.Bugs, filepath.Base(path))); err != nil || !strings.Contains(string(data), filepath.Base(shot)) {
		t.Fatalf("the report = %q, %v", data, err)
	}
	if data, err = os.ReadFile(filepath.Join(c.Bugs, filepath.Base(shot))); err != nil || !bytes.Equal(data, png) {
		t.Fatalf("the screenshot = %q, %v", data, err)
	}
}

// TestBugReport_Refuses: a request that is not a report, a screenshot
// or a narration writes nothing.
func TestBugReport_Refuses(t *testing.T) {
	var (
		c     = testCmd(t)
		srv   = serve(t, c)
		cases = []struct {
			path string
			body string
			want int
		}{
			{
				path: "/api/bugreport",
				body: "not json",
				want: http.StatusBadRequest,
			},
			{
				path: "/api/bugreport",
				body: `{"title": "t", "markdown": "  "}`,
				want: http.StatusBadRequest,
			},
			{
				path: "/api/bugreport/screenshot",
				body: "GIF89a",
				want: http.StatusBadRequest,
			},
			{
				path: "/api/bugreport/audio",
				body: "RIFF....AVI ",
				want: http.StatusBadRequest,
			},
		}
		status int
		err    error
	)
	for _, c := range cases {
		if status, _ = postTo(t, srv.URL+c.path, []byte(c.body)); status != c.want {
			t.Errorf("POST %s %q = %d, want %d", c.path, c.body, status, c.want)
		}
	}
	if status, _ = get(t, srv.URL+"/api/bugreport"); status != http.StatusMethodNotAllowed {
		t.Errorf("GET /api/bugreport = %d, want 405", status)
	}
	if _, err = os.Stat(c.Bugs); err == nil {
		t.Fatal("a refused request made the directory")
	}
}

func TestShownPath(t *testing.T) {
	var (
		repo = t.TempDir()
		err  error
	)
	if err = os.Mkdir(filepath.Join(repo, ".git"), 0o755); err != nil {
		t.Fatal(err)
	}
	if got := shownPath(filepath.Join(repo, ".bugreports", "r.md")); got != ".bugreports/r.md" {
		t.Fatalf("shownPath = %q", got)
	}
}
