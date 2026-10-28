package main

import "strings"

// mywURL is --myw-url as GET /api/config tells it: trimmed, with no
// trailing slash. Empty is no service. bff does not talk to My Whisper;
// the page does, with CORS.
func mywURL(flag string) string {
	return strings.TrimSuffix(strings.TrimSpace(flag), "/")
}
