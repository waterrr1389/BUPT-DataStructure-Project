declare class Buffer extends Uint8Array {
  static from(data: string | Uint8Array | readonly number[]): Buffer;
  static concat(list: readonly Uint8Array[]): Buffer;
  static isBuffer(value: unknown): value is Buffer;
  toString(encoding?: string): string;
}

declare namespace NodeJS {
  interface ErrnoException extends Error {
    code?: string;
    errno?: number;
    path?: string;
    syscall?: string;
  }

  interface Timeout {
    ref(): Timeout;
    unref(): Timeout;
  }

  interface Process {
    env: Record<string, string | undefined>;
    cwd(): string;
    exitCode?: number;
    stdout: {
      write(chunk: string | Uint8Array): boolean;
    };
  }
}

interface NodeModule {
  exports: unknown;
}

interface NodeRequire {
  (id: string): unknown;
  main?: NodeModule;
}

declare const __dirname: string;
declare const module: NodeModule;
declare const process: NodeJS.Process;
declare const require: NodeRequire;

declare module "node:fs/promises" {
  export function readFile(filePath: string): Promise<Buffer>;
  export function readFile(filePath: string, encoding: "utf8"): Promise<string>;
  export function mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  export function writeFile(path: string, data: string | Uint8Array, encoding?: "utf8"): Promise<void>;

  const fs: {
    mkdir: typeof mkdir;
    readFile: typeof readFile;
    writeFile: typeof writeFile;
  };

  export default fs;
}

declare module "node:http" {
  export interface IncomingMessage extends AsyncIterable<Buffer | string> {
    method?: string;
    url?: string;
  }

  export interface ServerResponse {
    end(data?: string | Uint8Array): void;
    writeHead(statusCode: number, headers?: Record<string, string>): this;
  }

  export interface Server {
    listen(port: number, host: string, listeningListener?: () => void): this;
  }

  export type RequestListener = (request: IncomingMessage, response: ServerResponse) => void | Promise<void>;

  export function createServer(listener?: RequestListener): Server;

  const http: {
    createServer: typeof createServer;
  };

  export default http;
}

declare module "node:path" {
  export function dirname(path: string): string;
  export function extname(path: string): string;
  export function join(...paths: string[]): string;
  export function normalize(path: string): string;
  export function resolve(...paths: string[]): string;

  const path: {
    dirname: typeof dirname;
    extname: typeof extname;
    join: typeof join;
    normalize: typeof normalize;
    resolve: typeof resolve;
  };

  export default path;
}
