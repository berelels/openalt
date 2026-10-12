# Compatibilidade: o que foi provado e o que é suposição

O OpenAlt é para **qualquer pessoa**. O PC de testes é só o primeiro caso. Este documento separa o
que foi **testado de verdade** do que é **suposição**, e é atualizado a cada teste.
No PC de cada pessoa, `openalt-core display check` diz o que funciona ali e por quê (a interface
mostra isso antes de tentar).

## Testado de verdade
| Item | Onde |
|---|---|
| Zorin OS 18.1, GNOME 46, **X11** | PC de testes |
| AMD RX 6600 (`amdgpu`), Mesa 26.2 | PC de testes |
| 2 monitores (1440x900 + 1920x1080), lado a lado | PC de testes |
| Sunshine 2026.914 em **Flatpak**, codificação VAAPI (H.264/HEVC) | PC de testes |
| Moonlight **PC** 6.2.0 como cliente (no mesmo PC) | PC de testes |
| "Nova tela" ligada e desligada **pelo Sunshine** (prep-cmd), captura só do monitor do celular | PC de testes |
| "Nova tela" pelo GNOME: conector forçado + **EDID do OpenAlt** + layout preservado, ligar e desligar sem travadas; posições à direita, entre os monitores, acima e abaixo; janela maximizada | PC de testes |

## Coberto só por testes de unidade (lógica certa, nunca visto num PC real)
- Layouts: 1 monitor (notebook), 2, 3 em fila com tamanhos diferentes e um girado, grade 2×2, monitor pequeno ao lado de um grande; celular à direita/esquerda/acima/abaixo de **qualquer** monitor, alinhado no início/centro/fim, com ajuste fino em pixels, inclusive **entre** monitores.
- Monitor girado 90° (troca largura e altura).
- Escala no modo lógico (Wayland com 200%).
- Duas placas de vídeo com conectores de mesmo número (recusa em vez de adivinhar).

## Suposições (não testadas; podem falhar)
| Situação | Expectativa | Risco |
|---|---|---|
| Intel (`i915`/`xe`) | o xrandr aceita modos em saída desconectada | médio |
| NVIDIA proprietário (`nvidia`) | o driver X da NVIDIA costuma **recusar** modos em saída sem monitor | **alto** |
| NVIDIA aberto (`nouveau`) | parecido com AMD | médio |
| Desligar com EDID fora da AMD | o desplugar simulado (`trigger_hotplug`) é do amdgpu; Intel/NVIDIA podem manter a saída conectada | **alto** |
| Notebook híbrido (Intel + NVIDIA/AMD) | saídas na placa secundária têm outros nomes | alto |
| Notebook sem saída livre (todas em uso, ou só a tela interna sem portas) | precisa de adaptador "dummy" | — |
| Dock/USB-C com MST (vários monitores num cabo) | conectores "DP-1-1" etc. | médio |
| Outras distros com GNOME X11 (Fedora, Debian, Pop!_OS 22.04) | igual ao Zorin | baixo |
| GNOME mais novo (47+) | API DisplayConfig estável há anos | baixo |
| KDE / XFCE / Cinnamon em X11 | "Espelhar" funciona; "Nova tela" não (precisa de integração própria com cada um) | — |
| **Wayland** (padrão no Ubuntu desde 22.04 e no Fedora) | **não funciona ainda** (M6) | — |
| Sunshine nativo (.deb) em vez de Flatpak | mais simples (sem `flatpak-spawn`) | baixo |
| HiDPI / escala 200% em X11 | escala global; layout em pixels físicos | médio |

## App Android (M2)
| Item | Estado |
|---|---|
| Moonlight Android 12.2 sem mudanças compila (NDK 29.0.14206865, compileSdk 37) | testado (GitHub Actions) |
| Leitura e validação do QR `openalt://pair` (validade, campos, ordem dos IPs, nome do cliente, `fp`) | só unidade (29 testes) |
| Pareamento por QR com confirmação automática no PC | suposição: falta o teste com aparelho |
| Conexão direta no app "OpenAlt" | suposição |
| Resolução nativa padrão em celulares e tablets (em pé ou deitados), Android 5 a 16 | suposição; o stream sai deitado como no Moonlight |
| Leitor de QR em aparelhos sem câmera traseira / TV | suposição (sem câmera: a tela explica e manda usar o +) |

## Observações que pesam no planejamento
- **Wayland é o padrão** no Ubuntu e no Fedora: boa parte das pessoas cai em "não suportado". Isso pede para rever a ordem dos marcos (M6 antes do M5?). Decisão do usuário.
- **NVIDIA proprietário** é comum entre quem joga: vale um spike cedo (precisa de alguém com a placa).
- Para testar em mais PCs: `openalt-core display check` + `display layout` são seguros (só leem). Pedir a voluntários a saída desses dois comandos.
