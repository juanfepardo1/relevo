import asyncio, os
from playwright.async_api import async_playwright
D=os.path.dirname(os.path.abspath(__file__)); F='/tmp/claude-0/-home-claude-relevo/dcc7213f-464d-5e4c-96db-b3ddb00c7dc9/scratchpad/node_modules/@fontsource'
ADS=[
 ('a_valoracion','¿Cuánto vale tu empresa hoy?','Valoración gratis y confidencial.','50% 60%'),
 ('d_oferta','¿Te hicieron una oferta por tu empresa?','Antes de responder, conoce el precio justo.','55% 60%'),
 ('b_reserva','Vende tu empresa con reserva.','Tu nombre no aparece. Solo compradores verificados.','45% 65%'),
 ('c_relevo','¿Tus hijos no van a seguir con la empresa?','Sin pagos por adelantado. Cobramos solo si se vende.','50% 70%'),
]
CSS=f'''@font-face{{font-family:Archivo;src:url(file://{F}-variable/archivo/files/archivo-latin-wght-normal.woff2);font-weight:100 900}}
@font-face{{font-family:Hanken;src:url(file://{F}/hanken-grotesk/files/hanken-grotesk-latin-400-normal.woff2);font-weight:400}}
@font-face{{font-family:Hanken;src:url(file://{F}/hanken-grotesk/files/hanken-grotesk-latin-600-normal.woff2);font-weight:600}}
@font-face{{font-family:News;src:url(file://{F}/newsreader/files/newsreader-latin-600-normal.woff2);font-weight:600}}
*{{box-sizing:border-box;margin:0}}
body{{width:var(--w);height:var(--h);background:#fafaf8;color:#131f33;overflow:hidden;position:relative;font-family:Hanken}}
.brand{{display:flex;align-items:center;gap:18px;font:600 52px News;letter-spacing:-.02em}}
.mark{{position:relative;width:46px;height:44px}}.mark i{{position:absolute;height:13px;width:31px;border-radius:3px}}
.mark i:first-child{{top:6px;left:0;background:#26497c}}.mark i:last-child{{top:24px;left:15px;background:#f08a4b}}
h1{{font:800 var(--hs)/1.0 Archivo;letter-spacing:-.035em;text-wrap:balance}}
p{{font:400 var(--ps)/1.3 Hanken;color:#4b5567;text-wrap:balance}}
.pill{{display:inline-block;background:#f08a4b;color:#131f33;font:600 var(--ps) Hanken;padding:.5em .9em;border-radius:8px}}
body{{display:flex;flex-direction:column}}.txt{{position:relative;z-index:1}}.cbox{{flex:1;min-height:0;overflow:hidden;position:relative}}.cbox img{{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}}.cbox:after{{content:'';position:absolute;left:0;right:0;top:0;height:90px;background:linear-gradient(#fafaf8,rgba(250,250,248,0))}}body.st .cbox{{margin-bottom:280px}}body.st .cbox:before{{content:'';position:absolute;z-index:1;left:0;right:0;bottom:0;height:36px;background:linear-gradient(rgba(250,250,248,0),#fafaf8)}}.tag{{font:400 30px Hanken;color:#4b5567;margin-top:10px;letter-spacing:.01em}}
'''
def html(w,h,head,sub,key,pos):
  if h==w:
    body=f'''<div class="txt" style="padding:64px 84px 36px">
      <div class="brand"><span class="mark"><i></i><i></i></span>Relevo</div><div class="tag">Venta de empresas en Colombia</div>
      <h1 style="margin-top:40px">{head}</h1><p style="margin-top:24px">{sub}</p></div>
      <div class="cbox"><img src="src/{key}.png" style="object-position:{pos}"></div>'''
    v='--hs:80px;--ps:36px'
  else:
    body=f'''<div class="txt" style="padding:250px 90px 40px">
      <div class="brand"><span class="mark"><i></i><i></i></span>Relevo</div><div class="tag">Venta de empresas en Colombia</div>
      <h1 style="margin-top:80px">{head}</h1><p style="margin-top:36px">{sub}</p>
      <div style="margin-top:48px"><span class="pill">Pide tu valoración gratis</span></div></div>
      <div class="cbox"><img src="src/{key}.png" style="object-position:{pos}"></div>'''
    v='--hs:116px;--ps:44px'
  return f'<!doctype html><html><head><meta charset="utf-8"><style>{CSS}</style></head><body class="{'st' if h>w else ''}" style="--w:{w}px;--h:{h}px;{v}">{body}</body></html>'
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch()
    for key,head,sub,pos in ADS:
      for w,h,tag in [(1080,1080,'feed'),(1080,1920,'historia')]:
        open('ad.html','w').write(html(w,h,head,sub,key,pos))
        pg=await b.new_page(viewport={'width':w,'height':h})
        await pg.goto('file://'+D+'/ad.html'); await pg.evaluate('document.fonts.ready'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=f'/home/claude/relevo/ads/{key}_{tag}.png'); await pg.close()
    await b.close()
asyncio.run(main())
