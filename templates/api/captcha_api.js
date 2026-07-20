(function () {
    // Argus Captcha Intelligent Widget Script - Premium Version
    const HOST = "{{ request.url_root }}".replace(/\/$/, "");

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
        webglRenderer: ""
    };

    const initTime = Date.now();

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
        if (telemetryData.mouseEvents % 5 === 0 && telemetryData.mouseTrajectory.length < 20) {
            telemetryData.mouseTrajectory.push({ x: e.clientX, y: e.clientY, t: Date.now() - initTime });
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

            try {
                const res = await fetch(`${HOST}/v1/captcha/settings?sitekey=${sitekey}`);
                const data = await res.json();
                if (!data.success) {
                    container.innerHTML = `<div style="color:red; font-size:12px; padding:8px; border:1px solid red; border-radius:4px;">Argus Captcha Error: ${data.error || 'Failed to load settings'}</div>`;
                    return;
                }
                mode = data.mode || 'manual';
                theme = data.theme || 'auto';
            } catch (err) {
                console.error("Argus Captcha Settings Error:", err);
                container.innerHTML = `<div style="color:red; font-size:12px; padding:8px; border:1px solid red; border-radius:4px;">Argus Captcha Error: Network failure</div>`;
                return;
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
                    boxBg: '#fff',
                    boxBorder: '#c1c1c1',
                    hoverBorder: '#b2b2b2'
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

            widget.style.cssText = `
                width: 100%;
                max-width: 304px;
                height: 78px;
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
                cursor: pointer;
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
            checkmark.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 12 9 17 20 6" style="stroke-dasharray: 50; stroke-dashoffset: 50;"></polyline></svg>`;
            checkmark.style.cssText = `
                display: none;
                position: absolute;
            `;

            const crossmark = document.createElement('div');
            crossmark.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="6" y1="6" x2="18" y2="18" style="stroke-dasharray: 30; stroke-dashoffset: 30;"></line>
                <line x1="18" y1="6" x2="6" y2="18" style="stroke-dasharray: 30; stroke-dashoffset: 30;"></line>
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
                width: 32px;
                height: 32px;
                margin-bottom: 2px;
                display: flex;
                align-items: center;
                justify-content: center;
            `;
            // Subtle lock or shield icon to look like a brand logo (like recaptcha loop)
            logoImgContainer.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${theme === 'dark' ? '#f9f9f9' : '#1f2937'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`;

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
                badgeIcon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`;
                badgeIcon.style.cssText = `
                    min-width: 16px;
                    height: 16px;
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

            // Visual Challenge UI Container (Hidden initially)
            const visualContainer = document.createElement('div');
            visualContainer.style.cssText = `
                display: none;
                width: 100%;
                margin-top: 10px;
                padding: 10px;
                background: #fff;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                box-sizing: border-box;
                text-align: center;
            `;
            const visualImg = document.createElement('img');
            visualImg.style.cssText = `
                max-width: 100%;
                border-radius: 4px;
                margin-bottom: 8px;
            `;
            const visualInput = document.createElement('input');
            visualInput.type = 'text';
            visualInput.placeholder = 'Enter the text above';
            visualInput.style.cssText = `
                width: 100%;
                padding: 10px 12px;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                font-size: 14px;
                margin-bottom: 12px;
                box-sizing: border-box;
                transition: all 0.2s ease;
                outline: none;
            `;
            visualInput.onfocus = () => {
                visualInput.style.borderColor = '#3b82f6';
                visualInput.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.1)';
            };
            visualInput.onblur = () => {
                visualInput.style.borderColor = '#d1d5db';
                visualInput.style.boxShadow = 'none';
            };
            const visualBtn = document.createElement('button');
            visualBtn.innerText = 'Verify';
            visualBtn.type = 'button';
            visualBtn.style.cssText = `
                width: 100%;
                padding: 10px;
                background: #3b82f6;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: background 0.2s;
            `;
            visualBtn.onmouseenter = () => visualBtn.style.background = '#2563eb';
            visualBtn.onmouseleave = () => visualBtn.style.background = '#3b82f6';
            visualContainer.appendChild(visualImg);
            visualContainer.appendChild(visualInput);
            visualContainer.appendChild(visualBtn);
            container.appendChild(visualContainer);

            if (!document.getElementById('argus-captcha-styles')) {
                const style = document.createElement('style');
                style.id = 'argus-captcha-styles';
                style.innerHTML = `
                    @keyframes argus-spin { to { transform: rotate(360deg); } }
                    @keyframes argus-fade { from { opacity: 0; } to { opacity: 1; } }
                    @keyframes argus-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
                    @keyframes argus-draw {
                        to { stroke-dashoffset: 0; }
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
                `;
                document.head.appendChild(style);
            }

            const injectToken = (token) => {
                spinner.style.display = 'none';
                box.style.display = 'none';
                checkmark.style.display = 'block';
                const polyline = checkmark.querySelector('polyline');
                polyline.style.animation = 'none';
                void polyline.offsetWidth;
                polyline.style.animation = 'argus-draw 0.4s ease forwards';

                text.innerText = "Verification complete";
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
            };

            const triggerError = (msg, isFatal = false) => {
                isProcessing = false;
                isFailed = true;
                spinner.style.display = 'none';
                box.style.display = 'none';

                if (isFatal) {
                    exclamation.style.display = 'block';
                    const lines = exclamation.querySelectorAll('line');
                    lines[0].style.animation = 'argus-draw 0.3s ease forwards';
                    lines[1].style.animation = 'argus-draw 0.3s ease 0.15s forwards';

                    text.innerText = "Error";
                    text.style.color = '#f59e0b';
                    subText.style.display = 'none';
                    widget.style.borderColor = '#f59e0b';
                    widget.style.cursor = 'not-allowed';
                    widget.title = msg; // Tooltip on hover
                    return; // Permanent error, do not reset
                }

                crossmark.style.display = 'block';
                const lines = crossmark.querySelectorAll('line');
                lines[0].style.animation = 'none';
                lines[1].style.animation = 'none';
                void crossmark.offsetWidth;
                lines[0].style.animation = 'argus-draw 0.3s ease forwards';
                lines[1].style.animation = 'argus-draw 0.3s ease 0.15s forwards';

                text.innerText = "Verification failed";
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

            const executeChallenge = async () => {
                if (container.dataset.verified === "true") return;
                if (isProcessing || isFailed) return; // prevent spamming clicks

                isProcessing = true;
                if (mode === 'manual') {
                    box.style.display = 'none';
                    spinner.style.display = 'block';
                    text.innerText = "Verifying you are human...";
                }

                telemetryData.timeOnPage = Date.now() - initTime;

                const tData = btoa(JSON.stringify({
                    webdriver: telemetryData.webdriver,
                    mouseScore: analyzeMouseBehavior(),
                    timeOnPage: telemetryData.timeOnPage,
                    screenRes: telemetryData.screenRes,
                    typingCadence: telemetryData.typingCadence,
                    touchPressures: telemetryData.touchPressures,
                    canvasFingerprint: telemetryData.canvasFingerprint,
                    webglRenderer: telemetryData.webglRenderer,
                    honeypot: getHoneypotValue(container),
                    forceVisual: window.forceArgusVisual === true,
                    url: window.location.href
                }));

                const payload = {
                    sitekey: sitekey,
                    telemetry: tData
                };

                try {
                    const res = await fetch(`${HOST}/v1/captcha/challenge`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    const data = await res.json();

                    if (data.success && data.token) {
                        injectToken(data.token);
                    }
                    else if (data.requires_visual) {
                        isProcessing = false;
                        text.innerText = "Action required";
                        subText.innerText = "Please solve the challenge below.";
                        subText.style.display = 'block';

                        visualImg.src = "data:image/png;base64," + data.image;
                        visualContainer.style.display = 'block';
                        visualInput.focus();

                        const visualTicket = data.visual_ticket;

                        visualBtn.onclick = async () => {
                            visualBtn.innerText = 'Verifying...';
                            visualBtn.disabled = true;
                            try {
                                const vRes = await fetch(`${HOST}/v1/captcha/visual-verify`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        sitekey: sitekey,
                                        visual_ticket: visualTicket,
                                        answer: visualInput.value
                                    })
                                });
                                const visData = await vRes.json();
                                if (visData.success && visData.token) {
                                    visualContainer.style.display = 'none';
                                    injectToken(visData.token);
                                } else {
                                    visualInput.value = '';
                                    visualInput.style.borderColor = '#ef4444';
                                    visualBtn.innerText = 'Verify';
                                    visualBtn.disabled = false;
                                }
                            } catch (e) {
                                visualInput.value = '';
                                visualInput.style.borderColor = '#ef4444';
                                text.style.color = '#ef4444';
                                isProcessing = false;
                                visualBtn.innerText = 'Verify';
                                visualBtn.disabled = false;
                            }
                        };
                    }
                    else {
                        throw { message: data.error || "Verification failed", fatal: data.error === "Invalid sitekey" || data.error === "Domain not authorized" || data.error === "Missing sitekey" };
                    }
                } catch (err) {
                    console.error("Argus Captcha Error:", err);
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

                            if (typeof window.showNotification === 'function') {
                                window.showNotification("Please complete the captcha first.", "error");
                            } else {
                                alert("Please complete the captcha first.");
                            }
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
