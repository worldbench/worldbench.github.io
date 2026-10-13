(() => {
  'use strict';
  const root = document.querySelector('.idea-player');
  if (!root) return;
  const get = id => document.getElementById(id);
  const canvas = get('idea-canvas');
  const ctx = canvas.getContext('2d');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const duration = 8500;
  const slides = [
    { phase:'Motivation', kicker:'Start with visual motion', title:'Can actions speak the language of vision?', copy:'World-action models anticipate visual dynamics, yet their action targets are often defined independently. What if visual motion itself could define the action representation?', insight:'The question: connect visual grounding and metric precision.', input:'Visual dynamics', code:'Action targets?', output:'Driving decisions', evidence:'Explore the motivation →', href:'#idea' },
    { phase:'Recorded-image reconstruction', kicker:'Give the model the future', title:'Vision captures the maneuver.', copy:'First remove forecasting from the problem. Reconstruct an ego trajectory from recorded current and future images. The recovered path is a smooth visual motion scaffold.', insight:'Recorded images provide supervision here; this is a reconstruction study.', input:'Recorded images · 0–4 s', code:'Visual motion code zᵥ', output:'Scaffold Dᵥ(zᵥ)', evidence:'Open the paper’s reconstruction figure ↗', href:'assets/vital/figures/paper_visual_precision.png' },
    { phase:'Recorded-image reconstruction', kicker:'Inspect the missing detail', title:'A plausible path still leaves a gap.', copy:'Even with the future already observed, visual reconstruction leaves local metric errors. The scaffold captures the overall motion but misses detail that can matter near road boundaries.', insight:'Full validation: 123.6 mm ADE · 221.6 mm FDE. The drawn gap is exaggerated.', input:'Demonstrated trajectory τ', code:'Compare with scaffold', output:'Remaining error e', evidence:'Inspect the precision diagnostic ↗', href:'assets/vital/figures/paper_visual_precision.png' },
    { phase:'Paired target construction', kicker:'Give the error its own coordinates', title:'Keep the scaffold. Encode its residual.', copy:'Encode the difference between the demonstrated trajectory and its visual scaffold in normalized PCA coordinates. The small metric correction now has a separate learning scale.', insight:'With paired ground-truth residuals: 0.3 mm ADE · 0.5 mm FDE, rounded as in the paper figure.', input:'Visual scaffold + error', code:'Paired codes (zᵥ, zᵣ)', output:'Precise reconstruction', evidence:'Read how the representation is built →', href:'#method' },
    { phase:'Deployment · one flow evaluation', kicker:'Predict before the future is seen', title:'One step predicts both codes.', copy:'The action expert jointly predicts the visual and residual codes from the current front image, ego state, and navigation command. One Euler update produces one trajectory; inference generates no future images.', insight:'Final policy: 90.8 PDMS · 149 ms · one action evaluation, including residual refinement.', input:'Current image + ego + command', code:'One flow step → (zᵥ, zᵣ)', output:'One 4-second trajectory', evidence:'See planning quality and latency ↗', href:'assets/vital/figures/paper_efficiency_learning.png' },
    { phase:'Deployment · bounded correction', kicker:'Refine the execution', title:'Adjust the residual. Preserve the scaffold.', copy:'After reward-based post-training, a residual actor applies one deterministic, bounded update. The action generator and decoder stay frozen; the predicted visual tokens do not change.', insight:'No extra denoising or candidate search. Local refinement cannot guarantee improvement in every scene.', input:'Frozen base prediction', code:'zᵣ + bounded Δzᵣ', output:'Locally refined plan', evidence:'See actual before/after examples ↗', href:'assets/vital/figures/paper_residual_cases.png' }
  ];
  let index = 0, elapsed = 0, playing = !reduced.matches, visible = false;
  let frame = null, previousTime = null;
  const tabs = [...root.querySelectorAll('[data-demo-step]')];
  function renderText() {
    const slide = slides[index];
    root.dataset.phase = index;
    get('demo-phase').textContent = `${String(index + 1).padStart(2, '0')} / 06 · ${slide.phase}`;
    get('demo-kicker').textContent = `${String(index + 1).padStart(2, '0')} · ${slide.kicker}`;
    get('demo-title').textContent = slide.title;
    get('demo-copy').textContent = slide.copy;
    get('demo-insight').textContent = slide.insight;
    get('demo-evidence').textContent = slide.evidence;
    get('demo-evidence').href = slide.href;
    ['input','code','output'].forEach(key => { get(`flow-${key}`).textContent = slide[key]; });
    get('target-legend').textContent = index < 4 ? 'Demonstrated trajectory' : 'Training reference hidden';
    tabs.forEach((tab, i) => {
      if (i === index) tab.setAttribute('aria-current', 'step');
      else tab.removeAttribute('aria-current');
    });
    canvas.setAttribute('aria-label', `Concept illustration, step ${index + 1}: ${slide.title} ${slide.copy} Illustrative geometry, not measured trajectories.`);
  }
  // All coordinates below are deliberately schematic, never experimental data.
  const colors = { scaffold:'#51b7d8', target:'#90d4b4', residual:'#ffb16a', plan:'#a988ff' };
  function point(t, kind) {
    const x = 330 + 210 * t * t + 70 * t * t * t;
    const y = 530 - 420 * t;
    const error = (20 * Math.sin(t * 9) + 18 * t) * t;
    return [x + (kind === 'target' ? error : kind === 'plan' ? error * .82 : kind === 'refined' ? error * .82 - 12 * Math.sin(t * Math.PI) : 0), y];
  }
  function path(kind, color, progress = 1, width = 4, dash = []) {
    ctx.beginPath();
    for (let i = 0; i <= 120 * progress; i++) {
      const [x,y] = point(i / 120, kind);
      if (!i) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash); ctx.stroke(); ctx.setLineDash([]);
  }
  function text(label,x,y,color='#aabecb',size=19) {
    ctx.fillStyle=color; ctx.font=`${size}px system-ui, sans-serif`; ctx.fillText(label,x,y);
  }
  function draw() {
    if (!ctx) return;
    ctx.clearRect(0,0,1000,620);
    // Grid and broad road corridor stay fixed across all six steps.
    ctx.strokeStyle='#ffffff07'; ctx.lineWidth=1;
    for (let x=40;x<1000;x+=50) { ctx.beginPath(); ctx.moveTo(x,40); ctx.lineTo(x,580); ctx.stroke(); }
    for (let y=40;y<620;y+=50) { ctx.beginPath(); ctx.moveTo(40,y); ctx.lineTo(960,y); ctx.stroke(); }
    path('scaffold','#203440',1,154); path('scaffold','#486270',1,2,[12,18]);
    const reveal = reduced.matches || !playing ? 1 : Math.min(1,elapsed/1800);
    if (index === 0) {
      path('scaffold',colors.scaffold,reveal,5,[9,9]);
      text('Visual dynamics',95,150,colors.scaffold,25);
      text('How should action',640,350,'#eaf2f7',24); text('targets be defined?',640,385,'#eaf2f7',24);
      text('?',695,290,colors.residual,85);
    }
    if (index >= 1) {
      path('scaffold',colors.scaffold,reveal,6);
      text(index < 4 ? 'Visual motion scaffold' : 'Predicted scaffold · fixed',55,80,colors.scaffold,23);
    }
    if (index === 2 || index === 3) {
      path('target',colors.target,1,3,[5,7]);
      text('Demonstrated path',635,110,colors.target,21);
      // Individual residuals connect paired times on the same trajectory grid.
      const amount = index === 3 ? reveal : .3;
      for (let i=12;i<=110;i+=10) {
        const a=point(i/120,'scaffold'), b=point(i/120,'target');
        ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(a[0]+(b[0]-a[0])*amount,b[1]);
        ctx.strokeStyle=colors.residual; ctx.lineWidth=3; ctx.stroke();
        ctx.beginPath(); ctx.arc(b[0],b[1],3,0,Math.PI*2); ctx.fillStyle=colors.target; ctx.fill();
      }
      text(index === 2 ? 'Remaining metric error' : 'Paired residual',640,280,colors.residual,22);
      if (index === 3) { path('target',colors.plan,reveal,4); text('Scaffold + residual',635,320,colors.plan,22); }
    }
    if (index >= 4) {
      path('plan',index === 5 ? '#a988ff65' : colors.plan,1,4,index === 5 ? [8,9] : []);
      if (index === 5) {
        path('refined',colors.plan,reveal,5);
        for (let i=15;i<=110;i+=15) {
          const a=point(i/120,'plan'), b=point(i/120,'refined');
          ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.strokeStyle=colors.residual;ctx.lineWidth=3;ctx.stroke();
        }
        text('Only the residual changes',625,320,colors.residual,22);
        text('Bounded local update',625,355,'#c3d5e0',20);
      } else {
        text('1 flow evaluation',625,280,colors.plan,29);
        text('Jointly predicted codes',625,320,'#c3d5e0',20);
        // Two token groups, predicted together, not a sequence of denoising steps.
        for (let row=0;row<4;row++) for (let col=0;col<7;col++) {
          ctx.fillStyle=col<4?colors.scaffold:colors.residual;
          ctx.globalAlpha=.45+.45*reveal;ctx.fillRect(640+col*25,365+row*23,17,14);ctx.globalAlpha=1;
        }
      }
    }
    // Ego marker stays grounded at the beginning of the schematic path.
    ctx.fillStyle='#eaf2f7';ctx.fillRect(316,514,28,45);ctx.fillStyle='#0b1d28';ctx.fillRect(321,521,18,11);
    text(index < 4 ? 'Current ego frame' : 'Current observation',240,597,'#adbfca',19);
    get('demo-time').style.width=`${elapsed/duration*100}%`;
  }
  function syncPlayback() {
    get('demo-play').textContent=playing?'Pause':'Play';
    get('demo-play').setAttribute('aria-pressed',String(playing));
    if (playing && visible && !document.hidden) {
      if (frame === null) { previousTime=null; frame=requestAnimationFrame(tick); }
    } else { if (frame !== null) cancelAnimationFrame(frame); frame=null; previousTime=null; }
  }
  function tick(now) {
    frame=null;
    if (!playing || !visible || document.hidden) return;
    if (previousTime !== null) elapsed+=Math.min(now-previousTime,100);
    previousTime=now;
    if (elapsed >= duration) { elapsed=0; index=(index+1)%slides.length; renderText(); }
    draw();frame=requestAnimationFrame(tick);
  }
  function select(next, resume=false) {
    index=(next+slides.length)%slides.length;elapsed=0;playing=resume;renderText();draw();syncPlayback();
  }
  get('demo-play').addEventListener('click',()=>{ playing=!playing;syncPlayback();draw(); });
  get('demo-prev').addEventListener('click',()=>select(index-1));
  get('demo-next').addEventListener('click',()=>select(index+1));
  get('demo-restart').addEventListener('click',()=>select(0,true));
  tabs.forEach((tab,i)=>tab.addEventListener('click',()=>select(i)));
  document.addEventListener('visibilitychange',syncPlayback);
  reduced.addEventListener('change',()=>{ if(reduced.matches) { playing=false;syncPlayback();draw(); } });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries=>{ visible=entries[0].isIntersecting;syncPlayback(); },{threshold:.12}).observe(root);
  } else visible=true;
  renderText();draw();syncPlayback();
})();
