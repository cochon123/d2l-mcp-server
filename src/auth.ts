import { chromium, BrowserContext } from 'playwright';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';

const SESSION_PATH = join(homedir(), '.d2l-session');
const D2L_HOST = process.env.D2L_HOST || 'learn.ul.ie';
const HOME_URL = `https://${D2L_HOST}/d2l/home`;
const CHROMIUM_EXECUTABLE_PATH = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

const browserOptions = {
  executablePath: CHROMIUM_EXECUTABLE_PATH,
  viewport: { width: 1280, height: 720 },
};

interface TokenCache {
  token: string;
  expiresAt: number;
}

let tokenCache: TokenCache = { token: '', expiresAt: 0 };

function isLoginPage(url: string): boolean {
  return url.includes('login') || url.includes('microsoftonline') || url.includes('sso') || url.includes('adfs');
}

export async function getToken(): Promise<string> {
  // Return cached token if still valid (with 5 min buffer)
  if (tokenCache.token && Date.now() < tokenCache.expiresAt - 300000) {
    return tokenCache.token;
  }

  const hasExistingSession = existsSync(SESSION_PATH);

  // Always try headless first if session exists - only show browser if login needed
  let context = await chromium.launchPersistentContext(SESSION_PATH, {
    ...browserOptions,
    headless: hasExistingSession,
  });

  try {
    const result = await captureToken(context, hasExistingSession);
    
    // If we need to login and were running headless, restart with headed browser
    if (result.needsLogin && hasExistingSession) {
      await context.close();
      console.error('Session expired, opening browser for login...');
      context = await chromium.launchPersistentContext(SESSION_PATH, {
        ...browserOptions,
        headless: false,
      });
      const retryResult = await captureToken(context, false);
      tokenCache = {
        token: retryResult.token,
        expiresAt: Date.now() + 3600000,
      };
      return retryResult.token;
    }

    tokenCache = {
      token: result.token,
      expiresAt: Date.now() + 3600000, // 1 hour
    };
    return result.token;
  } finally {
    await context.close();
  }
}

async function captureToken(context: BrowserContext, quickCheck: boolean): Promise<{ token: string; needsLogin: boolean }> {
  const page = await context.newPage();
  let capturedToken = '';

  // Listen for requests to capture Authorization header from any D2L API call
  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('/d2l/api/')) {
      const auth = request.headers()['authorization'];
      if (auth?.startsWith('Bearer ')) {
        capturedToken = auth.slice(7);
      }
    }
  });

  // Go to home page
  await page.goto(HOME_URL, { waitUntil: 'networkidle' });

  // Check if we're on login page
  let currentUrl = page.url();
  if (isLoginPage(currentUrl)) {
    // Try to click the SSO login button automatically
    // The saved browser session should handle Microsoft SSO without user interaction
    try {
      const ssoButton = page.locator('button.d2l-button-sso-1, button:has-text("Student & Staff Login")');
      if (await ssoButton.isVisible({ timeout: 2000 })) {
        await ssoButton.click();
        // Wait for SSO redirect and completion
        await page.waitForURL(url => !isLoginPage(url.toString()), { timeout: quickCheck ? 15000 : 60000 });
        await page.waitForLoadState('networkidle');
      }
    } catch {
      // SSO auto-login failed (needs user interaction)
      if (quickCheck) {
        await page.close();
        return { token: '', needsLogin: true };
      }
    }
  }

  // Wait for token capture
  const maxWait = quickCheck ? 10000 : 600000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    currentUrl = page.url();

    if (!isLoginPage(currentUrl)) {
      // We're logged in, wait for API calls
      if (!capturedToken) {
        await page.waitForTimeout(2000);
        // Try scrolling to trigger more API calls
        await page.evaluate(() => window.scrollBy(0, 100));
        await page.waitForTimeout(1000);
      }

      if (capturedToken) {
        break;
      }

      // Some Brightspace installations authenticate API requests with the
      // browser session cookie rather than an Authorization bearer token.
      const whoAmI = await context.request.get(
        `${HOME_URL.replace('/d2l/home', '')}/d2l/api/lp/1.43/users/whoami`
      );
      if (whoAmI.ok()) {
        capturedToken = 'cookie-session';
        break;
      }
    } else if (!quickCheck) {
      // Wait for user to login
      await page.waitForTimeout(2000);
    } else {
      break;
    }
  }

  await page.close();

  if (!capturedToken) {
    if (quickCheck) {
      return { token: '', needsLogin: true };
    }
    throw new Error('Failed to capture authentication token. Please try again.');
  }

  return { token: capturedToken, needsLogin: false };
}

export async function refreshTokenIfNeeded(): Promise<string> {
  return getToken();
}

export function clearTokenCache(): void {
  tokenCache = { token: '', expiresAt: 0 };
}

export function getTokenExpiry(): number {
  return tokenCache.expiresAt;
}

export async function getAuthenticatedContext(): Promise<BrowserContext> {
  const hasExistingSession = existsSync(SESSION_PATH);

  let context = await chromium.launchPersistentContext(SESSION_PATH, {
    ...browserOptions,
    headless: hasExistingSession,
  });

  const page = await context.newPage();
  
  // Go to home to check auth status
  await page.goto(HOME_URL, { waitUntil: 'domcontentloaded' });
  
  let currentUrl = page.url();
  if (isLoginPage(currentUrl)) {
    // Try SSO auto-login
    try {
      const ssoButton = page.locator('button.d2l-button-sso-1, button:has-text("Student & Staff Login")');
      if (await ssoButton.isVisible({ timeout: 2000 })) {
        await ssoButton.click();
        await page.waitForURL(url => !isLoginPage(url.toString()), { timeout: hasExistingSession ? 15000 : 60000 });
        await page.waitForLoadState('domcontentloaded');
      }
    } catch {
      // If headless failed to auto-login, restart with visible browser
      if (hasExistingSession) {
        await context.close();
        console.error('Session expired, opening browser for login...');
        context = await chromium.launchPersistentContext(SESSION_PATH, {
          ...browserOptions,
          headless: false,
        });
        const newPage = await context.newPage();
        await newPage.goto(HOME_URL, { waitUntil: 'domcontentloaded' });
        
        // Wait for user to complete login
        await newPage.waitForURL(url => !isLoginPage(url.toString()), { timeout: 120000 });
        await newPage.close();
      }
    }
  }
  
  await page.close();
  return context;
}
