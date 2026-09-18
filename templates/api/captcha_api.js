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

            if (!sitekey) {
                container.innerHTML = `<div style="color:red; font-size:12px; padding:8px; border:1px solid red; border-radius:4px;">Argus Captcha Error: Missing sitekey</div>`;
                return;
            }

            let mode = 'manual';
            let theme = 'auto';
            let initialError = null;
            let isTestMode = false;

            try {
                const res = await fetch(`${HOST}/v1/captcha/settings?sitekey=${sitekey}`);
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
            exclamation.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="8" x2="12" y2="12" style="stroke-dasharray: 10; stroke-dashoffset: 10;"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
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

            textContainer.appendChild(text);
            textContainer.appendChild(subText);

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
            visualOverlay.style.cssText = `
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0, 0, 0, 0.5);
                z-index: 2147483647;
                align-items: center;
                justify-content: center;
            `;

            const visualContainer = document.createElement('div');
            visualContainer.style.cssText = `
                width: 100%;
                max-width: 360px;
                padding: 24px;
                background: ${colors.bg};
                border: 1px solid ${colors.border};
                border-radius: 12px;
                box-sizing: border-box;
                text-align: center;
                box-shadow: 0 10px 30px rgba(0,0,0,0.25);
                position: relative;
            `;

            const closeButton = document.createElement('button');
            closeButton.innerHTML = '&times;';
            closeButton.style.cssText = `
                position: absolute;
                top: 15px;
                right: 15px;
                width: 30px;
                height: 30px;
                background: transparent;
                color: ${colors.subText};
                border: none;
                border-radius: 50%;
                font-size: 26px;
                line-height: 1;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: color 0.2s, background 0.2s;
                z-index: 10;
            `;
            closeButton.onmouseover = () => { closeButton.style.background = 'rgba(0,0,0,0.05)'; closeButton.style.color = colors.text; };
            closeButton.onmouseout = () => { closeButton.style.background = 'transparent'; closeButton.style.color = colors.subText; };
            closeButton.onclick = () => {
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

            visualOverlay.appendChild(visualContainer);
            document.body.appendChild(visualOverlay);

            if (!document.getElementById('argus-captcha-styles')) {
                const style = document.createElement('style');
                style.id = 'argus-captcha-styles';
                style.innerHTML = `
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
                    let input = document.createElement('input');
                    input.type = 'hidden';
                    input.name = 'argus-captcha-response';
                    input.value = token;
                    form.appendChild(input);
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

            const triggerError = (msg, isFatal = false) => {
                isProcessing = false;
                isFailed = true;

                const errorCbName = container.dataset.errorCallback;
                if (errorCbName && typeof window[errorCbName] === 'function') {
                    window[errorCbName](msg);
                }
                container.dispatchEvent(new CustomEvent('argus-error', { detail: { message: msg } }));

                spinner.style.display = 'none';
                box.style.display = 'none';

                if (isFatal) {
                    exclamation.style.display = 'block';
                    const lines = exclamation.querySelectorAll('line');
                    lines[0].style.animation = 'argus-draw-exclamation 0.3s ease forwards';
                    lines[1].style.animation = 'argus-draw-exclamation 0.3s ease 0.15s forwards';

                    text.innerText = "Error";
                    text.style.color = '#f59e0b';
                    subText.style.display = 'none';
                    widget.style.borderColor = '#f59e0b';
                    widget.style.cursor = 'not-allowed';
                    widget.title = msg; // Tooltip on hover
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
                        visualContainer.appendChild(closeButton);

                        const headerDiv = document.createElement('div');
                        headerDiv.style.cssText = `
                            text-align: left;
                            margin-bottom: 20px;
                            padding-right: 30px;
                        `;

                        const title = document.createElement('h3');
                        title.innerText = "Security Challenge";
                        title.style.cssText = `
                            margin: 0 0 6px 0;
                            font-size: 18px;
                            color: ${colors.text};
                            font-weight: 600;
                            line-height: 1.2;
                            font-family: inherit;
                        `;

                        const instr = document.createElement('p');
                        instr.style.cssText = `
                            margin: 0;
                            font-size: 14px;
                            color: ${colors.subText};
                            line-height: 1.4;
                            font-family: inherit;
                        `;

                        headerDiv.appendChild(title);
                        headerDiv.appendChild(instr);
                        visualContainer.appendChild(headerDiv);

                        if (data.visual_type === 'slider') {
                            instr.innerText = "Drag the slider to fit the puzzle piece.";
                            const bgContainer = document.createElement('div');
                            bgContainer.style.cssText = `position: relative; width: 100%; height: 150px; background-image: url(data:image/png;base64,${data.bg_image}); background-size: 100% 100%; border-radius: 4px; overflow: hidden;`;

                            const pieceImg = document.createElement('img');
                            pieceImg.src = "data:image/png;base64," + data.piece_image;
                            pieceImg.style.cssText = `position: absolute; top: ${data.piece_y}px; left: 0px; width: 12.5%; height: 40px; z-index: 2; pointer-events: none; border-radius: 5px;`;
                            bgContainer.appendChild(pieceImg);

                            const sliderTrack = document.createElement('div');
                            sliderTrack.style.cssText = `position: relative; width: 100%; height: 40px; background: ${colors.boxBg}; border: 1px solid ${colors.boxBorder}; border-radius: 20px; margin-top: 15px; box-sizing: border-box; overflow: hidden;`;

                            const sliderFill = document.createElement('div');
                            sliderFill.style.cssText = `position: absolute; top: 0; left: 0; height: 100%; width: 0; background: #3b82f6; opacity: 0.2; border-radius: 20px 0 0 20px;`;
                            sliderTrack.appendChild(sliderFill);

                            const sliderHandle = document.createElement('div');
                            sliderHandle.style.cssText = `position: absolute; top: 0; left: 0; width: 12.5%; height: 100%; background: #3b82f6; border-radius: 20px; cursor: grab; display: flex; justify-content: center; align-items: center; color: white; transition: background 0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.2); user-select: none; font-size: 18px;`;
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

                        } else {
                            instr.innerText = "Type the text from the image below.";
                            // Text challenge fallback
                            const visualImg = document.createElement('img');
                            visualImg.src = "data:image/png;base64," + data.image;
                            visualImg.style.cssText = `max-width: 100%; border-radius: 4px; margin-bottom: 8px;`;
                            const visualInput = document.createElement('input');
                            visualInput.type = 'text';
                            visualInput.placeholder = 'Enter the text above';
                            visualInput.style.cssText = `width: 100%; padding: 10px 12px; background: ${colors.boxBg}; color: ${colors.text}; border: 1px solid ${colors.boxBorder}; border-radius: 6px; font-size: 14px; margin-bottom: 12px; box-sizing: border-box; outline: none;`;
                            visualInput.onfocus = () => { visualInput.style.borderColor = '#3b82f6'; };
                            visualInput.onblur = () => { visualInput.style.borderColor = colors.boxBorder; };
                            const visualBtn = document.createElement('button');
                            visualBtn.innerText = 'Verify';
                            visualBtn.type = 'button';
                            visualBtn.style.cssText = `width: 100%; padding: 10px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background 0.2s;`;
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
                                        triggerFail();
                                    }
                                } catch (e) {
                                    visualOverlay.style.display = 'none';
                                    triggerFail();
                                }
                            };
                        }
                    }
                    else {
                        throw { message: data.error || "Verification failed", fatal: data.error === "Invalid sitekey" || data.error === "Domain not authorized" || data.error === "Missing sitekey" };
                    }
                } catch (err) {
                    console.error("Argus Captcha Error:", err);
                    console.log(`[Argus Captcha] Validation [FAIL]: ${err.message || 'Unknown Error'}`);
                    triggerError(err.message, err.fatal === true);
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
