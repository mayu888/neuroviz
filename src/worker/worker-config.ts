let _baseUrl: URL | null = null;

/**
 * 设置 Worker 文件的 base URL。
 * 当 Worker 文件不在默认位置（与主 bundle 同目录）时，需要调用此方法。
 *
 * @example
 * setWorkerBaseUrl('/static/workers/');
 * setWorkerBaseUrl(new URL('/workers/', window.location.href));
 */
export function setWorkerBaseUrl(url: string | URL): void {
  _baseUrl = typeof url === "string" ? new URL(url, window.location.href) : url;
}

/** @internal */
export function getWorkerUrl(filename: string): URL {
  if (_baseUrl) return new URL(filename, _baseUrl);
  return new URL(`./${filename}`, import.meta.url);
}
