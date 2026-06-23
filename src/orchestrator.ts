import { getCurrentWindow } from '@tauri-apps/api/window';
import { Webview } from '@tauri-apps/api/webview';
import { LogicalSize, LogicalPosition } from '@tauri-apps/api/dpi';
import { listen, emit } from '@tauri-apps/api/event';

const appWindow = getCurrentWindow();

interface Tab { id: string; title: string; url: string; webview: Webview; }
let tabs: Tab[] = [];
let activeTabId: string | null = null;
let uiWebview: Webview | null = null;

// Высчитываем размеры так, чтобы окно плотно облегало капсулу вместе с её тенью!
function getUiBounds() {
  const capsuleWidth = Math.min(window.innerWidth - 64, 900);
  const capsuleHeight = 48;
  const shadowPadding = 24; // Место под тень, чтобы не обрезалась
  
  const width = capsuleWidth + shadowPadding * 2;
  const height = capsuleHeight + shadowPadding * 2;
  const x = (window.innerWidth - width) / 2;
  const y = window.innerHeight - height - 16; // Высота полета над дном
  
  return { x, y, width, height };
}

async function init() {
  const uiUrl = window.location.origin + '/?ui=1';
  const b = getUiBounds();
  
  uiWebview = new Webview(appWindow, 'ui-layer', {
    url: uiUrl,
    x: b.x, y: b.y, width: b.width, height: b.height,
    transparent: true,
  });

  await new Promise(r => uiWebview!.once('tauri://created', r));

  listen('new-tab', (event: any) => createNewTab(event.payload.title, event.payload.url));
  listen('switch-tab', (event: any) => switchTab(event.payload.id));
  listen('close-tab', async (event: any) => {
    const id = event.payload.id;
    const tab = tabs.find(t => t.id === id);
    if (tab) {
      await tab.webview.close();
      tabs = tabs.filter(t => t.id !== id);
      if (activeTabId === id) {
        if (tabs.length > 0) switchTab(tabs[tabs.length - 1].id);
        else { activeTabId = null; syncUi(); }
      } else syncUi();
    }
  });

  // Двигаем капсулу за окном при изменении размеров
  window.addEventListener('resize', async () => {
    if (uiWebview) {
      const bounds = getUiBounds();
      await uiWebview.setSize(new LogicalSize(bounds.width, bounds.height));
      await uiWebview.setPosition(new LogicalPosition(bounds.x, bounds.y));
    }
    await Promise.all(tabs.map(async tab => {
      await tab.webview.setSize(new LogicalSize(window.innerWidth, window.innerHeight));
    }));
  });

  setTimeout(() => createNewTab('Google', 'https://www.google.com'), 200);
}

function syncUi() {
  emit('update-tabs', { activeTabId, tabs: tabs.map(t => ({ id: t.id, title: t.title })) });
}

async function forceUiToFront() {
  if (uiWebview) {
    try { await uiWebview.reparent(appWindow); } 
    catch (e) { console.error(e); }
  }
}

async function switchTab(targetId: string) {
  activeTabId = targetId;
  syncUi();
  await Promise.all(tabs.map(tab => tab.id === targetId ? tab.webview.show() : tab.webview.hide()));
  await forceUiToFront();
}

async function createNewTab(title: string, url: string) {
  const id = `tab-${Date.now()}`;
  try {
    const webview = new Webview(appWindow, id, {
      url, x: 0, y: 0, 
      width: window.innerWidth, height: window.innerHeight, // Сайт на все 100% экрана!
    });
    await new Promise((resolve, reject) => {
      webview.once('tauri://created', () => resolve(true));
      webview.once('tauri://error', (e) => reject(e.payload));
    });
    tabs.push({ id, title, url, webview });
    await switchTab(id);
  } catch (e) { console.error(e); }
}

init();
