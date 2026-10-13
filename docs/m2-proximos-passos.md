# M2: o que decidir (13/10)

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
