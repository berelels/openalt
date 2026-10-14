# M3: acesso remoto pelo Tailscale oficial (arquitetura)

Feito com a skill `engineering:system-design`. Base: ADR-0003 (Tailscale oficial), ADR-0006
(segurança), ADR-0012 (app Android). **(provado)** = conferido em código ou teste;
**(suposição)** = falta testar.

## 1. Requisitos

### Funcionais
1. **Detectar** no PC: Tailscale instalado? serviço rodando? logado? IP 100.x? O aparelho está na
   mesma tailnet e online?
2. **Guiar** o que falta, um passo por vez, sem o OpenAlt fazer login nem tocar em credenciais.
3. **Parear em casa, usar fora:** o pareamento por QR continua sendo na frente do PC. O aparelho
   precisa guardar o endereço 100.x para alcançar o PC fora de casa.
4. **Conectar fora de casa** sem passo extra, e dizer se a conexão é **direta** ou **por relay (DERP)**.
5. **Diagnóstico** na tela "Este PC": "Fora de casa: pronto / falta X".

### Não funcionais
- Latência: direta ≈ rede da operadora; relay pode ficar ruim para jogo (spike 6 mede).
- Segurança: nada novo exposto à internet; nada de serviço iniciado sem a pessoa pedir.
- Qualquer distro: o Tailscale pode vir de pacotes diferentes; em alguns sistemas o `tailscale` CLI
  pede `sudo` para `up` (o OpenAlt só **lê** o estado, sem sudo).

### Restrições
- Tailscale oficial nos dois aparelhos (ADR-0003). Sunshine sem modificação (ADR-0002).
- Mudanças em arquivos do Moonlight mínimas e marcadas com "OpenAlt:".

## 2. Visão geral

```
            em casa (Wi-Fi)                              fora de casa (4G/5G)
 ┌──────── PC ────────┐                         ┌──────── PC ────────┐
 │ OpenAlt  ─ lê ─►  tailscale status --json    │ Sunshine :47984…   │
 │ Sunshine :47984…   │                         │ tailscale0 100.a   │
 │ wlan 192.168.x     │                         └─────────▲──────────┘
 │ tailscale0 100.a   │                                   │ WireGuard (direta ou DERP)
 └───▲────────────────┘                         ┌─────────┴──────────┐
     │ QR: hosts=[192.168.x, 100.a], fp, pin    │ Android: Tailscale │
 ┌───┴────────────────┐                         │ app + OpenAlt      │
 │ Android: lê QR,    │ ── guarda LAN e 100.a ─►│ conecta em 100.a   │
 │ pareia pela LAN    │                         └────────────────────┘
 └────────────────────┘
```

## 3. Detalhes

### 3.1 Detecção no PC (`core/src/tailscale.ts`, novo)
`execFile('tailscale', ['status', '--json'])`, sem shell, com timeout. Estados:

| Estado | Como se reconhece | O que a tela diz |
|---|---|---|
| `missing` | ENOENT | "Instale o Tailscale" + link oficial por distro |
| `stopped` | erro de socket do `tailscaled` | "O serviço do Tailscale está parado" (comando para a pessoa rodar) |
| `needs-login` | `BackendState = NeedsLogin` | "Entre na sua conta Tailscale" (`tailscale up` / app oficial) |
| `running` | `BackendState = Running` + `Self.TailscaleIPs` | IP 100.x e lista de aparelhos |

- Aparelho na tailnet: `Peer[*]` com `OS = android` (ou `iOS`), `Online`, nome. Sem associar
  automaticamente: mostra a lista; o par é confirmado quando o aparelho pareado conecta pelo 100.x.
- Direta × relay: `Peer.CurAddr` preenchido = direta; vazio com `Relay` = DERP. Vale só com tráfego
  recente; durante o streaming, conferir a cada 5 s.
- PC de testes hoje: Tailscale 1.104.1 instalado, `NeedsLogin` **(provado, 13/10)**.
- Saída para a interface: chaves (`UiText`), nunca frases; pt/es/en.

### 3.2 Sunshine
- O Sunshine trata **100.64.0.0/10 como LAN** (`src/network.cpp`, `lan_ips_v4`) **(provado no
  código)**. Consequência: as regras de "só LAN" valem pela tailnet, e a criptografia do vídeo segue
  `lan_encryption_mode` (padrão desligada); o túnel WireGuard já cifra tudo.
- Risco: um PC ligado **direto** a uma operadora com CGNAT (IP 100.x público, sem roteador) seria
  tratado como LAN. Raro; pareamento continua exigindo o QR. Registrar em `compatibilidade.md`.
- Nenhuma porta aberta no roteador. O Sunshine continua escutando em todas as interfaces.

### 3.3 Endereços no Android (o ponto principal do M3)
Hoje `PairQrActivity` guarda só **um** endereço (`manualAddress` = o primeiro que respondeu, a LAN).
Problemas **(provado no código)**:
- `remoteAddress` é sobrescrito pelo `ExternalIP` do Sunshine/STUN (IP público; inútil com CGNAT).
- `localAddress` vem do `LocalIP` do Sunshine, que é o endereço **em que a pergunta chegou**: se o
  poll for pelo 100.x, o LAN se perde.
- Resultado: fora de casa o app só tenta a LAN e o IP público, e **não conecta**.

| Opção | Como | A favor | Contra |
|---|---|---|---|
| **A. `manualAddress` = 100.x** | Ao parear, se o QR tem um 100.x, guardar ele como manual; a LAN entra como `localAddress` pelo poll | 1 arquivo nosso, nenhum do Moonlight | Se o poll for pelo 100.x, o `localAddress` vira 100.x; em casa com o Tailscale desligado, não conecta |
| **B. Lista de endereços do OpenAlt** (recomendado) | Tabela própria (uuid → LAN + 100.x do QR). O poll do Moonlight ganha uma tupla extra a partir dela (mudança pequena em `ComputerManagerService`, marcada "OpenAlt:") | Funciona em casa sem Tailscale e fora com ele; a LAN tem prioridade | Toca um arquivo do Moonlight |
| C. Pedir o IP 100.x à mão | Campo "Adicionar PC" do Moonlight | Nada a codar | Atrito; foge do "sem digitar" |

**Recomendação:** B. A ordem de prioridade do poll fica LAN → 100.x → resto, como o QR já faz.

### 3.4 Segurança (ADR-0006)
- O OpenAlt não roda `tailscale up/login`, não lê chaves nem `tailscaled.state`.
- QR continua de uso único e 2 min; só vale na frente do PC.
- Tailnet compartilhada (família/amigos): qualquer aparelho dela alcança as portas do Sunshine.
  Pareamento ainda é obrigatório; sugerir ACL do Tailscale no guia (opcional).
- `security-review` antes de fechar o M3.

### 3.5 Erros e mensagens
- Fora de casa e PC desligado / OpenAlt desligado: "Não achei o PC. Ele está ligado, com o OpenAlt
  ligado e o Tailscale conectado?"
- Aparelho sem Tailscale ligado: o Android não tem rota para 100.x. Detectar (`VpnService` ativo
  ou `NetHelper.isActiveNetworkVpn`) e dizer "Ligue o Tailscale no aparelho".
- Relay: aviso suave "Conexão indireta: pode ter atraso", com sugestão de baixar a qualidade.

## 4. Testes
- Unidade (PC): parser do `status --json` com amostras de cada estado (incluindo sem peers,
  vários IPs, IPv6), executor falso.
- Unidade (Android): escolha/ordem de endereços; persistência da lista.
- Real (spike 6, precisa do tablet e de login no Tailscale; **pedir confirmação**):
  1. Em casa, Wi-Fi, Tailscale nos dois: pareia e conecta pela LAN.
  2. Tablet em 4G/5G (Wi-Fi desligado): conecta pelo 100.x; medir `tailscale ping`, direta × DERP,
     latência e quadros perdidos no Moonlight.
  3. Em casa com o Tailscale do tablet desligado: ainda conecta pela LAN.

## 5. Ordem de trabalho
1. `core/src/tailscale.ts` + testes (só leitura; nada no sistema).
2. Cartão "Fora de casa" na interface do PC + `display check`.
3. Android: lista de endereços (opção B) + mensagens; build no GitHub Actions.
4. Spike 6 com o tablet (depende de você: login no Tailscale nos dois aparelhos).
5. ADR-0013 com a decisão de endereços e o resultado do spike; `security-review`.

## 6. Rever depois
- Se o relay for ruim em 4G/5G: M7 (tsnet embutido / WebRTC) ganha prioridade.
- Wake-on-LAN pela tailnet (PC dormindo) não é coberto.
- iOS fora do escopo.
