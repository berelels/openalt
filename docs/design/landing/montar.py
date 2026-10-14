# Monta as variações: troca {{CHAR:tela}}, {{PHONE:largura[:dark]}} e {{LOGO}} pelos pedaços prontos.
# uso: python3 montar.py   (lê variacoes/src/*.html, grava variacoes/*.html)
import pathlib, re
here = pathlib.Path(__file__).parent
phone = (here / 'celular-app.snippet.html').read_text().strip()
char = (here / 'personagem.snippet.html').read_text().strip()
LOGO = ('<span class="logo"><svg viewBox="64 120 380 300" fill="none" stroke="currentColor" stroke-width="40" stroke-linecap="round" stroke-linejoin="round">'
        '<path d="M86 156c62-2 108-6 136 16 30 24 26 80 40 124 18 56 78 92 126 64 40-24 30-90-14-96-50-8-72 52-40 92 22 28 62 34 92 24"/>'
        '<path d="M270 152c50-8 96-10 144-6"/></svg><span>Open<em>Alt</em></span></span>')
DESK = '<div class="desk"><div class="win"><div class="tb"><i></i><i></i><i></i></div><div class="body"><div></div><div></div><div></div></div></div></div>'
GAME = '<div class="game"><div class="sun"></div><div class="mt"></div><div class="car"></div></div>'
def scr(kind):
    return DESK if kind == 'desk' else GAME if kind == 'game' else f'<img src="../img/{kind}" alt="">'
def prop(kind):
    # o que o personagem segura: tablet com uma tela, celular deitado jogando, ou nada
    if kind == 'none': return ''
    if kind == 'phone-game':
        return ('<div class="inphone"><div class="phn land dark" style="--w:96px"><div class="bz"><div class="scr">'
                '<div class="island"></div>' + GAME + '</div></div></div></div>')
    return f'<div class="intab"><div class="tab dark" style="--w:300px"><div class="bz"><div class="scr">{scr(kind)}</div></div></div></div>'
# balões soltos da 03 (sem o boneco): {{BUBBLE:monitor|pad|qr|phone[:largura]}}
BUB_BODY = 'M10 70c0-40 30-60 70-60s70 20 70 60-30 60-70 60c-12 0-22-2-30-6l-30 22 8-34C16 100 10 86 10 70z'
BUB_IN = {
  'monitor': '<rect x="48" y="44" width="64" height="46" rx="6" fill="#FBF6EE"/><path d="M66 102h28"/>',
  'pad': '<path d="M40 52h80c14 0 22 12 22 26s-10 26-22 26c-10 0-16-8-22-14H62c-6 6-12 14-22 14-12 0-22-12-22-26s8-26 22-26z" fill="#FBF6EE"/><path d="M48 70v14M41 77h14"/><circle cx="104" cy="72" r="3" fill="#26211B"/><circle cx="114" cy="82" r="3" fill="#26211B"/>',
  'qr': '<rect x="50" y="36" width="60" height="60" rx="6" fill="#FBF6EE"/><path d="M60 46h14v14H60zM86 46h14v14H86zM60 72h14v14H60z" fill="#26211B"/><path d="M88 74h4M96 80h4M88 86h12"/>',
  'phone': '<rect x="62" y="30" width="36" height="70" rx="8" fill="#FBF6EE"/><path d="M74 92h12"/>',
}
BUB_FILL = {'monitor': '#8FBF92', 'pad': '#FF746C', 'qr': '#F2B33D', 'phone': '#F2B9B4'}
def bubble(m):
    k, w = m[1], int(m[2] or 150)
    flip = ' style="transform:scaleX(-1)"' if m[3] else ''
    return (f'<svg width="{w}" height="{int(w*.93)}" viewBox="0 0 160 150" fill="none" stroke="#26211B" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">'
            f'<g{flip} transform-origin="80 75"><path d="{BUB_BODY}" fill="{BUB_FILL[k]}"/></g>{BUB_IN[k]}</svg>')

for src in sorted((here / 'variacoes' / 'src').glob('*.html')):
    s = src.read_text()
    s = s.replace('{{LOGO}}', LOGO)
    s = re.sub(r'\{\{BUBBLE:(\w+)(?::(\d+))?(:flip)?\}\}', bubble, s)
    s = re.sub(r'\{\{CHAR:([\w.-]+)\}\}', lambda m: char.replace('PROP', prop(m[1])), s)
    def ph(m):
        out = phone.format(w=m[1])
        return out.replace('class="phn"', 'class="phn dark"') if m[2] else out
    s = re.sub(r'\{\{PHONE:(\d+)(:dark)?\}\}', ph, s)
    (here / 'variacoes' / src.name).write_text(s)
    print('ok', src.name)
