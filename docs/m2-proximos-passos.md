# M2: o que decidir (13/10)

> **Decidido e feito em 13/10** (o usuário aprovou as recomendações): som **A + B** e reinício pela
> **extensão (4)**. Detalhes e o que falta testar em "Feito em 13/10", no fim.

Dois problemas ficaram abertos no teste com o tablet. Abaixo estão as opções de cada um e a
recomendação.

## 1. O som só sai no tablet (opções "PC" e "Os dois" não funcionam)

**Causa provável** (registro de 13/10, 00:03):
- O Sunshine troca a saída padrão do PC pela dele **~0,5 s depois** de o aparelho conectar
  ("Setting default sink to: [sink-sunshine-stereo]").
- O app esperava só a saída do Sunshine *existir* e já devolvia a saída para o fone. Ela passa a
  existir antes da troca, então o Sunshine trocava logo depois e ganhava.
- O loopback do "Os dois" não chegou a ser criado.

| Opção | Como | A favor | Contra |
|---|---|---|---|
| **A. Corrigir a corrida** | Esperar a saída padrão *virar* a do Sunshine e só então aplicar a escolha; conferir a cada 2 s enquanto conectado | Vale na hora; funciona com qualquer cliente | Depende de os apps seguirem a saída padrão do PipeWire (a maioria segue; app com saída fixa não segue) |
| **B. "PC" pelo Sunshine** | `stream_audio = disabled` ao ligar; se a pessoa mudar sem aparelho conectado, o app religa o Sunshine sozinho | À prova de corrida: o Sunshine nem mexe no som | Só vale ao (re)ligar o Sunshine |
| **C. "Os dois" pelo cliente** | O app Android pede "tocar no PC" (`playAudioOnHost` do protocolo Moonlight). O Sunshine então toca no PC **e** transmite, sem loopback | O jeito oficial do Sunshine, sem truque | O app Android precisa saber a escolha. Ela iria para o app do tablet ("Som: aqui / no PC / nos dois"); hoje a escolha está no PC |

**Recomendação:** **A + B agora** (corrigir a corrida e usar o `stream_audio` para o "PC").
Avaliar **C** se o loopback do "Os dois" ficar com atraso ou eco.

## 2. A caixa do Alt+F2 que aparece para reiniciar o GNOME

Hoje o app digita Alt+F2 → r → Enter. Funciona e é conferido pelo D-Bus. Mas a caixa aparece por
~1 s, e a pessoa pode clicar ou digitar nela no meio.

| Opção | Como | A favor | Contra |
|---|---|---|---|
| **1. Bloquear mouse e teclado** | `xinput disable` por ~2 s, com um timer do systemd que religa de qualquer jeito | A pessoa não interfere | A caixa ainda aparece; se algo falhar, mouse e teclado ficam mortos por alguns segundos (assusta) |
| **2. Cobrir com um aviso** | Janela do OpenAlt por cima ("Ajustando os monitores…") | Explica o que está acontecendo | A caixa do GNOME fica acima de qualquer janela; não esconde nem bloqueia |
| **3. Achar o que quebra o papel de parede** | Testar com as extensões desligadas. No registro há erros do **blur-my-shell** a cada troca de monitor (`on_window_actor_removed … undefined`) | Se for uma extensão, basta recarregá-la; sem reinício | Investigação; pode ser do próprio GNOME no X11 |
| **4. Extensão "OpenAlt" do GNOME** (recomendado) | Uma extensão pequena nossa, instalada junto com o app, com um método D-Bus (`RefreshMonitors`). Ela roda **dentro** do GNOME: refaz os fundos (`Main.layoutManager`) e, se precisar, reinicia o Shell (`Meta.restart`) **sem caixa e sem teclado** | Invisível; nada de digitar; funciona igual para todo mundo; serve depois no Wayland (lá não dá para reiniciar, mas dá para refazer os fundos) | É uma extensão a manter a cada versão do GNOME (45–48+). Instalar uma extensão nova exige reiniciar o GNOME **uma vez** (o instalador faz no fim) |

**Recomendação:** **4**, com o **3** antes, para saber exatamente o que refazer: se só os fundos, nem
precisa reiniciar. Enquanto isso, o Alt+F2 atual fica como reserva.

## Outros pontos em aberto (já no m2-resultados.md)
- Vídeo do Brave/Chrome travando no monitor virtual: falta um teste controlado.
- Cursor duplicado na borda (bug do Sunshine na captura X11).
- Mensagem clara para o erro 409 (pareamento aberto no Moonlight original).

## Feito em 13/10 (falta testar com o tablet)

**Som** (`core/src/audio.ts`, `AudioRouter`; 8 testes com um PulseAudio de mentira que reproduz a corrida):
- "PC": o Sunshine liga com `stream_audio = disabled`, então não transmite som nem troca a saída. Se
  a pessoa escolher "PC" com o aparelho já conectado, o app devolve a saída para a do PC sempre que
  ela virar a do Sunshine (confere a cada 1 s).
- "Aparelho" e "Os dois": o app espera a saída do Sunshine existir. "Os dois" mantém UMA cópia
  (loopback) para a saída real do PC; se alguém a desligar, ela é religada.
- Trocar a escolha sem aparelho conectado religa o Sunshine na hora, com novo QR. Se o Sunshine
  ligou sem som e a pessoa pedir som no aparelho com ele conectado, a tela avisa "desconecte e
  conecte de novo", e o app religa o Sunshine assim que o aparelho sai.
- Se a pessoa trocar a saída real (fone → caixa) no GNOME, essa passa a ser "a do PC".
- Confirmado no código do Sunshine (`src/audio.cpp`): com `stream_audio` desligado, a captura
  retorna antes de mexer na saída.

**Reinício do GNOME sem a caixa** (`core/gnome-shell/openalt@cattastudios.dev`, `core/src/linux-x11/shell-helper.ts`; 5 testes):
- O que a extensão faz:
  - Registra no D-Bus `dev.cattastudios.OpenAlt.Shell`, com `Restart`, `RefreshBackgrounds` e as
    propriedades `Version` e `CanRestart`.
  - `Restart` chama o mesmo `Meta.restart` do Alt+F2 → r, mas só até 60 s depois de um monitor
    entrar ou sair, e uma vez por troca. Assim, outro programa não consegue reiniciar o GNOME à toa.
- Instalação pelo app:
  - Ao Ligar (GNOME no X11), copia a extensão para `~/.local/share/gnome-shell/extensions` e a põe
    nas extensões ligadas, sem perder as da pessoa.
  - Não liga se a pessoa desligou a extensão ou todas as extensões.
  - O GNOME só carrega extensões novas ao reiniciar: o **1º** reinício ainda é pelo Alt+F2, e ele
    já carrega a extensão. Do 2º em diante, nenhuma caixa aparece.
- `restartShell` (desktop/src/main/main.ts) tenta a extensão primeiro e confere pela troca do dono
  `org.gnome.Shell` no D-Bus. Se a extensão não responder, usa o Alt+F2.

**Não testado:**
- A extensão rodando no GNOME de verdade. A tentativa num GNOME isolado (Xvfb +
  `dbus-run-session`) não carregou a extensão e, pior, gravou no dconf real (ver o incidente abaixo).
- O som com o tablet: os três modos, mais a troca com o aparelho conectado.
- `RefreshBackgrounds` (opção 3): testar com a pessoa presente, logo depois de conectar, antes do
  reinício, para ver se basta para o papel de parede voltar.

**Incidente:**
- No teste isolado, o `gsettings set` foi parar no dconf real: a lista de extensões ligadas ficou
  só `['openalt@cattastudios.dev']` **no disco**. A sessão ao vivo não mudou.
- A restauração é um comando `gsettings set` com a lista original (está na conversa de 13/10).
