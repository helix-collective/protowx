package main

import (
	"fmt"
	"os/exec"
	"runtime"
)

// openBrowser asks the desktop to open url. It returns once the helper
// has been started, not once a window exists: there is no portable way
// to wait for that, and nothing here needs to.
//
// Failing to open a browser is never fatal. The server is already
// listening by the time this is called, and the URL is in the log, so
// the worst case is that the developer clicks it themselves.
func openBrowser(url string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", url)
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("opening %s: %w", url, err)
	}
	// The helper exits as soon as it has handed the URL over, so it is
	// reaped here rather than left as a zombie for the server's life.
	go func() { _ = cmd.Wait() }()
	return nil
}
