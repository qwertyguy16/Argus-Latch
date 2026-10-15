(function () {
    // Argus Captcha Intelligent Widget Script - Premium Version
    const scriptSrc = document.currentScript ? document.currentScript.src : window.location.origin + '/v1/captcha';
    const HOST = scriptSrc.split('/v1/captcha')[0];

    // Telemetry Collection
    let telemetryData = {
        mouseEvents: 0,
        mouseTrajectory: [],
        timeOnPage: 0,
        webdriver: false,
        plugins: 0,
        screenRes: "",
        typingCadence: [],
        touchPressures: [],
        canvasFingerprint: "",
        webglRenderer: "",
        hardwareConcurrency: navigator.hardwareConcurrency || 0,
        deviceMemory: navigator.deviceMemory || 0,
        audioFingerprint: "",
        clickDurations: [],
        maxMouseVelocity: 0
    };

    const initTime = Date.now();

    // Audio Fingerprinting
    try {
        const audioCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 44100, 44100);
        const oscillator = audioCtx.createOscillator();
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(10000, audioCtx.currentTime);
        const compressor = audioCtx.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-50, audioCtx.currentTime);
        compressor.knee.setValueAtTime(40, audioCtx.currentTime);
        compressor.ratio.setValueAtTime(12, audioCtx.currentTime);
        compressor.attack.setValueAtTime(0, audioCtx.currentTime);
        compressor.release.setValueAtTime(0.25, audioCtx.currentTime);
        oscillator.connect(compressor);
        compressor.connect(audioCtx.destination);
        oscillator.start(0);
        audioCtx.startRendering().then(buffer => {
            let sum = 0;
            const channelData = buffer.getChannelData(0);
            for (let i = 4500; i < 5000; i++) {
                sum += Math.abs(channelData[i]);
            }
            telemetryData.audioFingerprint = sum.toString();
        }).catch(() => { });
    } catch (e) { }

    // Click duration
    let mouseDownTime = 0;
    document.addEventListener('mousedown', () => mouseDownTime = Date.now(), { passive: true });
    document.addEventListener('mouseup', () => {
        if (mouseDownTime > 0) {
            telemetryData.clickDurations.push(Date.now() - mouseDownTime);
        }
    }, { passive: true });

    async function solvePoW(sitekey) {
        const timestamp = Date.now();
        let nonce = 0;
        const prefix = "0000";
        const encoder = new TextEncoder();
        while (true) {
            const msg = sitekey + timestamp + nonce;
            const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(msg));
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            if (hashHex.startsWith(prefix)) {
                return { nonce, timestamp, hashHex };
            }
            nonce++;
            if (nonce % 500 === 0) {
                await new Promise(r => setTimeout(r, 0));
            }
        }
    }

    function obfuscatePayload(payloadStr, sitekey) {
        let result = "";
        for (let i = 0; i < payloadStr.length; i++) {
            let keyChar = sitekey.charCodeAt(i % sitekey.length);
            result += String.fromCharCode(payloadStr.charCodeAt(i) ^ keyChar);
        }
        return btoa(result);
    }

    if (navigator.webdriver || window.document.__selenium_unwrapped || window.callPhantom || window._phantom || window.cdc_adoQpoasnfa76pfcZLmcfl_Array || document.documentElement.getAttribute("webdriver")) {
        telemetryData.webdriver = true;
    }

    try {
        const glCanvas = document.createElement('canvas');
        const gl = glCanvas.getContext('webgl') || glCanvas.getContext('experimental-webgl');
        if (gl) {
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
                telemetryData.webglRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
            }
        }
    } catch (e) { }
    telemetryData.plugins = navigator.plugins ? navigator.plugins.length : 0;
    telemetryData.screenRes = `${window.screen.width}x${window.screen.height}`;

    // Typing cadence
    let lastKeyTime = Date.now();
    document.addEventListener('keydown', function (e) {
        let now = Date.now();
        if (telemetryData.typingCadence.length < 20) {
            telemetryData.typingCadence.push(now - lastKeyTime);
        }
        lastKeyTime = now;
    }, { passive: true });

    // Touch pressure
    document.addEventListener('touchmove', function (e) {
        if (e.touches && e.touches.length > 0 && e.touches[0].force !== undefined) {
            if (telemetryData.touchPressures.length < 20) {
                telemetryData.touchPressures.push(e.touches[0].force);
            }
        }
    }, { passive: true });

    // Canvas Fingerprinting
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 200; canvas.height = 50;
        ctx.textBaseline = "top";
        ctx.font = "14px 'Arial'";
        ctx.fillStyle = "#f60";
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = "#069";
        ctx.fillText("Argus Captcha Fingerprint", 2, 15);
        ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
        ctx.fillText("Argus Captcha Fingerprint", 4, 17);
        telemetryData.canvasFingerprint = canvas.toDataURL().substring(0, 50); // Get a stable prefix/hash
    } catch (e) { }

    document.addEventListener('mousemove', function (e) {
        telemetryData.mouseEvents++;
        const now = Date.now();
        const t = now - initTime;
        if (telemetryData.mouseEvents % 5 === 0 && telemetryData.mouseTrajectory.length < 20) {
            telemetryData.mouseTrajectory.push({ x: e.clientX, y: e.clientY, t: t });
        }
        if (telemetryData.mouseTrajectory.length > 1) {
            let last = telemetryData.mouseTrajectory[telemetryData.mouseTrajectory.length - 2];
            let curr = { x: e.clientX, y: e.clientY, t: t };
            let dist = Math.sqrt(Math.pow(curr.x - last.x, 2) + Math.pow(curr.y - last.y, 2));
            let dt = curr.t - last.t;
            if (dt > 0) {
                let v = dist / dt;
                if (v > telemetryData.maxMouseVelocity) telemetryData.maxMouseVelocity = v;
            }
        }
    }, { passive: true });

    function getHoneypotValue(container) {
        let form = container.closest('form');
        if (form) {
            let honeypot = form.querySelector('input[name="website_url"]');
            if (honeypot) return honeypot.value;
        }
        return "";
    }

    function analyzeMouseBehavior() {
        if (telemetryData.mouseEvents === 0) return 100;
        if (telemetryData.mouseTrajectory.length < 3) return 80;

        let straightLines = 0;
        for (let i = 2; i < telemetryData.mouseTrajectory.length; i++) {
            let p1 = telemetryData.mouseTrajectory[i - 2];
            let p2 = telemetryData.mouseTrajectory[i - 1];
            let p3 = telemetryData.mouseTrajectory[i];

            let dx1 = p2.x - p1.x;
            let dy1 = p2.y - p1.y;
            let dx2 = p3.x - p2.x;
            let dy2 = p3.y - p2.y;

            if (dx1 * dy2 === dy1 * dx2) straightLines++;
        }

        if (straightLines > 0 && straightLines >= telemetryData.mouseTrajectory.length - 2) return 90;
        return 0;
    }

    function initCaptcha() {
        const containers = document.querySelectorAll('.argus-captcha');

        containers.forEach(async container => {
            if (container.dataset.initialized) return;
            container.dataset.initialized = "true";

            const sitekey = container.dataset.sitekey;

            let parentForm = container.closest('form');
            let submitButtons = [];
            if (parentForm) {
                submitButtons = parentForm.querySelectorAll('button[type="submit"], input[type="submit"]');
            }

            let mode = 'manual';
            let theme = 'auto';
            let initialError = null;
            let isTestMode = false;

            if (!sitekey) {
                initialError = "Missing sitekey";
            } else if (sitekey === 'argus_simulate_network_error') {
                initialError = "Network Error";
            } else {
                try {
                    const res = await fetch(`${HOST}/v1/captcha/settings?sitekey=${encodeURIComponent(sitekey)}`);
                    const data = await res.json();
                    if (!data.success) {
                        initialError = data.error || 'Failed to load settings';
                    } else {
                        mode = data.mode || 'manual';
                        theme = data.theme || 'auto';
                        isTestMode = data.is_test || false;
                    }
                } catch (err) {
                    console.error("Argus Captcha Settings Error:", err);
                    initialError = "Network Error";
                }
            }



            const widget = document.createElement('div');
            const box = document.createElement('div');
            const text = document.createElement('div');
            const subText = document.createElement('div');
            const brand = document.createElement('div');
            const logoContainer = document.createElement('div');
            const checkboxContainer = document.createElement('div');

            if (theme === 'auto') {
                theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            }

            let colors;
            if (theme === 'dark') {
                colors = {
                    bg: '#222222',
                    border: '#525252',
                    text: '#f9f9f9',
                    subText: '#9ca3af',
                    boxBg: '#333333',
                    boxBorder: '#525252',
                    hoverBorder: '#6b7280'
                };
            } else {
                colors = {
                    bg: '#f9f9f9',
                    border: '#d3d3d3',
                    text: '#555555',
                    subText: '#999999',
                    boxBg: '#fff',
                    boxBorder: '#c1c1c1',
                    hoverBorder: '#b2b2b2'
                };
            }

            widget.classList.add('argus-captcha-widget-box');
            widget.style.cssText = `
                background: ${colors.bg};
                border-radius: 3px;
                border: 1px solid ${colors.border};
                display: flex;
                align-items: center;
                padding: 0 12px;
                box-sizing: border-box;
                font-family: Roboto, Helvetica, Arial, sans-serif;
                box-shadow: 0px 0px 4px 1px rgba(0,0,0,0.08);
                position: relative;
                overflow: hidden;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                cursor: default;
                color: ${colors.text};
                margin: 0 auto;
            `;

            let isProcessing = false;
            let isFailed = false;

            widget.onmouseenter = () => {
                if (container.dataset.verified !== "true" && !isProcessing && !isFailed) {
                    box.style.borderColor = colors.hoverBorder;
                }
            };

            widget.onmouseleave = () => {
                if (container.dataset.verified !== "true" && !isProcessing && !isFailed) {
                    box.style.borderColor = colors.boxBorder;
                }
            };

            checkboxContainer.style.cssText = `
                width: 28px;
                height: 28px;
                margin-right: 12px;
                position: relative;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1;
            `;

            box.style.cssText = `
                width: 28px;
                height: 28px;
                border: 2px solid ${colors.boxBorder};
                background: ${colors.boxBg};
                border-radius: 2px;
                transition: all 0.2s ease;
                box-sizing: border-box;
            `;

            const spinner = document.createElement('div');
            spinner.style.cssText = `
                width: 20px;
                height: 20px;
                border: 3px solid rgba(59, 130, 246, 0.1);
                border-top-color: #3b82f6;
                border-radius: 50%;
                animation: argus-spin 1s linear infinite;
                display: none;
                position: absolute;
            `;

            const checkmark = document.createElement('div');
            checkmark.innerHTML = `<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="14" cy="14" r="14" fill="#10b981"/><polyline points="8 14 12 18 20 10" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="stroke-dasharray: 50; stroke-dashoffset: 50;"></polyline></svg>`;
            checkmark.style.cssText = `
                display: none;
                position: absolute;
            `;

            const crossmark = document.createElement('div');
            crossmark.innerHTML = `<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="14" cy="14" r="14" fill="#ef4444"/>
                <line x1="9" y1="9" x2="19" y2="19" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="stroke-dasharray: 15; stroke-dashoffset: 15;"></line>
                <line x1="19" y1="9" x2="9" y2="19" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="stroke-dasharray: 15; stroke-dashoffset: 15;"></line>
            </svg>`;
            crossmark.style.cssText = `
                display: none;
                position: absolute;
            `;

            const exclamation = document.createElement('div');
            exclamation.innerHTML = `<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="14" cy="14" r="14" fill="#f59e0b"/>
                <line x1="14" y1="8" x2="14" y2="15.5" stroke="white" stroke-width="2.6" stroke-linecap="round"></line>
                <circle cx="14" cy="19.5" r="1.4" fill="white"></circle>
            </svg>`;
            exclamation.style.cssText = `
                display: none;
                position: absolute;
            `;

            checkboxContainer.appendChild(box);
            checkboxContainer.appendChild(spinner);
            checkboxContainer.appendChild(checkmark);
            checkboxContainer.appendChild(crossmark);
            checkboxContainer.appendChild(exclamation);

            const textContainer = document.createElement('div');
            textContainer.style.cssText = `
                flex: 1;
                display: flex;
                flex-direction: column;
                z-index: 1;
                min-width: 0;
                justify-content: center;
            `;

            text.innerText = "I'm not a robot";
            text.style.cssText = `
                font-size: 14px;
                color: ${colors.text};
                font-weight: 400;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                line-height: 1.2;
            `;

            subText.style.cssText = `
                font-size: 11px;
                color: ${colors.subText};
                opacity: 0.7;
                margin-top: 2px;
                display: none;
                animation: argus-fade 0.5s ease;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            `;

            const learnMore = document.createElement('a');
            learnMore.innerText = 'Learn more';
            learnMore.target = '_blank';
            learnMore.rel = 'noopener noreferrer';
            const refHost = window.location.hostname;
            learnMore.href = 'https://argusgroup.co.uk/help/latch/errors' + (refHost ? `?r=${encodeURIComponent(refHost)}` : '');
            learnMore.style.cssText = `
                font-size: 10px;
                color: #3b82f6;
                text-decoration: none;
                margin-top: 1px;
                display: none;
                width: fit-content;
                cursor: pointer;
                line-height: 1.2;
            `;
            learnMore.onmouseenter = () => { learnMore.style.textDecoration = 'underline'; };
            learnMore.onmouseleave = () => { learnMore.style.textDecoration = 'none'; };
            learnMore.addEventListener('click', (e) => e.stopPropagation());

            textContainer.appendChild(text);
            textContainer.appendChild(subText);
            textContainer.appendChild(learnMore);

            logoContainer.style.cssText = `
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                z-index: 1;
                padding-left: 12px;
                height: 100%;
                background: transparent;
            `;

            const logoImgContainer = document.createElement('div');
            logoImgContainer.style.cssText = `
                width: 46px;
                height: 46px;
                margin-bottom: 2px;
                display: flex;
                align-items: center;
                justify-content: center;
            `;
            // Subtle lock or shield icon to look like a brand logo (like recaptcha loop)
            logoImgContainer.innerHTML = `<img src="https://argusgroup.co.uk/static/images/Logo${theme === 'dark' ? 'white' : 'black'}.png" style="width: 42px; height: 42px; object-fit: contain;" alt="Argus Logo">`;

            brand.innerText = "Argus";
            brand.style.cssText = `
                font-size: 10px;
                font-weight: 400;
                color: ${colors.subText};
                margin-bottom: 2px;
            `;

            const privacyContainer = document.createElement('div');
            privacyContainer.style.cssText = "display: flex; align-items: center;";

            const privacy = document.createElement('div');
            privacy.innerHTML = "<a href='https://argusgroup.co.uk/legal/privacy' target='_blank' style='color:#9ca3af; text-decoration:none;'>Privacy</a> - <a href='https://argusgroup.co.uk/legal/terms' target='_blank' style='color:#9ca3af; text-decoration:none;'>Terms</a>";
            privacy.style.cssText = `
                font-size: 8px;
                color: #9ca3af;
                text-decoration: none;
                margin-top: -2px;
            `;

            privacyContainer.appendChild(privacy);

            logoContainer.appendChild(logoImgContainer);
            // logoContainer.appendChild(brand); // removed brand text to look more like the icon only then privacy
            logoContainer.appendChild(privacyContainer);

            widget.appendChild(checkboxContainer);
            widget.appendChild(textContainer);
            widget.appendChild(logoContainer);

            if (mode === 'invisible') {
                widget.style.display = 'none';

                const badge = document.createElement('div');
                badge.style.cssText = `
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    background: #fff;
                    border: 1px solid rgba(128, 128, 128, 0.2);
                    border-radius: 6px;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                    display: flex;
                    align-items: center;
                    padding: 8px;
                    z-index: 999999;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    cursor: pointer;
                    overflow: hidden;
                    transition: max-width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    max-width: 16px;
                    white-space: nowrap;
                    color: #1f2937;
                    box-sizing: content-box;
                `;

                const badgeIcon = document.createElement('div');
                badgeIcon.innerHTML = `<img src="https://argusgroup.co.uk/static/images/Logo${theme === 'dark' ? 'white' : 'black'}.png" style="width: 24px; height: 24px; object-fit: contain;" alt="Argus Logo">`;
                badgeIcon.style.cssText = `
                    min-width: 24px;
                    height: 24px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    color: #4b5563;
                `;

                const badgeContent = document.createElement('div');
                badgeContent.style.cssText = `
                    display: flex;
                    flex-direction: column;
                    margin-left: 12px;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                `;

                const badgeBrand = document.createElement('div');
                badgeBrand.innerText = "Secured by Argus Latch";
                badgeBrand.style.cssText = `
                    font-size: 11px;
                    font-weight: 600;
                    color: #374151;
                `;

                const badgeLinks = document.createElement('div');
                badgeLinks.innerHTML = "<a href='https://argusgroup.co.uk/legal/privacy' target='_blank' style='color:#6b7280; text-decoration:none;'>Privacy</a> - <a href='https://argusgroup.co.uk/legal/terms' target='_blank' style='color:#6b7280; text-decoration:none;'>Terms</a>";
                badgeLinks.style.cssText = `
                    font-size: 9px;
                    margin-top: 2px;
                `;

                badgeContent.appendChild(badgeBrand);
                badgeContent.appendChild(badgeLinks);
                badge.appendChild(badgeIcon);
                badge.appendChild(badgeContent);

                badge.onmouseenter = () => {
                    badge.style.maxWidth = '200px';
                    badgeContent.style.opacity = '1';
                };

                badge.onmouseleave = () => {
                    badge.style.maxWidth = '16px';
                    badgeContent.style.opacity = '0';
                };

                document.body.appendChild(badge);
            }

            container.appendChild(widget);

            if (isTestMode) {
                const testBanner = document.createElement('div');
                testBanner.innerText = "For testing only, if seen, report to site owner.";
                testBanner.style.cssText = `
                    color: #ef4444;
                    font-size: 9px;
                    font-weight: 600;
                    margin-top: 2px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                `;
                textContainer.appendChild(testBanner);
            }

            // Inject Honeypot
            let form = container.closest('form');
            if (form && !form.querySelector('input[name="website_url"]')) {
                let honeypot = document.createElement('input');
                honeypot.type = 'text';
                honeypot.name = 'website_url';
                honeypot.setAttribute('style', 'position:absolute; top:-9999px; left:-9999px; opacity:0; z-index:-1;');
                honeypot.tabIndex = -1;
                honeypot.autocomplete = 'off';
                form.appendChild(honeypot);
            }

            // Visual Challenge UI Modal Overlay
            const visualOverlay = document.createElement('div');
            visualOverlay.id = 'argus-visual-overlay';
            visualOverlay.style.cssText = `
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0, 0, 0, 0.65);
                backdrop-filter: blur(4px);
                -webkit-backdrop-filter: blur(4px);
                z-index: 2147483647;
                align-items: center;
                justify-content: center;
                box-sizing: border-box;
            `;

            const visualContainer = document.createElement('div');
            visualContainer.id = 'argus-visual-container';
            visualContainer.style.cssText = `
                width: 100%;
                max-width: 380px;
                padding: 22px 24px;
                background: ${colors.bg};
                border: 1px solid ${colors.border};
                border-radius: 16px;
                box-sizing: border-box;
                text-align: center;
                box-shadow: 0 20px 45px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06);
                position: relative;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            `;

            const closeModal = () => {
                visualOverlay.style.display = 'none';
                isProcessing = false;
                isFailed = false;
                spinner.style.display = 'none';
                crossmark.style.display = 'none';
                checkmark.style.display = 'none';
                exclamation.style.display = 'none';
                box.style.display = 'block';
                box.style.borderColor = colors.boxBorder;
                text.innerText = "I'm not a robot";
                text.style.color = colors.text;
                subText.style.display = 'none';
                widget.style.borderColor = colors.border;
            };

            const createHeaderIconBtn = (svgHtml, title, onClick) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.title = title;
                btn.setAttribute('aria-label', title);
                btn.innerHTML = svgHtml;
                btn.style.cssText = `
                    display: inline-flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    width: 34px !important;
                    height: 34px !important;
                    min-width: 34px !important;
                    min-height: 34px !important;
                    max-width: 34px !important;
                    max-height: 34px !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    border: 1px solid ${colors.border || 'rgba(255,255,255,0.1)'} !important;
                    border-radius: 8px !important;
                    background: ${colors.boxBg || 'rgba(255,255,255,0.05)'} !important;
                    color: ${colors.subText} !important;
                    cursor: pointer !important;
                    outline: none !important;
                    box-shadow: none !important;
                    box-sizing: border-box !important;
                    transition: all 0.2s ease !important;
                    flex-shrink: 0 !important;
                    line-height: 1 !important;
                `;
                btn.onmouseover = () => {
                    btn.style.color = colors.text;
                    btn.style.borderColor = '#3b82f6';
                    btn.style.background = 'rgba(59, 130, 246, 0.12)';
                    btn.style.transform = 'translateY(-1px)';
                };
                btn.onmouseout = () => {
                    btn.style.color = colors.subText;
                    btn.style.borderColor = colors.border || 'rgba(255,255,255,0.1)';
                    btn.style.background = colors.boxBg || 'rgba(255,255,255,0.05)';
                    btn.style.transform = 'translateY(0)';
                };
                btn.onclick = onClick;
                return btn;
            };

            const renderModalHeader = (titleText, descText, switchType, onSwitch) => {
                const headerRow = document.createElement('div');
                headerRow.style.cssText = `
                    display: flex !important;
                    align-items: flex-start !important;
                    justify-content: space-between !important;
                    margin-bottom: 20px !important;
                    width: 100% !important;
                    text-align: left !important;
                    box-sizing: border-box !important;
                `;

                const textCol = document.createElement('div');
                textCol.style.cssText = `
                    flex: 1 !important;
                    padding-right: 12px !important;
                    min-width: 0 !important;
                `;

                const titleEl = document.createElement('h3');
                titleEl.innerText = titleText;
                titleEl.style.cssText = `
                    margin: 0 0 5px 0 !important;
                    font-size: 17px !important;
                    font-weight: 600 !important;
                    color: ${colors.text} !important;
                    line-height: 1.25 !important;
                    font-family: inherit !important;
                `;

                const descEl = document.createElement('p');
                descEl.innerText = descText;
                descEl.style.cssText = `
                    margin: 0 !important;
                    font-size: 13.5px !important;
                    color: ${colors.subText} !important;
                    line-height: 1.4 !important;
                    font-family: inherit !important;
                `;

                textCol.appendChild(titleEl);
                textCol.appendChild(descEl);
                headerRow.appendChild(textCol);

                const actionsCol = document.createElement('div');
                actionsCol.style.cssText = `
                    display: flex !important;
                    align-items: center !important;
                    gap: 6px !important;
                    flex-shrink: 0 !important;
                `;

                if (switchType === 'audio') {
                    const audioBtn = createHeaderIconBtn(
                        `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex-shrink:0;"><path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path></svg>`,
                        'Switch to audio challenge (Accessibility)',
                        onSwitch
                    );
                    actionsCol.appendChild(audioBtn);
                } else if (switchType === 'visual') {
                    const visualBtn = createHeaderIconBtn(
                        `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex-shrink:0;"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
                        'Switch to visual challenge',
                        onSwitch
                    );
                    actionsCol.appendChild(visualBtn);
                }

                const closeBtn = createHeaderIconBtn(
                    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex-shrink:0;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
                    'Close',
                    closeModal
                );
                actionsCol.appendChild(closeBtn);

                headerRow.appendChild(actionsCol);
                visualContainer.appendChild(headerRow);
                return { titleEl, descEl, actionsCol };
            };

            visualOverlay.appendChild(visualContainer);
            document.body.appendChild(visualOverlay);

            if (!document.getElementById('argus-captcha-styles')) {
                const style = document.createElement('style');
                style.id = 'argus-captcha-styles';
                style.innerHTML = `
                    #argus-visual-overlay * {
                        box-sizing: border-box !important;
                    }
                    #argus-visual-overlay button {
                        font-family: inherit !important;
                        text-transform: none !important;
                        margin: 0;
                    }
                    @keyframes argus-spin { to { transform: rotate(360deg); } }
                    @keyframes argus-fade { from { opacity: 0; } to { opacity: 1; } }
                    @keyframes argus-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
                    @keyframes argus-draw {
                        from { stroke-dashoffset: 50; }
                        to { stroke-dashoffset: 0; }
                    }
                    @keyframes argus-draw-cross {
                        from { stroke-dashoffset: 15; }
                        to { stroke-dashoffset: 0; }
                    }
                    @keyframes argus-draw-exclamation {
                        from { stroke-dashoffset: 10; }
                        to { stroke-dashoffset: 0; }
                    }
                    @keyframes argus-pop-in {
                        0% { transform: scale(0); opacity: 0; }
                        60% { transform: scale(1.15); opacity: 1; }
                        100% { transform: scale(1); opacity: 1; }
                    }
                    @keyframes argus-pop-out {
                        0% { transform: scale(1); opacity: 1; }
                        100% { transform: scale(0.8); opacity: 0; }
                    }
                    @keyframes argus-shake {
                        0%, 100% { transform: translateX(0); }
                        25% { transform: translateX(-5px); }
                        75% { transform: translateX(5px); }
                    }
                    .argus-captcha-widget-box {
                        width: 340px;
                        max-width: 100%;
                        height: 78px;
                    }
                    @media (max-width: 380px) {
                        .argus-captcha-widget-box {
                            width: 100%;
                            height: 72px;
                        }
                    }
                `;
                document.head.appendChild(style);
            }

            const injectToken = (token) => {
                const timestamp = new Date().toISOString();
                console.log(`[Argus Captcha] Completed at: ${timestamp} | Result: PASS | Website: ${window.location.href}`);
                spinner.style.display = 'none';
                box.style.display = 'none';
                checkmark.style.display = 'block';
                checkmark.style.animation = 'none';
                void checkmark.offsetWidth;
                checkmark.style.animation = 'argus-pop-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards';

                const polyline = checkmark.querySelector('polyline');
                polyline.style.animation = 'none';
                void polyline.offsetWidth;
                polyline.style.animation = 'argus-draw 0.4s ease 0.2s both';

                text.innerText = "Success!";
                text.style.color = '#10b981';
                subText.style.display = 'none';

                widget.style.borderColor = '#10b981';
                widget.style.boxShadow = '0 0 0 1px rgba(16, 185, 129, 0.2)';

                container.dataset.verified = "true";
                container.dispatchEvent(new CustomEvent('argus-captcha-verified', { detail: { token } }));



                let form = container.closest('form');
                if (form) {
                    let input = form.querySelector('input[name="argus-captcha-response"]');
                    if (!input) {
                        input = document.createElement('input');
                        input.type = 'hidden';
                        input.name = 'argus-captcha-response';
                        form.appendChild(input);
                    }
                    input.value = token;
                    if (mode === 'invisible') {
                        HTMLFormElement.prototype.submit.call(form);
                    }
                }

                const cbName = container.dataset.callback;
                if (cbName && typeof window[cbName] === 'function') {
                    window[cbName](token);
                }
                container.dispatchEvent(new CustomEvent('argus-success', { detail: { token: token } }));
            };

            const getPresetErrorDescription = (errMsg) => {
                if (!errMsg) return "An unexpected error occurred.";
                const str = String(errMsg).toLowerCase().trim();

                if (str.includes("network") || str.includes("failed to fetch") || str.includes("connection")) {
                    return "Connection failed. Click to retry.";
                }
                if (str.includes("service") || str.includes("unavailable") || str.includes("server") || str.includes("500") || str.includes("503") || str.includes("settings") || str.includes("load") || str.includes("simulated") || str.includes("demo")) {
                    return "Service temporarily unavailable.";
                }
                if (str.includes("blocked") || str.includes("high risk") || str.includes("security validation") || str.includes("403")) {
                    return "Verification blocked by security policy.";
                }
                if (str.includes("rate limit") || str.includes("too many") || str.includes("429")) {
                    return "Too many requests. Try again later.";
                }
                if (str.includes("expired") || str.includes("timeout")) {
                    return "Verification expired. Please retry.";
                }
                if (str.includes("missing sitekey") || str.includes("missing site_key") || str.includes("invalid sitekey") || str.includes("invalid site_key") || str.includes("invalid key") || str.includes("not found")) {
                    return "Invalid verification configuration.";
                }
                if (str.includes("domain") && (str.includes("not authorized") || str.includes("unauthorized") || str.includes("mismatch"))) {
                    return "Domain not authorized.";
                }
                if (str.includes("audio") && str.includes("fail")) {
                    return "Audio challenge unavailable.";
                }
                if (errMsg.length <= 32) {
                    return errMsg;
                }
                return "Verification service error.";
            };

            const triggerError = (msg, isFatal = false) => {
                const timestamp = new Date().toISOString();
                const desc = getPresetErrorDescription(msg);
                console.log(`[Argus Captcha] Completed at: ${timestamp} | Result: FAIL | Reason: ${msg} (${desc}) | Website: ${window.location.href}`);
                isProcessing = false;
                isFailed = true;

                const errorCbName = container.dataset.errorCallback;
                if (errorCbName && typeof window[errorCbName] === 'function') {
                    window[errorCbName](msg, desc);
                }
                container.dispatchEvent(new CustomEvent('argus-error', { detail: { message: msg, description: desc } }));

                spinner.style.display = 'none';
                box.style.display = 'none';

                if (isFatal) {
                    crossmark.style.display = 'none';
                    checkmark.style.display = 'none';
                    exclamation.style.display = 'block';
                    exclamation.style.animation = 'none';
                    void exclamation.offsetWidth;
                    exclamation.style.animation = 'argus-pop-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards';

                    text.innerText = "Error";
                    text.style.color = '#f59e0b';
                    text.style.fontWeight = '500';
                    text.style.fontSize = '14px';

                    subText.innerText = desc;
                    subText.style.display = 'block';
                    subText.style.color = colors.subText;
                    subText.style.fontSize = '11px';
                    subText.style.lineHeight = '1.3';
                    subText.style.opacity = '0.9';
                    subText.title = msg ? `${desc} (${msg})` : desc;
                    let errorCode = "service_unavailable";
                    const lowerMsg = String(msg || "").toLowerCase();
                    if (lowerMsg.includes("blocked") || lowerMsg.includes("high risk") || lowerMsg.includes("security validation") || lowerMsg.includes("403")) {
                        errorCode = "blocked";
                    } else if (lowerMsg.includes("network") || lowerMsg.includes("failed to fetch") || lowerMsg.includes("connection")) {
                        errorCode = "network";
                    } else if (lowerMsg.includes("domain") && (lowerMsg.includes("not authorized") || lowerMsg.includes("unauthorized") || lowerMsg.includes("mismatch"))) {
                        errorCode = "unauthorized_domain";
                    } else if (lowerMsg.includes("rate limit") || lowerMsg.includes("too many") || lowerMsg.includes("429")) {
                        errorCode = "rate_limited";
                    } else if (lowerMsg.includes("missing sitekey") || lowerMsg.includes("missing site_key") || lowerMsg.includes("invalid sitekey") || lowerMsg.includes("invalid site_key") || lowerMsg.includes("invalid key") || lowerMsg.includes("not found")) {
                        errorCode = "invalid_key";
                    } else if (lowerMsg.includes("service") || lowerMsg.includes("unavailable") || lowerMsg.includes("server") || lowerMsg.includes("500") || lowerMsg.includes("503") || lowerMsg.includes("settings") || lowerMsg.includes("load") || lowerMsg.includes("simulated") || lowerMsg.includes("demo")) {
                        errorCode = "service_unavailable";
                    }

                    const params = [];
                    if (refHost) {
                        params.push(`r=${encodeURIComponent(refHost)}`);
                    }
                    if (errorCode) {
                        params.push(`e=${encodeURIComponent(errorCode)}`);
                    }
                    learnMore.href = 'https://argusgroup.co.uk/help/latch/errors' + (params.length > 0 ? `?${params.join('&')}` : '');
                    learnMore.style.display = 'block';

                    widget.style.borderColor = 'rgba(245, 158, 11, 0.6)';
                    widget.style.boxShadow = '0 0 0 1px rgba(245, 158, 11, 0.2), 0 2px 8px rgba(245, 158, 11, 0.08)';
                    widget.style.cursor = 'not-allowed';
                    widget.title = `Argus Error: ${desc} - ${msg}`;

                    // If network error, provide click-to-retry
                    if (String(msg).toLowerCase().includes('network') || String(msg).toLowerCase().includes('connection') || String(msg).toLowerCase().includes('fetch')) {
                        widget.style.cursor = 'pointer';
                        subText.innerText = `${desc}`;
                        const retryHandler = () => {
                            widget.removeEventListener('click', retryHandler);
                            exclamation.style.display = 'none';
                            box.style.display = 'block';
                            text.innerText = "Verify you are human";
                            text.style.color = colors.text;
                            subText.style.display = 'none';
                            learnMore.style.display = 'none';
                            widget.style.borderColor = colors.border;
                            widget.style.boxShadow = '0px 0px 4px 1px rgba(0,0,0,0.08)';
                            widget.style.cursor = 'default';
                            isFailed = false;
                            executeChallenge();
                        };
                        widget.addEventListener('click', retryHandler, { once: true });
                    }

                    return; // Permanent error, do not reset
                }

                crossmark.style.display = 'block';
                crossmark.style.animation = 'none';
                void crossmark.offsetWidth;
                crossmark.style.animation = 'argus-pop-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards';

                const lines = crossmark.querySelectorAll('line');
                lines[0].style.animation = 'none';
                lines[1].style.animation = 'none';
                void crossmark.offsetWidth;
                lines[0].style.animation = 'argus-draw-cross 0.3s ease 0.2s both';
                lines[1].style.animation = 'argus-draw-cross 0.3s ease 0.35s both';

                text.innerText = "Failed!";
                text.style.color = colors.text;
                subText.style.display = 'none'; // Ensure no details are shown
                widget.style.borderColor = colors.border;

                // Allow them to click again after 3 seconds
                setTimeout(() => {
                    if (container.dataset.verified !== "true") {
                        crossmark.style.animation = 'argus-pop-out 0.4s ease forwards';
                        text.style.color = colors.text;
                        widget.style.borderColor = colors.border;

                        setTimeout(() => {
                            crossmark.style.display = 'none';
                            crossmark.style.animation = 'none'; // reset for next time
                            box.style.display = 'block';
                            box.style.borderColor = colors.boxBorder;
                            text.innerText = "Verify you are human";
                            subText.style.display = 'none';
                            isFailed = false;
                        }, 400); // wait for fade out
                    }
                }, 3000);
            };

            if (initialError) {
                triggerError(initialError, true);
            }

            const executeChallenge = async () => {
                if (container.dataset.verified === "true") return;
                if (isProcessing || isFailed) return; // prevent spamming clicks

                isProcessing = true;
                if (mode === 'manual') {
                    box.style.display = 'none';
                    spinner.style.display = 'block';
                    text.innerText = "Verifying you are human...";
                }

                console.log(`[Argus Captcha] Initiating challenge...`);

                try {
                    telemetryData.timeOnPage = Date.now() - initTime;

                    let powData = null;
                    try {
                        if (window.crypto && window.crypto.subtle) {
                            powData = await solvePoW(sitekey);
                        } else {
                            console.warn("[Argus Captcha] WebCrypto API is not available. PoW skipped.");
                        }
                    } catch (e) {
                        console.warn("[Argus Captcha] PoW generation failed.", e);
                    }

                    const rawTelemetry = {
                        webdriver: telemetryData.webdriver,
                        mouseScore: analyzeMouseBehavior(),
                        timeOnPage: telemetryData.timeOnPage,
                        screenRes: telemetryData.screenRes,
                        typingCadence: telemetryData.typingCadence,
                        touchPressures: telemetryData.touchPressures,
                        canvasFingerprint: telemetryData.canvasFingerprint,
                        webglRenderer: telemetryData.webglRenderer,
                        hardwareConcurrency: telemetryData.hardwareConcurrency,
                        deviceMemory: telemetryData.deviceMemory,
                        audioFingerprint: telemetryData.audioFingerprint,
                        clickDurations: telemetryData.clickDurations,
                        maxMouseVelocity: telemetryData.maxMouseVelocity,
                        honeypot: getHoneypotValue(container),
                        forceVisual: window.forceArgusVisual === true,
                        forceChallenge: window.forceArgusChallenge || null,
                        url: window.location.href,
                        pow: powData
                    };

                    const tData = obfuscatePayload(JSON.stringify(rawTelemetry), sitekey);

                    const payload = {
                        sitekey: sitekey,
                        telemetry: tData
                    };

                    const res = await fetch(`${HOST}/v1/captcha/challenge`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    const data = await res.json();

                    if (data.success && data.token) {
                        console.log(`[Argus Captcha] Validation [PASS]`);
                        injectToken(data.token);
                    }
                    else if (data.requires_visual) {
                        isProcessing = false;
                        text.innerText = "Action required";
                        subText.innerText = "Please solve the challenge below.";
                        subText.style.display = 'block';

                        visualContainer.innerHTML = ''; // clear

                        const renderAudioError = (errorMsg) => {
                            visualContainer.innerHTML = '';
                            renderModalHeader("Audio Challenge", "Accessibility verification", 'visual', () => {
                                isProcessing = false;
                                visualContainer.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
                                visualContainer.style.opacity = '0';
                                visualContainer.style.transform = 'scale(0.97)';
                                setTimeout(() => {
                                    executeChallenge();
                                    visualContainer.style.opacity = '1';
                                    visualContainer.style.transform = 'scale(1)';
                                }, 150);
                            });

                            const errBox = document.createElement('div');
                            errBox.style.cssText = `
                                padding: 24px 16px;
                                text-align: center;
                                font-family: inherit;
                                box-sizing: border-box;
                            `;

                            const iconDiv = document.createElement('div');
                            iconDiv.style.cssText = `
                                width: 44px;
                                height: 44px;
                                margin: 0 auto 12px auto;
                                border-radius: 50%;
                                background: rgba(239, 68, 68, 0.12);
                                color: #ef4444;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                            `;
                            iconDiv.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="10" r="8"></circle><line x1="12" y1="7" x2="12" y2="11"></line><line x1="12" y1="14" x2="12.01" y2="14"></line></svg>`;

                            const msgDiv = document.createElement('div');
                            msgDiv.style.cssText = `
                                font-size: 14px;
                                color: ${colors.text};
                                font-weight: 600;
                                margin-bottom: 6px;
                            `;
                            msgDiv.innerText = errorMsg || "Failed to load audio challenge";

                            const subDiv = document.createElement('div');
                            subDiv.style.cssText = `
                                font-size: 12.5px;
                                color: ${colors.subText};
                                margin-bottom: 20px;
                            `;
                            subDiv.innerText = "You can retry loading audio or return to visual verification.";

                            const btnRow = document.createElement('div');
                            btnRow.style.cssText = `
                                display: flex;
                                gap: 10px;
                                justify-content: center;
                            `;

                            const retryBtn = document.createElement('button');
                            retryBtn.type = 'button';
                            retryBtn.innerText = 'Retry Audio';
                            retryBtn.style.cssText = `
                                flex: 1;
                                padding: 10px 14px;
                                background: #3b82f6;
                                color: white;
                                border: none;
                                border-radius: 8px;
                                font-size: 13.5px;
                                font-weight: 600;
                                cursor: pointer;
                                transition: background 0.2s;
                            `;
                            retryBtn.onmouseover = () => { retryBtn.style.background = '#2563eb'; };
                            retryBtn.onmouseout = () => { retryBtn.style.background = '#3b82f6'; };
                            retryBtn.onclick = () => { onSwitchToAudio(); };

                            const backBtn = document.createElement('button');
                            backBtn.type = 'button';
                            backBtn.innerText = 'Back to Visual';
                            backBtn.style.cssText = `
                                flex: 1;
                                padding: 10px 14px;
                                background: ${colors.boxBg};
                                color: ${colors.text};
                                border: 1px solid ${colors.boxBorder};
                                border-radius: 8px;
                                font-size: 13.5px;
                                font-weight: 600;
                                cursor: pointer;
                                transition: background 0.2s, border-color 0.2s;
                            `;
                            backBtn.onmouseover = () => { backBtn.style.borderColor = '#3b82f6'; };
                            backBtn.onmouseout = () => { backBtn.style.borderColor = colors.boxBorder; };
                            backBtn.onclick = () => {
                                isProcessing = false;
                                visualContainer.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
                                visualContainer.style.opacity = '0';
                                visualContainer.style.transform = 'scale(0.97)';
                                setTimeout(() => {
                                    executeChallenge();
                                    visualContainer.style.opacity = '1';
                                    visualContainer.style.transform = 'scale(1)';
                                }, 150);
                            };

                            btnRow.appendChild(retryBtn);
                            btnRow.appendChild(backBtn);

                            errBox.appendChild(iconDiv);
                            errBox.appendChild(msgDiv);
                            errBox.appendChild(subDiv);
                            errBox.appendChild(btnRow);
                            visualContainer.appendChild(errBox);
                        };

                        const onSwitchToAudio = async () => {
                            visualContainer.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
                            visualContainer.style.opacity = '0';
                            visualContainer.style.transform = 'scale(0.97)';
                            
                            setTimeout(async () => {
                                renderAudioLoading();
                                visualContainer.style.opacity = '1';
                                visualContainer.style.transform = 'scale(1)';
                                try {
                                    const aRes = await fetch(`${HOST}/v1/captcha/audio-challenge`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ sitekey: sitekey })
                                    });
                                    const aData = await aRes.json();
                                    if (aData.audio) {
                                        visualContainer.style.opacity = '0';
                                        visualContainer.style.transform = 'scale(0.97)';
                                        setTimeout(() => {
                                            renderAudioUI(aData, true);
                                            visualContainer.style.opacity = '1';
                                            visualContainer.style.transform = 'scale(1)';
                                        }, 120);
                                    } else {
                                        renderAudioError(aData.error || 'Failed to load audio challenge');
                                    }
                                } catch (e) {
                                    renderAudioError('Network error loading audio challenge');
                                }
                            }, 150);
                        };

                        const renderAudioLoading = () => {
                            visualContainer.innerHTML = '';
                            renderModalHeader("Audio Challenge", "Preparing audio challenge...", null, null);
                            const loadDiv = document.createElement('div');
                            loadDiv.style.cssText = `padding: 40px 20px; text-align: center; color: ${colors.subText}; font-size: 14px; font-family: inherit;`;
                            loadDiv.innerHTML = '<div style="display:inline-block;width:32px;height:32px;border:3px solid #3b82f6;border-top:3px solid transparent;border-radius:50%;animation:argus-spin 1s linear infinite;margin-bottom:12px;"></div><div>Synthesizing audio challenge...</div>';
                            visualContainer.appendChild(loadDiv);
                        };

                        const renderAudioUI = (aData, isSwitchedFromVisual = false) => {
                            visualContainer.innerHTML = '';
                            const isAudioOnly = (aData.audio_only === true) || (!isSwitchedFromVisual);

                            renderModalHeader(
                                isAudioOnly ? "Audio Verification" : "Audio Challenge",
                                isAudioOnly ? "Security verification: Listen and enter the numbers heard." : "Listen to the numbers and enter them below.",
                                isAudioOnly ? null : 'visual',
                                () => {
                                    if (audioObj) audioObj.pause();
                                    isProcessing = false;
                                    visualContainer.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
                                    visualContainer.style.opacity = '0';
                                    visualContainer.style.transform = 'scale(0.97)';
                                    setTimeout(() => {
                                        executeChallenge();
                                        visualContainer.style.opacity = '1';
                                        visualContainer.style.transform = 'scale(1)';
                                    }, 150);
                                }
                            );

                            const audioCard = document.createElement('div');
                            audioCard.style.cssText = `
                                display: flex;
                                flex-direction: column;
                                align-items: center;
                                justify-content: center;
                                padding: 22px 16px;
                                background: ${colors.boxBg};
                                border: 1px solid ${colors.boxBorder};
                                border-radius: 12px;
                                margin-bottom: 16px;
                            `;

                            const playBtn = document.createElement('button');
                            playBtn.type = 'button';
                            playBtn.title = 'Play Audio';
                            playBtn.style.cssText = `
                                width: 56px !important;
                                height: 56px !important;
                                min-width: 56px !important;
                                min-height: 56px !important;
                                padding: 0 !important;
                                margin: 0 !important;
                                border-radius: 50% !important;
                                background: #3b82f6 !important;
                                color: white !important;
                                border: none !important;
                                cursor: pointer !important;
                                display: inline-flex !important;
                                align-items: center !important;
                                justify-content: center !important;
                                transition: transform 0.15s, background 0.2s !important;
                                box-shadow: 0 4px 12px rgba(59, 130, 246, 0.35) !important;
                                outline: none !important;
                                box-sizing: border-box !important;
                            `;
                            playBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style="display:block;flex-shrink:0;"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg>`;

                            const playLabel = document.createElement('div');
                            playLabel.innerText = "Play Audio";
                            playLabel.style.cssText = `
                                font-size: 13px;
                                font-weight: 500;
                                color: ${colors.text};
                                margin-top: 10px;
                                font-family: inherit;
                            `;

                            let audioObj = null;
                            try {
                                audioObj = new Audio("data:audio/wav;base64," + aData.audio);
                            } catch (e) {
                                console.warn("Audio element failed to load base64:", e);
                            }

                            playBtn.onclick = () => {
                                if (!audioObj) return;
                                playBtn.style.transform = 'scale(0.92)';
                                setTimeout(() => { playBtn.style.transform = 'scale(1)'; }, 150);
                                playLabel.innerText = "Playing...";
                                playBtn.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation:argus-pulse 1s infinite;display:block;flex-shrink:0;"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>`;
                                audioObj.currentTime = 0;
                                audioObj.play().catch(err => {
                                    console.warn("Audio play blocked:", err);
                                    playLabel.innerText = "Click to replay";
                                });
                                audioObj.onended = () => {
                                    playLabel.innerText = "Click to replay";
                                    playBtn.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex-shrink:0;"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`;
                                };
                            };

                            audioCard.appendChild(playBtn);
                            audioCard.appendChild(playLabel);
                            visualContainer.appendChild(audioCard);

                            const audioInput = document.createElement('input');
                            audioInput.type = 'text';
                            audioInput.inputMode = 'numeric';
                            audioInput.pattern = '[0-9]*';
                            audioInput.placeholder = '• • • • •';
                            audioInput.maxLength = 10;
                            audioInput.style.cssText = `
                                width: 100% !important;
                                padding: 12px !important;
                                background: ${colors.boxBg} !important;
                                color: ${colors.text} !important;
                                border: 1px solid ${colors.boxBorder} !important;
                                border-radius: 10px !important;
                                font-size: 22px !important;
                                font-weight: 700 !important;
                                text-align: center !important;
                                letter-spacing: 6px !important;
                                margin-bottom: 16px !important;
                                box-sizing: border-box !important;
                                outline: none !important;
                                font-family: inherit !important;
                                transition: border-color 0.2s !important;
                            `;
                            audioInput.onfocus = () => { audioInput.style.borderColor = '#3b82f6'; };
                            audioInput.onblur = () => { audioInput.style.borderColor = colors.boxBorder; };
                            visualContainer.appendChild(audioInput);

                            const aVerifyBtn = document.createElement('button');
                            aVerifyBtn.type = 'button';
                            aVerifyBtn.innerText = 'Verify';
                            aVerifyBtn.style.cssText = `
                                width: 100% !important;
                                padding: 12px !important;
                                margin: 0 !important;
                                background: #3b82f6 !important;
                                color: white !important;
                                border: none !important;
                                border-radius: 10px !important;
                                font-size: 15px !important;
                                font-weight: 600 !important;
                                cursor: pointer !important;
                                transition: background 0.2s !important;
                                box-shadow: 0 3px 8px rgba(59, 130, 246, 0.3) !important;
                                box-sizing: border-box !important;
                                outline: none !important;
                                display: block !important;
                            `;
                            aVerifyBtn.onmouseover = () => { aVerifyBtn.style.background = '#2563eb'; };
                            aVerifyBtn.onmouseout = () => { aVerifyBtn.style.background = '#3b82f6'; };

                            const submitAudio = async () => {
                                const val = audioInput.value.trim();
                                if (!val) {
                                    audioInput.focus();
                                    return;
                                }
                                aVerifyBtn.disabled = true;
                                aVerifyBtn.innerHTML = '<div style="display:inline-block;width:16px;height:16px;border:2px solid white;border-top:2px solid transparent;border-radius:50%;animation:argus-spin 1s linear infinite;vertical-align:middle;margin-right:6px;"></div> Verifying...';
                                try {
                                    const vRes = await fetch(`${HOST}/v1/captcha/visual-verify`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            sitekey: sitekey,
                                            visual_ticket: aData.visual_ticket,
                                            answer: val
                                        })
                                    });
                                    const visData = await vRes.json();
                                    if (visData.success && visData.token) {
                                        console.log(`[Argus Captcha] Validation [PASS] (Audio)`);
                                        if (audioObj) audioObj.pause();
                                        visualOverlay.style.display = 'none';
                                        injectToken(visData.token);
                                    } else {
                                        if (audioObj) audioObj.pause();
                                        visualOverlay.style.display = 'none';
                                        triggerError('Validation failed', false);
                                    }
                                } catch (e) {
                                    if (audioObj) audioObj.pause();
                                    visualOverlay.style.display = 'none';
                                    triggerError('Validation failed', false);
                                }
                            };

                            aVerifyBtn.onclick = submitAudio;
                            audioInput.onkeydown = (e) => {
                                if (e.key === 'Enter') submitAudio();
                            };

                            visualContainer.appendChild(aVerifyBtn);
                            visualOverlay.style.display = 'flex';
                            setTimeout(() => {
                                audioInput.focus();
                                playBtn.click();
                            }, 250);
                        };

                        if (data.visual_type === 'audio') {
                            renderAudioUI(data, false);
                            return;
                        }

                        // Universal Header for all current and future visual challenges
                        const headerInfo = renderModalHeader(
                            "Security Challenge",
                            "",
                            'audio',
                            onSwitchToAudio
                        );

                        if (data.visual_type === 'slider') {
                            headerInfo.descEl.innerText = "Drag the slider to fit the puzzle piece.";
                            const bgContainer = document.createElement('div');
                            bgContainer.style.cssText = `position: relative; width: 100%; height: 150px; background-image: url(data:image/png;base64,${data.bg_image}); background-size: 100% 100%; border-radius: 8px; overflow: hidden; border: 1px solid ${colors.boxBorder}; box-sizing: border-box;`;

                            const pieceImg = document.createElement('img');
                            pieceImg.src = "data:image/png;base64," + data.piece_image;
                            pieceImg.style.cssText = `position: absolute; top: ${data.piece_y}px; left: 0px; width: 12.5%; height: 40px; z-index: 2; pointer-events: none; border-radius: 5px;`;
                            bgContainer.appendChild(pieceImg);

                            const sliderTrack = document.createElement('div');
                            sliderTrack.style.cssText = `position: relative; width: 100%; height: 42px; background: ${colors.boxBg}; border: 1px solid ${colors.boxBorder}; border-radius: 21px; margin-top: 16px; box-sizing: border-box; overflow: hidden;`;

                            const sliderFill = document.createElement('div');
                            sliderFill.style.cssText = `position: absolute; top: 0; left: 0; height: 100%; width: 0; background: #3b82f6; opacity: 0.2; border-radius: 21px 0 0 21px;`;
                            sliderTrack.appendChild(sliderFill);

                            const sliderHandle = document.createElement('div');
                            sliderHandle.style.cssText = `position: absolute; top: 0; left: 0; width: 48px; height: 100%; background: #3b82f6; border-radius: 21px; cursor: grab; display: flex; justify-content: center; align-items: center; color: white; transition: background 0.2s; box-shadow: 0 2px 6px rgba(0,0,0,0.25); user-select: none; font-size: 18px; box-sizing: border-box;`;
                            sliderHandle.innerHTML = '&#8594;'; // right arrow
                            sliderTrack.appendChild(sliderHandle);

                            visualContainer.appendChild(bgContainer);
                            visualContainer.appendChild(sliderTrack);
                            visualOverlay.style.display = 'flex';

                            const visualTicket = data.visual_ticket;
                            let isDragging = false;
                            let startX = 0;
                            let currentX = 0;
                            let maxTravel = 0;

                            const onMove = (e) => {
                                if (!isDragging) return;
                                let clientX = e.touches ? e.touches[0].clientX : e.clientX;
                                let deltaX = clientX - startX;
                                currentX = Math.max(0, Math.min(deltaX, maxTravel));
                                sliderHandle.style.left = currentX + 'px';
                                pieceImg.style.left = currentX + 'px';
                                sliderFill.style.width = (currentX + (sliderHandle.clientWidth / 2)) + 'px';
                                e.preventDefault(); // prevent scrolling
                            };

                            const onEnd = async () => {
                                if (!isDragging) return;
                                isDragging = false;
                                document.removeEventListener('mousemove', onMove);
                                document.removeEventListener('mouseup', onEnd);
                                document.removeEventListener('touchmove', onMove);
                                document.removeEventListener('touchend', onEnd);
                                sliderHandle.style.cursor = 'grab';

                                // Submit
                                sliderHandle.innerHTML = '<div style="width:16px;height:16px;border:2px solid white;border-top:2px solid transparent;border-radius:50%;animation:argus-spin 1s linear infinite;"></div>';
                                try {
                                    // Map currentX back to the native 320px scale backend expects
                                    const nativeAnswer = currentX * (320 / sliderTrack.clientWidth);
                                    const vRes = await fetch(`${HOST}/v1/captcha/visual-verify`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            sitekey: sitekey,
                                            visual_ticket: visualTicket,
                                            answer: nativeAnswer.toString()
                                        })
                                    });
                                    const visData = await vRes.json();
                                    if (visData.success && visData.token) {
                                        console.log(`[Argus Captcha] Validation [PASS] (Slider)`);
                                        visualOverlay.style.display = 'none';
                                        injectToken(visData.token);
                                    } else {
                                        visualOverlay.style.display = 'none';
                                        triggerError('Validation failed', false);
                                    }
                                } catch (e) {
                                    visualOverlay.style.display = 'none';
                                    triggerError('Validation failed', false);
                                }
                            };

                            const onStart = (e) => {
                                isDragging = true;
                                maxTravel = sliderTrack.clientWidth - sliderHandle.clientWidth;
                                startX = (e.touches ? e.touches[0].clientX : e.clientX) - currentX;
                                sliderHandle.style.cursor = 'grabbing';
                                sliderHandle.style.transition = 'none';
                                pieceImg.style.transition = 'none';
                                sliderFill.style.transition = 'none';
                                document.addEventListener('mousemove', onMove);
                                document.addEventListener('mouseup', onEnd);
                                document.addEventListener('touchmove', onMove, { passive: false });
                                document.addEventListener('touchend', onEnd);
                                e.preventDefault();
                            };

                            sliderHandle.addEventListener('mousedown', onStart);
                            sliderHandle.addEventListener('touchstart', onStart, { passive: false });

                        } else if (data.visual_type === 'rotation') {
                            headerInfo.descEl.innerText = "Rotate the object until it is right-side up.";

                            const rotWrapper = document.createElement('div');
                            rotWrapper.style.cssText = `
                                display: flex;
                                flex-direction: column;
                                align-items: center;
                                justify-content: center;
                                width: 100%;
                                box-sizing: border-box;
                            `;

                            const frameContainer = document.createElement('div');
                            frameContainer.style.cssText = `
                                position: relative;
                                display: inline-block;
                                margin: 10px auto 16px auto;
                                box-sizing: border-box;
                            `;

                            const topMarker = document.createElement('div');
                            topMarker.title = "Top orientation indicator";
                            topMarker.style.cssText = `
                                position: absolute;
                                top: -8px;
                                left: 50%;
                                transform: translateX(-50%);
                                width: 0;
                                height: 0;
                                border-left: 6px solid transparent;
                                border-right: 6px solid transparent;
                                border-top: 7px solid #3b82f6;
                                z-index: 10;
                                filter: drop-shadow(0 1px 2px rgba(59, 130, 246, 0.5));
                            `;

                            // Circular preview frame
                            const imgFrame = document.createElement('div');
                            imgFrame.style.cssText = `
                                position: relative;
                                width: 172px;
                                height: 172px;
                                border-radius: 50%;
                                background: ${colors.boxBg};
                                border: 2px solid ${colors.border};
                                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
                                overflow: hidden;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                box-sizing: border-box;
                            `;

                            const rotImg = document.createElement('img');
                            rotImg.src = "data:image/png;base64," + data.image;
                            rotImg.style.cssText = `
                                width: 100%;
                                height: 100%;
                                border-radius: 50%;
                                user-select: none;
                                -webkit-user-drag: none;
                                pointer-events: none;
                                transform-origin: 50% 50%;
                                transition: transform 0.15s cubic-bezier(0.2, 0, 0, 1);
                            `;
                            imgFrame.appendChild(rotImg);
                            frameContainer.appendChild(topMarker);
                            frameContainer.appendChild(imgFrame);
                            rotWrapper.appendChild(frameContainer);

                            let currentAngle = 0;

                            const updateRotation = (angle, animate = true) => {
                                currentAngle = ((angle % 360) + 360) % 360;
                                rotImg.style.transition = animate ? 'transform 0.15s cubic-bezier(0.2, 0, 0, 1)' : 'none';
                                rotImg.style.transform = `rotate(${currentAngle}deg)`;
                                slider.value = currentAngle;
                            };

                            // Button controls container
                            const controlsRow = document.createElement('div');
                            controlsRow.style.cssText = `
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                gap: 20px;
                                width: 100%;
                                margin-bottom: 14px;
                                box-sizing: border-box;
                            `;

                            const createRotateBtn = (svgPath, delta, label) => {
                                const btn = document.createElement('button');
                                btn.type = 'button';
                                btn.title = label;
                                btn.innerHTML = svgPath;
                                btn.style.cssText = `
                                    width: 44px !important;
                                    height: 44px !important;
                                    min-width: 44px !important;
                                    min-height: 44px !important;
                                    padding: 0 !important;
                                    margin: 0 !important;
                                    border-radius: 50% !important;
                                    background: ${colors.boxBg} !important;
                                    border: 1px solid ${colors.border} !important;
                                    color: ${colors.text} !important;
                                    display: inline-flex !important;
                                    align-items: center !important;
                                    justify-content: center !important;
                                    cursor: pointer !important;
                                    transition: all 0.2s ease !important;
                                    box-shadow: 0 2px 4px rgba(0,0,0,0.06) !important;
                                    box-sizing: border-box !important;
                                    outline: none !important;
                                `;
                                btn.onmouseover = () => {
                                    btn.style.borderColor = '#3b82f6';
                                    btn.style.color = '#3b82f6';
                                    btn.style.transform = 'scale(1.08)';
                                };
                                btn.onmouseout = () => {
                                    btn.style.borderColor = colors.border;
                                    btn.style.color = colors.text;
                                    btn.style.transform = 'scale(1)';
                                };
                                btn.onclick = () => {
                                    updateRotation(currentAngle + delta, true);
                                };
                                return btn;
                            };

                            // Left rotate button (-30 deg)
                            const btnLeft = createRotateBtn(
                                `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex-shrink:0;"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`,
                                -30,
                                "Rotate left 30 degrees"
                            );

                            // Right rotate button (+30 deg)
                            const btnRight = createRotateBtn(
                                `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex-shrink:0;"><path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>`,
                                30,
                                "Rotate right 30 degrees"
                            );

                            controlsRow.appendChild(btnLeft);
                            controlsRow.appendChild(btnRight);
                            rotWrapper.appendChild(controlsRow);

                            // Slider container for smooth adjustment
                            const sliderContainer = document.createElement('div');
                            sliderContainer.style.cssText = `
                                width: 100%;
                                display: flex;
                                align-items: center;
                                margin-bottom: 18px;
                                box-sizing: border-box;
                            `;

                            const slider = document.createElement('input');
                            slider.type = 'range';
                            slider.min = '0';
                            slider.max = '360';
                            slider.step = '1';
                            slider.value = '0';
                            slider.style.cssText = `
                                width: 100% !important;
                                cursor: pointer !important;
                                accent-color: #3b82f6 !important;
                                margin: 0 !important;
                                box-sizing: border-box !important;
                            `;
                            slider.oninput = (e) => {
                                updateRotation(parseFloat(e.target.value), false);
                            };
                            sliderContainer.appendChild(slider);
                            rotWrapper.appendChild(sliderContainer);

                            // Verify Button
                            const verifyBtn = document.createElement('button');
                            verifyBtn.type = 'button';
                            verifyBtn.innerText = 'Verify';
                            verifyBtn.style.cssText = `
                                width: 100% !important;
                                padding: 12px !important;
                                margin: 0 !important;
                                background: #3b82f6 !important;
                                color: white !important;
                                border: none !important;
                                border-radius: 10px !important;
                                font-size: 15px !important;
                                font-weight: 600 !important;
                                cursor: pointer !important;
                                transition: background 0.2s, transform 0.1s !important;
                                box-shadow: 0 3px 8px rgba(59, 130, 246, 0.3) !important;
                                box-sizing: border-box !important;
                                outline: none !important;
                                display: block !important;
                            `;
                            verifyBtn.onmouseover = () => { verifyBtn.style.background = '#2563eb'; };
                            verifyBtn.onmouseout = () => { verifyBtn.style.background = '#3b82f6'; };

                            const visualTicket = data.visual_ticket;

                            verifyBtn.onclick = async () => {
                                verifyBtn.disabled = true;
                                verifyBtn.innerHTML = '<div style="display:inline-block;width:16px;height:16px;border:2px solid white;border-top:2px solid transparent;border-radius:50%;animation:argus-spin 1s linear infinite;vertical-align:middle;margin-right:6px;"></div> Verifying...';
                                try {
                                    const vRes = await fetch(`${HOST}/v1/captcha/visual-verify`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            sitekey: sitekey,
                                            visual_ticket: visualTicket,
                                            answer: currentAngle.toString()
                                        })
                                    });
                                    const visData = await vRes.json();
                                    if (visData.success && visData.token) {
                                        console.log(`[Argus Captcha] Validation [PASS] (Rotation)`);
                                        visualOverlay.style.display = 'none';
                                        injectToken(visData.token);
                                    } else {
                                        visualOverlay.style.display = 'none';
                                        triggerError('Validation failed', false);
                                    }
                                } catch (e) {
                                    visualOverlay.style.display = 'none';
                                    triggerError('Validation failed', false);
                                }
                            };

                            rotWrapper.appendChild(verifyBtn);
                            visualContainer.appendChild(rotWrapper);
                            visualOverlay.style.display = 'flex';

                        } else {
                            headerInfo.descEl.innerText = "Type the text from the image below.";
                            // Text challenge fallback
                            const visualImg = document.createElement('img');
                            visualImg.src = "data:image/png;base64," + data.image;
                            visualImg.style.cssText = `max-width: 100%; border-radius: 8px; margin-bottom: 12px; border: 1px solid ${colors.boxBorder}; box-sizing: border-box;`;
                            const visualInput = document.createElement('input');
                            visualInput.type = 'text';
                            visualInput.placeholder = 'Enter the text above';
                            visualInput.style.cssText = `width: 100% !important; padding: 12px !important; background: ${colors.boxBg} !important; color: ${colors.text} !important; border: 1px solid ${colors.boxBorder} !important; border-radius: 10px !important; font-size: 15px !important; margin-bottom: 14px !important; box-sizing: border-box !important; outline: none !important; font-family: inherit !important;`;
                            visualInput.onfocus = () => { visualInput.style.borderColor = '#3b82f6'; };
                            visualInput.onblur = () => { visualInput.style.borderColor = colors.boxBorder; };
                            const visualBtn = document.createElement('button');
                            visualBtn.innerText = 'Verify';
                            visualBtn.type = 'button';
                            visualBtn.style.cssText = `width: 100% !important; padding: 12px !important; margin: 0 !important; background: #3b82f6 !important; color: white !important; border: none !important; border-radius: 10px !important; cursor: pointer !important; font-size: 15px !important; font-weight: 600 !important; transition: background 0.2s !important; box-shadow: 0 3px 8px rgba(59, 130, 246, 0.3) !important; box-sizing: border-box !important; outline: none !important; display: block !important;`;
                            visualBtn.onmouseover = () => { visualBtn.style.background = '#2563eb'; };
                            visualBtn.onmouseout = () => { visualBtn.style.background = '#3b82f6'; };
                            visualContainer.appendChild(visualImg);
                            visualContainer.appendChild(visualInput);
                            visualContainer.appendChild(visualBtn);
                            visualOverlay.style.display = 'flex';
                            visualInput.focus();

                            const visualTicket = data.visual_ticket;
                            visualBtn.onclick = async () => {
                                visualBtn.innerText = 'Verifying...';
                                visualBtn.disabled = true;
                                try {
                                    const vRes = await fetch(`${HOST}/v1/captcha/visual-verify`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ sitekey: sitekey, visual_ticket: visualTicket, answer: visualInput.value })
                                    });
                                    const visData = await vRes.json();
                                    if (visData.success && visData.token) {
                                        visualOverlay.style.display = 'none';
                                        injectToken(visData.token);
                                    } else {
                                        visualOverlay.style.display = 'none';
                                        triggerError('Validation failed', false);
                                    }
                                } catch (e) {
                                    visualOverlay.style.display = 'none';
                                    triggerError('Validation failed', false);
                                }
                            };
                        }
                    }
                    else {
                        const isFatal = !res.ok || res.status === 403 || res.status === 400 ||
                            data.error === "Invalid sitekey" || 
                            data.error === "Domain not authorized" || 
                            data.error === "Missing sitekey" ||
                            (data.error && (
                                data.error.toLowerCase().includes("blocked") || 
                                data.error.toLowerCase().includes("high risk") || 
                                data.error.toLowerCase().includes("security")
                            ));
                        throw { 
                            message: data.error || (res.status === 403 ? "Client blocked by security policy" : "Verification failed"), 
                            fatal: isFatal 
                        };
                    }
                } catch (err) {
                    console.error("Argus Captcha Error:", err);
                    console.log(`[Argus Captcha] Validation [FAIL]: ${err.message || 'Unknown Error'}`);
                    const isFatal = err.fatal === true || !navigator.onLine || err.name === 'TypeError' || (err.message && err.message.toLowerCase().includes('network'));
                    triggerError(err.message || 'Verification error', isFatal);
                }
            };




            if (mode === 'manual') {
                checkboxContainer.addEventListener('click', executeChallenge);
                if (form) {
                    form.addEventListener('submit', (e) => {
                        if (container.dataset.verified !== "true") {
                            e.preventDefault();

                            widget.style.animation = 'none';
                            void widget.offsetWidth;
                            widget.style.animation = 'argus-shake 0.4s ease';

                            const oldBorder = widget.style.borderColor;
                            widget.style.borderColor = '#ef4444';
                            setTimeout(() => {
                                if (container.dataset.verified !== "true") {
                                    widget.style.borderColor = oldBorder || colors.border;
                                }
                            }, 1000);

                            // Custom alert/notification logic should be implemented by the user
                        }
                    });
                }
            } else if (mode === 'invisible') {
                widget.style.display = 'none';
                if (form) {
                    form.addEventListener('submit', (e) => {
                        if (container.dataset.verified !== "true") {
                            e.preventDefault();
                            executeChallenge();
                        }
                    });
                }
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCaptcha);
    } else {
        initCaptcha();
    }
})();
