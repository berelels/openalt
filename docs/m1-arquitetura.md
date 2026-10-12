# M1: arquitetura do OpenAlt no PC (Linux X11)

Feito com a skill `engineering:system-design`. Base: `docs/briefing.md`, ADRs 0001–0009,
resultados do M0 (`docs/m0-resultados.md`). O que está marcado como **(provado)** foi testado de
verdade no M0; **(suposição)** ainda precisa de teste.

## 1. Requisitos

### Funcionais
1. **Instalar e abrir; um botão "Ligar".** Na primeira vez, "Preparar": confere/instala Sunshine (Flatpak) e a permissão do sistema (ajudante + polkit) com **um único** pedido de senha.
2. **Parear por QR:** o PC mostra um QR; o app Android escaneia e fica pareado. QR de **uso único** e **validade curta**.
3. **Dois modos:** "Nova tela" (monitor extra, ADR-0009) e "Espelhar" (ADR-0005). O celular escolhe ao conectar; o PC mostra qual está ativo.
4. **Posição do celular:** à direita/esquerda/acima/abaixo de qualquer monitor, alinhado no início/centro/fim, com ajuste fino. Muda a qualquer momento, sem senha (`display move`, provado no S13).
5. **Desligar a qualquer hora** (fecha a sessão, desliga o monitor, para o Sunshine).
6. **Áudio no celular e no PC** (padrão "áudio no host"; S2/S14).
7. **Diagnóstico honesto:** `display check` vira a tela "Este PC" — o que funciona aqui e por quê.
8. (M3) **Remoto:** detectar e guiar o Tailscale oficial.

### Não funcionais
- **Para qualquer pessoa:** 1–4+ monitores, GPUs e distros diferentes (`docs/compatibilidade.md`).
- **Segurança** (ADR-0006): credenciais aleatórias 0600 fora de logs; nada de serviço de rede sem o usuário pedir; QR de uso único; nunca alterar a configuração do Sunshine **da pessoa**.
- **Não atrapalhar:** ligar/desligar só pisca (S12c); sem rearranjar monitores (layout aplicado pelo GNOME).
- **pt-BR primeiro**, en/es depois. Acessibilidade AA, tudo por teclado.
- **Funciona sem internet** (fontes locais; a rede só para o streaming).

### Restrições
- Electron + TypeScript (ADR-0004); núcleo separado, sem depender da interface.
- Sunshine em Flatpak sem modificação (ADR-0002, ADR-0008). O Flatpak só enxerga o **home**: tudo o que o Sunshine chama precisa estar no home.
- Uma pessoa desenvolvendo; testes reais só no PC de testes (AMD/GNOME X11).

## 2. Visão geral

```
┌──────────────────────── PC (sessão do usuário) ─────────────────────────┐
│                                                                          │
│  ┌──────────── App OpenAlt (Electron) ────────────┐                      │
│  │ renderer (HTML/CSS, sem Node)                  │                      │
│  │      ▲  IPC tipado (contextBridge)             │                      │
│  │      ▼                                         │                      │
│  │ main: Controller ──── usa ──► @openalt/core    │                      │
│  └────────┬───────────────────────────┬───────────┘                      │
│           │ inicia/para (filho)       │ API local HTTPS 127.0.0.1:47990  │
│           ▼                           ▼ (usuário/senha do OpenAlt)        │
│  ┌──────── Sunshine (Flatpak, config PRÓPRIA do OpenAlt) ───────┐        │
│  │  prep-cmd do/undo ──► ~/.local/share/openalt/openalt-prep    │        │
│  └──────────────────────────────┬───────────────────────────────┘        │
│        flatpak-spawn --host     │                                        │
│                                 ▼                                        │
│              openalt-core display extend|mirror|down  ──► GNOME (D-Bus)  │
│                                 │ pkexec (polkit: sem senha após instalar)│
│                                 ▼                                        │
│              openalt-helper (root): conector on/detect + EDID            │
└──────────────────────────────────┬───────────────────────────────────────┘
                                   │ protocolo Moonlight (TCP 47984/47989/48010,
                                   │ UDP 47998-48000) — rede local ou Tailscale
                                   ▼
                   ┌──── App OpenAlt Android (fork do Moonlight) ────┐
                   │ escaneia QR → pareia → "Nova tela" / "Espelhar" │
                   └─────────────────────────────────────────────────┘
```

### Componentes
| Componente | Onde | Responsabilidade |
|---|---|---|
| **renderer** | Electron, sem Node, CSP rígida | telas; só fala com o main por IPC |
| **main / Controller** | Electron (Node) | estado do app; chama o núcleo; gerencia o processo do Sunshine; pareamento |
| **@openalt/core** | biblioteca + CLI | monitor virtual, layout, GNOME, Sunshine (config e API), Tailscale, QR, diagnóstico |
| **openalt-prep** | script em `~/.local/share/openalt/` | ponte chamada pelo Sunshine (dentro do Flatpak) → `flatpak-spawn --host` → CLI do núcleo (provado S2/S14) |
| **openalt-helper** | `/usr/libexec/openalt/` (root, polkit) | só: forçar conector livre + EDID; devolver ao automático (provado S12c) |
| **Sunshine** | Flatpak, **instância do OpenAlt** | captura, codificação, entrada, protocolo |
| **App Android** | fork do Moonlight (M2) | QR, pareamento, streaming, escolha do modo |

## 3. Decisões que este desenho traz

### D1. Sunshine com configuração **própria** do OpenAlt (nova ADR-0010)
Quem joga pode já usar o Sunshine. O OpenAlt **não toca** na configuração dele: inicia o Sunshine com
um arquivo de configuração próprio, que aponta `file_apps`, `file_state`, `credentials_file`, `cert`,
`pkey`, `log_path` para `~/.config/openalt/sunshine/` (opções confirmadas na interface do Sunshine 2026.914).
- Contra: se o Sunshine da pessoa estiver rodando, as portas colidem → detectar e explicar ("feche o seu Sunshine ou use…"). Porta alternativa: **suposição**, testar.
- O que fizemos no M0 na configuração padrão (backup em `.backup/`) vira só ambiente de teste.

### D2. Sem servidor HTTP local do OpenAlt (nova ADR-0011)
A interface é Electron: renderer ↔ main por **IPC** (`contextBridge`, `contextIsolation`, `sandbox`, sem `nodeIntegration`). Não há porta aberta pelo OpenAlt; a única interface local é a do **Sunshine**, já restrita ao PC (`origin_web_ui_allowed = pc`, provado: 403 pela rede) e com credenciais do OpenAlt.
Atende a exigência do briefing ("interface local só em 127.0.0.1 com token e checagem de Host") da forma mais forte: não existe interface local nossa para atacar.

### D3. Configurações num arquivo lido pelo `openalt-prep`
O Sunshine chama o `prep` sem o app estar envolvido, então posição, modo e opções ficam em
`~/.config/openalt/settings.json` (0600), lido pelo núcleo:
```json
{ "version": 1,
  "placement": { "anchor": "primary", "anchorName": "LG Electronics 27\"", "side": "right", "align": "start", "offset": 0 },
  "rememberLayout": false,
  "audioOnHost": true }
```
`anchor` guarda o conector (ex.: `DisplayPort-2`) e o nome do monitor; se o conector sumir (monitor trocado de porta), procura pelo nome; senão, usa o principal.

### D4. Dois apps no Sunshine: "Nova tela" e "Espelhar"
Registrados pelo OpenAlt no `apps.json` **dele**. O celular escolhe ao conectar; trocar de modo = reconectar.
`output_name` fica fixo na saída do monitor virtual (os dois modos usam a mesma, provado S4/Espelhar).
O id da saída é **descoberto** (ordem das saídas no X), não fixo em 0 como no M0.

### D5. Empacotamento: o núcleo é compilado para JS
No desenvolvimento o TypeScript roda direto (Node 24). No pacote, `tsc` gera JS e a CLI roda com
`ELECTRON_RUN_AS_NODE=1 <binário do app> core/cli.js` (sem depender de Node instalado). Revisa a ADR-0004.

## 4. Fluxos

### F1. Primeira vez ("Preparar")
```
App abre → display check + estado do Sunshine/permissão
  ├─ Sunshine Flatpak ausente → "Instalar Sunshine" (flatpak install --user, sem senha; pede confirmação)
  ├─ permissão ausente → "Instalar permissão" (1 senha: copia helper + política polkit)
  └─ cria ~/.config/openalt/ (0700): sunshine.conf, apps.json, credenciais aleatórias (0600),
     settings.json; instala ~/.local/share/openalt/openalt-prep
```
Nada disso inicia serviço de rede. Cada passo é um botão que a pessoa aperta.

### F2. "Ligar"
```
Ligar → core: retractDesktop (limpa sobras de queda) → checa portas livres
      → inicia Sunshine (filho do app, config do OpenAlt) → espera "Starting main loop"
      → estado "Pronto para conectar"; mostra QR se não houver aparelho pareado
```

### F3. Parear por QR (uso único, 2 min)
```
PC gera: pin (4 dígitos, CSPRNG), token (128 bits), validade (agora+120 s)
QR = openalt://pair?v=1&n=<nome do PC>&h=<IPs locais>,<IP/nome Tailscale>&p=47989
                   &fp=<SHA-256 do certificado do Sunshine>&pin=<pin>&d=<id do pedido>&exp=<unix>
Celular: conecta em h:p, confere o certificado = fp (senão aborta: PC falso)
       → inicia o pareamento Moonlight com devicename = "OpenAlt-<d>" e PIN = pin
PC (enquanto o QR está na tela): GET /api/pin a cada 1 s
       → pedido com nome "OpenAlt-<d>" e dentro da validade → POST /api/pin {pairing_id, pin}
       → invalida o QR (uso único) e gera outro se a pessoa quiser parear mais um aparelho
       → pedidos com outros nomes: ignorados e avisados ("outro aparelho tentou parear")
```
Por que é seguro: o PIN é o segredo do pareamento do Moonlight (um intruso que inicia um pedido sem
o PIN não completa o pareamento); o `fp` impede o celular de parear com um PC impostor; validade curta
e uso único limitam uma foto do QR. Pareamento automatizado provado no M0 (`GET/POST /api/pin`).

### F4. Conectar (celular → PC)
```
Celular escolhe "Nova tela" ou "Espelhar" → Sunshine executa prep "do"
  → openalt-prep → core display extend (lê settings.json: posição) | display mirror (--of anchor)
  → Sunshine captura a saída do monitor virtual e transmite
Desconectar → prep "undo" → core display down
```
Provado de ponta a ponta no S14 (com o Moonlight do PC).

### F5. Mudar a posição com o celular conectado
`settings.json` atualizado + `core display move` (só GNOME, sem senha; S13).

### F6. "Desligar"
`core display down` (se houver sessão) → para o Sunshine → estado "Desligado". Fechar o app = Desligar
(na v1; bandeja do sistema fica para depois).

## 5. API do núcleo usada pelo app (TypeScript)
```ts
check(): Assessment                          // display check
setup.status(): { sunshine, helper, config } // F1
setup.installSunshine() / installHelper() / writeConfig()
sunshine.start() / stop() / status()         // processo + API local
pairing.create(): { qr: string, expiresAt }  // F3; pairing.watch() emite eventos
pairing.devices() / unpair(id)
display.plan(placement) / move(placement)    // prévia e mudança de posição
settings.read() / write()
tailscale.status()                           // M3
```
O main expõe ao renderer só **ações de alto nível** (`ligar`, `desligar`, `parear`, `moverCelular`…),
nunca comandos ou caminhos.

## 6. Erros e recuperação
| Falha | Comportamento |
|---|---|
| App/PC cai com a "Nova tela" ligada | no próximo "Ligar" (e ao abrir o app), `retractDesktop` usa o registro de conectores forçados (provado) |
| `prep` falha | Sunshine cancela o início; o celular mostra o erro; o núcleo já desfez o que fez (provado S10) |
| GNOME não reconhece a saída / modo | tempo-limite → desfaz → mensagem com o motivo (provado S10) |
| Portas do Sunshine ocupadas | não inicia; explica (provável Sunshine da pessoa rodando) |
| Ajudante não instalado | "Nova tela" indisponível com botão "Instalar permissão"; "Espelhar" segue funcionando |
| Sem saída livre / GPU não testada | vem do `display check`; a interface mostra antes de tentar |

## 7. Escala e confiabilidade
É um app local, 1 PC ↔ 1–2 aparelhos; "escala" aqui é **diversidade de PCs**, não carga. Prioridades:
diagnóstico claro, limpeza garantida, nenhuma mudança persistente no sistema sem pedir (o `monitors.xml`
só muda com `--remember`).

## 8. Trade-offs
| Escolha | Ganho | Custo |
|---|---|---|
| Sunshine com config própria | não quebra o Sunshine de ninguém | colisão de portas a tratar |
| Sem HTTP local | zero superfície de ataque local nossa | o `prep` não fala com o app em tempo real (usa `settings.json`) |
| Sunshine como filho do app | "Ligar/Desligar" óbvios; nada rodando escondido | fechar o app desliga tudo (sem bandeja na v1) |
| PIN de 4 dígitos do Moonlight | compatível com o protocolo | entropia baixa; mitigado por uso único + 2 min + nome do pedido + `fp` (avaliar PIN maior no fork, M2) |
| Ajudante root mínimo | uma senha na instalação | código root a manter e revisar (`security-review` a cada marco) |

## 9. Rever quando crescer
- Bandeja do sistema / iniciar com a sessão (o briefing pede "nada sem o usuário pedir": só se ele ligar a opção).
- PIN mais longo no fork Android.
- Vários celulares ao mesmo tempo (dois monitores virtuais: DisplayPort-0 e -1).
- Wayland (M6) e Windows (M5): o `core` já separa por plataforma.

## 10. Suposições a testar no M1
1. Sunshine iniciado com arquivo de configuração próprio usa todos os caminhos indicados (inclusive credenciais e certificado).
2. Primeira configuração de credenciais pela API (`/api/password`) sem pôr a senha na linha de comando.
3. Descobrir o id da saída do monitor virtual para `output_name` em PCs com outra ordem de saídas.
4. `ELECTRON_RUN_AS_NODE` rodando a CLI empacotada (M4, mas o desenho depende disso).
