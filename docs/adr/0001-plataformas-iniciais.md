# ADR-0001: Linux X11 primeiro, só Android no celular

**Status:** Aceita
**Data:** 2026-10-12
**Decisores:** Catta Studios

## Contexto
O OpenAlt precisa funcionar no PC de quem desenvolve para ser testado de verdade todos os dias:
Zorin OS 18.1, GNOME 46 em **X11**, AMD RX 6600 (amdgpu), dois monitores (HDMI-A-0 1440x900 e
DisplayPort-2 1920x1080 primário) e duas saídas livres (DisplayPort-0 e DisplayPort-1).
No X11 dá para criar um monitor virtual só com `xrandr` (ADR-0005). No Wayland e no Windows isso
exige outro mecanismo (portal/compositor; driver de monitor virtual).

## Decisão
Ordem: **Linux X11 → Windows → Wayland**. No celular, **só Android**; iOS fica fora por enquanto.

## Opções consideradas

### A: Linux X11 primeiro (escolhida)
| Dimensão | Avaliação |
|---|---|
| Complexidade | Baixa: monitor virtual com xrandr, já provado |
| Custo | Zero: é o PC de testes |
| Alcance | Pequeno (Linux X11 é nicho) |
| Familiaridade | Alta |

**Prós:** teste real todo dia; caminho já provado. **Contras:** pouca gente usa X11; o GNOME está empurrando Wayland.

### B: Windows primeiro
**Prós:** muito mais usuários. **Contras:** precisa de driver de monitor virtual (assinado) e de uma máquina Windows para testar; nada provado ainda.

### C: Wayland primeiro
**Contras:** cada compositor cria monitor virtual de um jeito; captura exige portal e confirmação do usuário.

## Análise
Começar onde dá para validar de ponta a ponta reduz risco: os spikes (Sunshine, Moonlight,
Tailscale) valem para todas as plataformas; só o "monitor virtual" muda.

## Consequências
- Fica mais fácil: provar o produto inteiro rápido.
- Fica mais difícil: nada; mas o núcleo **tem de isolar a plataforma** (`core/src/linux-x11/`) para Windows/Wayland entrarem como módulos irmãos.
- Rever: quando o Zorin/GNOME deixar de oferecer sessão X11.

## Ações
1. [x] Núcleo com pasta por plataforma (`core/src/linux-x11/`).
2. [ ] M5: spike de driver de monitor virtual no Windows.
3. [ ] M6: spike de monitor virtual no GNOME Wayland (mutter / portal ScreenCast).
