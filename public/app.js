import { createAppShell } from "./spa/app-shell.js";

const root = document.querySelector("#app-root");

if (!root) {
  throw new Error("App root not found.");
}

const app = createAppShell(root);

app.start().catch((error) => {
  const message = error instanceof Error ? error.message : "SPA bootstrap failed.";
  root.innerHTML = `
    <main class="boot-failure">
      <div class="boot-failure-card">
        <p class="eyebrow">Trail Atlas</p>
        <h1>Browser shell unavailable</h1>
        <p>${message}</p>
        <a href="/" class="inline-link">Reload the shell</a>
      </div>
    </main>
  `;
});
