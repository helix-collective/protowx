//go:build !embedmodel

package source

// embedded is empty without `-tags embedmodel`: the model comes from
// --model or a download.
var embedded []byte
