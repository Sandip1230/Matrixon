/**
 * sounds.js — MATRIXON Ambient Sound & SFX Manager v2
 * Include AFTER config.js on any page that needs audio.
 *
 * HOW IT WORKS:
 *  - SFX (click, xpGain, achievement, levelUp, error) fire whenever
 *    window.matrixonSettings.soundFX is true (default: true).
 *  - Ambient hum only plays when bgMusic is true (default: false — enable in Settings).
 *  - Everything is muted when localStorage matrixon_muted === '1'.
 *  - First user interaction (click or keydown) starts the AudioContext and
 *    plays an audible boot ping so you can confirm sound is working.
 */

(function () {
  let ctx = null;
  let ambientNodes = null;
  let ambientGain = null;
  let ambientRunning = false;
  let ready = false;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }
  function isMuted() { return localStorage.getItem('matrixon_muted') === '1'; }
  function sfxEnabled() { const s=window.matrixonSettings; if(!s)return true; return s.soundFX!==false; }
  function getVolume() { const s=window.matrixonSettings||{}; return Math.min(1,Math.max(0,(s.volume!==undefined?s.volume:70)/100)); }

  function tone(freq, type, duration, vol, delayMs) {
    if (!ready || isMuted() || !sfxEnabled()) return;
    const fire = () => {
      try {
        const ac=getCtx(), osc=ac.createOscillator(), g=ac.createGain();
        osc.type=type||'sine'; osc.frequency.value=freq||440;
        const v=(vol||0.3)*getVolume();
        g.gain.setValueAtTime(v,ac.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+(duration||0.3));
        osc.connect(g); g.connect(ac.destination);
        osc.start(); osc.stop(ac.currentTime+(duration||0.3));
      } catch(_) {}
    };
    delayMs ? setTimeout(fire,delayMs) : fire();
  }

  function startAmbient() {
    if (ambientRunning) return;
    const s=window.matrixonSettings||{};
    if (!s.bgMusic||isMuted()) return;
    try {
      const ac=getCtx();
      ambientGain=ac.createGain(); ambientGain.gain.value=getVolume()*0.1;
      const osc1=ac.createOscillator(); osc1.type='sine'; osc1.frequency.value=55;
      const osc2=ac.createOscillator(); osc2.type='triangle'; osc2.frequency.value=110;
      const lfo=ac.createOscillator(), lfoG=ac.createGain();
      lfo.frequency.value=0.08; lfoG.gain.value=0.03;
      lfo.connect(lfoG); lfoG.connect(ambientGain.gain);
      const filt=ac.createBiquadFilter(); filt.type='lowpass'; filt.frequency.value=700; filt.Q.value=1;
      osc1.connect(filt); osc2.connect(filt); filt.connect(ambientGain); ambientGain.connect(ac.destination);
      osc1.start(); osc2.start(); lfo.start();
      ambientNodes={osc1,osc2,lfo}; ambientRunning=true;
      console.info('[MATRIXON Sounds] Ambient hum started');
    } catch(e) { console.warn('[MATRIXON Sounds] Ambient error:',e); }
  }

  function stopAmbient() {
    if (!ambientRunning||!ambientNodes) return;
    try {
      const t=getCtx().currentTime;
      ambientGain.gain.linearRampToValueAtTime(0,t+0.6);
      setTimeout(()=>{
        try{ambientNodes.osc1.stop();ambientNodes.osc2.stop();ambientNodes.lfo.stop();}catch(_){}
        ambientRunning=false; ambientNodes=null;
      },700);
    } catch(_) { ambientRunning=false; }
  }

  window.MatrixSounds = {
    /** Rising 3-note chime — call when XP is awarded */
    xpGain:      () => { tone(523,'sine',0.12,0.22,0); tone(659,'sine',0.12,0.18,90); tone(784,'sine',0.2,0.15,180); },
    /** 4-note fanfare — call on achievement unlock */
    achievement: () => { [523,659,784,1047].forEach((f,i)=>tone(f,'triangle',0.28,0.28,i*85)); },
    /** 5-note ascent — call on level up */
    levelUp:     () => { [392,523,659,784,1047].forEach((f,i)=>tone(f,'sine',0.35,0.32,i*75)); },
    /** Two falling tones — call on error / wrong answer */
    error:       () => { tone(260,'sawtooth',0.18,0.22,0); tone(180,'sawtooth',0.25,0.18,140); },
    /** Soft tick — attach to nav buttons */
    click:       () =>   tone(900,'sine',0.07,0.12,0),
    /** Boot ping — auto-plays on first interaction to confirm audio works */
    boot:        () => { tone(330,'sine',0.1,0.18,0); tone(440,'sine',0.12,0.14,100); tone(550,'sine',0.15,0.1,200); },
    startAmbient, stopAmbient,
    setVolume:   (v) => { if(ambientGain) ambientGain.gain.value=v*0.1; },
    refresh:     () => { stopAmbient(); setTimeout(startAmbient,750); }
  };

  function onFirstInteraction() {
    document.removeEventListener('click',   onFirstInteraction);
    document.removeEventListener('keydown', onFirstInteraction);
    if (ready) return;
    ready = true;
    try { getCtx(); } catch(_) {}
    window.MatrixSounds.boot();  // audible confirmation that audio works
    startAmbient();
    console.info('[MATRIXON Sounds] AudioContext unlocked ✓');
  }
  document.addEventListener('click',   onFirstInteraction);
  document.addEventListener('keydown', onFirstInteraction);

  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    document.hidden ? ctx.suspend() : ctx.resume().then(()=>{ if(!ambientRunning) startAmbient(); });
  });

  console.info('[MATRIXON Sounds] Ready — waiting for first user interaction...');
})();