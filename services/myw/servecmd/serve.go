// Package servecmd is `myw serve`: My Whisper, the transcription
// service the page talks to when it dictates. It serves server.New on
// --addr. It has no tailnet node of its own: the stack's tailscale
// container is the one way onto the tailnet.
// docs/features/001-calculator/prd.md section 5.
package servecmd

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"slices"
	"strings"
	"syscall"
	"time"

	"myw/server"
	"myw/source"
)

type ServeCmd struct {
	source.Options `opts:"mode=embedded"`

	Addr    string        `opts:"short=a,env=MYW_ADDR" help:"Host:port to listen on. Loopback: the page on bff's loopback origins reaches it there."`
	Origin  []string      `opts:"env=MYW_ORIGIN" help:"A page origin CORS lets in, e.g. http://127.0.0.1:9000; repeat for more. http://127.0.0.1:8080 and http://localhost:8080, bff's default, are let in always. Any other origin is refused."`
	Quiet   bool          `opts:"short=q" help:"Do not log requests."`
	Timeout time.Duration `help:"Grace period for in-flight requests on shutdown. A transcription in flight is lost after it."`
}

func NewServeCmd() *ServeCmd {
	return &ServeCmd{
		Options: source.NewOptions(),
		Addr:    "127.0.0.1:8090",
		Timeout: 5 * time.Second,
	}
}

// Run serves until the process is interrupted.
func (c *ServeCmd) Run() error {
	return c.run(context.Background(), log.New(os.Stderr, "", log.LstdFlags))
}

// run is Run with the context and the log supplied, so a test can stop
// it and read what it said.
func (c *ServeCmd) run(ctx context.Context, logger *log.Logger) error {
	var (
		ln         net.Listener
		origins    []string
		mdl        = server.NewModel(c.Options)
		srv        *http.Server
		serveErr   = make(chan error, 1)
		ctx2, stop = signal.NotifyContext(ctx, os.Interrupt, syscall.SIGTERM)
		shutCtx    context.Context
		shutCancel context.CancelFunc
		err        error
	)
	defer stop()
	defer func() { _ = mdl.Close() }()
	if c.Libs == "" {
		return errors.New("--libs is required: whisper.cpp's lib directory, PROTOWX_WHISPER_LIBS in the dev shell")
	}
	if ln, err = net.Listen("tcp", c.Addr); err != nil {
		return fmt.Errorf("listening on %s: %w", c.Addr, err)
	}
	origins = allowedOrigins(c.Origin)
	srv = &http.Server{
		Handler: server.New(server.Config{
			Transcriber: mdl,
			Streamer:    mdl,
			ModelName:   source.ModelName(c.Options),
			Origins:     origins,
			Logger:      requestLog(logger, c.Quiet),
		}),
		ReadHeaderTimeout: 10 * time.Second,
		// No write timeout: a request waits for its transcription.
	}
	logger.Printf("myw serving on http://%s, model %s, libs %s", ln.Addr(), source.ModelName(c.Options), c.Libs)
	logger.Printf("CORS lets in: %s", strings.Join(origins, " "))
	go func() {
		var err error
		if err = srv.Serve(ln); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serveErr <- err
		}
	}()
	select {
	case err = <-serveErr:
		return fmt.Errorf("serving: %w", err)
	case <-ctx2.Done():
	}
	logger.Printf("shutting down")
	shutCtx, shutCancel = context.WithTimeout(context.Background(), c.Timeout)
	defer shutCancel()
	return srv.Shutdown(shutCtx)
}

// requestLog is the request log, or nil under --quiet.
func requestLog(logger *log.Logger, quiet bool) *log.Logger {
	if quiet {
		return nil
	}
	return logger
}

// allowedOrigins is the CORS allowlist: the two loopback origins of
// bff's default --addr, always, and extra, the --origin flags, each
// once and without a trailing slash. A bff on another address, or the
// stack's page on the tailnet, is an --origin.
func allowedOrigins(extra []string) []string {
	var out = []string{
		"http://127.0.0.1:8080",
		"http://localhost:8080",
	}
	for _, o := range extra {
		if o = strings.TrimSuffix(strings.TrimSpace(o), "/"); o != "" && !slices.Contains(out, o) {
			out = append(out, o)
		}
	}
	return out
}
