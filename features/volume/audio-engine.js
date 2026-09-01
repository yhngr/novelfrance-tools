const NFAudioEngine = (() => {
  "use strict";

  const chains = new WeakMap();
  const samplers = new WeakMap();
  const contexts = new Set();

  function connect(audio) {
    if (chains.has(audio)) {
      return chains.get(audio);
    }

    const ctx = new AudioContext();

    const source = ctx.createMediaElementSource(audio);

    const bass = ctx.createBiquadFilter();
    bass.type = "lowshelf";
    bass.frequency.value = 200;

    const mid = ctx.createBiquadFilter();
    mid.type = "peaking";
    mid.frequency.value = 1000;
    mid.Q.value = 1;

    const treble = ctx.createBiquadFilter();
    treble.type = "highshelf";
    treble.frequency.value = 4000;

    const gain = ctx.createGain();

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -12;
    compressor.knee.value = 18;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.15;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;

    source.connect(bass);
    bass.connect(mid);
    mid.connect(treble);
    treble.connect(gain);
    gain.connect(compressor);
    compressor.connect(analyser);
    analyser.connect(ctx.destination);

    audio.volume = 1;

    const chain = {
      ctx,
      source,
      gain,
      bass,
      mid,
      treble,
      compressor,
      analyser,
      limiterEnabled: true,
    };
    chains.set(audio, chain);
    contexts.add(ctx);
    return chain;
  }

  async function resumeContext(chain) {
    if (chain.ctx.state === "suspended") {
      await chain.ctx.resume();
    }
  }

  function setEqualizer(chain, equalizer) {
    if (!equalizer) {
      return;
    }
    chain.bass.gain.value = equalizer.bass || 0;
    chain.mid.gain.value = equalizer.mid || 0;
    chain.treble.gain.value = equalizer.treble || 0;
  }

  function setLimiter(chain, enabled) {
    chain.limiterEnabled = enabled;
    chain.compressor.ratio.value = enabled ? 4 : 1;
    chain.compressor.threshold.value = enabled ? -12 : 0;
  }

  function applyGain(chain, percent, { fadeMs = 0 } = {}) {
    const value = Math.max(0, percent / 100);
    const now = chain.ctx.currentTime;

    chain.gain.gain.cancelScheduledValues(now);
    if (fadeMs > 0) {
      chain.gain.gain.setValueAtTime(chain.gain.gain.value, now);
      chain.gain.gain.linearRampToValueAtTime(value, now + fadeMs / 1000);
    } else {
      chain.gain.gain.setValueAtTime(value, now);
    }
  }

  async function apply(audio, percent, options = {}) {
    const chain = connect(audio);
    await resumeContext(chain);

    setEqualizer(chain, options.equalizer);
    setLimiter(chain, options.limiterEnabled !== false);

    const fadeMs = options.fadeEnabled ? options.fadeDurationMs || 0 : 0;
    applyGain(chain, percent, { fadeMs });
  }

  function measureRms(audio) {
    const chain = chains.get(audio);
    if (!chain) {
      return null;
    }

    const buffer = new Float32Array(chain.analyser.fftSize);
    chain.analyser.getFloatTimeDomainData(buffer);

    let sum = 0;
    for (let i = 0; i < buffer.length; i += 1) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  }

  function startSampling(audio, onSample) {
    stopSampling(audio);
    const chain = chains.get(audio);
    if (!chain) {
      return;
    }

    const timer = window.setInterval(() => {
      if (audio.paused || audio.ended) {
        return;
      }
      const rms = measureRms(audio);
      if (rms !== null && rms > 0.001) {
        onSample(rms);
      }
    }, 1200);

    samplers.set(audio, timer);
  }

  function stopSampling(audio) {
    const timer = samplers.get(audio);
    if (timer) {
      window.clearInterval(timer);
      samplers.delete(audio);
    }
  }

  async function disconnect(audio) {
    stopSampling(audio);
    const chain = chains.get(audio);
    if (!chain) {
      return;
    }

    [chain.source, chain.bass, chain.mid, chain.treble, chain.gain, chain.compressor, chain.analyser]
      .forEach((node) => node.disconnect());

    contexts.delete(chain.ctx);
    chains.delete(audio);
    if (chain.ctx.state !== "closed") {
      await chain.ctx.close();
    }
  }

  async function keepAlive() {
    for (const ctx of contexts) {
      if (ctx.state === "closed") {
        contexts.delete(ctx);
        continue;
      }
      if (ctx.state === "suspended") {
        await ctx.resume();
      }
    }
  }

  return {
    connect,
    apply,
    measureRms,
    startSampling,
    stopSampling,
    disconnect,
    keepAlive,
    resumeContext,
  };
})();
