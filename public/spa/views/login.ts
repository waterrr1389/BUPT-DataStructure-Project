// @ts-nocheck

import { escapeHtml } from "../lib.js";
import type { SpaApp, SpaRoute, ViewCleanup } from "../types.js";

export async function render(
  app: SpaApp,
  route: SpaRoute,
  root: HTMLElement,
): Promise<ViewCleanup> {
  app.setDocumentTitle("登录");

  let mode = "login";

  try {
    await app.loadBootstrap();
  } catch {
    // bootstrap failure is tolerated; destination selector falls back to text input
  }

  const destinationOptions = app.getDestinationOptions();

  function buildMarkup() {
    const isLogin = mode === "login";
    const title = isLogin ? "🔒 用户登录" : "📝 注册账号";
    const subtitle = isLogin
      ? "登录以继续探索您的旅程"
      : "创建新账号，开启个性化旅行体验";
    const submitLabel = isLogin ? "登录" : "注册";

    const homeDestinationField =
      destinationOptions.length > 0
        ? `<label>
            归属地（可选）
            <select id="login-home-destination">
              <option value="">请选择</option>
              ${destinationOptions
                .map(
                  (d) =>
                    `<option value="${escapeHtml(d.id)}">${escapeHtml(d.label || d.name)}</option>`,
                )
                .join("")}
            </select>
          </label>`
        : `<label>
            归属地 ID（可选）
            <input id="login-home-destination" type="text" placeholder="输入目的地 ID" />
          </label>`;

    root.innerHTML = `
      <div class="login-wrap">
        <div class="surface-card login-card">
          <div class="login-header">
            <h1>${title}</h1>
            <p class="muted">${subtitle}</p>
          </div>
          <div class="login-error" id="login-error" hidden></div>
          <div class="login-tab">
            <button type="button" id="login-tab-login" class="${isLogin ? "" : "ghost"}">登录</button>
            <button type="button" id="login-tab-register" class="${isLogin ? "ghost" : ""}">注册</button>
          </div>
          <form class="login-form" id="login-form">
            <label>
              用户名
              <input id="login-username" type="text" required autocomplete="username" />
            </label>
            <label>
              密码
              <input id="login-password" type="password" required autocomplete="${isLogin ? "current-password" : "new-password"}" />
            </label>
            ${
              !isLogin
                ? `
            <label>
              确认密码
              <input id="login-password-confirm" type="password" required autocomplete="new-password" />
            </label>
            <label>
              兴趣标签（可选）
              <input id="login-interests" type="text" placeholder="用逗号分隔，如：徒步,摄影,美食" />
            </label>
            ${homeDestinationField}
            `
                : ""
            }
            <button type="submit" class="login-submit">${submitLabel}</button>
          </form>
        </div>
      </div>
    `;

    const errorBanner = root.querySelector("#login-error");
    const tabLogin = root.querySelector("#login-tab-login");
    const tabRegister = root.querySelector("#login-tab-register");

    tabLogin?.addEventListener("click", () => {
      if (mode !== "login") {
        mode = "login";
        buildMarkup();
      }
    });

    tabRegister?.addEventListener("click", () => {
      if (mode !== "register") {
        mode = "register";
        buildMarkup();
      }
    });

    root.querySelector("#login-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      errorBanner.hidden = true;
      errorBanner.textContent = "";

      const name = root.querySelector("#login-username").value.trim();
      const password = root.querySelector("#login-password").value;

      if (!isLogin) {
        const confirmPassword = root.querySelector("#login-password-confirm").value;
        if (password !== confirmPassword) {
          errorBanner.textContent = "两次输入的密码不一致";
          errorBanner.hidden = false;
          return;
        }
      }

      try {
        if (isLogin) {
          await app.requestJson("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({ name, password }),
          });
        } else {
          const interestsInput = root.querySelector("#login-interests")?.value.trim();
          const interests = interestsInput
            ? interestsInput.split(/,|，/).map((s: string) => s.trim()).filter(Boolean)
            : undefined;
          const homeDestinationId =
            root.querySelector("#login-home-destination")?.value.trim() || undefined;

          const body: Record<string, unknown> = { name, password };
          if (interests?.length) {
            body.interests = interests;
          }
          if (homeDestinationId) {
            body.homeDestinationId = homeDestinationId;
          }

          await app.requestJson("/api/auth/register", {
            method: "POST",
            body: JSON.stringify(body),
          });
        }

        await app.loadBootstrap();
        app.navigate("/", { replace: true });
      } catch (error) {
        errorBanner.textContent = (error as Error).message || "请求失败，请稍后重试";
        errorBanner.hidden = false;
      }
    });
  }

  buildMarkup();

  return null;
}
