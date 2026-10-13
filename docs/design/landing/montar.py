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
for src in sorted((here / 'variacoes' / 'src').glob('*.html')):
    s = src.read_text()
    s = s.replace('{{LOGO}}', LOGO)
    s = re.sub(r'\{\{CHAR:([\w.-]+)\}\}', lambda m: char.replace('PROP', prop(m[1])), s)
    def ph(m):
        out = phone.format(w=m[1])
        return out.replace('class="phn"', 'class="phn dark"') if m[2] else out
    s = re.sub(r'\{\{PHONE:(\d+)(:dark)?\}\}', ph, s)
    (here / 'variacoes' / src.name).write_text(s)
    print('ok', src.name)
