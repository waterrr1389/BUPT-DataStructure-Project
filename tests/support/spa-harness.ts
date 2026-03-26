import fs from "node:fs/promises";
import path from "node:path";

type EventListener = (event: TestEvent) => unknown;
type PublicPageScriptType = "classic" | "module";
type PublicPageScriptContract = {
  src: string;
  type: PublicPageScriptType;
};

type EventInit = {
  altKey?: boolean;
  bubbles?: boolean;
  button?: number;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  target?: TestElement;
};

const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

let spaModuleRootPromise: Promise<string> | null = null;
const PUBLIC_INDEX_FILE = "index.html";
const PUBLIC_BOOTSTRAP_GLOBALS = [
  "RouteVisualizationMarkers",
  "JournalPresentation",
  "JournalConsumers",
] as const;
const SPA_MODULE_FILES = [
  "app-shell.js",
  "lib.js",
  "map-rendering.js",
  "world-rendering.js",
  "views/compose.js",
  "views/explore.js",
  "views/feed.js",
  "views/home.js",
  "views/map.js",
  "views/not-found.js",
  "views/post-detail.js",
];
const runtimeImport = new Function("specifier", "return import(specifier);") as (
  specifier: string,
) => Promise<unknown>;
const vm = require("vm") as {
  runInNewContext(
    source: string,
    context: Record<string, unknown>,
    options?: { filename?: string },
  ): unknown;
  runInThisContext(source: string, options?: { filename?: string }): unknown;
};
function createImportSpecifier(absolutePath: string): string {
  const normalizedPath = path.resolve(absolutePath).replace(/\\/g, "/");
  return `file://${normalizedPath}?t=${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createClassicScriptFilename(relativePath: string): string {
  return path.join(process.cwd(), "public", relativePath);
}

function createClassicScriptContext(): Record<string, unknown> {
  return {
    globalThis,
  };
}

function ensureRouteVisualizationMarkers(): void {
  const runtimeGlobals = globalThis as typeof globalThis & {
    RouteVisualizationMarkers?: unknown;
  };
  if (!runtimeGlobals.RouteVisualizationMarkers) {
    runtimeGlobals.RouteVisualizationMarkers = require(
      path.join(process.cwd(), "public", "route-visualization-markers.js"),
    );
  }
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeAttributeName(name: string): string {
  return name.toLowerCase();
}

function parseAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s/>]+)))?/g;

  for (const match of source.matchAll(pattern)) {
    const [, rawName, doubleQuoted, singleQuoted, bareValue] = match;
    const name = normalizeAttributeName(rawName);
    attributes[name] = doubleQuoted ?? singleQuoted ?? bareValue ?? "";
  }

  return attributes;
}

function normalizePublicAssetPath(source: string): string {
  const pathname = new URL(source, "http://localhost").pathname;
  return pathname.replace(/^\/+/, "");
}

function extractBodyMarkup(html: string): string {
  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) {
    throw new Error("Public index.html is missing a body element.");
  }
  return bodyMatch[1] ?? "";
}

function clearPublicBootstrapGlobals(): void {
  const runtimeGlobals = globalThis as typeof globalThis & Record<string, unknown>;
  PUBLIC_BOOTSTRAP_GLOBALS.forEach((name) => {
    runtimeGlobals[name] = undefined;
  });
}

export function parsePublicPageScriptContract(html: string): PublicPageScriptContract[] {
  const scripts: PublicPageScriptContract[] = [];
  const scriptPattern = /<script\b([^>]*)><\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptPattern.exec(html)) !== null) {
    const attributes = parseAttributes(match[1] ?? "");
    const src = attributes.src;
    if (!src) {
      continue;
    }

    scripts.push({
      src,
      type: normalizeAttributeName(attributes.type ?? "") === "module" ? "module" : "classic",
    });
  }

  return scripts;
}

async function readPublicPageScriptContract(): Promise<PublicPageScriptContract[]> {
  const html = await fs.readFile(path.join(process.cwd(), "public", PUBLIC_INDEX_FILE), "utf8");
  return parsePublicPageScriptContract(html);
}

async function listPublicRootFiles(): Promise<string[]> {
  const rootFiles = new Set<string>([PUBLIC_INDEX_FILE]);
  const scripts = await readPublicPageScriptContract();

  scripts.forEach(({ src }) => {
    const relativePath = normalizePublicAssetPath(src);
    if (relativePath && !relativePath.startsWith("spa/")) {
      rootFiles.add(relativePath);
    }
  });

  return [...rootFiles];
}

function splitSelector(selector: string): string[] {
  return selector
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function matchesSimpleSelector(element: TestElement, selector: string): boolean {
  if (!selector) {
    return false;
  }

  if (selector.startsWith("#")) {
    return element.id === selector.slice(1);
  }

  if (selector.startsWith(".")) {
    return element.classList.contains(selector.slice(1));
  }

  const attributeMatch = selector.match(
    /^([a-z0-9-]+)?\[([a-z0-9:-]+)(?:=['"]?([^'"\]]+)['"]?)?\]$/i,
  );
  if (attributeMatch) {
    const [, tagName, rawAttribute, expectedValue] = attributeMatch;
    const attribute = normalizeAttributeName(rawAttribute);
    if (tagName && element.tagName !== tagName.toLowerCase()) {
      return false;
    }
    if (!element.hasAttribute(attribute)) {
      return false;
    }
    return expectedValue == null || element.getAttribute(attribute) === expectedValue;
  }

  return element.tagName === selector.toLowerCase();
}

function matchesSelectorChain(element: TestElement, selectors: string[]): boolean {
  let current: TestElement | null = element;

  for (let index = selectors.length - 1; index >= 0; index -= 1) {
    const selector = selectors[index];
    if (!current) {
      return false;
    }

    if (index === selectors.length - 1) {
      if (!matchesSimpleSelector(current, selector)) {
        return false;
      }
      current = current.parent;
      continue;
    }

    while (current && !matchesSimpleSelector(current, selector)) {
      current = current.parent;
    }
    if (!current) {
      return false;
    }
    current = current.parent;
  }

  return true;
}

function collectMatches(root: TestElement, selector: string): TestElement[] {
  const selectors = splitSelector(selector);
  const matches: TestElement[] = [];

  function visit(node: TestElement): void {
    node.children.forEach((child) => {
      if (matchesSelectorChain(child, selectors)) {
        matches.push(child);
      }
      visit(child);
    });
  }

  visit(root);
  return matches;
}

function toDatasetKey(attributeName: string): string {
  return attributeName
    .slice("data-".length)
    .split("-")
    .map((part, index) => (index === 0 ? part : `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`))
    .join("");
}

function parseHtmlFragment(ownerDocument: TestDocument, html: string, parent: TestElement): TestElement[] {
  const root = new TestElement(ownerDocument, "fragment");
  const stack: TestElement[] = [root];
  const tagPattern = /<\/?([a-z0-9-]+)([^>]*)>/gi;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(html)) !== null) {
    const [rawTag, rawTagName, rawAttributes] = match;
    const tagName = rawTagName.toLowerCase();

    if (rawTag.startsWith("</")) {
      while (stack.length > 1) {
        const current = stack.pop();
        if (current?.tagName === tagName) {
          break;
        }
      }
      continue;
    }

    const attributes = parseAttributes(rawAttributes);
    const element = new TestElement(ownerDocument, tagName, attributes);
    stack[stack.length - 1].appendChild(element);
    if (!VOID_TAGS.has(tagName) && !rawTag.endsWith("/>")) {
      stack.push(element);
    }
  }

  root.children.forEach((child) => {
    child.parent = parent;
  });
  return root.children;
}

export class TestEvent {
  altKey: boolean;
  bubbles: boolean;
  button: number;
  ctrlKey: boolean;
  currentTarget: TestElement | null;
  defaultPrevented: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  target: TestElement;
  type: string;

  constructor(type: string, target: TestElement, init: EventInit = {}) {
    this.altKey = init.altKey ?? false;
    this.bubbles = init.bubbles ?? true;
    this.button = init.button ?? 0;
    this.ctrlKey = init.ctrlKey ?? false;
    this.currentTarget = null;
    this.defaultPrevented = false;
    this.metaKey = init.metaKey ?? false;
    this.shiftKey = init.shiftKey ?? false;
    this.target = init.target ?? target;
    this.type = type;
  }

  preventDefault(): void {
    this.defaultPrevented = true;
  }
}

class TestClassList {
  element: TestElement;

  constructor(element: TestElement) {
    this.element = element;
  }

  add(...tokens: string[]): void {
    const next = new Set(this.values());
    tokens.filter(Boolean).forEach((token) => next.add(token));
    this.element.setAttribute("class", [...next].join(" "));
  }

  contains(token: string): boolean {
    return this.values().includes(token);
  }

  remove(...tokens: string[]): void {
    const removeSet = new Set(tokens);
    const next = this.values().filter((token) => !removeSet.has(token));
    if (next.length) {
      this.element.setAttribute("class", next.join(" "));
      return;
    }
    this.element.removeAttribute("class");
  }

  toggle(token: string, force?: boolean): boolean {
    const hasToken = this.contains(token);
    const shouldHaveToken = force ?? !hasToken;
    if (shouldHaveToken) {
      this.add(token);
    } else {
      this.remove(token);
    }
    return shouldHaveToken;
  }

  private values(): string[] {
    return (this.element.getAttribute("class") ?? "")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean);
  }
}

export class TestElement {
  attributes: Map<string, string>;
  children: TestElement[];
  classList: TestClassList;
  dataset: Record<string, string>;
  disabled: boolean;
  listeners: Map<string, EventListener[]>;
  ownerDocument: TestDocument;
  parent: TestElement | null;
  tagName: string;

  private htmlContent: string;
  private textContentValue: string;
  private valueState: string;

  constructor(ownerDocument: TestDocument, tagName: string, attributes: Record<string, string> = {}) {
    this.attributes = new Map();
    this.children = [];
    this.classList = new TestClassList(this);
    this.dataset = {};
    this.disabled = false;
    this.htmlContent = "";
    this.listeners = new Map();
    this.ownerDocument = ownerDocument;
    this.parent = null;
    this.tagName = tagName.toLowerCase();
    this.textContentValue = "";
    this.valueState = "";

    Object.entries(attributes).forEach(([name, value]) => {
      this.setAttribute(name, value);
    });

    if (this.tagName === "input" || this.tagName === "textarea" || this.tagName === "select") {
      this.valueState = this.getAttribute("value") ?? "";
    }
  }

  get id(): string {
    return this.getAttribute("id") ?? "";
  }

  get innerHTML(): string {
    return this.htmlContent;
  }

  set innerHTML(value: string) {
    this.htmlContent = value;
    this.textContentValue = "";
    this.children = parseHtmlFragment(this.ownerDocument, value, this);
    if (this.tagName === "select") {
      this.syncSelectValue();
    }
  }

  get textContent(): string {
    return this.textContentValue;
  }

  set textContent(value: string) {
    this.textContentValue = String(value);
    this.htmlContent = escapeText(this.textContentValue);
    this.children = [];
  }

  get value(): string {
    if (this.tagName === "select" && !this.valueState) {
      this.syncSelectValue();
    }
    return this.valueState;
  }

  set value(nextValue: string) {
    this.valueState = String(nextValue);
  }

  addEventListener(type: string, listener: EventListener): void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  appendChild(child: TestElement): TestElement {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  closest(selector: string): TestElement | null {
    let current: TestElement | null = this;
    while (current) {
      if (matchesSimpleSelector(current, selector)) {
        return current;
      }
      current = current.parent;
    }
    return null;
  }

  dispatchEvent(event: TestEvent): boolean {
    let current: TestElement | null = this;
    while (current) {
      event.currentTarget = current;
      const listeners = current.listeners.get(event.type) ?? [];
      listeners.forEach((listener) => {
        listener(event);
      });
      if (!event.bubbles) {
        break;
      }
      current = current.parent;
    }
    return !event.defaultPrevented;
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(normalizeAttributeName(name)) ?? null;
  }

  hasAttribute(name: string): boolean {
    return this.attributes.has(normalizeAttributeName(name));
  }

  querySelector(selector: string): TestElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector: string): TestElement[] {
    return collectMatches(this, selector);
  }

  removeAttribute(name: string): void {
    const normalized = normalizeAttributeName(name);
    this.attributes.delete(normalized);
    if (normalized === "disabled") {
      this.disabled = false;
    }
    if (normalized.startsWith("data-")) {
      delete this.dataset[toDatasetKey(normalized)];
    }
  }

  setAttribute(name: string, value: string): void {
    const normalized = normalizeAttributeName(name);
    this.attributes.set(normalized, String(value));
    if (normalized === "disabled") {
      this.disabled = true;
    }
    if (
      normalized === "value" &&
      (this.tagName === "input" || this.tagName === "textarea" || this.tagName === "select")
    ) {
      this.valueState = String(value);
    }
    if (normalized.startsWith("data-")) {
      this.dataset[toDatasetKey(normalized)] = String(value);
    }
  }

  private syncSelectValue(): void {
    if (this.tagName !== "select") {
      return;
    }
    const options = this.children.filter((child) => child.tagName === "option");
    const selected = options.find((option) => option.hasAttribute("selected"));
    this.valueState = selected?.getAttribute("value") ?? options[0]?.getAttribute("value") ?? "";
  }
}

export class TestDocument {
  body: TestElement;
  title: string;

  constructor() {
    this.body = new TestElement(this, "body");
    this.title = "";
  }

  createElement(tagName: string): TestElement {
    return new TestElement(this, tagName);
  }

  querySelector(selector: string): TestElement | null {
    return this.body.querySelector(selector);
  }

  querySelectorAll(selector: string): TestElement[] {
    return this.body.querySelectorAll(selector);
  }
}

async function ensureSpaModuleRoot(): Promise<string> {
  if (!spaModuleRootPromise) {
    spaModuleRootPromise = (async () => {
      const tempRoot = path.join(
        "/tmp",
        `ds-ts-spa-tests-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      );
      const moduleRoot = path.join(tempRoot, "browser");
      await fs.mkdir(moduleRoot, { recursive: true });
      await fs.writeFile(path.join(moduleRoot, "package.json"), JSON.stringify({ type: "module" }));
      const publicRootFiles = await listPublicRootFiles();

      await Promise.all(
        publicRootFiles.map(async (relativePath) => {
          const sourcePath = path.join(process.cwd(), "public", relativePath);
          const targetPath = path.join(moduleRoot, relativePath);
          await fs.mkdir(path.dirname(targetPath), { recursive: true });
          await fs.writeFile(targetPath, await fs.readFile(sourcePath, "utf8"), "utf8");
        }),
      );

      await Promise.all(
        SPA_MODULE_FILES.map(async (relativePath) => {
          const sourcePath = path.join(process.cwd(), "public", "spa", relativePath);
          const targetPath = path.join(moduleRoot, "spa", relativePath);
          await fs.mkdir(path.dirname(targetPath), { recursive: true });
          await fs.writeFile(targetPath, await fs.readFile(sourcePath, "utf8"), "utf8");
        }),
      );

      return moduleRoot;
    })();
  }

  return spaModuleRootPromise;
}

export async function importSpaModule<TModule>(relativePath: string): Promise<TModule> {
  ensureRouteVisualizationMarkers();
  const moduleRoot = await ensureSpaModuleRoot();
  const absolutePath = path.join(moduleRoot, "spa", relativePath);
  return runtimeImport(createImportSpecifier(absolutePath)) as Promise<TModule>;
}

export async function importPublicModule<TModule>(relativePath: string): Promise<TModule> {
  ensureRouteVisualizationMarkers();
  const moduleRoot = await ensureSpaModuleRoot();
  const absolutePath = path.join(moduleRoot, relativePath);
  return runtimeImport(createImportSpecifier(absolutePath)) as Promise<TModule>;
}

export async function loadPublicPageFromIndexHtml(): Promise<PublicPageScriptContract[]> {
  const html = await fs.readFile(path.join(process.cwd(), "public", PUBLIC_INDEX_FILE), "utf8");
  const scripts = parsePublicPageScriptContract(html);
  const moduleRoot = await ensureSpaModuleRoot();

  clearPublicBootstrapGlobals();
  globalThis.document.body.innerHTML = extractBodyMarkup(html);

  for (const script of scripts) {
    const relativePath = normalizePublicAssetPath(script.src);

    if (script.type === "classic") {
      const classicSource = await fs.readFile(createClassicScriptFilename(relativePath), "utf8");
      vm.runInNewContext(classicSource, createClassicScriptContext(), {
        filename: createClassicScriptFilename(relativePath),
      });
      continue;
    }

    const absolutePath = path.join(moduleRoot, relativePath);
    await runtimeImport(createImportSpecifier(absolutePath));
  }

  return scripts;
}

export function createSpaDomEnvironment() {
  const document = new TestDocument();
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  const historyEntries: string[] = [];
  const location = {
    href: "http://localhost/",
    origin: "http://localhost",
    pathname: "/",
    search: "",
  };

  function syncLocation(url: string): void {
    const next = new URL(url, location.origin);
    location.href = next.href;
    location.pathname = next.pathname;
    location.search = next.search;
  }

  const windowObject = {
    addEventListener(type: string, listener: (...args: unknown[]) => void) {
      const list = listeners.get(type) ?? [];
      list.push(listener);
      listeners.set(type, list);
    },
    clearTimeout,
    history: {
      pushState(_state: unknown, _title: string, url: string) {
        syncLocation(url);
        historyEntries.push(`${location.pathname}${location.search}`);
      },
      replaceState(_state: unknown, _title: string, url: string) {
        syncLocation(url);
        historyEntries.push(`${location.pathname}${location.search}`);
      },
    },
    location,
    removeEventListener(type: string, listener: (...args: unknown[]) => void) {
      const list = listeners.get(type) ?? [];
      listeners.set(
        type,
        list.filter((entry) => entry !== listener),
      );
    },
    scrollTo() {},
    scrollY: 0,
    setTimeout,
  };

  return {
    createRoot(): TestElement {
      const root = document.createElement("div");
      document.body.appendChild(root);
      return root;
    },
    document,
    historyEntries,
    install(): () => void {
      const previousDocument = globalThis.document;
      const previousWindow = globalThis.window;
      globalThis.document = document as unknown as Document;
      globalThis.window = windowObject as unknown as Window & typeof globalThis;
      return () => {
        globalThis.document = previousDocument;
        globalThis.window = previousWindow;
      };
    },
    window: windowObject,
  };
}

export function createJsonResponse(status: number, payload: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    },
  };
}

export function dispatchDomEvent(target: TestElement, type: string, init: EventInit = {}): TestEvent {
  const event = new TestEvent(type, target, init);
  target.dispatchEvent(event);
  return event;
}

export async function settleAsync(rounds = 4): Promise<void> {
  for (let index = 0; index < rounds; index += 1) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
  }
}

export function requireElement(root: TestElement, selector: string): TestElement {
  const element = root.querySelector(selector);
  if (!element) {
    throw new Error(`Expected element for selector: ${selector}`);
  }
  return element;
}
