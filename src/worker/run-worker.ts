type WorkerResponse<T> = { ok: true; data: T } | { ok: false; message: string };

export function runWorker<TInput, TOutput>(
  workerUrl: URL,
  input: TInput,
  transfer: Transferable[] = [],
): Promise<TOutput> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerUrl, { type: "module" });
    worker.onmessage = (e: MessageEvent<WorkerResponse<TOutput>>) => {
      worker.terminate();
      e.data.ok ? resolve(e.data.data) : reject(new Error(e.data.message));
    };
    worker.onerror = (err) => {
      worker.terminate();
      reject(new Error(err.message));
    };
    worker.postMessage(input, transfer);
  });
}
