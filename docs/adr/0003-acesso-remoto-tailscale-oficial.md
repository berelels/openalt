# ADR-0003: Acesso remoto pela versão oficial do Tailscale (v1)

**Status:** Aceita (a premissa sobre o tsnet ainda NÃO foi testada; ver "Ações")
**Data:** 2026-10-12
**Decisores:** Catta Studios

## Contexto
Para jogar ou usar a tela fora de casa, o celular precisa alcançar o PC atrás do roteador
(provavelmente com CGNAT). O Moonlight usa várias portas diretas: TCP 47984, 47989 e 48010, e
UDP 47998–48000 e 48010. A latência importa muito.
Situação atual do PC: o `tailscale` já está instalado, mas **deslogado**.

## Decisão
Na v1, usar o **Tailscale oficial** no PC e no celular, com a conta do próprio usuário (login
com Google). O OpenAlt **detecta** se estão instalados e logados, **guia** a instalação e o login
(uma vez) e **confirma** que os dois aparelhos estão na mesma tailnet. Depois disso o Moonlight usa
o IP 100.x do PC como se fosse rede local.

## Opções consideradas

### A: Tailscale oficial nos dois aparelhos (escolhida)
| Dimensão | Avaliação |
|---|---|
| Complexidade | Baixa: o OpenAlt só detecta e orienta |
| Custo | Zero no plano pessoal |
| Desempenho | WireGuard no kernel (PC) e VpnService (Android); conexão direta quando o NAT deixa, relay DERP quando não deixa |
| Atrito | Médio: mais um app e um login no celular, uma vez só |

### B: Tailscale embutido (tsnet) no app Android
**Contras (por conhecimento, NÃO testado):** rede em userspace teria de carregar todo o tráfego UDP/TCP do Moonlight, o que é frágil e aumenta a latência; o core de rede do Moonlight (C) abre sockets próprios. Fica como spike M7.

### C: Headscale (servidor próprio)
**Contras:** precisa de servidor, manutenção e custo. Só se o app crescer.

### D: WebRTC com STUN/TURN
**Contras:** exige trocar o transporte do streaming, o que é incompatível com o Sunshine/Moonlight sem fork pesado. Pesquisa no M7.

### E: Abrir portas no roteador (UPnP)
**Contras:** expõe o Sunshine à internet e não funciona com CGNAT. Descartada.

## Análise
A tem o menor risco e o menor código, e o custo de atrito (instalar o Tailscale no celular) é
pago uma vez. O risco real é **desempenho por relay**: se a rede móvel impedir a conexão direta,
o tráfego passa pelo DERP, com latência e banda piores. Isso é o spike 6 e decide se a v1 é jogável fora de casa.

## Consequências
- Fica mais fácil: nada de servidor nosso nem de exposição de portas.
- Fica mais difícil: depender de um app de terceiros no celular e do estado de login dele.
- O OpenAlt **não** faz login no Tailscale pelo usuário e não lida com as credenciais dele.
- Rever: resultado do spike 6 (direta × relay, latência medida em 4G/5G).

## Ações
1. [ ] Spike 6: testar com o celular **em 4G/5G** (Wi-Fi desligado), medindo `tailscale ping`, se a conexão é direta ou por relay, e a latência no Moonlight.
2. [ ] M3: detecção do estado (`tailscale status --json`) e guia na interface.
3. [ ] M7: spike de tsnet embutido e de WebRTC.
