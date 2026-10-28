package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// maxReportBytes caps a report. A report carries the store at the start
// of the recording and each message after it, so it is larger than an
// engine request.
const maxReportBytes = 8 << 20 // 8 MiB

// bugReportHandler serves POST /api/bugreport: the page's feedback
// report in, a Markdown file under dir out, and the file's path back.
// docs/features/001-calculator/prd.md section 6.
//
// It is plain JSON through encoding/json, not a protocol value: the
// engine never sees a report, and the rule against encoding/json is
// about ADL values.
//
// The server chooses the name. Nothing the client sends is used as a
// path: the title reaches the file name through slug, which keeps
// [a-z0-9-] and nothing else. That rule, and loopback, are what make a
// route that writes files safe to serve.
type bugReportHandler struct {
	dir string
	now func() time.Time
	// mu makes choosing a free name and creating the file one step, so
	// two reports in the same minute with the same title get two names.
	mu sync.Mutex
}

func newBugReportHandler(dir string) *bugReportHandler {
	return &bugReportHandler{
		dir: dir,
		now: time.Now,
	}
}

// bugReport is the request body.
type bugReport struct {
	Title    string `json:"title"`
	Markdown string `json:"markdown"`
}

// bugReportSaved is the response body of the routes: the path of the
// file written.
type bugReportSaved struct {
	Path string `json:"path"`
}

// ServeHTTP writes one report on POST. 201 with the path; 405, 413 and
// 400 for a request that is not one, and nothing is written; 500 when
// the file cannot be written.
func (h *bugReportHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	var (
		body   []byte
		tooBig *http.MaxBytesError
		req    bugReport
		path   string
		err    error
	)
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		httpError(w, http.StatusMethodNotAllowed, "the feedback report API takes POST")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxReportBytes)
	if body, err = io.ReadAll(r.Body); err != nil {
		if errors.As(err, &tooBig) {
			httpError(w, http.StatusRequestEntityTooLarge, fmt.Sprintf("request body over %d bytes", maxReportBytes))
			return
		}
		httpError(w, http.StatusBadRequest, "reading the request body: "+err.Error())
		return
	}
	if err = json.Unmarshal(body, &req); err != nil {
		httpError(w, http.StatusBadRequest, "not a feedback report: "+err.Error())
		return
	}
	if strings.TrimSpace(req.Markdown) == "" {
		httpError(w, http.StatusBadRequest, "not a feedback report: the markdown is empty")
		return
	}
	if path, err = h.write(req.Title, ".md", []byte(req.Markdown)); err != nil {
		httpError(w, http.StatusInternalServerError, "writing the feedback report: "+err.Error())
		return
	}
	writeSaved(w, path)
}

// maxScreenshotBytes caps a screenshot. A PNG of a 4K screen can pass
// the report's 8 MiB.
const maxScreenshotBytes = 32 << 20 // 32 MiB

// pngSignature is the first 8 bytes of every PNG file.
var pngSignature = []byte("\x89PNG\r\n\x1a\n")

// screenshots is the handler for POST /api/bugreport/screenshot: one PNG
// in, a file beside the reports out, and its path back. The page posts
// each screenshot before the report, so the report can link to the
// names the server chose. A body that does not start with the PNG
// signature is refused, so the route writes images and nothing else.
func (h *bugReportHandler) screenshots() http.Handler {
	return h.file(fileRoute{
		what:  "screenshot",
		ext:   ".png",
		max:   maxScreenshotBytes,
		valid: func(body []byte) bool { return bytes.HasPrefix(body, pngSignature) },
		form:  "a PNG",
	})
}

// maxAudioBytes caps a narration. The page stops one at 30 minutes,
// about 58 MB of 16 kHz mono 16-bit WAV.
const maxAudioBytes = 64 << 20 // 64 MiB

// isWave reports whether body starts as a RIFF WAVE file does: "RIFF",
// four bytes of length, then "WAVE".
func isWave(body []byte) bool {
	return len(body) >= 12 && string(body[:4]) == "RIFF" && string(body[8:12]) == "WAVE"
}

// audio is the handler for POST /api/bugreport/audio: the narration's
// WAV in, a file beside the reports out, and its path back. The page
// sends it once, at submit, before the report.
func (h *bugReportHandler) audio() http.Handler {
	return h.file(fileRoute{
		what:  "narration",
		ext:   ".wav",
		max:   maxAudioBytes,
		valid: isWave,
		form:  "a RIFF WAVE file",
	})
}

// fileRoute is one route that writes its body as a file beside the
// reports: a screenshot or a narration.
type fileRoute struct {
	// what the file is, for the messages.
	what string
	ext  string
	max  int64
	// valid reports whether the body is the kind of file the route writes.
	valid func([]byte) bool
	// form is what valid checks, for the refusal.
	form string
}

// file is the handler for a fileRoute. The body is the file itself, not
// JSON. The title is the query's "title", and it reaches the file name
// only through slug, as a report's does. 201 with the path; 405, 413 and
// 400 for a request that is not one, and nothing is written.
func (h *bugReportHandler) file(fr fileRoute) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var (
			body   []byte
			tooBig *http.MaxBytesError
			path   string
			err    error
		)
		if r.Method != http.MethodPost {
			w.Header().Set("Allow", http.MethodPost)
			httpError(w, http.StatusMethodNotAllowed, "the "+fr.what+" API takes POST")
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, fr.max)
		if body, err = io.ReadAll(r.Body); err != nil {
			if errors.As(err, &tooBig) {
				httpError(w, http.StatusRequestEntityTooLarge, fmt.Sprintf("request body over %d bytes", fr.max))
				return
			}
			httpError(w, http.StatusBadRequest, "reading the request body: "+err.Error())
			return
		}
		if !fr.valid(body) {
			httpError(w, http.StatusBadRequest, "not a "+fr.what+": the body is not "+fr.form)
			return
		}
		if path, err = h.write(r.URL.Query().Get("title"), fr.ext, body); err != nil {
			httpError(w, http.StatusInternalServerError, "writing the "+fr.what+": "+err.Error())
			return
		}
		writeSaved(w, path)
	})
}

// writeSaved answers 201 with the path of the file a route wrote.
func writeSaved(w http.ResponseWriter, path string) {
	var (
		out []byte
		err error
	)
	if out, err = json.Marshal(bugReportSaved{
		Path: path,
	}); err != nil {
		httpError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusCreated)
	_, _ = w.Write(out)
}

// write creates one file under a free name and answers its path, as
// shownPath spells it.
//
// The directory is made here, on the first write, and not at startup:
// a read-only checkout then serves the page and fails only the save.
func (h *bugReportHandler) write(title, ext string, data []byte) (string, error) {
	var (
		name string
		p    string
		err  error
	)
	h.mu.Lock()
	defer h.mu.Unlock()
	if err = os.MkdirAll(h.dir, 0o755); err != nil {
		return "", err
	}
	name = reportFileName(title, h.now(), ext, func(n string) bool {
		var err error
		_, err = os.Stat(filepath.Join(h.dir, n))
		return err == nil
	})
	p = filepath.Join(h.dir, name)
	if err = createFile(p, data); err != nil {
		return "", err
	}
	return shownPath(p), nil
}

// createFile writes data to a new file at p. O_EXCL as well as the
// lock: a file another process made between the check and the create is
// refused rather than overwritten.
func createFile(p string, data []byte) error {
	var (
		f   *os.File
		err error
	)
	if f, err = os.OpenFile(p, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o644); err != nil {
		return err
	}
	if _, err = f.Write(data); err != nil {
		_ = f.Close()
		return err
	}
	return f.Close()
}

// reportFileName is the file name for a report, a screenshot or a
// narration: the time as YYYYMMDD-HHMM, two underscores, the title as a
// slug, and -2, -3 and so on before ext when exists says the name is
// taken. The page's download uses the same rule, so the two sinks agree
// on a name.
func reportFileName(title string, now time.Time, ext string, exists func(string) bool) string {
	var (
		base = now.Format("20060102-1504") + "__" + slug(title)
		name = base + ext
	)
	for n := 2; exists(name); n++ {
		name = fmt.Sprintf("%s-%d%s", base, n, ext)
	}
	return name
}

// slugMax is the longest a slug may be, so a long title makes a file
// name that still reads in a directory listing.
const slugMax = 40

// slug lower-cases the title, writes each run of anything outside
// [a-z0-9] as one '-', trims the ends, cuts it at slugMax, and answers
// "bug" when nothing is left. Nothing outside [a-z0-9-] survives, which
// is what keeps a separator, a dot or a NUL out of the file name.
func slug(title string) string {
	var (
		b    strings.Builder
		dash bool
		s    string
	)
	for _, c := range strings.ToLower(title) {
		if (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') {
			if dash && b.Len() > 0 {
				b.WriteByte('-')
			}
			dash = false
			b.WriteRune(c)
			continue
		}
		dash = true
	}
	s = b.String()
	if len(s) > slugMax {
		s = strings.TrimRight(s[:slugMax], "-")
	}
	if s == "" {
		return "bug"
	}
	return s
}

// shownPath is the path the page shows and the prompt names: relative to
// the repository that holds the file, with forward slashes, so it reads
// .bugreports/... whichever directory the server was started in; the
// absolute path when no repository holds it.
func shownPath(path string) string {
	var (
		abs  string
		root string
		rel  string
		err  error
	)
	if abs, err = filepath.Abs(path); err != nil {
		return filepath.ToSlash(path)
	}
	if root = repoRoot(filepath.Dir(abs)); root == "" {
		return filepath.ToSlash(abs)
	}
	if rel, err = filepath.Rel(root, abs); err != nil || strings.HasPrefix(rel, "..") {
		return filepath.ToSlash(abs)
	}
	return filepath.ToSlash(rel)
}

// repoRoot is the nearest directory at or above dir holding a .git, a
// directory in a clone and a file in a worktree; "" when there is none.
func repoRoot(dir string) string {
	var err error
	for {
		if _, err = os.Stat(filepath.Join(dir, ".git")); err == nil {
			return dir
		}
		var parent = filepath.Dir(dir)
		if parent == dir {
			return ""
		}
		dir = parent
	}
}
