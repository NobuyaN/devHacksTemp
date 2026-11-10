/* Firebase Auth REST client; no remotely loaded extension code or stored passwords. */
(() => {
  const config = globalThis.SOURCELENS_CONFIG || {};
  const key = "sourcelensAuthSession";
  let refreshPromise = null;
  const store = globalThis.chrome?.storage?.session;
  const read = async () => store ? (await store.get(key))[key] || null : JSON.parse(sessionStorage.getItem(key) || "null");
  const write = async value => {
    if (store) { if (value) await store.set({ [key]: value }); else await store.remove(key); }
    else if (value) sessionStorage.setItem(key, JSON.stringify(value)); else sessionStorage.removeItem(key);
  };
  const messages = {
    EMAIL_EXISTS: "That email already has an account. Sign in instead.",
    INVALID_LOGIN_CREDENTIALS: "Email or password is incorrect.",
    INVALID_PASSWORD: "Email or password is incorrect.",
    EMAIL_NOT_FOUND: "Email or password is incorrect.",
    INVALID_EMAIL: "Enter a valid email address.",
    WEAK_PASSWORD: "Choose a stronger password with at least eight characters.",
    OPERATION_NOT_ALLOWED: "Account sign-in is not enabled on this service yet.",
    CREDENTIAL_TOO_OLD_LOGIN_AGAIN: "Sign out and sign in again before deleting your account.",
    TOO_MANY_ATTEMPTS_TRY_LATER: "Too many sign-in attempts. Try again later."
  };
  async function call(action, payload, refresh = false) {
    if (!config.firebaseApiKey) throw new Error("Account sign-in has not been configured.");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(refresh
        ? `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(config.firebaseApiKey)}`
        : `https://identitytoolkit.googleapis.com/v1/accounts:${action}?key=${encodeURIComponent(config.firebaseApiKey)}`, {
        method: "POST", credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer",
        headers: { "Content-Type": refresh ? "application/x-www-form-urlencoded" : "application/json" },
        body: refresh ? new URLSearchParams(payload).toString() : JSON.stringify(payload), signal: controller.signal
      });
      const data = await response.json();
      if (!response.ok) {
        const code = String(data.error?.message || "").split(" : ")[0];
        throw new Error(messages[code] || "Sign-in could not complete. Check your details or try again later.");
      }
      return data;
    } finally { clearTimeout(timer); }
  }
  async function save(data, email, verified = false) {
    const state = { idToken: data.idToken || data.id_token, refreshToken: data.refreshToken || data.refresh_token,
      expiresAt: Date.now() + Number(data.expiresIn || data.expires_in || 3600) * 1000,
      email, emailVerified: verified };
    if (!state.idToken || !state.refreshToken || !Number.isFinite(state.expiresAt)) throw new Error("Invalid sign-in response.");
    await write(state); return state;
  }
  async function token(force = false) {
    const state = await read();
    if (!state) return null;
    if (!force && state.expiresAt > Date.now() + 60000) return state.idToken;
    if (!refreshPromise) refreshPromise = (async () => {
      try { return (await save(await call("", { grant_type: "refresh_token", refresh_token: state.refreshToken }, true), state.email, state.emailVerified)).idToken; }
      catch (error) { await write(null); throw error; }
      finally { refreshPromise = null; }
    })();
    return refreshPromise;
  }
  async function status() {
    const state = await read();
    return { configured: Boolean(config.authRequired && config.firebaseApiKey), signedIn: Boolean(state),
      email: state?.email || "", emailVerified: state?.emailVerified === true };
  }
  async function verifyStatus() {
    const idToken = await token(true);
    if (!idToken) return status();
    const data = await call("lookup", { idToken });
    const state = await read();
    if (state) await write({ ...state, emailVerified: data.users?.[0]?.emailVerified === true });
    return status();
  }
  async function signIn(email, password) {
    const data = await call("signInWithPassword", { email, password, returnSecureToken: true });
    await save(data, email);
    return verifyStatus();
  }
  async function sendVerification() {
    const idToken = await token();
    if (!idToken) throw new Error("Sign in first.");
    await call("sendOobCode", { requestType: "VERIFY_EMAIL", idToken });
    return { sent: true };
  }
  async function signUp(email, password) {
    if (password.length < 8) throw new Error("Choose a password with at least eight characters.");
    await save(await call("signUp", { email, password, returnSecureToken: true }), email);
    try { await sendVerification(); return { ...(await status()), verificationSent: true }; }
    catch (_) { return { ...(await status()), verificationSent: false }; }
  }
  async function resetPassword(email) {
    await call("sendOobCode", { requestType: "PASSWORD_RESET", email });
    return { sent: true };
  }
  async function deleteAccount() {
    const idToken = await token();
    if (!idToken) throw new Error("Sign in first.");
    await call("delete", { idToken });
    await write(null);
    return status();
  }
  globalThis.SourceLensAuth = { token, status, signIn, signUp, sendVerification, resetPassword, deleteAccount, refresh: verifyStatus, signOut: () => write(null) };
})();
