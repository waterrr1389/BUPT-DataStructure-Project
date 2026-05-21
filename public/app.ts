import { createAppShell } from "./spa/app-shell.js";
import { appCopy } from "./spa/copy.js";

const root = document.querySelector("#app-root") as HTMLElement | null;

if (!root) {
  throw new Error(appCopy.errors.appRootMissing);
}

const app = createAppShell(root);

app.start().catch(() => {
  const message = "单页应用启动失败。";
  root.innerHTML = `
    <main class="boot-failure">
      <div class="boot-failure-card">
        <p class="eyebrow">${appCopy.brand}</p>
        <h1>${appCopy.shell.bootFailureTitle}</h1>
        <p>${message}</p>
        <a href="/" class="inline-link">${appCopy.common.buttons.reloadShell}</a>
      </div>
    </main>
  `;
});
