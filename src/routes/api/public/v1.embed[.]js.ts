import { createFileRoute } from "@tanstack/react-router";

// Lekki embed (~5 kB) — wyświetla aktualności z publicznego API w Shadow DOM.
// Wymagane atrybuty na <script>:  data-org="<public-slug>"  data-mode="news"
// Opcjonalne: data-lang="pl|en", data-limit="6", data-base="https://twoja-instancja"
//
// Użycie:
//   <div id="concertivo-feed"></div>
//   <script async src="https://...lovable.app/api/public/v1/embed.js"
//           data-org="moja-organizacja" data-mode="news" data-target="#concertivo-feed"></script>

const EMBED_JS = `(()=>{try{
var s=document.currentScript;if(!s)return;
var org=s.getAttribute('data-org');if(!org){console.warn('[concertivo] data-org required');return;}
var mode=s.getAttribute('data-mode')||'news';
var lang=s.getAttribute('data-lang')||'pl';
var limit=parseInt(s.getAttribute('data-limit')||'6',10);
var base=s.getAttribute('data-base')|| (new URL(s.src)).origin;
var sel=s.getAttribute('data-target');
var host=sel?document.querySelector(sel):document.createElement('div');
if(!sel){s.parentNode.insertBefore(host,s.nextSibling);}
var root=host.attachShadow?host.attachShadow({mode:'open'}):host;
root.innerHTML='<style>.c-grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));font-family:system-ui,-apple-system,sans-serif}.c-card{border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background:#fff;color:#111}.c-card img{display:block;width:100%;height:160px;object-fit:cover}.c-body{padding:12px 14px}.c-title{font-size:15px;font-weight:600;margin:0 0 4px;line-height:1.3}.c-excerpt{font-size:13px;color:#4b5563;margin:0;line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.c-date{font-size:11px;color:#6b7280;margin-top:6px}.c-empty,.c-err{font-family:system-ui;color:#6b7280;font-size:13px;padding:16px;text-align:center}</style><div class="c-grid" id="c"></div>';
var grid=root.getElementById('c');
var url=base+'/api/public/v1/orgs/'+encodeURIComponent(org)+'/'+(mode==='events'?'events':'news')+'?lang='+encodeURIComponent(lang)+'&limit='+limit;
fetch(url).then(function(r){return r.json();}).then(function(j){
  var items=j.items||[];
  if(!items.length){grid.outerHTML='<div class="c-empty">Brak treści.</div>';return;}
  grid.innerHTML=items.map(function(it){
    var img=it.cover_image_url?'<img src="'+it.cover_image_url+'" alt="">':'';
    var date=(it.published_at||it.starts_at||'').toString().slice(0,10);
    var excerpt=(it.excerpt|| (it.description_html||'').replace(/<[^>]+>/g,' ').slice(0,180) ||'');
    return '<article class="c-card">'+img+'<div class="c-body"><h3 class="c-title">'+escape(it.title||'')+'</h3><p class="c-excerpt">'+escape(excerpt)+'</p>'+(date?'<div class="c-date">'+escape(date)+'</div>':'')+'</div></article>';
  }).join('');
}).catch(function(e){grid.outerHTML='<div class="c-err">Błąd ładowania.</div>';});
function escape(s){return String(s||'').replace(/[&<>"']/g,function(c){return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[c];});}
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
