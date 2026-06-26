import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

const searchInput = document.getElementById("search-input") as HTMLInputElement;
const tabsContainer = document.getElementById(
  "tabs-container",
) as HTMLDivElement;
const tabsWrapper = document.querySelector(".tabs-wrapper") as HTMLElement;
const scrollLeftBtn = document.getElementById("scroll-left");
const scrollRightBtn = document.getElementById("scroll-right");
const appWindow = getCurrentWindow();

const btnFav = document.getElementById("btn-fav");
const favPanel = document.getElementById("fav-panel") as HTMLDivElement;
const btnSettings = document.getElementById("btn-settings");
const settingsContainer = document.getElementById("settings-container");
const searchEngineSelect = document.getElementById(
  "search-engine-select",
) as HTMLSelectElement;
const startPageInput = document.getElementById(
  "start-page-input",
) as HTMLInputElement;
const themeToggleBtn = document.getElementById("theme-toggle-btn");

document
  .getElementById("btn-close")
  ?.addEventListener("click", () => appWindow.close());
document
  .getElementById("btn-minimize")
  ?.addEventListener("click", () => appWindow.minimize());
document
  .getElementById("btn-maximize")
  ?.addEventListener("click", () => appWindow.toggleMaximize());

interface Tab {
  id: string;
  title: string;
  url: string;
}
interface FavoriteItem {
  title: string;
  url: string;
}

let tabs: Tab[] = [];
let favorites: FavoriteItem[] = [];
let activeTabId: string | null = null;
let expandedTabId: string | null = null;

let startPage = localStorage.getItem("start_page") || "";
if (startPageInput) startPageInput.value = startPage;

const emptyScreen = document.getElementById("empty-screen");
const clockDisplay = document.getElementById("clock-display");
const dateDisplay = document.getElementById("date-display");

function updateClock() {
  if (!clockDisplay || !dateDisplay) return;
  const now = new Date();
  clockDisplay.textContent = now.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
  dateDisplay.textContent = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
setInterval(updateClock, 1000);
updateClock();

let isDark = localStorage.getItem("theme") === "dark";
const sunIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
const moonIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="moon-svg"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;

const applyTheme = async (dark: boolean) => {
  document.body.classList.toggle("dark-theme", dark);
  if (themeToggleBtn) themeToggleBtn.innerHTML = dark ? sunIcon : moonIcon;
  try {
    await appWindow.setTheme(dark ? "dark" : "light");
  } catch (e) {}
};
if (isDark) applyTheme(true);

if (themeToggleBtn) {
  themeToggleBtn.innerHTML = isDark ? sunIcon : moonIcon;
  themeToggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    isDark = !isDark;
    localStorage.setItem("theme", isDark ? "dark" : "light");
    applyTheme(isDark);
  });
}

listen("fullscreen_changed", (e: any) => {
  if (e.payload as boolean) document.body.classList.add("fullscreen-mode");
  else document.body.classList.remove("fullscreen-mode");
  window.dispatchEvent(new Event("resize"));
});

btnFav?.addEventListener("click", (e) => {
  e.stopPropagation();
  favPanel?.classList.toggle("show");
  settingsContainer?.classList.remove("show");
});

btnSettings?.addEventListener("click", (e) => {
  e.stopPropagation();
  settingsContainer?.classList.toggle("show");
  favPanel?.classList.remove("show");
});

document.addEventListener("click", (e) => {
  const target = e.target as Node;
  if (
    favPanel?.classList.contains("show") &&
    !favPanel.contains(target) &&
    !btnFav?.contains(target)
  )
    favPanel.classList.remove("show");
  if (
    settingsContainer?.classList.contains("show") &&
    !settingsContainer.contains(target) &&
    !btnSettings?.contains(target)
  )
    settingsContainer.classList.remove("show");
});

searchEngineSelect?.addEventListener("change", (e) =>
  localStorage.setItem("search_engine", (e.target as HTMLSelectElement).value),
);
startPageInput?.addEventListener("change", (e) => {
  let val = (e.target as HTMLInputElement).value.trim();
  if (val && !/^https?:\/\//i.test(val)) val = `https://${val}`;
  startPage = val;
  localStorage.setItem("start_page", startPage);
  startPageInput.value = startPage;
});

function getShortUrl(fullUrl: string): string {
  try {
    const url = new URL(fullUrl);
    if (url.hostname.includes("google") && url.pathname.startsWith("/url")) {
      const actualUrl =
        url.searchParams.get("q") || url.searchParams.get("url");
      if (actualUrl) return new URL(actualUrl).hostname.replace(/^www\./, "");
    }
    return url.hostname.replace(/^www\./, "");
  } catch {
    return "search";
  }
}

function updateTabVisuals(tabId: string) {
  const tab = tabs.find((t) => t.id === tabId);
  if (!tab) return;
  const shortDomain = getShortUrl(tab.url);
  const tabEl = document.querySelector(`.tab[data-id="${tabId}"]`);
  if (tabEl) {
    const titleInput = tabEl.querySelector(
      ".tab-url-input",
    ) as HTMLInputElement;
    if (titleInput) {
      const isExpanded = tabEl.classList.contains("expanded");
      titleInput.value = isExpanded ? tab.url : shortDomain;
      titleInput.readOnly = !isExpanded;
    }
    const faviconImg = tabEl.querySelector(".tab-favicon") as HTMLImageElement;
    if (faviconImg) {
      faviconImg.src = `https://www.google.com/s2/favicons?sz=32&domain=${shortDomain}`;
      faviconImg.style.display = "block";
    }
    const starBtn = tabEl.querySelector(".tab-star-btn") as HTMLElement;
    if (starBtn) {
      const isFav = favorites.some((f) => f.url === tab.url);
      starBtn
        .querySelector("svg")
        ?.setAttribute("fill", isFav ? "#ffc107" : "none");
      starBtn
        .querySelector("svg")
        ?.setAttribute("stroke", isFav ? "#ffc107" : "currentColor");
    }
  }
}

function toggleFavorite(url: string) {
  const short = getShortUrl(url);
  const index = favorites.findIndex((f) => f.url === url);
  if (index > -1) favorites.splice(index, 1);
  else favorites.push({ title: short, url });
  renderTabs();
  renderFavorites();
}

function renderFavorites() {
  if (!favPanel) return;
  favPanel.innerHTML = "";
  if (favorites.length === 0) {
    const placeholder = document.createElement("div");
    placeholder.className = "fav-placeholder";
    placeholder.innerHTML = `add tabs <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
    favPanel.appendChild(placeholder);
    return;
  }
  favorites.forEach((fav) => {
    const favItem = document.createElement("div");
    favItem.className = "fav-item";
    favItem.title = fav.url;
    const img = document.createElement("img");
    img.src = `https://www.google.com/s2/favicons?sz=32&domain=${fav.title}`;
    img.onerror = () => (img.style.display = "none");
    const span = document.createElement("span");
    span.textContent =
      Math.abs(fav.title.length) > 12
        ? fav.title.substring(0, 10) + ".."
        : fav.title;
    favItem.appendChild(img);
    favItem.appendChild(span);
    favItem.addEventListener("click", () => createNewTab(fav.title, fav.url));
    favPanel.appendChild(favItem);
  });
}

function updateScrollArrows() {
  if (!tabsContainer || !tabsWrapper) return;
  tabsWrapper.classList.toggle("can-scroll-left", tabsContainer.scrollLeft > 1);
  tabsWrapper.classList.toggle(
    "can-scroll-right",
    Math.ceil(tabsContainer.scrollLeft + tabsContainer.clientWidth) <
      tabsContainer.scrollWidth - 1,
  );
}
tabsContainer?.addEventListener("scroll", updateScrollArrows, {
  passive: true,
});

function getContentBounds() {
  if (document.body.classList.contains("fullscreen-mode"))
    return { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
  const offset = window.innerHeight >= window.screen.height - 10 ? 48 : 20;
  return {
    x: 0,
    y: 0,
    width: window.innerWidth,
    height: window.innerHeight - offset,
  };
}

let resizeTimeout: any;
const resizeObserver = new ResizeObserver(() => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(async () => {
    updateScrollArrows();
    const b = getContentBounds();
    await Promise.all(
      tabs.map((tab) =>
        invoke("resize_tab", {
          id: tab.id,
          x: b.x,
          y: b.y,
          width: b.width,
          height: b.height,
        }),
      ),
    );
  }, 50);
});
resizeObserver.observe(document.documentElement);

scrollLeftBtn?.addEventListener("click", () =>
  tabsContainer.scrollBy({ left: -150, behavior: "smooth" }),
);
scrollRightBtn?.addEventListener("click", () =>
  tabsContainer.scrollBy({ left: 150, behavior: "smooth" }),
);

function renderTabs() {
  if (!tabsContainer) return;
  tabsContainer.innerHTML = "";
  if (tabs.length === 0) emptyScreen?.classList.remove("hidden");
  else emptyScreen?.classList.add("hidden");

  tabs.forEach((tab) => {
    const tabEl = document.createElement("div");
    const isActive = tab.id === activeTabId;
    const isExpanded = tab.id === expandedTabId;
    tabEl.className = `tab ${isActive ? "active" : ""} ${isExpanded ? "expanded" : ""}`;
    tabEl.dataset.id = tab.id;

    const shortDomain = getShortUrl(tab.url);
    const faviconImg = document.createElement("img");
    faviconImg.className = "tab-favicon";
    faviconImg.src = `https://www.google.com/s2/favicons?sz=32&domain=${shortDomain}`;
    faviconImg.onerror = () => {
      faviconImg.style.display = "none";
    };
    tabEl.appendChild(faviconImg);

    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.className = "tab-url-input";
    titleInput.value = isExpanded ? tab.url : shortDomain;
    titleInput.readOnly = !isExpanded;

    titleInput.addEventListener("click", (e) => {
      if (isExpanded) e.stopPropagation();
    });
    titleInput.addEventListener("keydown", async (e) => {
      if (e.key === "Enter" && isExpanded) {
        e.stopPropagation();
        let newUrl = titleInput.value.trim();
        if (newUrl && !/^https?:\/\//i.test(newUrl))
          newUrl = `https://${newUrl}`;
        await invoke("navigate_tab", { id: tab.id, url: newUrl });
        titleInput.blur();
      }
    });
    tabEl.appendChild(titleInput);

    if (isActive) {
      const reloadBtn = document.createElement("div");
      reloadBtn.className = "tab-reload-btn";
      reloadBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>`;
      reloadBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await invoke("reload_webview", { id: tab.id });
      });
      tabEl.appendChild(reloadBtn);

      const starBtn = document.createElement("div");
      starBtn.className = "tab-star-btn";
      const isFav = favorites.some((f) => f.url === tab.url);
      starBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="${isFav ? "#ffc107" : "none"}" stroke="${isFav ? "#ffc107" : "currentColor"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
      starBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleFavorite(tab.url);
      });
      tabEl.appendChild(starBtn);
    }

    const closeBtn = document.createElement("div");
    closeBtn.className = "tab-close-btn";
    closeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    closeBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await invoke("close_tab", { id: tab.id });
      tabs = tabs.filter((t) => t.id !== tab.id);
      if (activeTabId === tab.id) {
        if (tabs.length > 0) {
          expandedTabId = null;
          await switchTab(tabs[tabs.length - 1].id);
        } else {
          activeTabId = null;
          expandedTabId = null;
          renderTabs();
        }
      } else renderTabs();
    });

    tabEl.addEventListener("click", () => {
      if (activeTabId !== tab.id) {
        expandedTabId = null;
        switchTab(tab.id);
      } else {
        expandedTabId = expandedTabId === tab.id ? null : tab.id;
        renderTabs();
      }
    });
    tabEl.appendChild(closeBtn);
    tabsContainer.appendChild(tabEl);
  });
  setTimeout(updateScrollArrows, 50);
}

async function switchTab(targetId: string) {
  activeTabId = targetId;
  renderTabs();
  await Promise.all(
    tabs.map((tab) =>
      invoke(tab.id === targetId ? "show_tab" : "hide_tab", { id: tab.id }),
    ),
  );
}

async function createNewTab(title: string, url: string) {
  const id = `tab-${Date.now()}`;
  const b = getContentBounds();
  try {
    await invoke("create_tab", {
      id,
      url,
      x: b.x,
      y: b.y,
      width: b.width,
      height: b.height,
      adblock: true,
    });
    tabs.push({ id, title, url });
    expandedTabId = null;
    await switchTab(id);
  } catch (e) {}
}

searchInput.addEventListener("keydown", async (e) => {
  if (e.key !== "Enter") return;
  const query = searchInput.value.trim();
  if (!query) return;
  const engine = localStorage.getItem("search_engine") || "duckduckgo";
  const isUrl = /^[^\s]+\.[a-z]{2,}(\/.*)?$/i.test(query);

  let searchUrl = "";
  switch (engine) {
    case "duckduckgo":
      searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
      break;
    case "bing":
      searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
      break;
    case "yandex":
      searchUrl = `https://yandex.com/search/?text=${encodeURIComponent(query)}`;
      break;
    default:
      searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      break;
  }
  await createNewTab(
    query,
    isUrl ? (query.startsWith("http") ? query : `https://${query}`) : searchUrl,
  );
  searchInput.value = "";
  searchInput.blur();
});

document.getElementById("btn-back")?.addEventListener("click", async () => {
  if (activeTabId) await invoke("go_back", { id: activeTabId });
});
document.getElementById("btn-forward")?.addEventListener("click", async () => {
  if (activeTabId) await invoke("go_forward", { id: activeTabId });
});

window.addEventListener("DOMContentLoaded", () => {
  renderFavorites();
  if (searchEngineSelect)
    searchEngineSelect.value =
      localStorage.getItem("search_engine") || "duckduckgo";
  if (startPage !== "")
    setTimeout(() => createNewTab("Start Page", startPage), 100);
});

let tickCount = 0;
setInterval(async () => {
  tickCount++;

  const tabsToCheck =
    tickCount % 10 === 0 ? tabs : tabs.filter((t) => t.id === activeTabId);

  for (const tab of tabsToCheck) {
    try {
      const currentUrl = await invoke<string>("get_webview_url", {
        id: tab.id,
      });
      if (!currentUrl || currentUrl === "about:blank") continue;

      if (tab.id === activeTabId) {
        const isFs = currentUrl.includes("tauri-fs=1");
        const bodyIsFs = document.body.classList.contains("fullscreen-mode");
        if (isFs && !bodyIsFs) {
          document.body.classList.add("fullscreen-mode");
          await invoke("toggle_frontend_fullscreen", { state: true });
          window.dispatchEvent(new Event("resize"));
        } else if (!isFs && bodyIsFs) {
          document.body.classList.remove("fullscreen-mode");
          await invoke("toggle_frontend_fullscreen", { state: false });
          window.dispatchEvent(new Event("resize"));
        }
      }

      let displayUrl = currentUrl
        .replace(/([?&])tauri-fs=1&?/, "$1")
        .replace(/[?&]$/, "");
      if (displayUrl !== tab.url) {
        tab.url = displayUrl;
        updateTabVisuals(tab.id);
        addToHistory(displayUrl);
      }
    } catch (e) {}
  }
}, 250);

interface HistoryItem {
  url: string;
  timestamp: number;
}
function addToHistory(url: string) {
  if (!url || url.startsWith("tauri://") || url === "about:blank") return;
  let history: HistoryItem[] = JSON.parse(
    localStorage.getItem("browser_history") || "[]",
  );
  if (history.length > 0 && history[0].url === url) return;
  history.unshift({ url, timestamp: Date.now() });
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  localStorage.setItem(
    "browser_history",
    JSON.stringify(history.filter((item) => item.timestamp > sevenDaysAgo)),
  );
}

function getDaysDifference(timestamp: number): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const itemDate = new Date(timestamp);
  itemDate.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - itemDate.getTime()) / 86400000);
}

function formatDate(date: Date): string {
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`;
}

function renderHistory() {
  const history: HistoryItem[] = JSON.parse(
    localStorage.getItem("browser_history") || "[]",
  );
  const columns: HistoryItem[][] = [[], [], [], []];

  history.forEach((item) => {
    const diff = getDaysDifference(item.timestamp);
    if (diff === 0) columns[0].push(item);
    else if (diff === 1) columns[1].push(item);
    else if (diff >= 2 && diff <= 4) columns[2].push(item);
    else if (diff >= 5 && diff <= 7) columns[3].push(item);
  });

  for (let i = 0; i < 4; i++) {
    const colEl = document.getElementById(`hist-col-${i}`);
    if (!colEl) continue;
    const contentEl = colEl.querySelector(".hist-content")!;
    const dateTitleEl = colEl.querySelector(".h-date")!;
    contentEl.innerHTML = "";

    const today = new Date();
    if (i === 0) dateTitleEl.textContent = formatDate(today);
    if (i === 1) {
      const yest = new Date();
      yest.setDate(yest.getDate() - 1);
      dateTitleEl.textContent = formatDate(yest);
    }
    if (i === 2) {
      const d2 = new Date();
      d2.setDate(d2.getDate() - 2);
      const d4 = new Date();
      d4.setDate(d4.getDate() - 4);
      dateTitleEl.textContent = `${formatDate(d2)} - ${formatDate(d4)}`;
    }
    if (i === 3) {
      const d5 = new Date();
      d5.setDate(d5.getDate() - 5);
      const d7 = new Date();
      d7.setDate(d7.getDate() - 7);
      dateTitleEl.textContent = `${formatDate(d5)} - ${formatDate(d7)}`;
    }

    const frag = document.createDocumentFragment();
    columns[i].forEach((item) => {
      const date = new Date(item.timestamp);
      const timeStr = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
      const el = document.createElement("div");
      el.className = "hist-item";
      el.innerHTML = `<span class="hist-url" title="${item.url}">${item.url.replace(/^https?:\/\//, "")}</span><span class="hist-time">${timeStr}</span>`;
      el.onclick = () => {
        document.getElementById("history-overlay")?.classList.add("hidden");
        createNewTab(getShortUrl(item.url), item.url);
      };
      frag.appendChild(el);
    });
    contentEl.appendChild(frag);
  }
}

document.getElementById("btn-history")?.addEventListener("click", () => {
  const overlay = document.getElementById("history-overlay");
  if (overlay) {
    if (overlay.classList.contains("hidden")) {
      renderHistory();
      overlay.classList.remove("hidden");
    } else {
      overlay.classList.add("hidden");
    }
  }
});
