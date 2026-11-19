import { test, expect, Page, WebSocketRoute } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { WorkspacePage } from '../pages/WorkspacePage';
import { CaseChatPage } from '../pages/CaseChatPage';

/**
 * QA verification for SIM-134 ("Chat answer can be lost when the connection
 * drops during a chat").
 *
 * The chat runs over a socket.io WebSocket: the question goes out as
 * `send_message`, the server confirms with `message_received`, and the AI's
 * answer comes back as `ai_message` (about 15 s later on dev). The bug: if the
 * connection is down when the answer is sent, it is silently lost. The fix
 * queues undelivered answers and re-sends them when the connection comes back.
 *
 * Each test puts the page's chat socket under its control (routeWebSocket),
 * drops it right after the server has the question, keeps it down long enough
 * for the answer to be sent into the void, then lets the app reconnect. The
 * page is never reloaded — a reload refetches the history and would hide the bug.
 *
 * Covered: acceptance criteria 1 (one chat) and 2 (two chats). Criterion 3 (a
 * re-send that fails again stays queued) needs the server-side timing of the
 * re-send and is left to the backend tests.
 */

const EMAIL    = process.env.TEST_EMAIL    ?? '';
const PASSWORD = process.env.TEST_PASSWORD ?? '';

/** How long the connection stays down. The AI answers in ~15 s, so its answer is sent while we're offline. */
const OUTAGE_MS = 60_000;
/** How long the answer may take to arrive once the connection is back. */
const DELIVERY_TIMEOUT_MS = 90_000;

/** Event name of a socket.io event frame (`42["name",…]`, optionally with namespace/ack id). */
function eventName(frame: string | Buffer): string | undefined {
  return frame.toString().match(/^42(?:\/[^,]*,)?\d*\["([^"]+)"/)?.[1];
}

/** When the server says the answer in an `ai_message` frame was produced (ms), if it says. */
function answerTime(frame: string | Buffer): number | undefined {
  try {
    const [, payload] = JSON.parse(frame.toString().replace(/^42(?:\/[^,]*,)?\d*/, ''));
    const time = payload?.message?.timestamp ?? payload?.message?.createdAt ?? payload?.timestamp;
    return time ? Date.parse(time) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Route the page's chat socket through the test so the connection can be
 * dropped and restored on demand, like a network blip.
 */
async function controlChatSocket(page: Page) {
  let down = false;
  let connections = 0;
  let restoredAt = 0;
  const events: { name: string; answeredAt?: number }[] = []; // socket.io events from the server, in arrival order
  const open: { client: WebSocketRoute; server: WebSocketRoute }[] = [];

  // socket.io can fall back to HTTP long-polling; keep that blocked while down too.
  await page.route(/\/socket\.io\//, route => (down ? route.abort('internetdisconnected') : route.continue()));

  await page.routeWebSocket(/\/socket\.io\//, client => {
    if (down) {
      client.close({ code: 4000, reason: 'connection down (test)' });
      return;
    }
    const server = client.connectToServer();
    client.onMessage(message => server.send(message));
    server.onMessage(message => {
      const name = eventName(message);
      if (name) events.push({ name, answeredAt: name === 'ai_message' ? answerTime(message) : undefined });
      client.send(message);
    });
    connections++;
    open.push({ client, server });
  });

  return {
    connections: () => connections,
    /** Number of server events seen so far — a bookmark for the `…Since` helpers. */
    mark: () => events.length,
    seenSince: (mark: number, name: string) => events.slice(mark).some(e => e.name === name),
    eventsSince: (mark: number) => events.slice(mark).map(e => e.name),
    /** Production times of the AI answers received since the bookmark (where the server stated one). */
    answerTimesSince: (mark: number) =>
      events.slice(mark).flatMap(e => (e.name === 'ai_message' && e.answeredAt ? [e.answeredAt] : [])),
    /** When the connection was last brought back. */
    restoredAt: () => restoredAt,
    drop() {
      down = true;
      for (const { client, server } of open.splice(0)) {
        server.close({ code: 4000, reason: 'connection dropped (test)' });
        client.close({ code: 4000, reason: 'connection dropped (test)' });
      }
    },
    restore() {
      down = false;
      restoredAt = Date.now();
    },
  };
}

type ChatSocket = Awaited<ReturnType<typeof controlChatSocket>>;

/**
 * Open the case at the given dashboard position, logging in first unless this
 * browser context already has a session (a second tab shares the first's).
 */
async function openCase(page: Page, index: number, { loggedIn = false } = {}) {
  const loginPage     = new LoginPage(page);
  const dashboardPage = new DashboardPage(page);

  if (loggedIn) {
    await page.goto('/dashboard');
  } else {
    await loginPage.goto();
    await loginPage.login(EMAIL, PASSWORD);
  }
  await loginPage.skipTour();

  await dashboardPage.waitForWorkspaceCard(index);
  const name = (await page.locator(`#case-card-${index}`).getByRole('heading').first().innerText()).trim();
  await dashboardPage.openWorkspace(index, name); // waits out the "still preparing" overlay
  await new WorkspacePage(page).skipTourInWorkspace();
}

/** A question whose answer is easy to recognise: the AI echoes a unique code. */
function questionFor(code: string) {
  return `Reply with only this reference code and nothing else: ${code}`;
}

/** Ask a question and wait until the server has it, so the drop happens mid-answer. */
async function askAndConfirm(socket: ChatSocket, chat: CaseChatPage, code: string) {
  const mark = socket.mark();
  await chat.ask(questionFor(code));
  await expect
    .poll(() => socket.seenSince(mark, 'message_received'), { message: 'the server never confirmed the question', timeout: 20_000 })
    .toBe(true);
}

/** Server events that are routine background traffic, left out of failure reports. */
const ROUTINE_EVENTS = /^(probing_prompts|document_feature_result|workspace_presence)$/;

/**
 * After the connection is back: does the AI's answer reach the reconnected
 * page — as an `ai_message` event, or shown in the chat by whatever means the
 * app re-sends it? On failure, reload to tell "answer lost" apart from "the AI
 * never answered", and report what the server did send after reconnecting.
 */
async function expectAnswerDelivered(page: Page, socket: ChatSocket, chat: CaseChatPage, code: string, mark: number) {
  // The question itself is one paragraph with the code; the answer adds at least one more.
  const answerOnScreen = async () => (await chat.messagesContaining(code).count()) >= 2;

  const delivered = await expect
    .poll(async () => socket.seenSince(mark, 'ai_message') || (await answerOnScreen()), { timeout: DELIVERY_TIMEOUT_MS })
    .toBe(true)
    .then(() => true, () => false);

  if (delivered) {
    // The user-facing half: the answer is on screen without a reload.
    await expect
      .poll(answerOnScreen, { message: 'the answer arrived on the socket but is not shown in the chat', timeout: 15_000 })
      .toBe(true);

    // Only meaningful if the answer was produced while the connection was down;
    // an answer produced after reconnecting was never undelivered.
    const answerTimes = socket.answerTimesSince(mark);
    if (answerTimes.length) {
      const producedAt = Math.min(...answerTimes);
      expect(
        producedAt,
        `the AI only answered after the connection was back (${new Date(producedAt).toISOString()}), so nothing was ever undelivered — increase OUTAGE_MS`
      ).toBeLessThan(socket.restoredAt());
      console.log(`Answer produced during the outage (${new Date(producedAt).toISOString()}) and re-sent after reconnecting`);
    } else {
      console.log('Answer appeared in the chat after reconnecting without an ai_message event carrying its time');
    }
    return;
  }

  const sentAfterReconnect = socket.eventsSince(mark).filter(name => !ROUTINE_EVENTS.test(name));
  await page.reload();

  // The app keeps one session per account: signing in elsewhere with the same
  // account (e.g. a second test run) ends this one, and a reconnect then fails.
  const signedOut = await page
    .getByRole('button', { name: /login to workspace/i })
    .waitFor({ timeout: 10_000 })
    .then(() => true, () => false);
  expect(
    signedOut,
    'the session ended during the test (was the same account signed in elsewhere?), so SIM-134 could not be judged'
  ).toBe(false);

  await chat.open();
  const answeredOnServer = await expect
    .poll(answerOnScreen, { timeout: 15_000 })
    .toBe(true)
    .then(() => true, () => false);
  expect(
    delivered,
    (answeredOnServer
      ? 'the AI answered (the answer shows after a reload) but it was never delivered to the reconnected chat (SIM-134)'
      : 'no answer arrived and none shows after a reload — the AI may not have answered at all, so SIM-134 could not be judged') +
      `\nServer events after reconnecting: ${sentAfterReconnect.join(', ') || '(none)'}`
  ).toBe(true);
}

test.describe('Chat - Answer delivery after a connection drop (SIM-134)', () => {
  test('An answer sent while the connection is down arrives once it is back', async ({ page }) => {
    test.setTimeout(420_000);

    const socket = await controlChatSocket(page);
    const chat   = new CaseChatPage(page);
    const code   = `QA-${Date.now().toString(36).toUpperCase()}`;

    await openCase(page, 0);
    await chat.open();
    await askAndConfirm(socket, chat, code);

    // --- Drop the connection mid-answer, then bring it back ---
    socket.drop();
    await page.waitForTimeout(OUTAGE_MS);
    const before = socket.connections();
    const mark   = socket.mark();
    socket.restore();
    await expect
      .poll(() => socket.connections(), { message: 'the chat never reconnected after the drop', timeout: 30_000 })
      .toBeGreaterThan(before);

    await expectAnswerDelivered(page, socket, chat, code, mark);
  });

  test('Two chats with undelivered answers both receive them once the connection is back', async ({ context }) => {
    test.setTimeout(600_000);

    // Two tabs on two different cases, each with its own chat and connection.
    const tabs = [await context.newPage(), await context.newPage()];
    const sessions: { page: Page; socket: ChatSocket; chat: CaseChatPage; code: string }[] = [];
    for (const [index, page] of tabs.entries()) {
      const socket = await controlChatSocket(page);
      const chat   = new CaseChatPage(page);
      const code   = `QA-${Date.now().toString(36).toUpperCase()}-${index + 1}`;
      await openCase(page, index, { loggedIn: index > 0 });
      await chat.open();
      sessions.push({ page, socket, chat, code });
    }

    for (const s of sessions) await askAndConfirm(s.socket, s.chat, s.code);

    // --- Both connections drop while their answers are on the way ---
    for (const s of sessions) s.socket.drop();
    await tabs[0].waitForTimeout(OUTAGE_MS);
    const marks = sessions.map(s => ({ before: s.socket.connections(), mark: s.socket.mark() }));
    for (const s of sessions) s.socket.restore();

    for (const [i, s] of sessions.entries()) {
      await expect
        .poll(() => s.socket.connections(), { message: `chat ${i + 1} never reconnected after the drop`, timeout: 30_000 })
        .toBeGreaterThan(marks[i].before);
      await expectAnswerDelivered(s.page, s.socket, s.chat, s.code, marks[i].mark);
    }
  });
});
