(function () {
    // Argus Captcha Intelligent Widget Script - Premium Version
    // Intelligent Host Resolution (supports direct Latch domain, local dev, or CDN hosting)
    let HOST = 'https://latch.argusgroup.co.uk';
    if (document.currentScript && document.currentScript.getAttribute('data-host')) {
        HOST = document.currentScript.getAttribute('data-host').replace(/\/+$/, '');
    } else {
        const scriptSrc = document.currentScript ? document.currentScript.src : '';
        if (scriptSrc.includes('/v1/captcha')) {
            HOST = scriptSrc.split('/v1/captcha')[0];
        } else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            HOST = window.location.origin;
        }
    }

    // Warm up network connection to backend via preconnect
    try {
        if (document.head && !document.querySelector(`link[rel="preconnect"][href="${HOST}"]`)) {
            const pc = document.createElement('link');
            pc.rel = 'preconnect';
            pc.href = HOST;
            pc.crossOrigin = 'anonymous';
            document.head.appendChild(pc);
        }
    } catch (_) {}

    // In-memory and sessionStorage fast settings cache for instant render (0.0 ms)
    const _settingsMemCache = new Map();
    function getStoredSettings(sk) {
        if (!sk) return null;
        if (_settingsMemCache.has(sk)) return _settingsMemCache.get(sk);
        try {
            const stored = sessionStorage.getItem('argus_s_' + sk);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Date.now() - parsed.ts < 300000) { // 5 min TTL
                    _settingsMemCache.set(sk, parsed.data);
                    return parsed.data;
                }
            }
        } catch (_) {}
        return null;
    }
    function setStoredSettings(sk, data) {
        if (!sk || !data) return;
        _settingsMemCache.set(sk, data);
        try {
            sessionStorage.setItem('argus_s_' + sk, JSON.stringify({ data: data, ts: Date.now() }));
        } catch (_) {}
    }

    // =========================================================================
    // ARGUS SHIELD: Multi-Layer Anti-Tamper, Anti-Hooking & Prototype Integrity
    // =========================================================================
    const ArgusShield = (function () {
        const _Function_toString = Function.prototype.toString;
        const _Object_getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
        const _Object_hasOwnProperty = Object.prototype.hasOwnProperty;
        const _Object_defineProperty = Object.defineProperty;
        const _Object_freeze = Object.freeze;
        const _Date_now = Date.now;
        const _fetch = window.fetch;
        const _createElement = Document.prototype.createElement;
        const _addEventListener = EventTarget.prototype.addEventListener;

        const NATIVE_CODE_REGEX = /^function\s*([a-zA-Z0-9_$]+)?\s*\([^)]*\)\s*\{\s*\[native code\]\s*\}$/;

        function isNativeFunction(fn) {
            if (!fn || typeof fn !== 'function') return false;
            try {
                if (_Object_hasOwnProperty.call(fn, 'toString')) {
                    return false;
                }
                const fnStr = _Function_toString.call(fn);
                if (!NATIVE_CODE_REGEX.test(fnStr)) {
                    return false;
                }
                const desc = _Object_getOwnPropertyDescriptor(fn, 'prototype');
                if (desc && desc.get) {
                    return false;
                }
                return true;
            } catch (_) {
                return false;
            }
        }

        function isToStringTampered() {
            try {
                if (Function.prototype.toString !== _Function_toString) {
                    return true;
                }
                if (_Object_hasOwnProperty.call(Function.prototype, 'toString')) {
                    const desc = _Object_getOwnPropertyDescriptor(Function.prototype, 'toString');
                    if (desc && (!desc.writable || !desc.configurable)) {
                        return true;
                    }
                }
                const selfStr = _Function_toString.call(_Function_toString);
                if (!NATIVE_CODE_REGEX.test(selfStr)) {
                    return true;
                }
                if (_Function_toString.name !== 'toString') {
                    return true;
                }
                return false;
            } catch (_) {
                return true;
            }
        }

        function auditEnvironment() {
            const tamperedAPIs = [];
            let hookingDetected = false;
            let debuggerDetected = false;

            if (isToStringTampered()) {
                hookingDetected = true;
                tamperedAPIs.push('Function.prototype.toString');
            }

            if (window.fetch && (!isNativeFunction(window.fetch) || window.fetch !== _fetch)) {
                hookingDetected = true;
                tamperedAPIs.push('window.fetch');
            }

            if (Object.defineProperty && (!isNativeFunction(Object.defineProperty) || Object.defineProperty !== _Object_defineProperty)) {
                hookingDetected = true;
                tamperedAPIs.push('Object.defineProperty');
            }

            if (Object.getOwnPropertyDescriptor && (!isNativeFunction(Object.getOwnPropertyDescriptor) || Object.getOwnPropertyDescriptor !== _Object_getOwnPropertyDescriptor)) {
                hookingDetected = true;
                tamperedAPIs.push('Object.getOwnPropertyDescriptor');
            }

            if (Document.prototype.createElement && (!isNativeFunction(Document.prototype.createElement) || Document.prototype.createElement !== _createElement)) {
                hookingDetected = true;
                tamperedAPIs.push('Document.prototype.createElement');
            }

            if (EventTarget.prototype.addEventListener && (!isNativeFunction(EventTarget.prototype.addEventListener) || EventTarget.prototype.addEventListener !== _addEventListener)) {
                hookingDetected = true;
                tamperedAPIs.push('EventTarget.prototype.addEventListener');
            }

            try {
                const nav = window.navigator;
                if (nav) {
                    const desc = _Object_getOwnPropertyDescriptor(nav, 'webdriver') ||
                                 _Object_getOwnPropertyDescriptor(Object.getPrototypeOf(nav), 'webdriver');
                    if (desc && desc.get) {
                        const getterStr = _Function_toString.call(desc.get);
                        if (!NATIVE_CODE_REGEX.test(getterStr)) {
                            hookingDetected = true;
                            tamperedAPIs.push('navigator.webdriver_getter_hook');
                        }
                    }
                }
            } catch (_) {}

            try {
                if (window.crypto && window.crypto.subtle && window.crypto.subtle.digest) {
                    if (!isNativeFunction(window.crypto.subtle.digest)) {
                        hookingDetected = true;
                        tamperedAPIs.push('crypto.subtle.digest');
                    }
                }
            } catch (_) {}

            try {
                if (window.HTMLCanvasElement && window.HTMLCanvasElement.prototype.toDataURL) {
                    if (!isNativeFunction(window.HTMLCanvasElement.prototype.toDataURL)) {
                        hookingDetected = true;
                        tamperedAPIs.push('HTMLCanvasElement.prototype.toDataURL');
                    }
                }
            } catch (_) {}

            try {
                const stack = (new Error()).stack || "";
                if (stack.includes("puppeteer") || stack.includes("playwright") ||
                    stack.includes("__puppeteer_evaluation_script__") || stack.includes("selenium") ||
                    stack.includes("userscript") || stack.includes("tampermonkey") || stack.includes("violentmonkey")) {
                    hookingDetected = true;
                    tamperedAPIs.push("bot_stack_trace");
                }
            } catch (_) {}

            try {
                const start = _Date_now();
                let dummy = 0;
                for (let i = 0; i < 2000; i++) {
                    dummy = (dummy + (i ^ 0x3c)) & 0xFFFF;
                }
                const elapsed = _Date_now() - start;
                if (elapsed > 120) {
                    debuggerDetected = true;
                    tamperedAPIs.push('debugger_timing_trap');
                }
            } catch (_) {}

            return {
                tamperingDetected: hookingDetected || debuggerDetected,
                hookingDetected: hookingDetected,
                debuggerDetected: debuggerDetected,
                tamperedAPIs: tamperedAPIs
            };
        }

        return {
            isNativeFunction,
            isToStringTampered,
            auditEnvironment,
            pristine: {
                fetch: _fetch,
                Date_now: _Date_now,
                Function_toString: _Function_toString,
                Object_freeze: _Object_freeze
            }
        };
    })();

    // =========================================================================
    // ARGUS BYTECODE VM: Custom Virtual Machine for Core Cryptography & Flow
    // =========================================================================
    const ArgusVM = (function () {
        // Polymorphic Opcode Seed (randomized per build)
        const _VM_SEED = 0x0C;

        // Base opcode mnemonics
        const _OP_BASE = [
            'PUSH_CONST', 'PUSH_INT', 'PUSH_TRUE', 'PUSH_FALSE', 'PUSH_NULL', 'POP',
            'LOAD_REG', 'STORE_REG', 'LOAD_ENV', 'GET_PROP', 'SET_PROP',
            'CALL_METHOD', 'CALL_FN', 'ADD', 'SUB', 'XOR', 'BIT_AND', 'EQ', 'NOT',
            'JUMP', 'JUMP_IF_FALSE', 'MAKE_ARRAY', 'MAKE_OBJECT', 'HALT'
        ];

        // Bijective permutation mapping: derives unique dynamic opcodes
        const OP = {};
        const _REV_OP = {};
        (function _initPolymorphicOpcodes(seed) {
            const sbox = [];
            for (let i = 0; i < 256; i++) sbox[i] = i;
            let j = 0;
            for (let i = 0; i < 256; i++) {
                j = (j + sbox[i] + seed + (i * 17)) & 0xFF;
                const tmp = sbox[i];
                sbox[i] = sbox[j];
                sbox[j] = tmp;
            }
            let pIdx = 1;
            for (let i = 0; i < _OP_BASE.length; i++) {
                const name = _OP_BASE[i];
                if (name === 'HALT') {
                    OP[name] = 0xFF;
                } else {
                    let code = sbox[pIdx++];
                    if (code === 0xFF || code === 0) code = sbox[pIdx++];
                    OP[name] = code;
                }
                _REV_OP[OP[name]] = name;
            }
        })(_VM_SEED);

        function execute(program, env) {
            const tStart = (typeof Date !== 'undefined' && Date.now) ? Date.now() : 0;
            const { bytecode, constPool, key } = program;
            const stack = [];
            const registers = new Array(32);
            let ip = 0;
            const len = bytecode.length;

            // Rolling state cipher for bytecode in-memory stream protection
            let rolling = 0x5A;
            const hasKey = Boolean(key && key.length > 0);

            const readByte = () => {
                const raw = bytecode[ip++];
                if (!hasKey) return raw;
                const kByte = key.charCodeAt((ip - 1) % key.length);
                const decrypted = (raw ^ kByte ^ rolling) & 0xFF;
                rolling = (rolling * 33 + decrypted) & 0xFF;
                return decrypted;
            };

            const readWord = () => {
                const b1 = readByte();
                const b2 = readByte();
                return (b1 << 8) | b2;
            };

            const getConst = (idx) => {
                if (!constPool) return undefined;
                const item = constPool[idx];
                if (typeof item === 'function') return item();
                if (item && typeof item === 'object' && item.__enc) {
                    let out = "";
                    const raw = item.d;
                    const k = key || "ARGUS_CONST_SEC";
                    for (let i = 0; i < raw.length; i++) {
                        out += String.fromCharCode(raw[i] ^ k.charCodeAt(i % k.length));
                    }
                    return out;
                }
                return item;
            };

            while (ip < len) {
                const op = readByte();
                if (op === OP.HALT) break;

                switch (op) {
                    case OP.PUSH_CONST: {
                        stack.push(getConst(readWord()));
                        break;
                    }
                    case OP.PUSH_INT: {
                        stack.push(readWord());
                        break;
                    }
                    case OP.PUSH_TRUE:
                        stack.push(true);
                        break;
                    case OP.PUSH_FALSE:
                        stack.push(false);
                        break;
                    case OP.PUSH_NULL:
                        stack.push(null);
                        break;
                    case OP.POP:
                        stack.pop();
                        break;
                    case OP.LOAD_REG: {
                        stack.push(registers[readByte()]);
                        break;
                    }
                    case OP.STORE_REG: {
                        registers[readByte()] = stack.pop();
                        break;
                    }
                    case OP.LOAD_ENV: {
                        const name = getConst(readWord());
                        stack.push(env && env[name] !== undefined ? env[name] : (typeof window !== 'undefined' ? window[name] : undefined));
                        break;
                    }
                    case OP.GET_PROP: {
                        const prop = stack.pop();
                        const obj = stack.pop();
                        stack.push(obj ? obj[prop] : undefined);
                        break;
                    }
                    case OP.SET_PROP: {
                        const val = stack.pop();
                        const prop = stack.pop();
                        const obj = stack.pop();
                        if (obj) obj[prop] = val;
                        break;
                    }
                    case OP.CALL_METHOD: {
                        const argc = readByte();
                        const args = [];
                        for (let i = 0; i < argc; i++) args.unshift(stack.pop());
                        const prop = stack.pop();
                        const obj = stack.pop();
                        stack.push(obj[prop].apply(obj, args));
                        break;
                    }
                    case OP.CALL_FN: {
                        const argc = readByte();
                        const args = [];
                        for (let i = 0; i < argc; i++) args.unshift(stack.pop());
                        const fn = stack.pop();
                        stack.push(fn.apply(null, args));
                        break;
                    }
                    case OP.ADD: {
                        const b = stack.pop();
                        const a = stack.pop();
                        stack.push(a + b);
                        break;
                    }
                    case OP.SUB: {
                        const b = stack.pop();
                        const a = stack.pop();
                        stack.push(a - b);
                        break;
                    }
                    case OP.XOR: {
                        const b = stack.pop();
                        const a = stack.pop();
                        stack.push(a ^ b);
                        break;
                    }
                    case OP.BIT_AND: {
                        const b = stack.pop();
                        const a = stack.pop();
                        stack.push(a & b);
                        break;
                    }
                    case OP.EQ: {
                        const b = stack.pop();
                        const a = stack.pop();
                        stack.push(a === b);
                        break;
                    }
                    case OP.NOT: {
                        stack.push(!stack.pop());
                        break;
                    }
                    case OP.JUMP: {
                        ip = readWord();
                        break;
                    }
                    case OP.JUMP_IF_FALSE: {
                        const target = readWord();
                        if (!stack.pop()) ip = target;
                        break;
                    }
                    case OP.MAKE_ARRAY: {
                        const count = readByte();
                        const arr = [];
                        for (let i = 0; i < count; i++) arr.unshift(stack.pop());
                        stack.push(arr);
                        break;
                    }
                    case OP.MAKE_OBJECT: {
                        const count = readByte();
                        const obj = {};
                        for (let i = 0; i < count; i++) {
                            const val = stack.pop();
                            const key = stack.pop();
                            obj[key] = val;
                        }
                        stack.push(obj);
                        break;
                    }
                    default:
                        break;
                }
            }

            if (tStart > 0 && typeof Date !== 'undefined' && Date.now) {
                const tElapsed = Date.now() - tStart;
                if (tElapsed > 300) {
                    if (typeof telemetryData !== 'undefined') {
                        telemetryData.debuggerDetected = true;
                        telemetryData.tamperingDetected = true;
                        if (telemetryData.tamperedAPIs) telemetryData.tamperedAPIs.push('vm_debugger_breakpoint');
                    }
                }
            }

            return stack.length > 0 ? stack[stack.length - 1] : undefined;
        }

        // Encrypts a bytecode array using the rolling stream cipher for protected storage
        function encryptBytecode(rawBytecode, key) {
            if (!key || key.length === 0) return rawBytecode;
            let rolling = 0x5A;
            const out = [];
            for (let i = 0; i < rawBytecode.length; i++) {
                const b = rawBytecode[i];
                const kByte = key.charCodeAt(i % key.length);
                const enc = (b ^ kByte ^ rolling) & 0xFF;
                rolling = (rolling * 33 + b) & 0xFF;
                out.push(enc);
            }
            return out;
        }

        function cipher(payloadStr, sitekey) {
            let iv = "";
            if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
                const arr = new Uint8Array(8);
                window.crypto.getRandomValues(arr);
                for (let i = 0; i < 8; i++) iv += (arr[i] < 16 ? "0" : "") + arr[i].toString(16);
            } else {
                for (let i = 0; i < 16; i++) iv += Math.floor(Math.random() * 16).toString(16);
            }

            const seedStr = sitekey + iv;
            const sBox = new Uint8Array(256);
            for (let i = 0; i < 256; i++) sBox[i] = i;
            let j = 0;
            for (let i = 0; i < 256; i++) {
                j = (j + sBox[i] + seedStr.charCodeAt(i % seedStr.length)) & 0xFF;
                const temp = sBox[i];
                sBox[i] = sBox[j];
                sBox[j] = temp;
            }

            let result = "";
            let i1 = 0, j1 = 0, prev = 0xAA;
            const len = payloadStr.length;
            for (let k = 0; k < len; k++) {
                i1 = (i1 + 1) & 0xFF;
                j1 = (j1 + sBox[i1]) & 0xFF;
                const temp = sBox[i1];
                sBox[i1] = sBox[j1];
                sBox[j1] = temp;
                const keyByte = sBox[(sBox[i1] + sBox[j1]) & 0xFF];
                const pCode = payloadStr.charCodeAt(k);
                const cByte = (pCode ^ keyByte ^ prev) & 0xFF;
                prev = cByte;
                result += String.fromCharCode(cByte);
            }
            return "v2:" + iv + ":" + btoa(result);
        }

        function decipher(cipherStr, sitekey) {
            if (cipherStr && cipherStr.startsWith("v2:")) {
                const parts = cipherStr.split(":", 3);
                const iv = parts[1];
                const rawBytes = atob(parts[2]);
                const seedStr = sitekey + iv;
                const sBox = new Uint8Array(256);
                for (let i = 0; i < 256; i++) sBox[i] = i;
                let j = 0;
                for (let i = 0; i < 256; i++) {
                    j = (j + sBox[i] + seedStr.charCodeAt(i % seedStr.length)) & 0xFF;
                    const temp = sBox[i];
                    sBox[i] = sBox[j];
                    sBox[j] = temp;
                }
                let out = "";
                let i1 = 0, j1 = 0, prev = 0xAA;
                for (let k = 0; k < rawBytes.length; k++) {
                    i1 = (i1 + 1) & 0xFF;
                    j1 = (j1 + sBox[i1]) & 0xFF;
                    const temp = sBox[i1];
                    sBox[i1] = sBox[j1];
                    sBox[j1] = temp;
                    const keyByte = sBox[(sBox[i1] + sBox[j1]) & 0xFF];
                    const cByte = rawBytes.charCodeAt(k);
                    const pCode = cByte ^ keyByte ^ prev;
                    prev = cByte;
                    out += String.fromCharCode(pCode);
                }
                return out;
            } else {
                const payloadStr = atob(cipherStr);
                let out = "";
                for (let i = 0; i < payloadStr.length; i++) {
                    out += String.fromCharCode(payloadStr.charCodeAt(i) ^ sitekey.charCodeAt(i % sitekey.length));
                }
                return out;
            }
        }

        function verifyVM() {
            try {
                const testKey = "ARGUS_VM_TEST_KEY_99";
                const rawBc = [
                    OP.PUSH_INT, 0x00, 0x2A,      // push 42
                    OP.STORE_REG, 0,              // reg[0] = 42
                    OP.LOAD_REG, 0,               // push reg[0]
                    OP.PUSH_INT, 0x01, 0x00,      // push 256
                    OP.ADD,                       // 42 + 256 = 298
                    OP.PUSH_INT, 0x00, 0x0F,      // push 15
                    OP.XOR,                       // 298 ^ 15 = 309
                    OP.HALT
                ];
                const encBc = encryptBytecode(rawBc, testKey);
                const program = {
                    bytecode: encBc,
                    constPool: [],
                    key: testKey
                };
                const output = execute(program, {});
                return output === ((42 + 256) ^ 15);
            } catch (_) {
                return false;
            }
        }

        const vmExports = { OP, execute, cipher, decipher, verifyVM, encryptBytecode };
        try {
            if (typeof Object.freeze === 'function') {
                Object.freeze(OP);
                Object.freeze(vmExports);
            }
        } catch (_) {}
        return vmExports;
    })();

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
        maxMouseVelocity: 0,
        honeypot: false,
        honeypotTriggered: false,
        honeypotAction: null,
        tamperingDetected: false,
        hookingDetected: false,
        debuggerDetected: false,
        tamperedAPIs: [],
        vmExecuted: true,
        vmIntegrityFailed: false
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

    async function solvePoW(sitekey, difficulty = 4) {
        const timestamp = Date.now();
        let nonce = 0;
        const prefix = "0".repeat(Math.max(1, Math.min(8, difficulty)));
        const encoder = new TextEncoder();
        while (true) {
            const msg = sitekey + timestamp + nonce;
            const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(msg));
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            if (hashHex.startsWith(prefix)) {
                return { nonce, timestamp, hashHex, difficulty };
            }
            nonce++;
            if (nonce % 500 === 0) {
                await new Promise(r => setTimeout(r, 0));
            }
        }
    }

    function obfuscatePayload(payloadStr, sitekey) {
        return ArgusVM.cipher(payloadStr, sitekey);
    }

    function detectStealthAndHeadless() {
        const reasons = [];
        let isWebdriver = false;
        let isStealth = false;
        let cdcFound = false;
        let automationGlobalsFound = false;
        let outerDimensionsZero = false;
        let screenAnomalies = false;

        // 1. Direct Webdriver Flag (strict true check only)
        try {
            if (navigator.webdriver === true) {
                isWebdriver = true;
                reasons.push('navigator.webdriver_true');
            }
        } catch (e) {}

        // 2. Known Automation Globals & Framework Artifacts
        const automationProps = [
            '__playwright',
            '__puppeteer_evaluation_script__',
            '__selenium_evaluate',
            '__webdriver_evaluate',
            '__driver_evaluate',
            '__webdriver_unwrapped',
            '__fxdriver_evaluate',
            '__driver_unwrapped',
            '__selenium_unwrapped',
            '__fxdriver_unwrapped',
            '_Selenium_IDE_Recorder',
            '_selenium',
            'calledSelenium',
            'callPhantom',
            '_phantom',
            'domAutomation',
            'domAutomationController'
        ];
        for (let i = 0; i < automationProps.length; i++) {
            const p = automationProps[i];
            try {
                if (p in window || (typeof document !== 'undefined' && p in document)) {
                    automationGlobalsFound = true;
                    isStealth = true;
                    reasons.push('automation_global:' + p);
                }
            } catch (e) {}
        }
        try {
            if (document && document.documentElement && document.documentElement.getAttribute('webdriver')) {
                automationGlobalsFound = true;
                isStealth = true;
                reasons.push('documentElement_webdriver_attr');
            }
        } catch (e) {}

        // 3. ChromeDriver CDC pattern ($cdc_ / cdc_)
        try {
            const checkObj = (obj) => {
                if (!obj) return null;
                const keys = Object.getOwnPropertyNames(obj);
                for (let i = 0; i < keys.length; i++) {
                    if (keys[i].startsWith('cdc_') || keys[i].startsWith('$cdc_')) {
                        return keys[i];
                    }
                }
                return null;
            };
            const wCdc = checkObj(window);
            const dCdc = typeof document !== 'undefined' ? checkObj(document) : null;
            if (wCdc || dCdc) {
                cdcFound = true;
                isStealth = true;
                reasons.push('cdc_marker_found:' + (wCdc || dCdc));
            }
        } catch (e) {}

        // 4. Headless Outer & Inner Dimensions Check (both must be 0)
        try {
            if (window.outerWidth === 0 && window.outerHeight === 0 && window.innerWidth === 0 && window.innerHeight === 0) {
                outerDimensionsZero = true;
                reasons.push('outer_dimensions_zero');
            }
        } catch (e) {}

        // 5. Impossible Screen Metrics
        try {
            if (window.screen) {
                if (window.screen.availWidth > window.screen.width || window.screen.availHeight > window.screen.height) {
                    screenAnomalies = true;
                    reasons.push('screen_avail_exceeds_total');
                }
                if (window.screen.colorDepth && window.screen.colorDepth < 8) {
                    screenAnomalies = true;
                    reasons.push('color_depth_low');
                }
            }
        } catch (e) {}

        // 6. Node.js environment leak in browser context (electron/puppeteer runner)
        try {
            if (typeof window.process !== 'undefined' && window.process.versions && window.process.versions.node) {
                automationGlobalsFound = true;
                reasons.push('node_process_in_browser');
            }
        } catch (e) {}

        // 7. WebGL Hardware Shader Precision & Software Rasterizer Check (C++ layer)
        try {
            if (typeof document !== 'undefined' && document.createElement) {
                const glCanvas = document.createElement('canvas');
                const gl = glCanvas.getContext('webgl') || glCanvas.getContext('experimental-webgl');
                if (gl) {
                    const precFormat = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
                    if (precFormat && (precFormat.precision < 23 || precFormat.rangeMin < 62 || precFormat.rangeMax < 62)) {
                        reasons.push('webgl_shader_precision_anomaly');
                        isStealth = true;
                    }
                    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                    if (debugInfo) {
                        const renderer = (gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '').toLowerCase();
                        const vendor = (gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '').toLowerCase();
                        if (renderer.includes('swiftshader') || renderer.includes('llvmpipe') ||
                            renderer.includes('softpipe') || renderer.includes('mesa') ||
                            renderer.includes('virtualbox') || renderer.includes('vmware') ||
                            vendor.includes('mesa') || renderer.includes('software rasterizer')) {
                            reasons.push('software_rasterizer_detected:' + renderer);
                            isStealth = true;
                        }
                    }
                }
            }
        } catch (e) {}

        // 8. AudioContext Physical DAC Channel Check
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                const aCtx = new AudioContextClass();
                if (aCtx.destination && aCtx.destination.maxChannelCount === 0) {
                    reasons.push('audio_hardware_missing_dac');
                    isStealth = true;
                }
                if (typeof aCtx.close === 'function') aCtx.close().catch(() => {});
            }
        } catch (e) {}

        // 9. V8 Recursion Stack Depth & Evaluation Context Check
        try {
            let stackDepth = 0;
            const testRecursion = () => { stackDepth++; testRecursion(); };
            try { testRecursion(); } catch (err) {
                if (stackDepth < 100 || (err.stack && (err.stack.includes('__puppeteer_evaluation_script__') || err.stack.includes('debugger eval')))) {
                    reasons.push('v8_execution_context_anomalous');
                    isStealth = true;
                }
            }
        } catch (e) {}

        // 10. Chrome Object Descriptors & WebIDL Integrity Check
        try {
            if (window.chrome) {
                const cDesc = Object.getOwnPropertyDescriptor(window, 'chrome');
                if (cDesc && (!cDesc.configurable || cDesc.value === undefined)) {
                    reasons.push('chrome_descriptor_anomaly');
                    isStealth = true;
                }
            }
        } catch (e) {}

        return {
            webdriver: isWebdriver,
            stealthDetected: isStealth || cdcFound || automationGlobalsFound,
            stealthReasons: reasons,
            cdcFound: cdcFound,
            automationGlobalsFound: automationGlobalsFound,
            outerDimensionsZero: outerDimensionsZero,
            pluginsFaked: false,
            chromeMissing: false,
            screenAnomalies: screenAnomalies
        };
    }

    const earlyStealth = detectStealthAndHeadless();
    if (earlyStealth.webdriver || earlyStealth.stealthDetected) {
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
        if (telemetryData.honeypot || telemetryData.honeypotTriggered) {
            return true;
        }
        let form = container.closest('form');
        if (form) {
            let honeypot = form.querySelector('input[name="website_url"]');
            if (honeypot && honeypot.value) return true;
            let fakeInput = form.querySelector('input[name="g-recaptcha-response"], input[name="recaptcha_verification_token"]');
            if (fakeInput && (fakeInput.value || fakeInput.checked)) return true;
        }
        return false;
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

    const initializedContainers = new WeakSet();

    function initCaptcha() {
        const containers = document.querySelectorAll('.argus-captcha');

        containers.forEach(async container => {
            if (initializedContainers.has(container)) return;
            initializedContainers.add(container);

            let isVerified = false;

            const sitekey = container.dataset.sitekey;

            let parentForm = container.closest('form');
            let submitButtons = [];
            if (parentForm) {
                submitButtons = parentForm.querySelectorAll('button[type="submit"], input[type="submit"]');
            }

            let mode = container.dataset.mode || 'manual';
            let theme = container.dataset.theme || 'auto';
            let initialError = null;
            let isTestMode = false;
            let powDifficulty = 4;

            if (!sitekey) {
                initialError = "Missing sitekey";
            } else if (sitekey === 'argus_simulate_network_error') {
                initialError = "Network Error";
            }

            // Check client-side instant cache (0.0 ms render)
            const cachedSettings = sitekey ? getStoredSettings(sitekey) : null;
            if (cachedSettings && cachedSettings.success) {
                mode = cachedSettings.mode || mode;
                if (cachedSettings.theme && cachedSettings.theme !== 'auto') theme = cachedSettings.theme;
                isTestMode = cachedSettings.is_test || false;
                powDifficulty = cachedSettings.pow_difficulty || (cachedSettings.pow_prefix ? cachedSettings.pow_prefix.length : 4);
            }

            // Asynchronous non-blocking settings promise (never blocks visual mounting)
            const settingsPromise = (async () => {
                if (initialError) return { success: false, error: initialError };
                if (cachedSettings) return cachedSettings;
                try {
                    const res = await fetch(`${HOST}/v1/captcha/settings?sitekey=${encodeURIComponent(sitekey)}`);
                    const data = await res.json();
                    if (data && data.success) {
                        setStoredSettings(sitekey, data);
                    }
                    return data;
                } catch (err) {
                    return { success: false, error: "Network Error" };
                }
            })();

            // Shadow DOM encapsulation for maximum stealth from external scrapers
            let mountPoint = container;
            if (typeof container.attachShadow === 'function') {
                try {
                    mountPoint = container.shadowRoot || container.attachShadow({ mode: 'open' });
                } catch (_) {
                    mountPoint = container;
                }
            }

            // Randomized element identifiers and classes per visit / refresh (no obvious prefixes)
            const randUid = Math.random().toString(36).substring(2, 9);
            const randSalt = Math.random().toString(36).substring(2, 6);
            const realWidgetClass = `w-${randUid}`;
            const realBoxClass = `b-${randUid}`;
            const realCbContainerClass = `c-${randUid}`;
            const realTextClass = `t-${randUid}`;
            const realSubTextClass = `s-${randUid}`;
            const realLogoClass = `l-${randUid}`;
            const randDataAttr = `data-r-${randSalt}`;

            // Unique dynamic keyframe tokens per instance
            const kfSpin = `sp_${randSalt}`;
            const kfFade = `fd_${randSalt}`;
            const kfPulse = `pl_${randSalt}`;
            const kfDraw = `dr_${randSalt}`;
            const kfDrawCross = `dc_${randSalt}`;
            const kfDrawExcl = `de_${randSalt}`;
            const kfPopIn = `pi_${randSalt}`;
            const kfPopOut = `po_${randSalt}`;
            const kfShake = `sk_${randSalt}`;

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

            widget.classList.add(realWidgetClass, `_w-${randSalt}`);
            widget.setAttribute(randDataAttr, 'widget');
            widget.setAttribute('data-token', randUid);
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
            let currentVisualData = null;
            let currentAudioData = null;
            let activeAudioObj = null;
            let isSwitchingChallenge = false;

            widget.onmouseenter = () => {
                if (!isVerified && !isProcessing && !isFailed) {
                    box.style.borderColor = colors.hoverBorder;
                }
            };

            widget.onmouseleave = () => {
                if (!isVerified && !isProcessing && !isFailed) {
                    box.style.borderColor = colors.boxBorder;
                }
            };

            checkboxContainer.className = `${realCbContainerClass} c-${randSalt}`;
            checkboxContainer.id = `chk-${randUid}`;
            checkboxContainer.setAttribute(randDataAttr, 'check-wrap');
            checkboxContainer.setAttribute('role', 'checkbox');
            checkboxContainer.setAttribute('tabindex', '0');
            checkboxContainer.setAttribute('aria-checked', 'false');
            checkboxContainer.setAttribute('aria-label', 'Verify you are human');
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

            box.className = `${realBoxClass} b-${randSalt}`;
            box.id = `box-${randUid}`;
            box.setAttribute(randDataAttr, 'box');
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
            spinner.className = `sp-${randUid}`;
            spinner.style.cssText = `
                width: 20px;
                height: 20px;
                border: 3px solid rgba(59, 130, 246, 0.1);
                border-top-color: #3b82f6;
                border-radius: 50%;
                animation: ${kfSpin} 1s linear infinite;
                display: none;
                position: absolute;
            `;

            const checkmark = document.createElement('div');
            checkmark.className = `cm-${randUid}`;
            checkmark.innerHTML = `<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="14" cy="14" r="14" fill="#10b981"/><polyline points="8 14 12 18 20 10" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="stroke-dasharray: 50; stroke-dashoffset: 50;"></polyline></svg>`;
            checkmark.style.cssText = `
                display: none;
                position: absolute;
            `;

            const crossmark = document.createElement('div');
            crossmark.className = `xm-${randUid}`;
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
            exclamation.className = `ex-${randUid}`;
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
            textContainer.className = `tc-${randUid}`;
            textContainer.style.cssText = `
                flex: 1;
                display: flex;
                flex-direction: column;
                z-index: 1;
                min-width: 0;
                justify-content: center;
            `;

            text.innerText = "I'm not a robot";
            text.className = `${realTextClass} t-${randSalt}`;
            text.setAttribute(randDataAttr, 'text');
            text.style.cssText = `
                font-size: 14px;
                color: ${colors.text};
                font-weight: 400;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                line-height: 1.2;
            `;

            subText.className = `${realSubTextClass} s-${randSalt}`;
            subText.style.cssText = `
                font-size: 11px;
                color: ${colors.subText};
                opacity: 0.85;
                margin-top: 2px;
                display: none;
                animation: ${kfFade} 0.5s ease;
                white-space: normal;
                word-break: break-word;
                line-height: 1.25;
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

            logoContainer.className = realLogoClass;
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
            const ARGUS_LOGO_WHITE = "data:image/png;base64,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";
            const ARGUS_LOGO_BLACK = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAfQAAAH0CAYAAADL1t+KAAAgAElEQVR4XuzdCXwMd/8H8JnZO4K4QkKTIFQfN/FoqbPap4fnoS3hcYaSUH2K0qqgKEW1SlEaRwhJEFVEH9VTD/2jbg+llVJH3SRIstfszP/13cwvHdtQRzbZnf28n1eeJLur2Z3f7nzmd/McAAAA+D3e718BAAAAINABAAC0ADV0AAAADUCgAwAAaAACHQAAQAMQ6AAAABqAQAcAANAABDoAAIAGINABAAA0AIEOAACgAQh0AAAADUCgAwAAaAACHQAAQAMQ6AAAABqAQAcAANAABDoAAIAGINABAAA0AIEOAACgAQh0AAAADUCgAwAAaAACHQAAQAMQ6AAAABqAQAcAANAABDoAAIAGINABAAA0AIEOAACgAQh0AAAADUCgAwAAaAACHQAAQAMQ6AAAABqAQAcAANAABDoAAIAGINABAAA0AIEOAACgAQh0AAAADUCgAwAAaAACHQAAQAMQ6AAAABqAQAcAANAABDoAAIAGINABAAA0AIEOAACgAQh0AAAADUCgAwAAaAACHQAAQAMQ6AAAABqAQAcAANAABDoAAIAGINABAAA0AIEOAACgAQh0AAAADUCgAwAAaAACHQAAQAMQ6AAAABqAQAcAANAABDoAAIAGINABAAA0AIEOAACgAQh0AAAADUCgAwAAaAACHQAAQAMQ6AAAABqAQAcAANAABDoAAIAGINABAAA0AIEOAACgAQh0AAAADUCgAwAAaAACHQAAQAMQ6AAAABqAQAcAANAABDoAAIAGINABAAA0AIEOAACgAQh0AAAADUCgAwAAaAACHQAAQAMQ6AAAABqAQAcAANAABDoAAIAGINABAAA0AIEOAACgAQh0AAAADUCgAwAAaAACHQAAQAMQ6AAAABqAQAcAANAABDoAAIAGINABAAA0AIEOAACgAQh0AAAADUCgAwAAaAACHQAAQAMQ6AAAABqAQAcAANAABDoAAIAGINABAAA0AIEOAACgAQh0AAAADUCgAwAAaAACHQAAQAMQ6AAAABqAQAcAANAABDoAAIAGINABAAA0AIEOAACgAQh0AAAADUCgAwAAaAACHQAAQAMQ6AAAABqAQAcAANAABDoAAIAGINABAAA0AIEOAACgAQh0AAAADUCgAwAAaAACHQAAQAMQ6AAA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";
            const currentLogo = theme === 'dark' ? ARGUS_LOGO_WHITE : ARGUS_LOGO_BLACK;
            // Subtle lock or shield icon to look like a brand logo (like recaptcha loop)
            logoImgContainer.innerHTML = `<img src="${currentLogo}" style="width: 42px; height: 42px; object-fit: contain;" alt="">`;

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
                badgeIcon.innerHTML = `<img src="${currentLogo}" style="width: 24px; height: 24px; object-fit: contain;" alt="">`;
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

            mountPoint.appendChild(widget);

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

            // Inject Honeypot Fake Captcha Box inside mountPoint for automated crawlers and scrapers
            const fakeCaptchaBox = document.createElement('div');
            fakeCaptchaBox.className = 'recaptcha-checkbox-container g-recaptcha cf-turnstile-wrapper h-captcha-box captcha-fake-box';
            fakeCaptchaBox.id = 'recaptcha-anchor-wrap';
            fakeCaptchaBox.setAttribute('aria-hidden', 'true');
            fakeCaptchaBox.style.cssText = 'position: absolute !important; width: 1px !important; height: 1px !important; padding: 0 !important; margin: -1px !important; overflow: hidden !important; clip: rect(0, 0, 0, 0) !important; white-space: nowrap !important; border: 0 !important; opacity: 0.001 !important; pointer-events: auto !important; z-index: -9999 !important;';

            const fakeCheckbox = document.createElement('div');
            fakeCheckbox.id = 'recaptcha-anchor';
            fakeCheckbox.className = 'recaptcha-checkbox goog-inline-block cf-turnstile-anchor hcaptcha-anchor captcha-verify-box';
            fakeCheckbox.setAttribute('role', 'checkbox');
            fakeCheckbox.setAttribute('aria-checked', 'false');
            fakeCheckbox.setAttribute('aria-label', "I'm not a robot");
            fakeCheckbox.tabIndex = -1;

            const fakeInput = document.createElement('input');
            fakeInput.type = 'checkbox';
            fakeInput.name = 'g-recaptcha-response';
            fakeInput.className = 'g-recaptcha-input recaptcha-token';
            fakeInput.tabIndex = -1;
            fakeInput.autocomplete = 'off';

            const fakeTextInput = document.createElement('input');
            fakeTextInput.type = 'text';
            fakeTextInput.name = 'recaptcha_verification_token';
            fakeTextInput.className = 'h-captcha-response cf-turnstile-response';
            fakeTextInput.tabIndex = -1;
            fakeTextInput.autocomplete = 'off';

            fakeCheckbox.appendChild(fakeInput);
            fakeCheckbox.appendChild(fakeTextInput);
            fakeCaptchaBox.appendChild(fakeCheckbox);

            const triggerHoneypotTrap = (e) => {
                telemetryData.honeypot = true;
                telemetryData.honeypotTriggered = true;
                telemetryData.honeypotAction = e ? e.type : 'interaction';
                try {
                    if (e && e.stopPropagation) e.stopPropagation();
                } catch (_) {}
                if (e && (e.type === 'click' || e.type === 'mousedown')) {
                    executeChallenge();
                }
            };

            const trapEvents = ['click', 'mousedown', 'mouseup', 'touchstart', 'focus', 'focusin', 'keydown', 'change', 'input'];
            trapEvents.forEach(evt => {
                fakeCaptchaBox.addEventListener(evt, triggerHoneypotTrap, { capture: true, passive: true });
                fakeCheckbox.addEventListener(evt, triggerHoneypotTrap, { capture: true, passive: true });
                fakeInput.addEventListener(evt, triggerHoneypotTrap, { capture: true, passive: true });
                fakeTextInput.addEventListener(evt, triggerHoneypotTrap, { capture: true, passive: true });
            });

            mountPoint.appendChild(fakeCaptchaBox);

            let form = container.closest('form');
            if (form && !form.querySelector('input[data-trap="true"]')) {
                let honeypot = document.createElement('input');
                honeypot.type = 'text';
                honeypot.name = 'website_url';
                honeypot.setAttribute('data-trap', 'true');
                honeypot.setAttribute('style', 'position: absolute !important; width: 1px !important; height: 1px !important; padding: 0 !important; margin: -1px !important; overflow: hidden !important; clip: rect(0, 0, 0, 0) !important; white-space: nowrap !important; border: 0 !important; opacity: 0.001 !important; pointer-events: none !important;');
                honeypot.tabIndex = -1;
                honeypot.autocomplete = 'off';
                honeypot.addEventListener('input', triggerHoneypotTrap, { capture: true, passive: true });
                honeypot.addEventListener('change', triggerHoneypotTrap, { capture: true, passive: true });
                form.appendChild(honeypot);
            }

            // Visual Challenge UI Modal Overlay (lazily attached on demand, never lingering)
            const visualOverlay = document.createElement('div');
            visualOverlay.id = `ovl_${randUid}`;
            visualOverlay.className = `m_${randSalt}`;
            visualOverlay.setAttribute(randDataAttr, 'overlay');
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
            visualContainer.id = `vc_${randUid}`;
            visualContainer.className = `modal-${randUid}`;
            visualContainer.setAttribute(randDataAttr, 'modal');
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

            const showModal = () => {
                if (!document.body.contains(visualOverlay)) {
                    document.body.appendChild(visualOverlay);
                }
                visualOverlay.style.display = 'flex';
            };

            const closeModal = () => {
                visualOverlay.style.display = 'none';
                if (document.body.contains(visualOverlay)) {
                    visualOverlay.remove();
                }
                if (activeAudioObj) {
                    try { activeAudioObj.pause(); activeAudioObj.currentTime = 0; } catch (_) {}
                    activeAudioObj = null;
                }
                isSwitchingChallenge = false;
                if (isVerified || container.dataset.verified === "true") return;
                isProcessing = false;
                isFailed = false;
                spinner.style.display = 'none';
                crossmark.style.display = 'none';
                checkmark.style.display = 'none';
                exclamation.style.display = 'none';
                box.style.display = 'block';
                box.style.borderColor = colors.boxBorder;
                text.innerText = "Verify you are human";
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

            const style = document.createElement('style');
            style.id = `st_${randSalt}`;
            style.innerHTML = `
                #${visualOverlay.id} * {
                    box-sizing: border-box !important;
                }
                #${visualOverlay.id} button {
                    font-family: inherit !important;
                    text-transform: none !important;
                    margin: 0;
                }
                @keyframes ${kfSpin} { to { transform: rotate(360deg); } }
                @keyframes ${kfFade} { from { opacity: 0; } to { opacity: 1; } }
                @keyframes ${kfPulse} { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
                @keyframes ${kfDraw} {
                    from { stroke-dashoffset: 50; }
                    to { stroke-dashoffset: 0; }
                }
                @keyframes ${kfDrawCross} {
                    from { stroke-dashoffset: 15; }
                    to { stroke-dashoffset: 0; }
                }
                @keyframes ${kfDrawExcl} {
                    from { stroke-dashoffset: 10; }
                    to { stroke-dashoffset: 0; }
                }
                @keyframes ${kfPopIn} {
                    0% { transform: scale(0); opacity: 0; }
                    60% { transform: scale(1.15); opacity: 1; }
                    100% { transform: scale(1); opacity: 1; }
                }
                @keyframes ${kfPopOut} {
                    0% { transform: scale(1); opacity: 1; }
                    100% { transform: scale(0.8); opacity: 0; }
                }
                @keyframes ${kfShake} {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-5px); }
                    75% { transform: translateX(5px); }
                }
                .${realWidgetClass} {
                    width: 340px;
                    max-width: 100%;
                    height: 78px;
                }
                @media (max-width: 380px) {
                    .${realWidgetClass} {
                        width: 100%;
                        height: 72px;
                    }
                }
            `;
            document.head.appendChild(style);
            if (mountPoint !== container) {
                mountPoint.appendChild(style.cloneNode(true));
            }

            const injectToken = (token) => {
                isVerified = true;
                container.dataset.verified = "true";
                isProcessing = false;
                isFailed = false;

                if (document.body.contains(visualOverlay)) {
                    visualOverlay.remove();
                }
                spinner.style.display = 'none';
                crossmark.style.display = 'none';
                box.style.display = 'none';
                exclamation.style.display = 'none';

                checkmark.style.display = 'block';
                checkmark.style.animation = 'none';
                void checkmark.offsetWidth;
                checkmark.style.animation = `${kfPopIn} 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards`;

                const polyline = checkmark.querySelector('polyline');
                if (polyline) {
                    polyline.style.animation = 'none';
                    void polyline.offsetWidth;
                    polyline.style.animation = `${kfDraw} 0.4s ease 0.2s both`;
                }

                text.innerText = "Success!";
                text.style.color = '#10b981';
                text.style.cursor = 'default';
                subText.style.display = 'none';

                widget.style.borderColor = '#10b981';
                widget.style.boxShadow = '0 0 0 1px rgba(16, 185, 129, 0.2)';
                widget.style.cursor = 'default';

                checkboxContainer.style.cursor = 'default';
                checkboxContainer.style.pointerEvents = 'none';
                checkboxContainer.setAttribute('aria-checked', 'true');
                checkboxContainer.removeAttribute('tabindex');

                // Detach click listener so clicking the tick does not re-execute
                checkboxContainer.removeEventListener('click', executeChallenge);
                if (typeof text !== 'undefined' && text) {
                    text.removeEventListener('click', executeChallenge);
                    text.style.cursor = 'default';
                }

                try {
                    container.dispatchEvent(new CustomEvent('argus-captcha-verified', { bubbles: true, composed: true, detail: { token } }));
                } catch (_) {}

                try {
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
                } catch (_) {}

                try {
                    const cbName = container.dataset.callback;
                    if (cbName && typeof window[cbName] === 'function') {
                        window[cbName](token);
                    }
                } catch (_) {}

                try {
                    container.dispatchEvent(new CustomEvent('argus-success', { detail: { token: token } }));
                } catch (_) {}
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
                    return "Blocked by security policy.";
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
                if (isVerified || container.dataset.verified === "true") return;
                const desc = getPresetErrorDescription(msg);
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
                    exclamation.style.animation = `${kfPopIn} 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards`;

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
                    widget.title = `Error: ${desc} - ${msg}`;

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
                crossmark.style.animation = `${kfPopIn} 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards`;

                const lines = crossmark.querySelectorAll('line');
                lines[0].style.animation = 'none';
                lines[1].style.animation = 'none';
                void crossmark.offsetWidth;
                lines[0].style.animation = `${kfDrawCross} 0.3s ease 0.2s both`;
                lines[1].style.animation = `${kfDrawCross} 0.3s ease 0.35s both`;

                text.innerText = "Failed!";
                text.style.color = colors.text;
                subText.style.display = 'none'; // Ensure no details are shown
                widget.style.borderColor = colors.border;

                // Allow them to click again after 3 seconds
                setTimeout(() => {
                    if (!isVerified) {
                        crossmark.style.animation = `${kfPopOut} 0.4s ease forwards`;
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

            settingsPromise.then(data => {
                if (!data || !data.success) {
                    triggerError((data && data.error) || 'Failed to load settings', true);
                } else {
                    mode = data.mode || mode;
                    isTestMode = data.is_test || false;
                    powDifficulty = data.pow_difficulty || (data.pow_prefix ? data.pow_prefix.length : 4);
                    if (mode === 'invisible') {
                        widget.style.display = 'none';
                    } else if (mode === 'auto' && !isVerified && !isProcessing) {
                        executeChallenge();
                    }
                }
            });

            const executeChallenge = async () => {
                if (isVerified || container.dataset.verified === "true") return;
                if (isProcessing || isFailed) return; // prevent spamming clicks

                // Ensure settings have completed before proceeding with challenge
                const settingsData = await settingsPromise;
                if (!settingsData || !settingsData.success) {
                    triggerError((settingsData && settingsData.error) || 'Failed to load settings', true);
                    return;
                }

                currentVisualData = null;
                currentAudioData = null;
                isSwitchingChallenge = false;
                if (activeAudioObj) {
                    try { activeAudioObj.pause(); } catch (_) {}
                    activeAudioObj = null;
                }

                isProcessing = true;
                if (mode === 'manual') {
                    box.style.display = 'none';
                    spinner.style.display = 'block';
                    text.innerText = "Verifying you are human...";
                }

                try {
                    telemetryData.timeOnPage = Date.now() - initTime;

                    let powData = null;
                    try {
                        if (window.crypto && window.crypto.subtle) {
                            powData = await solvePoW(sitekey, powDifficulty);
                        }
                    } catch (e) {
                    }

                    const stealthReport = detectStealthAndHeadless();
                    telemetryData.webdriver = Boolean(stealthReport.webdriver);

                    const shieldReport = ArgusShield.auditEnvironment();
                    telemetryData.tamperingDetected = shieldReport.tamperingDetected;
                    telemetryData.hookingDetected = shieldReport.hookingDetected;
                    telemetryData.debuggerDetected = shieldReport.debuggerDetected;
                    telemetryData.tamperedAPIs = shieldReport.tamperedAPIs;

                    const vmOk = ArgusVM.verifyVM();
                    telemetryData.vmExecuted = true;
                    telemetryData.vmIntegrityFailed = !vmOk;

                    const rawTelemetry = {
                        webdriver: telemetryData.webdriver,
                        stealthDetected: stealthReport.stealthDetected,
                        stealthReasons: stealthReport.stealthReasons,
                        cdcFound: stealthReport.cdcFound,
                        automationGlobalsFound: stealthReport.automationGlobalsFound,
                        outerDimensionsZero: stealthReport.outerDimensionsZero,
                        pluginsFaked: stealthReport.pluginsFaked,
                        chromeMissing: stealthReport.chromeMissing,
                        screenAnomalies: stealthReport.screenAnomalies,
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
                        honeypot: Boolean(getHoneypotValue(container) || telemetryData.honeypot),
                        honeypotTriggered: Boolean(telemetryData.honeypotTriggered),
                        honeypotAction: telemetryData.honeypotAction || null,
                        tamperingDetected: Boolean(telemetryData.tamperingDetected),
                        hookingDetected: Boolean(telemetryData.hookingDetected),
                        debuggerDetected: Boolean(telemetryData.debuggerDetected),
                        tamperedAPIs: telemetryData.tamperedAPIs || [],
                        vmExecuted: Boolean(telemetryData.vmExecuted),
                        vmIntegrityFailed: Boolean(telemetryData.vmIntegrityFailed),
                        forceVisual: window.forceArgusVisual === true,
                        forceChallenge: window.forceArgusChallenge || null,
                        url: window.location.href,
                        pow: powData
                    };

                    const tData = ArgusVM.cipher(JSON.stringify(rawTelemetry), sitekey);

                    const payload = {
                        sitekey: sitekey,
                        telemetry: tData
                    };

                    const fetchFn = (ArgusShield.pristine && ArgusShield.pristine.fetch) ? ArgusShield.pristine.fetch : window.fetch;
                    const res = await fetchFn(`${HOST}/v1/captcha/challenge`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    const data = await res.json();

                    if (data.success && data.token) {
                        injectToken(data.token);
                        return;
                    }
                    else if (data.requires_visual) {
                        isProcessing = false;
                        text.innerText = "Action required";
                        subText.innerText = "Please solve the challenge below.";
                        subText.style.display = 'block';

                        currentVisualData = (data.visual_type !== 'audio') ? data : null;
                        currentAudioData = (data.visual_type === 'audio') ? data : null;

                        const onSwitchToVisual = () => {
                            if (isSwitchingChallenge) return;
                            if (!currentVisualData) return;
                            isSwitchingChallenge = true;

                            if (activeAudioObj) {
                                try {
                                    activeAudioObj.pause();
                                    activeAudioObj.currentTime = 0;
                                } catch (_) {}
                                activeAudioObj = null;
                            }

                            visualContainer.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
                            visualContainer.style.opacity = '0';
                            visualContainer.style.transform = 'scale(0.97)';

                            setTimeout(() => {
                                renderVisualChallenge(currentVisualData);
                                visualContainer.style.opacity = '1';
                                visualContainer.style.transform = 'scale(1)';
                                isSwitchingChallenge = false;
                            }, 150);
                        };

                        const onSwitchToAudio = async () => {
                            if (isSwitchingChallenge) return;
                            isSwitchingChallenge = true;

                            visualContainer.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
                            visualContainer.style.opacity = '0';
                            visualContainer.style.transform = 'scale(0.97)';

                            setTimeout(async () => {
                                if (currentAudioData && currentAudioData.audio) {
                                    renderAudioUI(currentAudioData, true);
                                    visualContainer.style.opacity = '1';
                                    visualContainer.style.transform = 'scale(1)';
                                    isSwitchingChallenge = false;
                                    return;
                                }

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
                                        currentAudioData = aData;
                                        visualContainer.style.opacity = '0';
                                        visualContainer.style.transform = 'scale(0.97)';
                                        setTimeout(() => {
                                            renderAudioUI(aData, true);
                                            visualContainer.style.opacity = '1';
                                            visualContainer.style.transform = 'scale(1)';
                                            isSwitchingChallenge = false;
                                        }, 120);
                                    } else {
                                        renderAudioError(aData.error || 'Failed to load audio challenge');
                                        isSwitchingChallenge = false;
                                    }
                                } catch (e) {
                                    renderAudioError('Network error loading audio challenge');
                                    isSwitchingChallenge = false;
                                }
                            }, 150);
                        };

                        const renderAudioLoading = () => {
                            visualContainer.innerHTML = '';
                            renderModalHeader("Audio Challenge", "Preparing audio challenge...", null, null);
                            const loadDiv = document.createElement('div');
                            loadDiv.style.cssText = `padding: 40px 20px; text-align: center; color: ${colors.subText}; font-size: 14px; font-family: inherit;`;
                            loadDiv.innerHTML = `<div style="display:inline-block;width:32px;height:32px;border:3px solid #3b82f6;border-top:3px solid transparent;border-radius:50%;animation:${kfSpin} 1s linear infinite;margin-bottom:12px;"></div><div>Synthesizing audio challenge...</div>`;
                            visualContainer.appendChild(loadDiv);
                        };

                        const renderAudioError = (errorMsg) => {
                            visualContainer.innerHTML = '';
                            renderModalHeader("Audio Challenge", "Accessibility verification", currentVisualData ? 'visual' : null, onSwitchToVisual);

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
                            subDiv.innerText = currentVisualData ? "You can retry loading audio or return to visual verification." : "Please try again later or reload the page.";

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
                            btnRow.appendChild(retryBtn);

                            if (currentVisualData) {
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
                                backBtn.onclick = () => { onSwitchToVisual(); };
                                btnRow.appendChild(backBtn);
                            }

                            errBox.appendChild(iconDiv);
                            errBox.appendChild(msgDiv);
                            errBox.appendChild(subDiv);
                            errBox.appendChild(btnRow);
                            visualContainer.appendChild(errBox);
                        };

                        const renderAudioUI = (aData, isSwitchedFromVisual = false) => {
                            visualContainer.innerHTML = '';
                            const canSwitchToVisual = Boolean(currentVisualData) && (aData.audio_only !== true);

                            renderModalHeader(
                                !canSwitchToVisual ? "Audio Verification" : "Audio Challenge",
                                !canSwitchToVisual ? "Security verification: Listen and enter the numbers heard." : "Listen to the numbers and enter them below.",
                                canSwitchToVisual ? 'visual' : null,
                                onSwitchToVisual
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
                                activeAudioObj = audioObj;
                            } catch (e) {
                            }

                            playBtn.onclick = () => {
                                if (!audioObj) return;
                                playBtn.style.transform = 'scale(0.92)';
                                setTimeout(() => { playBtn.style.transform = 'scale(1)'; }, 150);
                                playLabel.innerText = "Playing...";
                                playBtn.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation:${kfPulse} 1s infinite;display:block;flex-shrink:0;"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>`;
                                audioObj.currentTime = 0;
                                audioObj.play().catch(() => {
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
                                aVerifyBtn.innerHTML = `<div style="display:inline-block;width:16px;height:16px;border:2px solid white;border-top:2px solid transparent;border-radius:50%;animation:${kfSpin} 1s linear infinite;vertical-align:middle;margin-right:6px;"></div> Verifying...`;
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
                                        if (activeAudioObj) { try { activeAudioObj.pause(); } catch(_) {} activeAudioObj = null; }
                                        injectToken(visData.token);
                                        closeModal();
                                    } else {
                                        if (activeAudioObj) { try { activeAudioObj.pause(); } catch(_) {} activeAudioObj = null; }
                                        closeModal();
                                        triggerError('Validation failed', false);
                                    }
                                } catch (e) {
                                    if (activeAudioObj) { try { activeAudioObj.pause(); } catch(_) {} activeAudioObj = null; }
                                    closeModal();
                                    triggerError('Validation failed', false);
                                }
                            };

                            aVerifyBtn.onclick = submitAudio;
                            audioInput.onkeydown = (e) => {
                                if (e.key === 'Enter') submitAudio();
                            };

                            visualContainer.appendChild(aVerifyBtn);
                            showModal();
                            setTimeout(() => {
                                audioInput.focus();
                                playBtn.click();
                            }, 250);
                        };

                        const renderVisualChallenge = (vData) => {
                            visualContainer.innerHTML = '';
                            const headerInfo = renderModalHeader(
                                "Security Challenge",
                                "",
                                'audio',
                                onSwitchToAudio
                            );

                            if (vData.visual_type === 'slider') {
                                headerInfo.descEl.innerText = "Drag the slider to fit the puzzle piece.";
                                const bgContainer = document.createElement('div');
                                bgContainer.style.cssText = `position: relative; width: 100%; height: 150px; background-image: url(data:image/png;base64,${vData.bg_image}); background-size: 100% 100%; border-radius: 8px; overflow: hidden; border: 1px solid ${colors.boxBorder}; box-sizing: border-box;`;

                                const pieceImg = document.createElement('img');
                                pieceImg.src = "data:image/png;base64," + vData.piece_image;
                                pieceImg.style.cssText = `position: absolute; top: ${vData.piece_y}px; left: 0px; width: 12.5%; height: 40px; z-index: 2; pointer-events: none; border-radius: 5px;`;
                                bgContainer.appendChild(pieceImg);

                                const sliderTrack = document.createElement('div');
                                sliderTrack.style.cssText = `position: relative; width: 100%; height: 42px; background: ${colors.boxBg}; border: 1px solid ${colors.boxBorder}; border-radius: 21px; margin-top: 16px; box-sizing: border-box; overflow: hidden;`;

                                const sliderFill = document.createElement('div');
                                sliderFill.style.cssText = `position: absolute; top: 0; left: 0; height: 100%; width: 0; background: #3b82f6; opacity: 0.2; border-radius: 21px 0 0 21px;`;
                                sliderTrack.appendChild(sliderFill);

                                const sliderHandle = document.createElement('div');
                                sliderHandle.style.cssText = `position: absolute; top: 0; left: 0; width: 48px; height: 100%; background: #3b82f6; border-radius: 21px; cursor: grab; display: flex; justify-content: center; align-items: center; color: white; transition: background 0.2s; box-shadow: 0 2px 6px rgba(0,0,0,0.25); user-select: none; font-size: 18px; box-sizing: border-box;`;
                                sliderHandle.innerHTML = '&#8594;';
                                sliderTrack.appendChild(sliderHandle);

                                visualContainer.appendChild(bgContainer);
                                visualContainer.appendChild(sliderTrack);
                                showModal();

                                const visualTicket = vData.visual_ticket;
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
                                    e.preventDefault();
                                };

                                const onEnd = async () => {
                                    if (!isDragging) return;
                                    isDragging = false;
                                    document.removeEventListener('mousemove', onMove);
                                    document.removeEventListener('mouseup', onEnd);
                                    document.removeEventListener('touchmove', onMove);
                                    document.removeEventListener('touchend', onEnd);
                                    sliderHandle.style.cursor = 'grab';

                                    sliderHandle.innerHTML = `<div style="width:16px;height:16px;border:2px solid white;border-top:2px solid transparent;border-radius:50%;animation:${kfSpin} 1s linear infinite;"></div>`;
                                    try {
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
                                            if (activeAudioObj) { try { activeAudioObj.pause(); } catch(_) {} activeAudioObj = null; }
                                            injectToken(visData.token);
                                            closeModal();
                                        } else {
                                            if (activeAudioObj) { try { activeAudioObj.pause(); } catch(_) {} activeAudioObj = null; }
                                            closeModal();
                                            triggerError('Validation failed', false);
                                        }
                                    } catch (e) {
                                        if (activeAudioObj) { try { activeAudioObj.pause(); } catch(_) {} activeAudioObj = null; }
                                        closeModal();
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

                            } else if (vData.visual_type === 'rotation') {
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
                                rotImg.src = "data:image/png;base64," + vData.image;
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

                                const btnLeft = createRotateBtn(
                                    `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex-shrink:0;"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`,
                                    -30,
                                    "Rotate left 30 degrees"
                                );

                                const btnRight = createRotateBtn(
                                    `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex-shrink:0;"><path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>`,
                                    30,
                                    "Rotate right 30 degrees"
                                );

                                controlsRow.appendChild(btnLeft);
                                controlsRow.appendChild(btnRight);
                                rotWrapper.appendChild(controlsRow);

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

                                const visualTicket = vData.visual_ticket;

                                verifyBtn.onclick = async () => {
                                    verifyBtn.disabled = true;
                                    verifyBtn.innerHTML = `<div style="display:inline-block;width:16px;height:16px;border:2px solid white;border-top:2px solid transparent;border-radius:50%;animation:${kfSpin} 1s linear infinite;vertical-align:middle;margin-right:6px;"></div> Verifying...`;
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
                                            if (activeAudioObj) { try { activeAudioObj.pause(); } catch(_) {} activeAudioObj = null; }
                                            injectToken(visData.token);
                                            closeModal();
                                        } else {
                                            if (activeAudioObj) { try { activeAudioObj.pause(); } catch(_) {} activeAudioObj = null; }
                                            closeModal();
                                            triggerError('Validation failed', false);
                                        }
                                    } catch (e) {
                                        if (activeAudioObj) { try { activeAudioObj.pause(); } catch(_) {} activeAudioObj = null; }
                                        closeModal();
                                        triggerError('Validation failed', false);
                                    }
                                };

                                rotWrapper.appendChild(verifyBtn);
                                visualContainer.appendChild(rotWrapper);
                                showModal();

                            } else {
                                headerInfo.descEl.innerText = "Type the text from the image below.";
                                const visualImg = document.createElement('img');
                                visualImg.src = "data:image/png;base64," + vData.image;
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
                                showModal();
                                visualInput.focus();

                                const visualTicket = vData.visual_ticket;
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
                                            if (activeAudioObj) { try { activeAudioObj.pause(); } catch(_) {} activeAudioObj = null; }
                                            injectToken(visData.token);
                                            closeModal();
                                        } else {
                                            if (activeAudioObj) { try { activeAudioObj.pause(); } catch(_) {} activeAudioObj = null; }
                                            closeModal();
                                            triggerError('Validation failed', false);
                                        }
                                    } catch (e) {
                                        if (activeAudioObj) { try { activeAudioObj.pause(); } catch(_) {} activeAudioObj = null; }
                                        closeModal();
                                        triggerError('Validation failed', false);
                                    }
                                };
                            }
                        };

                        if (data.visual_type === 'audio') {
                            renderAudioUI(data, false);
                        } else {
                            renderVisualChallenge(data);
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
                    if (isVerified || container.dataset.verified === "true") return;
                    const isFatal = err.fatal === true || !navigator.onLine || err.name === 'TypeError' || (err.message && err.message.toLowerCase().includes('network'));
                    triggerError(err.message || 'Verification error', isFatal);
                }
            };




            if (mode === 'manual') {
                checkboxContainer.addEventListener('click', executeChallenge);
                text.addEventListener('click', executeChallenge);
                if (form) {
                    form.addEventListener('submit', (e) => {
                        if (!isVerified) {
                            e.preventDefault();

                            widget.style.animation = 'none';
                            void widget.offsetWidth;
                            widget.style.animation = `${kfShake} 0.4s ease`;

                            const oldBorder = widget.style.borderColor;
                            widget.style.borderColor = '#ef4444';
                            setTimeout(() => {
                                if (!isVerified) {
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
                        if (!isVerified) {
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
