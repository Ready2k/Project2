// AudioWorkletProcessor for decoding and playing incoming PCM16 data
// Buffers float32 samples and outputs them in process() for gapless playback.
class PCM16Player extends AudioWorkletProcessor {
  constructor(options) {
    super(options);
    this.buffer = new Float32Array(0);
    this.port.onmessage = (event) => {
      const input = event.data;
      // Expecting ArrayBuffer of Int16 PCM samples
      const int16 = new Int16Array(input);
      const floatBuf = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        floatBuf[i] = int16[i] / 32768;
      }
      // Append new samples to buffer
      const combined = new Float32Array(this.buffer.length + floatBuf.length);
      combined.set(this.buffer);
      combined.set(floatBuf, this.buffer.length);
      this.buffer = combined;
    };
  }

  process(inputs, outputs) {
    const output = outputs[0][0];
    const len = output.length;
    if (this.buffer.length >= len) {
      output.set(this.buffer.subarray(0, len));
      this.buffer = this.buffer.subarray(len);
    } else if (this.buffer.length > 0) {
      output.set(this.buffer);
      for (let i = this.buffer.length; i < len; i++) output[i] = 0;
      this.buffer = new Float32Array(0);
    } else {
      // No data: output silence
      for (let i = 0; i < len; i++) output[i] = 0;
    }
    return true;
  }
}

registerProcessor('pcm16-player', PCM16Player);
