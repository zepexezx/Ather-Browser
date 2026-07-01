use tauri::Manager;

#[tauri::command]
fn go_back(app: tauri::AppHandle, id: String) {
    if let Some(webview) = app.get_webview(&id) {
        let _ = webview.eval("window.history.back()");
    }
}

#[tauri::command]
fn go_forward(app: tauri::AppHandle, id: String) {
    if let Some(webview) = app.get_webview(&id) {
        let _ = webview.eval("window.history.forward()");
    }
}

#[tauri::command]
fn get_webview_url(app: tauri::AppHandle, id: String) -> String {
    if let Some(webview) = app.get_webview(&id) {
        if let Ok(url) = webview.url() {
            return url.to_string();
        }
    }
    "".to_string()
}

#[tauri::command]
fn reload_webview(app: tauri::AppHandle, id: String) {
    if let Some(webview) = app.get_webview(&id) {
        let _ = webview.eval("window.location.reload()");
    }
}

#[tauri::command]
fn toggle_frontend_fullscreen(app: tauri::AppHandle, state: bool) {
    if let Some(window) = app
        .get_window("main")
        .or_else(|| app.windows().into_values().next())
    {
        let _ = window.set_fullscreen(state);
    }
}

#[tauri::command]
fn navigate_tab(app: tauri::AppHandle, id: String, url: String) {
    if let Some(webview) = app.get_webview(&id) {
        let _ = webview.eval(&format!("window.location.href = '{}';", url));
    }
}

const YOUTUBE_FS_PATCH: &str = r#"
    (function() {
        if (window.__yt_fs_patched) return;
        window.__yt_fs_patched = true;

        Object.defineProperty(document, 'fullscreenEnabled', { value: true, configurable: true });
        Object.defineProperty(document, 'webkitFullscreenEnabled', { value: true, configurable: true });

        let fsElement = null;

        Object.defineProperty(document, 'fullscreenElement', { get: () => fsElement, configurable: true });
        Object.defineProperty(document, 'webkitFullscreenElement', { get: () => fsElement, configurable: true });

        const enterFS = function() {
            return new Promise((resolve) => {
                fsElement = this === document ? document.documentElement : this;
                fsElement.dataset.oldCss = fsElement.style.cssText || '';

                fsElement.style.setProperty('position', 'fixed', 'important');
                fsElement.style.setProperty('top', '0', 'important');
                fsElement.style.setProperty('left', '0', 'important');
                fsElement.style.setProperty('width', '100vw', 'important');
                fsElement.style.setProperty('height', '100vh', 'important');
                fsElement.style.setProperty('z-index', '2147483647', 'important');
                fsElement.style.setProperty('background-color', '#000', 'important');

                const url = new URL(window.location.href);
                url.searchParams.set('tauri-fs', '1');
                window.history.replaceState({}, '', url);

                setTimeout(() => {
                    fsElement.dispatchEvent(new Event('fullscreenchange', { bubbles: true }));
                    fsElement.dispatchEvent(new Event('webkitfullscreenchange', { bubbles: true }));
                    resolve();
                }, 50);
            });
        };

        const exitFS = function() {
            return new Promise((resolve) => {
                if (fsElement) {
                    fsElement.style.cssText = fsElement.dataset.oldCss || '';
                }

                const target = fsElement || document;
                fsElement = null;

                const url = new URL(window.location.href);
                url.searchParams.delete('tauri-fs');
                window.history.replaceState({}, '', url);

                setTimeout(() => {
                    target.dispatchEvent(new Event('fullscreenchange', { bubbles: true }));
                    target.dispatchEvent(new Event('webkitfullscreenchange', { bubbles: true }));
                    resolve();
                }, 50);
            });
        };

        Element.prototype.requestFullscreen = enterFS;
        Element.prototype.webkitRequestFullscreen = enterFS;
        Document.prototype.exitFullscreen = exitFS;
        Document.prototype.webkitExitFullscreen = exitFS;

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && fsElement) {
                document.exitFullscreen();
            }
        });
    })();
"#;

#[tauri::command]
fn create_tab(
    app: tauri::AppHandle,
    id: String,
    url: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    adblock: bool,
) -> Result<(), String> {
    let window = app
        .get_window("main")
        .or_else(|| app.windows().into_values().next())
        .ok_or("No main window found")?;

    let parsed_url = url.parse().map_err(|e| format!("Invalid URL: {}", e))?;

    #[cfg(target_os = "macos")]
    let user_agent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
    #[cfg(target_os = "windows")]
    let user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edge/125.0.0.0";
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let user_agent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

    let mut builder =
        tauri::webview::WebviewBuilder::new(&id, tauri::WebviewUrl::External(parsed_url))
            .user_agent(user_agent)
            .initialization_script(YOUTUBE_FS_PATCH);

    let adblock_script = r#"
        (function() {
            if ('serviceWorker' in navigator) {
                const fakeSW = {
                    register: function() { return Promise.resolve({ addEventListener: function(){}, removeEventListener: function(){}, active: null, installing: null, waiting: null, scope: '/', unregister: function(){ return Promise.resolve(true); }, update: function(){ return Promise.resolve(); } }); },
                    getRegistration: function() { return Promise.resolve(null); }, getRegistrations: function() { return Promise.resolve([]); },
                    addEventListener: function(){}, removeEventListener: function(){}, controller: null, ready: new Promise(() => {})
                };
                Object.defineProperty(navigator, 'serviceWorker', { value: fakeSW, configurable: true });
            }

            const adPatterns = [
                'doubleclick.net', 'googleadservices.com', 'googlesyndication.com', '/pagead/', 'securepubads.g.doubleclick.net',
                'yandex.ru/ads', 'mc.yandex.ru', '/api/stats/ads', '/youtubei/v1/ad_break',
                'adfox.ru', 'adriver.ru', '1xbet', 'melbet', 'betboom', 'winline', 'fonbet'
            ];

            function isAd(u) {
                if (!u || typeof u !== 'string') return false;
                const lower = u.toLowerCase();
                if (lower.startsWith('ipc://') || lower.startsWith('tauri://') || lower.startsWith('data:') || lower.startsWith('blob:')) return false;
                return adPatterns.some(p => lower.includes(p));
            }

            const origOpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function(method, url, ...args) {
                if (typeof url === 'string' && isAd(url)) this.__adBlockerKilled = true;
                return origOpen.apply(this, [method, url, ...args]);
            };

            const origSend = XMLHttpRequest.prototype.send;
            XMLHttpRequest.prototype.send = function(...args) {
                if (this.__adBlockerKilled) { setTimeout(() => { if (this.abort) this.abort(); }, 0); return; }
                return origSend.apply(this, args);
            };

            const origFetch = window.fetch;
            window.fetch = function(...args) {
                const fetchUrl = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
                if (isAd(fetchUrl)) return Promise.resolve(new Response('', { status: 200 }));
                return origFetch.apply(this, args);
            };

            const origParse = JSON.parse;
            JSON.parse = function(text, reviver) {
                let obj = origParse.call(this, text, reviver);
                if (obj && typeof obj === 'object') {
                    if (obj.adPlacements) delete obj.adPlacements;
                    if (obj.adSignalsInfo) delete obj.adSignalsInfo;
                    if (obj.playerAds) delete obj.playerAds;
                    if (obj.adBreakHeartbeatParams) delete obj.adBreakHeartbeatParams;
                }
                return obj;
            };

            let ytPlayerRes = undefined;
            Object.defineProperty(window, 'ytInitialPlayerResponse', {
                get: () => ytPlayerRes,
                set: (val) => { if (val) { delete val.adPlacements; delete val.adSignalsInfo; delete val.playerAds; } ytPlayerRes = val; },
                configurable: true
            });

            const skipAds = () => {

                if (document.hidden) return;

                const skipBtns = document.querySelectorAll('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, [class*="skip-ad"], [class*="ad-skip"], .rmp-ad-skip-button');
                skipBtns.forEach(btn => { if (btn.offsetParent !== null) btn.click(); });

                const adVideos = document.querySelectorAll('.rmp-ad-vast-video-player, video[class*="ad-"], video[id*="ad-"]');
                adVideos.forEach(vid => {
                    if (vid && !vid.paused && !vid.ended) {
                        vid.muted = true; vid.playbackRate = 16.0;
                        if (!isNaN(vid.duration) && isFinite(vid.duration)) vid.currentTime = vid.duration - 0.1;
                    }
                });

                const mainVideos = document.querySelectorAll('video');
                mainVideos.forEach(video => {
                    const isAdShowing = video.closest('.ad-showing, [class*="ad-is-playing"]');
                    if (isAdShowing) {
                        video.muted = true; video.playbackRate = 16.0;
                        if (!isNaN(video.duration) && isFinite(video.duration)) video.currentTime = video.duration - 0.1;
                    }
                });
            };


            setInterval(skipAds, 250);

            window.addEventListener('DOMContentLoaded', () => {
                const style = document.createElement('style');
                style.innerHTML = `
                    ytd-ad-slot-renderer, .ytd-display-ad-renderer, #masthead-ad, .video-ads,
                    .rmp-ad-container, .preroll-block, [id^="adfox_"], [id^="yandex_rtb_"] {
                        display: none !important; opacity: 0 !important; pointer-events: none !important;
                    }
                `;
                document.head.appendChild(style);
            });
        })();
    "#;

    if adblock {
        builder = builder.initialization_script(adblock_script);
    }

    #[cfg(desktop)]
    {
        let _webview = window
            .add_child(
                builder,
                tauri::Position::Logical(tauri::LogicalPosition::new(x, y)),
                tauri::Size::Logical(tauri::LogicalSize::new(width, height)),
            )
            .map_err(|e| format!("Failed to add child webview: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
fn resize_tab(app: tauri::AppHandle, id: String, x: f64, y: f64, width: f64, height: f64) {
    if let Some(webview) = app.get_webview(&id) {
        let bounds = tauri::Rect {
            position: tauri::Position::Logical(tauri::LogicalPosition::new(x, y)),
            size: tauri::Size::Logical(tauri::LogicalSize::new(width, height)),
        };
        let _ = webview.set_bounds(bounds);
    }
}

#[tauri::command]
fn close_tab(app: tauri::AppHandle, id: String) {
    if let Some(webview) = app.get_webview(&id) {
        let _ = webview.close();
    }
}

#[tauri::command]
fn show_tab(app: tauri::AppHandle, id: String) {
    if let Some(webview) = app.get_webview(&id) {
        let _ = webview.show();
    }
}

#[tauri::command]
fn hide_tab(app: tauri::AppHandle, id: String) {
    if let Some(webview) = app.get_webview(&id) {
        let _ = webview.hide();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            go_back,
            go_forward,
            get_webview_url,
            reload_webview,
            navigate_tab,
            force_video_fullscreen,
            create_tab,
            resize_tab,
            close_tab,
            show_tab,
            hide_tab,
            toggle_frontend_fullscreen
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn force_video_fullscreen(app: tauri::AppHandle, id: String) -> Result<(), String> {
    // Получаем нужную вкладку
    let webview = app.get_webview(&id).ok_or("Webview not found")?;

    // JS-скрипт, который насильно растягивает видео
    let js = r#"
        (function() {
            // Ищем видео на странице
            let vid = document.querySelector('video');
            if (!vid) {
                // Если видео в iframe, пытаемся найти его там (работает для тех же доменов)
                let iframes = document.querySelectorAll('iframe');
                for (let i = 0; i < iframes.length; i++) {
                    try {
                        let iframeVid = iframes[i].contentDocument.querySelector('video');
                        if (iframeVid) { vid = iframeVid; break; }
                    } catch(e) {} // Игнорируем ошибки CORS
                }
            }

            if (!vid) return; // Видео не найдено

            if (document.getElementById('minimal-fs-style')) {
                // Если уже на весь экран — выключаем
                document.getElementById('minimal-fs-style').remove();
                vid.classList.remove('force-fs-minimal');
            } else {
                // Если нет — растягиваем!
                let style = document.createElement('style');
                style.id = 'minimal-fs-style';
                style.innerHTML = `
                    .force-fs-minimal {
                        position: fixed !important;
                        top: 0 !important;
                        left: 0 !important;
                        width: 100vw !important;
                        height: 100vh !important;
                        z-index: 2147483647 !important;
                        background: black !important;
                        object-fit: contain !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                `;
                document.head.appendChild(style);
                vid.classList.add('force-fs-minimal');
            }
        })();
    "#;

    webview.eval(js).map_err(|e| e.to_string())?;
    Ok(())
}
