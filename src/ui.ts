import { emit, listen } from '@tauri-apps/api/event';

// Раскрываем спрятанный HTML
const uiLayer = document.getElementById('ui-layer')!;
uiLayer.style.display = 'block';

const searchInput = document.getElementById('search-input') as HTMLInputElement;
const tabsContainer = document.getElementById('tabs-container') as HTMLDivElement;

let tabs: any[] = [];
let activeTabId: string | null = null;

// Слушаем обновления от диспетчера
listen('update-tabs', (event: any) => {
  tabs = event.payload.tabs;
  activeTabId = event.payload.activeTabId;
  renderTabs();
});

function renderTabs() {
  tabsContainer.innerHTML = '';

  tabs.forEach(tab => {
    const tabEl = document.createElement('div');
    tabEl.className = `tab ${tab.id === activeTabId ? 'active' : ''}`;

    const titleSpan = document.createElement('span');
    titleSpan.textContent = tab.title;
    tabEl.appendChild(titleSpan);

    const closeBtn = document.createElement('div');
    closeBtn.className = 'tab-close-btn';
    closeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>`;

    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      emit('close-tab', { id: tab.id }); // Просим диспетчер закрыть
    });

    tabEl.addEventListener('click', () => {
      if (activeTabId !== tab.id) {
        emit('switch-tab', { id: tab.id }); // Просим диспетчер переключить
      }
    });

    tabEl.appendChild(closeBtn);
    tabsContainer.appendChild(tabEl);
  });
}

searchInput.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const query = searchInput.value.trim();
  if (!query) return;

  const isUrl = /^[^\s]+\.[a-z]{2,}(\/.*)?$/i.test(query);
  const finalUrl = isUrl
    ? (query.startsWith('http') ? query : `https://${query}`)
    : `https://www.google.com/search?q=${encodeURIComponent(query)}`;

  const tabTitle = isUrl ? query.split('/')[0].replace('https://', '') : query;

  emit('new-tab', { title: tabTitle, url: finalUrl }); // Просим диспетчер открыть
  
  searchInput.value = '';
  searchInput.blur();
});
