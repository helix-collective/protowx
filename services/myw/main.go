// Command myw is My Whisper, the dictation's transcription service:
// whisper.cpp inside a Go binary, through kronk's model package, with
// no whisper-cli and no cgo. `serve` is the service the page talks to
// when it dictates; `transcribe` and `stream` run the same model from
// the command line. See docs/features/001-calculator/prd.md section 5
// and README.md.
//
//	$ myw serve --libs "$PROTOWX_WHISPER_LIBS"
//	$ myw transcribe testdata/narration.wav
//	$ myw stream testdata/narration.wav
package main

import (
	"fmt"
	"os"

	"github.com/jpillora/opts"

	"myw/servecmd"
	"myw/streamcmd"
	"myw/transcribecmd"
)

var (
	rootCmd = &struct{}{}
	builder = opts.New(rootCmd).
		Name("myw").
		EmbedGlobalFlagSet().
		Complete()
)

func init() {
	builder.AddCommand(opts.New(servecmd.NewServeCmd()).Name("serve").
		Summary("Serve My Whisper, which the page talks to when it dictates: GET /healthz, POST /transcribe and the live streams under /live, on --addr."))
	builder.AddCommand(opts.New(transcribecmd.NewTranscribeCmd()).Name("transcribe").
		Summary("Transcribe one WAV file, and print the segments as POST /transcribe would answer them."))
	builder.AddCommand(opts.New(streamcmd.NewStreamCmd()).Name("stream").
		Summary("Play a WAV file into a live stream in slices, and print each partial and final as it arrives."))
}

func main() {
	var (
		cli opts.ParsedOpts
		err error
	)
	if cli, err = builder.ParseArgsError(os.Args); err != nil {
		fmt.Fprintf(os.Stderr, "%v", err)
		os.Exit(1)
	}
	if err = cli.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "%s\nError: %v\n\n", cli.Selected().Help(), err)
		os.Exit(2)
	}
}
