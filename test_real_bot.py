"""
Argus-Latch Real Bot Detection Test
Tests:
  1. Standard Headless Chrome Bot (Selenium automation)
  2. Stealth Evasion Bot (CDP script attempting to fake navigator.webdriver)
"""
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

BASE_URL = "http://127.0.0.1:4757/"

def test_headless_bot():
    print("=" * 65)
    print("[TEST 1] Standard Headless Chrome Bot (Selenium)")
    print("=" * 65)
    opts = Options()
    opts.add_argument('--headless=new')
    opts.set_capability('goog:loggingPrefs', {'browser': 'ALL'})
    driver = webdriver.Chrome(options=opts)
    try:
        driver.get(BASE_URL)
        time.sleep(1)
        driver.find_element(By.ID, 'init-btn').click()
        time.sleep(1)
        
        # Click the checkbox
        driver.find_element(By.CSS_SELECTOR, '.argus-captcha-widget-box > div').click()
        
        # Wait up to 6 seconds for verification to settle
        for _ in range(12):
            time.sleep(0.5)
            text = driver.find_element(By.CSS_SELECTOR, '.argus-captcha-widget-box').text
            if "Verifying" not in text:
                break

        # Inspect browser logs
        logs = driver.get_log('browser')
        failed = any("403" in l['message'] or "Validation [FAIL]" in l['message'] for l in logs)
        widget_text = driver.find_element(By.CSS_SELECTOR, '.argus-captcha-widget-box').text.replace('\n', ' | ')

        print(f"  Widget Display: {widget_text}")
        if failed or "blocked" in widget_text.lower():
            print("  --> [SUCCESS] Headless Bot was detected and blocked with 403!")
        else:
            print("  --> [UNEXPECTED] Bot was not blocked.")
    finally:
        driver.quit()

def test_stealth_bot():
    print("\n" + "=" * 65)
    print("[TEST 2] Stealth Bot (Simulating puppeteer-extra-stealth)")
    print("=" * 65)
    opts = Options()
    opts.add_argument('--headless=new')
    opts.add_argument('--disable-blink-features=AutomationControlled')
    opts.set_capability('goog:loggingPrefs', {'browser': 'ALL'})
    driver = webdriver.Chrome(options=opts)
    try:
        # Inject stealth override on navigator.webdriver
        driver.execute_cdp_cmd(
            "Page.addScriptToEvaluateOnNewDocument",
            {
                "source": """
                    Object.defineProperty(navigator, 'webdriver', {
                        get: () => undefined
                    });
                """
            }
        )
        driver.get(BASE_URL)
        time.sleep(1)
        driver.find_element(By.ID, 'init-btn').click()
        time.sleep(1)

        # Click the checkbox
        driver.find_element(By.CSS_SELECTOR, '.argus-captcha-widget-box > div').click()
        
        # Wait up to 6 seconds for verification to settle
        for _ in range(12):
            time.sleep(0.5)
            text = driver.find_element(By.CSS_SELECTOR, '.argus-captcha-widget-box').text
            if "Verifying" not in text:
                break

        logs = driver.get_log('browser')
        failed = any("403" in l['message'] or "Validation [FAIL]" in l['message'] for l in logs)
        widget_text = driver.find_element(By.CSS_SELECTOR, '.argus-captcha-widget-box').text.replace('\n', ' | ')

        print(f"  Widget Display: {widget_text}")
        if failed or "blocked" in widget_text.lower():
            print("  --> [SUCCESS] Stealth Evasion was caught via prototype tampering & blocked!")
        else:
            print("  --> [UNEXPECTED] Stealth bot was not blocked.")
    finally:
        driver.quit()

if __name__ == '__main__':
    test_headless_bot()
    test_stealth_bot()
