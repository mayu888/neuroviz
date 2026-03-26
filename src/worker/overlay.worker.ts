/// <reference lib="webworker" />

type OverlayInput = { text: string };

self.addEventListener("message", (e: MessageEvent<OverlayInput>) => {
  try {
    const parts = e.data.text.trim().split(/\s+/);
    const values = new Float32Array(parts.length);
    for (let i = 0; i < parts.length; i++) {
      values[i] = parseFloat(parts[i]);
    }
    self.postMessage({ ok: true, data: values }, [values.buffer]);
  } catch (err) {
    self.postMessage({ ok: false, message: (err as Error).message });
  }
});
