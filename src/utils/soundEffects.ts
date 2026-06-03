/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Elegant programmatically synthesized Web Audio sound FX to avoid CORS issue with external audios.
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    // @ts-ignore
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  return audioCtx;
}

export function playSound(type: 'click' | 'win' | 'roll' | 'reset' | 'error', enabled: boolean = true) {
  if (!enabled) return;
  
  const ctx = getAudioContext();
  if (!ctx) return;
  
  // Resume context if suspended (browser security blocks auto-activation)
  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  try {
    const now = ctx.currentTime;

    if (type === 'click') {
      // Gentle sine clock sound
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.1);
      
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
    } 
    
    else if (type === 'win') {
      // Beautiful major key celebratory chime: C E G C
      const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
      notes.forEach((freq, i) => {
        const noteTime = now + (i * 0.1);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, noteTime);
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.12, noteTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.3);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(noteTime);
        osc.stop(noteTime + 0.35);
      });
    } 
    
    else if (type === 'roll') {
      // Synthesize a retro bubble sweep for rolling the balls
      const duration = 1.2;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      
      // Sweep pitch up and down rapidly
      osc.frequency.setValueAtTime(180, now);
      for (let t = 0.1; t < duration; t += 0.08) {
        osc.frequency.setValueAtTime(250 + Math.random() * 600, now + t);
      }
      osc.frequency.exponentialRampToValueAtTime(800, now + duration);
      
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.linearRampToValueAtTime(0.08, now + duration - 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration);
    } 
    
    else if (type === 'reset') {
      // Descending pitch sweep
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.4);
      
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    }

    else if (type === 'error') {
      // Low buzz error chime
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, now);
      
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  } catch (err) {
    console.warn("Sound synthesis failed, Web Audio API may be suspended in iframe sandbox:", err);
  }
}
