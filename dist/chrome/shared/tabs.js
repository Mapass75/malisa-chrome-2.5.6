import browser from './browser.js';
const NO_RECEIVER = /receiving end does not exist|could not establish connection/i;

export function isTranslatableUrl(url) {
  if (!url) return false;
  try {
    const { protocol } = new URL(url);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

async function injectContentScript(tabId) {
  await browser.scripting.executeScript({
    target: { tabId },
    files: ['content/content.js'],
  });
}

export async function sendToContent(tabId, message) {
  try {
    return await browser.tabs.sendMessage(tabId, message);
  } catch (err) {
    if (!NO_RECEIVER.test(err?.message ?? '')) throw err;
    await injectContentScript(tabId);
    await new Promise((r) => setTimeout(r, 150));
    return browser.tabs.sendMessage(tabId, message);
  }
}

export async function sendToActiveTab(message) {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab');
  if (!isTranslatableUrl(tab.url)) {
    throw new Error('Malisa works on regular web pages (http/https) only');
  }
  return sendToContent(tab.id, message);
}
