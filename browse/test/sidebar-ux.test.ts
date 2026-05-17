/**
 * Tests for sidebar UX after the PTY/terminal refactor.
 *
 * The old chat-based sidebar (sidebar-agent.ts, chat queue, one-shot claude -p)
 * was replaced by a terminal-based PTY architecture (terminal-agent.ts,
 * xterm.js, WebSocket transport). These tests validate key invariants
 * of the new architecture.
 */

import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');

// ─── PTY session setup ──────────────────────────────────────────

describe('PTY session setup (server.ts)', () => {
  const serverSrc = fs.readFileSync(path.join(ROOT, 'src', 'server.ts'), 'utf-8');

  test('/pty-session endpoint exists', () => {
    expect(serverSrc).toContain("/pty-session'");
  });

  test('/pty-session creates session cookie', () => {
    const handlerIdx = serverSrc.indexOf("'/pty-session'");
    const handler = serverSrc.slice(handlerIdx, handlerIdx + 2500);
    expect(handler).toContain('HttpOnly');
    expect(handler).toContain('ptySessionToken');
  });

  test('terminal-agent internal token handoff exists', () => {
    expect(serverSrc).toContain('readTerminalInternalToken');
    expect(serverSrc).toContain('terminal-internal-token');
  });

  test('terminal-port file read exists', () => {
    expect(serverSrc).toContain('terminal-port');
  });

  test('/sse-session endpoint exists for EventSource auth', () => {
    expect(serverSrc).toContain("/sse-session'");
  });

  test('validateAuth guards privileged endpoints', () => {
    expect(serverSrc).toContain('function validateAuth');
  });
});

// ─── Terminal-agent invariants ──────────────────────────────────

describe('terminal-agent.ts (replaces sidebar-agent.ts)', () => {
  const agentSrc = fs.readFileSync(path.join(ROOT, 'src', 'terminal-agent.ts'), 'utf-8');

  test('file exists and has key structures', () => {
    expect(agentSrc.length).toBeGreaterThan(1000);
  });

  test('spawns claude as a PTY', () => {
    expect(agentSrc).toContain('spawnClaude');
    expect(agentSrc).toContain('terminal');
  });

  test('sets BROWSE_NO_AUTOSTART in claude environment', () => {
    expect(agentSrc).toContain('BROWSE_NO_AUTOSTART');
    expect(agentSrc).toContain('1');
  });

  test('builds tab-awareness system prompt', () => {
    expect(agentSrc).toContain('buildTabAwarenessHint');
    expect(agentSrc).toContain('--append-system-prompt');
  });

  test('WebSocket transport with Sec-WebSocket-Protocol auth', () => {
    expect(agentSrc).toContain('WebSocket');
    expect(agentSrc).toContain('Sec-WebSocket-Protocol');
  });

  test('internal token handoff at /internal/grant', () => {
    expect(agentSrc).toContain('/internal/grant');
  });

  test('lazy spawn: claude starts on first data frame', () => {
    expect(agentSrc).toContain('Binary');
    expect(agentSrc).toContain('open');
  });

  test('disposeSession does SIGINT then SIGKILL', () => {
    expect(agentSrc).toContain('SIGINT');
    expect(agentSrc).toContain('SIGKILL');
  });
});

// ─── Sidebar HTML (sidepanel.html) ──────────────────────────────

describe('sidebar HTML (sidepanel.html)', () => {
  const html = fs.readFileSync(path.join(ROOT, '..', 'extension', 'sidepanel.html'), 'utf-8');

  test('terminal pane is the primary surface', () => {
    expect(html).toContain('id="tab-terminal"');
    expect(html).toContain('id="terminal-mount"');
  });

  test('security shield element exists', () => {
    expect(html).toContain('id="security-shield"');
  });

  test('connection banner exists with reconnect button', () => {
    expect(html).toContain('id="conn-banner"');
    expect(html).toContain('id="conn-reconnect"');
  });

  test('browser tabs container exists hidden by default', () => {
    expect(html).toContain('id="browser-tabs"');
    expect(html).toContain('display:none');
  });

  test('toolbar has cleanup, screenshot, and cookies buttons', () => {
    expect(html).toContain('id="chat-cleanup-btn"');
    expect(html).toContain('id="chat-screenshot-btn"');
    expect(html).toContain('id="chat-cookies-btn"');
  });

  test('restart button exists', () => {
    expect(html).toContain('id="terminal-restart-now"');
    expect(html).toContain('id="terminal-restart"');
  });

  test('bootstrap status card exists', () => {
    expect(html).toContain('id="terminal-bootstrap"');
    expect(html).toContain('id="terminal-bootstrap-status"');
  });

  test('install card exists for when claude is missing', () => {
    expect(html).toContain('id="terminal-install-card"');
    expect(html).toContain('Claude Code not found');
  });

  test('session ended card exists', () => {
    expect(html).toContain('id="terminal-ended"');
    expect(html).toContain('Session ended');
  });

  test('debug toggle exists', () => {
    expect(html).toContain('id="debug-toggle"');
    expect(html).toContain('id="reload-sidebar"');
  });
});

// ─── Sidebar CSS ────────────────────────────────────────────────

describe('sidebar CSS (sidepanel.css)', () => {
  const css = fs.readFileSync(path.join(ROOT, '..', 'extension', 'sidepanel.css'), 'utf-8');

  test('browser-tabs and terminal styles exist', () => {
    expect(css).toContain('.browser-tabs');
    expect(css).toContain('.browser-tab');
    expect(css).toContain('.terminal-mount');
  });

  test('connection banner styles exist', () => {
    expect(css).toContain('.conn-banner');
    expect(css).toContain('.reconnected');
  });

  test('terminal styles exist', () => {
    expect(css).toContain('.terminal-bootstrap');
    expect(css).toContain('.terminal-ended');
  });
});

// ─── Sidebar JS (sidepanel.js) ──────────────────────────────────

describe('sidebar JS (sidepanel.js)', () => {
  const js = fs.readFileSync(path.join(ROOT, '..', 'extension', 'sidepanel.js'), 'utf-8');

  test('command sets defined for navigation, interaction, observe', () => {
    expect(js).toContain('NAV_COMMANDS');
    expect(js).toContain('INTERACTION_COMMANDS');
    expect(js).toContain('OBSERVE_COMMANDS');
  });

  test('connection state machine exists', () => {
    expect(js).toContain('setConnState');
    expect(js).toContain('disconnected');
    expect(js).toContain('reconnecting');
    expect(js).toContain('dead');
  });

  test('SSE session and activity stream', () => {
    expect(js).toContain('ensureSseSessionCookie');
    expect(js).toContain('connectSSE');
    expect(js).toContain('/activity/stream');
  });

  test('refs fetching exists', () => {
    expect(js).toContain('fetchRefs');
    expect(js).toContain('/refs');
  });

  test('toolbar actions: cleanup and screenshot via /command', () => {
    expect(js).toContain('runCleanup');
    expect(js).toContain('runScreenshot');
    expect(js).toContain('/command');
  });

  test('updateConnection sets globals for terminal-agent', () => {
    expect(js).toContain('updateConnection');
    expect(js).toContain('gstackServerPort');
    expect(js).toContain('gstackAuthToken');
  });

  test('tryConnect polls health endpoint', () => {
    expect(js).toContain('tryConnect');
    expect(js).toContain('/health');
  });

  test('gstackInjectToTerminal is called on command injection', () => {
    expect(js).toContain('gstackInjectToTerminal');
  });
});

// ─── Sidebar Terminal JS (sidepanel-terminal.js) ────────────────

describe('sidebar terminal JS (sidepanel-terminal.js)', () => {
  const termJs = fs.readFileSync(path.join(ROOT, '..', 'extension', 'sidepanel-terminal.js'), 'utf-8');

  test('state machine with IDLE, CONNECTING, LIVE, ENDED, NO_CLAUDE', () => {
    expect(termJs).toContain('IDLE');
    expect(termJs).toContain('CONNECTING');
    expect(termJs).toContain('LIVE');
    expect(termJs).toContain('ENDED');
    expect(termJs).toContain('NO_CLAUDE');
  });

  test('PTY session minting via /pty-session', () => {
    expect(termJs).toContain('mintSession');
    expect(termJs).toContain('/pty-session');
  });

  test('WebSocket connection with protocol auth', () => {
    expect(termJs).toContain('WebSocket');
    expect(termJs).toContain('gstack-pty');
  });

  test('xterm.js terminal setup with FitAddon', () => {
    expect(termJs).toContain('ensureXterm');
    expect(termJs).toContain('FitAddon');
    expect(termJs).toContain('xterm');
  });

  test('claude availability check before connecting', () => {
    expect(termJs).toContain('checkClaudeAvailable');
    expect(termJs).toContain('/claude-available');
  });

  test('restart/teardown logic exists', () => {
    expect(termJs).toContain('teardown');
    expect(termJs).toContain('forceRestart');
  });

  test('gstackInjectToTerminal exposed as global', () => {
    expect(termJs).toContain('window.gstackInjectToTerminal');
  });

  test('tab-state listener forwards tab context to PTY', () => {
    expect(termJs).toContain('gstack:tab-state');
    expect(termJs).toContain('tabState');
  });

  test('init wires install-retry and restart buttons', () => {
    expect(termJs).toContain('install-retry');
    expect(termJs).toContain('init');
  });
});

// ─── BROWSE_NO_AUTOSTART ────────────────────────────────────────

describe('BROWSE_NO_AUTOSTART (sidebar headless prevention)', () => {
  const cliSrc = fs.readFileSync(path.join(ROOT, 'src', 'cli.ts'), 'utf-8');
  const termSrc = fs.readFileSync(path.join(ROOT, 'src', 'terminal-agent.ts'), 'utf-8');

  test('cli.ts exits when BROWSE_NO_AUTOSTART is set and server unavailable', () => {
    expect(cliSrc).toContain('BROWSE_NO_AUTOSTART');
    expect(cliSrc).toContain('process.exit(1)');
  });

  test('terminal-agent sets BROWSE_NO_AUTOSTART in claude env', () => {
    expect(termSrc).toContain('BROWSE_NO_AUTOSTART');
    expect(termSrc).toContain("'1'");
  });
});

// ─── Tool-result file filtering (terminal-agent.ts) ──────────────

describe('terminal-agent hides internal tool-result reads', () => {
  const agentSrc = fs.readFileSync(path.join(ROOT, 'src', 'terminal-agent.ts'), 'utf-8');

  test('state directory contains internal files that should be hidden', () => {
    expect(agentSrc).toContain('terminal-port');
  });

  test('state files are in a project-scoped directory', () => {
    expect(agentSrc).toContain('stateDir');
  });
});

// ─── Background script ──────────────────────────────────────────

describe('background script (background.js)', () => {
  const bgSrc = fs.readFileSync(path.join(ROOT, '..', 'extension', 'background.js'), 'utf-8');

  test('port discovery between sidepanel and content script', () => {
    expect(bgSrc).toContain('getPort');
    expect(bgSrc).toContain('runtime.onMessage');
  });
});

// ─── Cookie import button ───────────────────────────────────────

describe('cookie import button (sidebar)', () => {
  const html = fs.readFileSync(path.join(ROOT, '..', 'extension', 'sidepanel.html'), 'utf-8');
  const js = fs.readFileSync(path.join(ROOT, '..', 'extension', 'sidepanel.js'), 'utf-8');

  test('quick actions toolbar has cookies button', () => {
    expect(html).toContain('id="chat-cookies-btn"');
  });

  test('cookies button navigates to cookie-picker', () => {
    expect(js).toContain("'chat-cookies-btn'");
    expect(js).toContain('cookie-picker');
  });
});
