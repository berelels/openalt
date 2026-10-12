# Teste no Windows (para amigos) — base do OpenAlt

O OpenAlt para Windows ainda não existe (é o marco M5). Este teste usa as **mesmas peças**
que o OpenAlt vai automatizar e mostra se elas funcionam no seu PC. Leva uns 15 minutos.

Precisa de: PC com Windows 10 ou 11, celular ou tablet Android **no mesmo Wi-Fi** do PC
(de preferência 5 GHz, ou o PC no cabo).

## Parte 1 — Espelhar e jogar (Sunshine oficial)

1. No PC, baixe o **Sunshine** só da página oficial: <https://github.com/LizardByte/Sunshine/releases>
   (arquivo `sunshine-windows-installer.exe`). Instale com as opções padrão.
2. Se o Windows perguntar sobre o firewall, permita em **redes privadas**.
3. O Sunshine abre uma página no navegador (`https://localhost:47990`). Aceite o aviso de
   certificado (é o do seu próprio PC) e crie um usuário e uma senha.
4. No celular, instale o **Moonlight Game Streaming** pela Play Store.
5. Abra o Moonlight. O PC deve aparecer sozinho. Se não aparecer, toque em **+** e digite o
   IP do PC (no PC: `Win+R` → `cmd` → `ipconfig` → "Endereço IPv4").
6. Toque no PC: o Moonlight mostra um **PIN**. No navegador do PC, vá em **PIN**, digite o
   número e um nome para o aparelho.
7. No Moonlight, ajuste em ⚙️ **Configurações → Resolução → a nativa do aparelho** e 60 FPS.
8. Toque em **Desktop**: o celular espelha a tela do PC. Teste também um jogo
   (Steam → "Big Picture", ou adicione o jogo em **Applications** no Sunshine).
9. Para sair: volte no Moonlight, segure o app e escolha **Encerrar sessão**.

## Parte 2 (opcional) — Nova tela (o celular como monitor extra)

O Windows precisa de um "monitor virtual". O jeito mais simples hoje é o **Apollo**, uma
versão do Sunshine que já traz isso: <https://github.com/ClassicOldSong/Apollo/releases>.
Desinstale o Sunshine antes (os dois usam as mesmas portas). Instale, pareie igual à
Parte 1 e conecte: o Windows ganha uma tela nova do tamanho do celular. Em
**Configurações → Sistema → Tela** dá para arrastar a tela nova para o lado que quiser.

Baixe só das páginas oficiais acima, nada de sites de terceiros.

## O que me mandar

Copie e preencha:

```
Windows: 10 / 11 (versão: ...)
Placa de vídeo: (Gerenciador de Dispositivos → Adaptadores de vídeo)
Monitores do PC: quantos e de que tamanho
Aparelho: modelo, celular ou tablet
Rede: Wi-Fi 2.4 / 5 GHz / PC no cabo
Parte 1 – espelhou? [sim/não]  travou? [nada / às vezes / muito]
         toque mexeu o mouse? [sim/não]   som saiu no celular? [sim/não]
         jogo rodou bem? [sim/não, qual]
Parte 2 – apareceu a tela nova? [sim/não]  deu para pôr do lado que queria? [sim/não]
         ao desconectar, a tela sumiu sozinha? [sim/não]
Algo estranho / mensagens de erro (foto ajuda):
```

Antes de conectar, ative no Moonlight ⚙️ **Configurações → mostrar estatísticas de
desempenho**: aparece a latência na tela. Mande uma foto disso também.
