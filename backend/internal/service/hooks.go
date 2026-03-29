package service

// Hook config types shared by all providers.

// hookEntry represents a single hook command.
type hookEntry struct {
	Type    string `json:"type"`
	Command string `json:"command"`
	Timeout int    `json:"timeout,omitempty"`
}

// hookMatcher represents a hook matcher with its commands.
type hookMatcher struct {
	Matcher string      `json:"matcher,omitempty"`
	Hooks   []hookEntry `json:"hooks"`
}

// hooksSettings represents the provider hook config file structure.
type hooksSettings struct {
	Hooks map[string][]hookMatcher `json:"hooks"`
}
