import { createFileRoute } from "@tanstack/react-router";

// Embed Concertivo v2 — news / events / gallery + lightbox + wideo.
// Użycie:
//   <div id="c-feed"></div>
//   <script async src=".../api/public/v1/embed.js"
//     data-org="<slug>" data-mode="news|events|gallery"
//     data-lang="pl|en" data-limit="6" data-target="#c-feed"></script>

const EMBED_JS = `(()=>{try{
var s=document.currentScript;if(!s)return;
var org=s.getAttribute('data-org');if(!org){console.warn('[concertivo] data-org required');return;}
var mode=s.getAttribute('data-mode')||'news';
var lang=s.getAttribute('data-lang')||'pl';
var limit=parseInt(s.getAttribute('data-limit')||'12',10);
var base=s.getAttribute('data-base')|| (new URL(s.src)).origin;
var sel=s.getAttribute('data-target');
var host=sel?document.querySelector(sel):document.createElement('div');
if(!sel){s.parentNode.insertBefore(host,s.nextSibling);}
var root=host.attachShadow?host.attachShadow({mode:'open'}):host;
var css='*{box-sizing:border-box}.c-grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));font-family:system-ui,-apple-system,sans-serif}.c-card{border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background:#fff;color:#111;cursor:pointer;transition:transform .15s,box-shadow .15s}.c-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.08)}.c-card img,.c-card video{display:block;width:100%;height:170px;object-fit:cover;background:#f3f4f6}.c-body{padding:12px 14px}.c-title{font-size:15px;font-weight:600;margin:0 0 4px;line-height:1.3}.c-excerpt{font-size:13px;color:#4b5563;margin:0;line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.c-date{font-size:11px;color:#6b7280;margin-top:6px}.c-badge{position:relative}.c-badge::after{content:"▶";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:32px;text-shadow:0 2px 6px rgba(0,0,0,.6);pointer-events:none}.c-empty,.c-err{color:#6b7280;font-size:13px;padding:16px;text-align:center}.c-lb{position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:2147483647;display:none;align-items:center;justify-content:center;padding:24px}.c-lb.open{display:flex}.c-lb-media{max-width:96vw;max-height:90vh}.c-lb-media img,.c-lb-media video{max-width:96vw;max-height:80vh;display:block;margin:auto;border-radius:6px}.c-lb-cap{color:#e5e7eb;font-size:13px;text-align:center;margin-top:8px;font-family:system-ui}.c-lb-close,.c-lb-prev,.c-lb-next{position:absolute;color:#fff;background:rgba(255,255,255,.1);border:0;width:44px;height:44px;border-radius:50%;cursor:pointer;font-size:20px;display:flex;align-items:center;justify-content:center}.c-lb-close{top:16px;right:16px}.c-lb-prev{left:16px;top:50%;transform:translateY(-50%)}.c-lb-next{right:16px;top:50%;transform:translateY(-50%)}';
root.innerHTML='<style>'+css+'</style><div id="c"></div>';
var grid=root.getElementById('c');
function esc(s){return String(s||'').replace(/[&<>"\']/g,function(c){return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[c];});}
function api(p){return base+'/api/public/v1/orgs/'+encodeURIComponent(org)+p;}

if(mode==='gallery'){
  // Lista albumów; klik -> ładuje pozycje i otwiera lightbox
  fetch(api('/gallery?lang='+lang+'&limit='+limit)).then(function(r){return r.json();}).then(function(j){
    var items=j.albums||j.items||[];
    if(!items.length){grid.outerHTML='<div class="c-empty">Brak albumów.</div>';return;}
    grid.className='c-grid';
    grid.innerHTML=items.map(function(a){
      var img=a.cover_image_url?'<img src="'+esc(a.cover_image_url)+'" alt="" loading="lazy">':'<div style="height:170px;background:#f3f4f6"></div>';
      return '<article class="c-card" data-album="'+esc(a.slug)+'">'+img+'<div class="c-body"><h3 class="c-title">'+esc(a.title||'')+'</h3></div></article>';
    }).join('');
    grid.querySelectorAll('[data-album]').forEach(function(el){
      el.addEventListener('click',function(){openAlbum(el.getAttribute('data-album'));});
    });
  }).catch(function(){grid.outerHTML='<div class="c-err">Błąd ładowania.</div>';});
} else {
  // news/events
  var ep=mode==='events'?'/events':'/news';
  fetch(api(ep+'?lang='+lang+'&limit='+limit)).then(function(r){return r.json();}).then(function(j){
    var items=j.items||[];
    if(!items.length){grid.outerHTML='<div class="c-empty">Brak treści.</div>';return;}
    grid.className='c-grid';
    grid.innerHTML=items.map(function(it){
      var img=it.cover_image_url?'<img src="'+esc(it.cover_image_url)+'" alt="" loading="lazy">':'';
      var date=(it.published_at||it.starts_at||'').toString().slice(0,10);
      var excerpt=(it.excerpt||(it.description_html||'').replace(/<[^>]+>/g,' ').slice(0,180)||'');
      return '<article class="c-card">'+img+'<div class="c-body"><h3 class="c-title">'+esc(it.title||'')+'</h3><p class="c-excerpt">'+esc(excerpt)+'</p>'+(date?'<div class="c-date">'+esc(date)+'</div>':'')+'</div></article>';
    }).join('');
  }).catch(function(){grid.outerHTML='<div class="c-err">Błąd ładowania.</div>';});
}

// Lightbox
var lb=document.createElement('div');lb.className='c-lb';
lb.innerHTML='<button class="c-lb-close" aria-label="Zamknij">✕</button><button class="c-lb-prev" aria-label="Poprzednie">‹</button><button class="c-lb-next" aria-label="Następne">›</button><div><div class="c-lb-media"></div><div class="c-lb-cap"></div></div>';
root.appendChild(lb);
var lbMedia=lb.querySelector('.c-lb-media'),lbCap=lb.querySelector('.c-lb-cap');
var slides=[],idx=0;
function render(){var it=slides[idx];if(!it)return;
  if(it.kind==='video'){lbMedia.innerHTML='<video src="'+esc(it.url)+'" controls autoplay playsinline></video>';}
  else{lbMedia.innerHTML='<img src="'+esc(it.url)+'" alt="">';}
  lbCap.textContent=(it.caption||'')+(it.photo_credit?' · © '+it.photo_credit:'');
}
function show(i){idx=(i+slides.length)%slides.length;render();}
lb.querySelector('.c-lb-close').onclick=function(){lb.classList.remove('open');lbMedia.innerHTML='';};
lb.querySelector('.c-lb-prev').onclick=function(){show(idx-1);};
lb.querySelector('.c-lb-next').onclick=function(){show(idx+1);};
lb.addEventListener('click',function(e){if(e.target===lb){lb.classList.remove('open');lbMedia.innerHTML='';}});
document.addEventListener('keydown',function(e){if(!lb.classList.contains('open'))return;
  if(e.key==='Escape'){lb.classList.remove('open');lbMedia.innerHTML='';}
  if(e.key==='ArrowLeft')show(idx-1);if(e.key==='ArrowRight')show(idx+1);});

function openAlbum(slug){
  fetch(api('/gallery/'+encodeURIComponent(slug)+'?lang='+lang)).then(function(r){return r.json();}).then(function(j){
    slides=(j.items||[]).map(function(it){return {kind:it.kind||'image',url:it.url,caption:it.caption||'',photo_credit:it.photo_credit||''};});
    if(!slides.length)return;
    show(0);lb.classList.add('open');
  });
}
}catch(e){console.warn('[concertivo embed]',e);}})();`;

export const Route = createFileRoute("/api/public/v1/embed.js")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(EMBED_JS, {
          status: 200,
          headers: {
            "Content-Type": "application/javascript; charset=utf-8",
            "Cache-Control": "public, max-age=3600, s-maxage=86400",
            "Access-Control-Allow-Origin": "*",
          },
        });
      },
    },
  },
});
