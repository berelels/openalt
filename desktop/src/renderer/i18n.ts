// Textos da interface em pt-BR, espanhol e inglês. O idioma é o do sistema (navigator.languages,
// que o Electron tira do LANG/LC_* do PC); se não for nenhum dos três, inglês. A pessoa pode trocar
// na aba Sobre (guardado neste PC, como o tema).
// Valores: "{nome}" no texto é trocado pelo valor (já escapado por quem chama, quando vem de fora).

type Lang = 'pt' | 'es' | 'en';
type LangPref = Lang | 'system';
type Dict = Record<string, string>;

const LANGS: Lang[] = ['pt', 'es', 'en'];
const HTML_LANG: Record<Lang, string> = { pt: 'pt-BR', es: 'es', en: 'en' };
/** Nome de cada idioma nele mesmo (o seletor mostra assim, em qualquer idioma). */
const LANG_NAME: Record<Lang, string> = { pt: 'Português', es: 'Español', en: 'English' };

const PT: Dict = {
  // trilho e tema (index.html)
  'nav.label': 'Navegação', 'nav.home': 'Painel', 'nav.devices': 'Aparelhos', 'nav.pc': 'Este PC', 'nav.about': 'Sobre',
  'theme.label': 'Tema', 'theme.light': 'Tema claro', 'theme.system': 'Tema automático', 'theme.dark': 'Tema escuro',

  // o aparelho dentro das frases
  'dev.generic': 'o aparelho', 'dev.phone': 'o celular', 'dev.tablet': 'o tablet',
  'kind.phone': 'Celular', 'kind.tablet': 'Tablet',
  'orient.auto': 'Automática', 'orient.portrait': 'Em pé', 'orient.landscape': 'Deitado',
  'orient.portrait.lc': 'em pé', 'orient.landscape.lc': 'deitado',
  'side.right': 'À direita', 'side.left': 'À esquerda', 'side.above': 'Acima', 'side.below': 'Abaixo',
  'place.at.right': 'À direita de {m}', 'place.at.left': 'À esquerda de {m}', 'place.at.above': 'Acima de {m}', 'place.at.below': 'Abaixo de {m}',
  'align.top': 'Topo', 'align.middle': 'Centro', 'align.bottom': 'Base', 'align.left': 'Esquerda', 'align.right': 'Direita',

  // topo
  'net.local': 'Rede local', 'net.away': 'Fora de casa',
  'top.pcChecks': 'O que funciona neste PC', 'top.fullscreen': 'Tela cheia (F11)', 'top.toTray': 'Continuar em segundo plano (bandeja do sistema)', 'tray.show': 'Mostrar o OpenAlt', 'tray.quit': 'Sair do OpenAlt', 'top.exitFullscreen': 'Sair da tela cheia (Esc)',

  // conexão
  'conn.title': 'Conexão',
  'conn.setup': 'Preparar', 'conn.setup.sub': 'Primeira vez neste PC',
  'conn.off': 'Desligado', 'conn.off.sub': 'Nada ligado sem você pedir',
  'conn.starting': 'Ligando…', 'conn.starting.sub': 'Iniciando o Sunshine',
  'conn.waiting': 'Esperando', 'conn.waiting.sub': 'Escaneie o código com {dev}',
  'conn.connected': 'Conectado', 'conn.mirroring': 'Espelhando {m}', 'conn.extra': 'Mais uma tela',
  'stat.resolution': 'resolução', 'stat.rate': 'taxa', 'stat.connection': 'conexão', 'stat.remote': 'Remota', 'stat.local': 'Local',
  'stat.monitor': 'monitor', 'stat.monitors': 'monitores', 'stat.mode': 'modo',
  'stat.mirror': 'Espelho', 'stat.new': 'Nova',
  'power.on': 'Ligar', 'power.off': 'Desligar',

  // modo
  'mode.title': 'Modo', 'mode.extend': 'Nova tela', 'mode.extend.hint': 'Um monitor a mais',
  'mode.mirror': 'Espelhar', 'mode.mirror.hint': 'Mostra um monitor',

  // pareamento
  'pair.title': 'Parear', 'pair.hint': 'App OpenAlt → “Parear” → aponte para o código',
  'pair.qrAria': 'Código QR de pareamento', 'pair.expired': 'Código vencido',
  'pair.validFor': 'Vale por {t} · uma vez só', 'pair.newCode': 'Gerar outro',
  'pair.network': 'Mesmo Wi-Fi deste PC, ou Tailscale para fora de casa.',
  'pair.pinLabel': 'Usando o Moonlight? Digite o PIN que ele mostra:',
  'pair.namePlaceholder': 'Nome (ex.: Tablet)', 'pair.nameAria': 'Nome do aparelho (opcional)', 'pair.submit': 'Parear',
  'pair.address': 'Endereço deste PC: {a}',
  'pin.format': 'O PIN tem 4 números.', 'pin.turnOn': 'Ligue o OpenAlt primeiro.',
  'pin.noRequest': 'Nenhum pedido ainda. No Moonlight, toque neste PC para aparecer o PIN.',
  'pin.ok': 'Pareado! No Moonlight, toque em “OpenAlt”.', 'pin.rejected': 'PIN não aceito. Confira e tente de novo.',

  // vitrine do aparelho
  'show.connected': 'Conectado', 'show.preview': 'Prévia', 'show.pairedAria': 'Ver aparelhos pareados',
  'show.none': 'Nenhum aparelho', 'show.estimated': '(estimado)', 'show.kindAria': 'Tipo de aparelho na prévia',

  // preferências
  'prefs.title': 'Como {dev} fica', 'prefs.hint': 'A orientação vale a partir da próxima conexão.',
  'prefs.orientation': 'Orientação',
  'prefs.maximize': 'Maximizar janelas em {dev}', 'prefs.maximize.hint': 'Ao levar uma janela para a Nova tela',
  'prefs.remember': 'Lembrar o arranjo', 'prefs.remember.hint': 'Menos piscadas; grava no GNOME',

  // posição
  'place.mirrorTitle': 'O que {dev} espelha', 'place.title': 'Onde {dev} fica',
  'place.mirrorHint': 'Escolha o monitor; ele aparece igualzinho no aparelho.',
  'place.liveHint': 'Muda na hora, sem senha. Clique num monitor e escolha o lado.',
  'place.hint': 'Clique num monitor e escolha o lado. Vale para a próxima conexão.',
  'place.mirrorOf': 'Monitor espelhado', 'place.anchor': 'Ao lado de qual monitor',
  'place.stageAria': 'Prévia da área de trabalho', 'place.side': 'Lado', 'place.align': 'Alinhar',
  'place.mirrorMsg': '{Dev} vai mostrar {m}.', 'place.tryOther': '{err}. Tente outro lado ou alinhamento.',
  'place.estimated': ' · tamanho estimado; o certo vem do aparelho ao conectar',
  'place.tileAria': '{name}, {w} por {h}', 'place.tilePrimaryAria': '{name}, principal, {w} por {h}',
  'place.deviceAria': '{kind}, {w} por {h}',

  // aparelhos pareados
  'devs.title': 'Aparelhos pareados', 'devs.hint': 'Celulares e tablets que já escanearam o código deste PC.',
  'devs.device': 'Aparelho', 'devs.resolution': 'Resolução', 'devs.orientation': 'Orientação', 'devs.network': 'Rede',
  'devs.lastSeen': 'Última vez', 'devs.actions': 'Ações', 'devs.now': 'Agora', 'devs.forget': 'Esquecer', 'devs.forgetAria': 'Esquecer {name}',
  'devs.empty': 'Nenhum ainda. Ligue e escaneie o código com o app OpenAlt.',

  // painel
  'home.off': 'Celular ou tablet como mais uma tela — ou espelho deste PC.',
  'home.starting': 'Ligando…', 'home.waiting': 'Ligado · esperando {dev}', 'home.connected': '{name} conectado · {mode}',

  // primeira vez
  'setup.title': 'Vamos preparar <em>este PC</em>', 'setup.sub': 'Dois passos, uma vez só. Nada muda sem você apertar o botão.',
  'setup.sunshine.ok': 'Instalado. O OpenAlt usa uma configuração só dele; a sua fica intacta.',
  'setup.sunshine.todo': 'O programa que transmite a tela. Pelo Flathub, sem senha.',
  'setup.helper': 'Permissão do sistema', 'setup.helper.ok': 'Instalada. Ligar e desligar não pede mais senha.',
  'setup.helper.todo': 'Para criar o monitor do aparelho. Pede sua senha uma vez. “Espelhar” funciona sem ela.',
  'setup.away': 'Fora de casa', 'setup.away.text': 'Opcional: Tailscale no PC e no aparelho. Dá para fazer depois.',
  'remote.title': 'Fora de casa', 'remote.checking': 'Conferindo o Tailscale…',
  'remote.hint': 'Para usar o aparelho longe de casa, o PC e ele precisam do Tailscale, gratuito, com a sua conta.',
  'remote.auto': 'Este cartão se atualiza sozinho: é só fazer o passo que falta.',
  'remote.pill.install': 'Falta instalar', 'remote.pill.login': 'Falta entrar', 'remote.pill.stopped': 'Tailscale parado',
  'remote.pill.ready': 'Pronto', 'remote.pill.relay': 'Indireta',
  'remote.step.install': 'Instalar no PC', 'remote.step.install.ok': 'O Tailscale está instalado.', 'remote.step.install.todo': 'Baixe pelo site oficial e volte aqui.',
  'remote.howInstall': 'Como instalar',
  'remote.step.login': 'Entrar na conta', 'remote.step.login.text': 'O PC pede a senha dele e o login abre no navegador. O OpenAlt nunca vê a senha da sua conta.',
  'remote.step.start': 'Ligar o Tailscale', 'remote.step.start.text': 'O serviço do Tailscale está parado. O PC pede a senha dele, liga o serviço e abre o login no navegador.',
  'remote.signin': 'Entrar', 'remote.signin.start': 'Ligar e entrar', 'remote.signin.waiting': 'Aguardando…',
  'remote.signin.browser': 'Digite a senha do PC, se ela for pedida, e entre na sua conta no navegador que vai abrir.',
  'remote.signin.ok': 'Pronto: o Tailscale está ligado.', 'remote.signin.nothing': 'Nada a fazer: o Tailscale já está ligado.',
  'remote.signin.busy': 'O login já está em andamento.', 'remote.signin.cancelled': 'Cancelado. Toque em Entrar para tentar de novo.',
  'remote.signin.failed': 'Não deu certo. Tente de novo, ou rode o comando abaixo no terminal.',
  'remote.orTerminal': 'Ou no terminal:',
  'remote.copy': 'Copiar', 'remote.copied': 'Copiado',
  'remote.step.device': 'Instalar no aparelho', 'remote.step.device.text': 'Instale o app do Tailscale no aparelho e entre na mesma conta.',
  'remote.getDevice': 'Baixar no aparelho',
  'remote.ready': 'Longe de casa, o aparelho acha este PC sozinho e espelha a tela (a Nova tela é só na mesma rede). Pareie em casa uma vez.',
  'remote.relay': 'O aparelho está conectado por um servidor intermediário do Tailscale. Pode ter atraso: para jogar, baixe a qualidade no aparelho.',
  'remote.pcAddress': 'Endereço deste PC', 'remote.devices': 'Aparelhos na sua conta',
  'remote.noDevice': 'Nenhum celular ou tablet na sua conta ainda. Instale o Tailscale no aparelho e entre na mesma conta.',
  'remote.dev.online': 'Online', 'remote.dev.offline': 'Desligado', 'remote.dev.relay': 'Indireta',
  'setup.install': 'Instalar', 'setup.seePc': 'Ver este PC', 'setup.continue': 'Continuar',

  // aparelhos / este PC
  'devices.title': '<em>Aparelhos</em>', 'devices.sub': 'Celulares e tablets pareados com este PC.',
  'pc.title': 'Este <em>PC</em>', 'pc.sub': 'O OpenAlt é para qualquer PC, mas cada um é de um jeito. Isto vale para este.',
  'pc.summary': 'Resumo', 'pc.summary.text': '“Nova tela” e “Espelhar” funcionam aqui',
  'check.session': 'Sessão', 'check.desktop': 'Área de trabalho', 'check.gpu': 'Placa de vídeo', 'check.multi-gpu': 'Várias placas',
  'check.free-output': 'Saída de vídeo livre', 'check.connector': 'Identificação da saída', 'check.helper': 'Permissão do sistema',
  'env.session.ok': 'Sessão X11.',
  'env.session.bad': 'Sessão "{session}": por enquanto o OpenAlt funciona só em X11 (Wayland está nos planos).',
  'env.desktop.ok': 'Área de trabalho GNOME.', 'env.desktop.mute': 'GNOME detectado, mas ele não respondeu sobre os monitores.',
  'env.desktop.bad': 'Área de trabalho "{desktop}": a "Nova tela" por enquanto só funciona no GNOME.',
  'env.gpu.unknown': 'Placa de vídeo não identificada.',
  'env.gpu.untested': 'Placa de vídeo ({drivers}) ainda não testada com o OpenAlt; pode funcionar.',
  'env.gpu.ok': 'Placa de vídeo testada ({drivers}).',
  'env.multi-gpu.untested': 'Mais de uma placa de vídeo: combinação ainda não testada.',
  'env.free-output.ok': 'Saída de vídeo livre: {output}.',
  'env.free-output.bad': 'Nenhuma saída de vídeo livre (todas em uso). Um adaptador "dummy" HDMI/DisplayPort resolve.',
  'env.connector.ok': 'Saída livre identificada no sistema.',
  'env.connector.bad': 'Não foi possível identificar com segurança a saída livre no sistema.',
  'env.helper.ok': 'Permissão do sistema instalada.',
  'env.helper.missing': 'Falta instalar a permissão do sistema (pedida uma vez, na instalação).',

  // sobre
  'about.title': 'Sobre o <em>OpenAlt</em>',
  'about.sub': 'Celular ou tablet como monitor extra, espelho ou tela de jogo. Código aberto (GPL-3.0).',
  'about.catta': 'Feito com carinho, para qualquer pessoa.', 'about.cattaSite': 'Site da Catta Studios',
  'about.ours': 'OpenAlt', 'about.ours.text': 'O código deste app e do app do celular. Este é o nosso repositório.',
  'about.sunshine': 'Transmissão da tela, por LizardByte (GPL-3.0). Usado sem modificações.',
  'about.moonlight': 'O app do celular e do tablet é um fork do Moonlight Android (GPL-3.0).',
  'about.common': 'Protocolo de transmissão usado pelo Moonlight (GPL-3.0).',
  'about.tailscale': 'Acesso fora de casa, com a sua conta.',
  'about.repo': 'Repositório', 'about.openAria': 'Abrir {name} no navegador',
  'about.language': 'Idioma', 'about.language.hint': 'O padrão é o idioma do sistema.', 'lang.system': 'Do sistema',

  // erros que vêm do processo principal
  'err.sunshineExited': 'O Sunshine fechou sozinho.',
  'err.pairRejected': 'O pareamento não foi aceito. Gere outro código e tente de novo.',
  'err.forget': 'Não deu para esquecer o aparelho: {detail}',
  'err.helperCancelled': 'A permissão não foi instalada: a senha foi cancelada.',
  'layout.noMonitors': 'O GNOME não informou os monitores', 'layout.badRequest': 'Pedido inválido',
  'layout.no-anchor': 'Monitor de referência não encontrado: {monitor}', 'layout.duplicate': 'Já existe um monitor chamado {monitor}',
  'layout.overlap': 'Não cabe aí: ficaria por cima de {monitor}', 'layout.overlap-pair': 'Os monitores {a} e {b} ficariam sobrepostos',
  'layout.loose': 'O monitor {monitor} ficaria solto, sem encostar em nenhum outro', 'layout.impossible': 'Arranjo impossível de resolver',
  'tour.count': 'Passo {n} de {total}', 'tour.back': 'Voltar', 'tour.next': 'Próximo', 'tour.done': 'Pronto', 'tour.skip': 'Pular o tour',
  'tour.power.title': 'Ligar', 'tour.power.text': 'Liga o OpenAlt neste PC. Depois, abra o app no aparelho e leia o QR que aparece aqui.',
  'tour.mode.title': 'Nova tela ou Espelhar', 'tour.mode.text': 'Nova tela aumenta a sua área de trabalho. Espelhar mostra no aparelho o mesmo que um monitor.',
  'tour.place.title': 'Onde fica {dev}', 'tour.place.text': 'Escolha de que lado de qual monitor ele está, como na sua mesa. O mouse passa para ele por esse lado.',
  'tour.prefs.title': 'Preferências', 'tour.prefs.text': 'Em pé ou deitado, e se as janelas já abrem ocupando a tela toda do aparelho.',
  'tour.devices.title': 'Aparelhos', 'tour.devices.text': 'Aqui ficam os aparelhos pareados. Dá para tirar um quando quiser.',
  'tour.remote.title': 'Fora de casa', 'tour.remote.text': 'Com o Tailscale, o celular ou tablet espelha este PC de qualquer lugar, até no 4G.',
  'tour.tray.title': 'Em segundo plano', 'tour.tray.text': 'Mande o OpenAlt para a bandeja do sistema e ele continua funcionando. Ou saia da tela cheia.',
  'about.tour': 'Tour guiado', 'about.tour.hint': 'Mostra o que cada parte do app faz, em poucos passos.', 'about.tour.button': 'Fazer o tour de novo',
  'show.wallpaperTip': 'Sem papel de parede na tela nova? Reinicie o GNOME: Alt+F2, digite r e aperte Enter (os programas continuam abertos).',
};

const ES: Dict = {
  'nav.label': 'Navegación', 'nav.home': 'Panel', 'nav.devices': 'Dispositivos', 'nav.pc': 'Este PC', 'nav.about': 'Acerca de',
  'theme.label': 'Tema', 'theme.light': 'Tema claro', 'theme.system': 'Tema automático', 'theme.dark': 'Tema oscuro',

  'dev.generic': 'el dispositivo', 'dev.phone': 'el celular', 'dev.tablet': 'la tableta',
  'kind.phone': 'Celular', 'kind.tablet': 'Tableta',
  'orient.auto': 'Automática', 'orient.portrait': 'Vertical', 'orient.landscape': 'Horizontal',
  'orient.portrait.lc': 'vertical', 'orient.landscape.lc': 'horizontal',
  'side.right': 'A la derecha', 'side.left': 'A la izquierda', 'side.above': 'Arriba', 'side.below': 'Abajo',
  'place.at.right': 'A la derecha de {m}', 'place.at.left': 'A la izquierda de {m}', 'place.at.above': 'Encima de {m}', 'place.at.below': 'Debajo de {m}',
  'align.top': 'Arriba', 'align.middle': 'Centro', 'align.bottom': 'Abajo', 'align.left': 'Izquierda', 'align.right': 'Derecha',

  'net.local': 'Red local', 'net.away': 'Fuera de casa',
  'top.pcChecks': 'Qué funciona en este PC', 'top.fullscreen': 'Pantalla completa (F11)', 'top.toTray': 'Seguir en segundo plano (bandeja del sistema)', 'tray.show': 'Mostrar OpenAlt', 'tray.quit': 'Salir de OpenAlt', 'top.exitFullscreen': 'Salir de pantalla completa (Esc)',

  'conn.title': 'Conexión',
  'conn.setup': 'Preparar', 'conn.setup.sub': 'Primera vez en este PC',
  'conn.off': 'Apagado', 'conn.off.sub': 'Nada se enciende sin que lo pidas',
  'conn.starting': 'Encendiendo…', 'conn.starting.sub': 'Iniciando Sunshine',
  'conn.waiting': 'Esperando', 'conn.waiting.sub': 'Escanea el código con {dev}',
  'conn.connected': 'Conectado', 'conn.mirroring': 'Duplicando {m}', 'conn.extra': 'Una pantalla más',
  'stat.resolution': 'resolución', 'stat.rate': 'frecuencia', 'stat.connection': 'conexión', 'stat.remote': 'Remota', 'stat.local': 'Local',
  'stat.monitor': 'monitor', 'stat.monitors': 'monitores', 'stat.mode': 'modo',
  'stat.mirror': 'Espejo', 'stat.new': 'Nueva',
  'power.on': 'Encender', 'power.off': 'Apagar',

  'mode.title': 'Modo', 'mode.extend': 'Nueva pantalla', 'mode.extend.hint': 'Un monitor más',
  'mode.mirror': 'Duplicar', 'mode.mirror.hint': 'Muestra un monitor',

  'pair.title': 'Vincular', 'pair.hint': 'App OpenAlt → “Vincular” → apunta al código',
  'pair.qrAria': 'Código QR para vincular', 'pair.expired': 'Código vencido',
  'pair.validFor': 'Válido por {t} · un solo uso', 'pair.newCode': 'Generar otro',
  'pair.network': 'La misma Wi-Fi de este PC, o Tailscale fuera de casa.',
  'pair.pinLabel': '¿Usas Moonlight? Escribe el PIN que muestra:',
  'pair.namePlaceholder': 'Nombre (ej.: Tableta)', 'pair.nameAria': 'Nombre del dispositivo (opcional)', 'pair.submit': 'Vincular',
  'pair.address': 'Dirección de este PC: {a}',
  'pin.format': 'El PIN tiene 4 números.', 'pin.turnOn': 'Primero enciende OpenAlt.',
  'pin.noRequest': 'Aún no hay solicitudes. En Moonlight, toca este PC para que aparezca el PIN.',
  'pin.ok': '¡Vinculado! En Moonlight, toca “OpenAlt”.', 'pin.rejected': 'PIN no aceptado. Revísalo e inténtalo de nuevo.',

  'show.connected': 'Conectado', 'show.preview': 'Vista previa', 'show.pairedAria': 'Ver dispositivos vinculados',
  'show.none': 'Ningún dispositivo', 'show.estimated': '(estimado)', 'show.kindAria': 'Tipo de dispositivo en la vista previa',

  'prefs.title': 'Cómo queda {dev}', 'prefs.hint': 'La orientación se aplica desde la próxima conexión.',
  'prefs.orientation': 'Orientación',
  'prefs.maximize': 'Maximizar ventanas en {dev}', 'prefs.maximize.hint': 'Al llevar una ventana a la Nueva pantalla',
  'prefs.remember': 'Recordar la disposición', 'prefs.remember.hint': 'Menos parpadeos; se guarda en GNOME',

  'place.mirrorTitle': 'Qué duplica {dev}', 'place.title': 'Dónde queda {dev}',
  'place.mirrorHint': 'Elige el monitor; aparece igualito en el dispositivo.',
  'place.liveHint': 'Cambia al instante, sin contraseña. Haz clic en un monitor y elige el lado.',
  'place.hint': 'Haz clic en un monitor y elige el lado. Se aplica en la próxima conexión.',
  'place.mirrorOf': 'Monitor duplicado', 'place.anchor': 'Junto a qué monitor',
  'place.stageAria': 'Vista previa del escritorio', 'place.side': 'Lado', 'place.align': 'Alinear',
  'place.mirrorMsg': '{Dev} va a mostrar {m}.', 'place.tryOther': '{err}. Prueba otro lado u otra alineación.',
  'place.estimated': ' · tamaño estimado; el real llega del dispositivo al conectar',
  'place.tileAria': '{name}, {w} por {h}', 'place.tilePrimaryAria': '{name}, principal, {w} por {h}',
  'place.deviceAria': '{kind}, {w} por {h}',

  'devs.title': 'Dispositivos vinculados', 'devs.hint': 'Celulares y tabletas que ya escanearon el código de este PC.',
  'devs.device': 'Dispositivo', 'devs.resolution': 'Resolución', 'devs.orientation': 'Orientación', 'devs.network': 'Red',
  'devs.lastSeen': 'Última vez', 'devs.actions': 'Acciones', 'devs.now': 'Ahora', 'devs.forget': 'Olvidar', 'devs.forgetAria': 'Olvidar {name}',
  'devs.empty': 'Ninguno todavía. Enciende y escanea el código con la app OpenAlt.',

  'home.off': 'Celular o tableta como una pantalla más — o como espejo de este PC.',
  'home.starting': 'Encendiendo…', 'home.waiting': 'Encendido · esperando {dev}', 'home.connected': '{name} conectado · {mode}',

  'setup.title': 'Preparemos <em>este PC</em>', 'setup.sub': 'Dos pasos, una sola vez. Nada cambia sin que presiones el botón.',
  'setup.sunshine.ok': 'Instalado. OpenAlt usa una configuración propia; la tuya queda intacta.',
  'setup.sunshine.todo': 'El programa que transmite la pantalla. Desde Flathub, sin contraseña.',
  'setup.helper': 'Permiso del sistema', 'setup.helper.ok': 'Instalado. Encender y apagar ya no pide contraseña.',
  'setup.helper.todo': 'Para crear el monitor del dispositivo. Pide tu contraseña una vez. “Duplicar” funciona sin él.',
  'setup.away': 'Fuera de casa', 'setup.away.text': 'Opcional: Tailscale en el PC y en el dispositivo. Se puede hacer después.',
  'remote.title': 'Fuera de casa', 'remote.checking': 'Comprobando Tailscale…',
  'remote.hint': 'Para usar el dispositivo lejos de casa, el PC y él necesitan Tailscale, gratuito, con tu cuenta.',
  'remote.auto': 'Esta tarjeta se actualiza sola: solo haz el paso que falta.',
  'remote.pill.install': 'Falta instalar', 'remote.pill.login': 'Falta iniciar sesión', 'remote.pill.stopped': 'Tailscale detenido',
  'remote.pill.ready': 'Listo', 'remote.pill.relay': 'Indirecta',
  'remote.step.install': 'Instalar en el PC', 'remote.step.install.ok': 'Tailscale está instalado.', 'remote.step.install.todo': 'Descárgalo del sitio oficial y vuelve aquí.',
  'remote.howInstall': 'Cómo instalar',
  'remote.step.login': 'Iniciar sesión', 'remote.step.login.text': 'El PC pide su contraseña y el inicio de sesión se abre en el navegador. OpenAlt nunca ve la contraseña de tu cuenta.',
  'remote.step.start': 'Encender Tailscale', 'remote.step.start.text': 'El servicio de Tailscale está detenido. El PC pide su contraseña, enciende el servicio y abre el inicio de sesión en el navegador.',
  'remote.signin': 'Iniciar sesión', 'remote.signin.start': 'Encender e iniciar sesión', 'remote.signin.waiting': 'Esperando…',
  'remote.signin.browser': 'Escribe la contraseña del PC, si se pide, e inicia sesión en tu cuenta en el navegador que se abrirá.',
  'remote.signin.ok': 'Listo: Tailscale está encendido.', 'remote.signin.nothing': 'Nada que hacer: Tailscale ya está encendido.',
  'remote.signin.busy': 'El inicio de sesión ya está en curso.', 'remote.signin.cancelled': 'Cancelado. Toca Iniciar sesión para intentarlo de nuevo.',
  'remote.signin.failed': 'No funcionó. Inténtalo de nuevo o ejecuta el comando de abajo en la terminal.',
  'remote.orTerminal': 'O en la terminal:',
  'remote.copy': 'Copiar', 'remote.copied': 'Copiado',
  'remote.step.device': 'Instalar en el dispositivo', 'remote.step.device.text': 'Instala la app de Tailscale en el dispositivo e inicia sesión con la misma cuenta.',
  'remote.getDevice': 'Descargar en el dispositivo',
  'remote.ready': 'Lejos de casa, el dispositivo encuentra este PC solo y duplica la pantalla (la Nueva pantalla es solo en la misma red). Vincúlalo en casa una vez.',
  'remote.relay': 'El dispositivo está conectado a través de un servidor intermedio de Tailscale. Puede haber retraso: para jugar, baja la calidad en el dispositivo.',
  'remote.pcAddress': 'Dirección de este PC', 'remote.devices': 'Dispositivos en tu cuenta',
  'remote.noDevice': 'Todavía no hay ningún móvil o tableta en tu cuenta. Instala Tailscale en el dispositivo e inicia sesión con la misma cuenta.',
  'remote.dev.online': 'En línea', 'remote.dev.offline': 'Apagado', 'remote.dev.relay': 'Indirecta',
  'setup.install': 'Instalar', 'setup.seePc': 'Ver este PC', 'setup.continue': 'Continuar',

  'devices.title': '<em>Dispositivos</em>', 'devices.sub': 'Celulares y tabletas vinculados con este PC.',
  'pc.title': 'Este <em>PC</em>', 'pc.sub': 'OpenAlt es para cualquier PC, pero cada uno es distinto. Esto vale para este.',
  'pc.summary': 'Resumen', 'pc.summary.text': '“Nueva pantalla” y “Duplicar” funcionan aquí',
  'check.session': 'Sesión', 'check.desktop': 'Escritorio', 'check.gpu': 'Tarjeta gráfica', 'check.multi-gpu': 'Varias tarjetas',
  'check.free-output': 'Salida de video libre', 'check.connector': 'Identificación de la salida', 'check.helper': 'Permiso del sistema',
  'env.session.ok': 'Sesión X11.',
  'env.session.bad': 'Sesión "{session}": por ahora OpenAlt solo funciona en X11 (Wayland está en los planes).',
  'env.desktop.ok': 'Escritorio GNOME.', 'env.desktop.mute': 'GNOME detectado, pero no respondió sobre los monitores.',
  'env.desktop.bad': 'Escritorio "{desktop}": por ahora la "Nueva pantalla" solo funciona en GNOME.',
  'env.gpu.unknown': 'Tarjeta gráfica no identificada.',
  'env.gpu.untested': 'Tarjeta gráfica ({drivers}) aún no probada con OpenAlt; puede funcionar.',
  'env.gpu.ok': 'Tarjeta gráfica probada ({drivers}).',
  'env.multi-gpu.untested': 'Más de una tarjeta gráfica: combinación aún no probada.',
  'env.free-output.ok': 'Salida de video libre: {output}.',
  'env.free-output.bad': 'No hay ninguna salida de video libre (todas en uso). Un adaptador "dummy" HDMI/DisplayPort lo resuelve.',
  'env.connector.ok': 'Salida libre identificada en el sistema.',
  'env.connector.bad': 'No se pudo identificar con seguridad la salida libre en el sistema.',
  'env.helper.ok': 'Permiso del sistema instalado.',
  'env.helper.missing': 'Falta instalar el permiso del sistema (se pide una vez, en la instalación).',

  'about.title': 'Acerca de <em>OpenAlt</em>',
  'about.sub': 'Celular o tableta como monitor extra, espejo o pantalla de juego. Código abierto (GPL-3.0).',
  'about.catta': 'Hecho con cariño, para cualquier persona.', 'about.cattaSite': 'Sitio de Catta Studios',
  'about.ours': 'OpenAlt', 'about.ours.text': 'El código de esta app y de la app del celular. Este es nuestro repositorio.',
  'about.sunshine': 'Transmisión de la pantalla, por LizardByte (GPL-3.0). Usado sin modificaciones.',
  'about.moonlight': 'La app del celular y de la tableta es un fork de Moonlight Android (GPL-3.0).',
  'about.common': 'Protocolo de transmisión que usa Moonlight (GPL-3.0).',
  'about.tailscale': 'Acceso fuera de casa, con tu propia cuenta.',
  'about.repo': 'Repositorio', 'about.openAria': 'Abrir {name} en el navegador',
  'about.language': 'Idioma', 'about.language.hint': 'Por defecto, el idioma del sistema.', 'lang.system': 'Del sistema',

  'err.sunshineExited': 'Sunshine se cerró solo.',
  'err.pairRejected': 'No se aceptó la vinculación. Genera otro código e inténtalo de nuevo.',
  'err.forget': 'No se pudo olvidar el dispositivo: {detail}',
  'err.helperCancelled': 'El permiso no se instaló: se canceló la contraseña.',
  'layout.noMonitors': 'GNOME no informó los monitores', 'layout.badRequest': 'Solicitud no válida',
  'layout.no-anchor': 'No se encontró el monitor de referencia: {monitor}', 'layout.duplicate': 'Ya existe un monitor llamado {monitor}',
  'layout.overlap': 'No cabe ahí: quedaría encima de {monitor}', 'layout.overlap-pair': 'Los monitores {a} y {b} quedarían superpuestos',
  'layout.loose': 'El monitor {monitor} quedaría suelto, sin tocar ningún otro', 'layout.impossible': 'Disposición imposible de resolver',
  'tour.count': 'Paso {n} de {total}', 'tour.back': 'Volver', 'tour.next': 'Siguiente', 'tour.done': 'Listo', 'tour.skip': 'Saltar el tour',
  'tour.power.title': 'Encender', 'tour.power.text': 'Enciende OpenAlt en este PC. Luego abre la app en el dispositivo y escanea el QR que aparece aquí.',
  'tour.mode.title': 'Nueva pantalla o Duplicar', 'tour.mode.text': 'Nueva pantalla amplía tu escritorio. Duplicar muestra en el dispositivo lo mismo que un monitor.',
  'tour.place.title': 'Dónde está {dev}', 'tour.place.text': 'Elige a qué lado de qué monitor está, como en tu mesa. El ratón pasa a él por ese lado.',
  'tour.prefs.title': 'Preferencias', 'tour.prefs.text': 'Vertical u horizontal, y si las ventanas se abren ocupando toda la pantalla del dispositivo.',
  'tour.devices.title': 'Dispositivos', 'tour.devices.text': 'Aquí están los dispositivos emparejados. Puedes quitar uno cuando quieras.',
  'tour.remote.title': 'Fuera de casa', 'tour.remote.text': 'Con Tailscale, el celular o la tableta duplica este PC desde cualquier lugar, incluso con datos móviles.',
  'tour.tray.title': 'En segundo plano', 'tour.tray.text': 'Envía OpenAlt a la bandeja del sistema y sigue funcionando. O sal de la pantalla completa.',
  'about.tour': 'Tour guiado', 'about.tour.hint': 'Muestra qué hace cada parte de la app, en pocos pasos.', 'about.tour.button': 'Hacer el tour otra vez',
  'show.wallpaperTip': '¿Sin fondo de pantalla en la pantalla nueva? Reinicia GNOME: Alt+F2, escribe r y pulsa Enter (los programas siguen abiertos).',
};

const EN: Dict = {
  'nav.label': 'Navigation', 'nav.home': 'Dashboard', 'nav.devices': 'Devices', 'nav.pc': 'This PC', 'nav.about': 'About',
  'theme.label': 'Theme', 'theme.light': 'Light theme', 'theme.system': 'Automatic theme', 'theme.dark': 'Dark theme',

  'dev.generic': 'the device', 'dev.phone': 'the phone', 'dev.tablet': 'the tablet',
  'kind.phone': 'Phone', 'kind.tablet': 'Tablet',
  'orient.auto': 'Automatic', 'orient.portrait': 'Portrait', 'orient.landscape': 'Landscape',
  'orient.portrait.lc': 'portrait', 'orient.landscape.lc': 'landscape',
  'side.right': 'Right', 'side.left': 'Left', 'side.above': 'Above', 'side.below': 'Below',
  'place.at.right': 'Right of {m}', 'place.at.left': 'Left of {m}', 'place.at.above': 'Above {m}', 'place.at.below': 'Below {m}',
  'align.top': 'Top', 'align.middle': 'Center', 'align.bottom': 'Bottom', 'align.left': 'Left', 'align.right': 'Right',

  'net.local': 'Local network', 'net.away': 'Away from home',
  'top.pcChecks': 'What works on this PC', 'top.fullscreen': 'Full screen (F11)', 'top.toTray': 'Keep running in the background (system tray)', 'tray.show': 'Show OpenAlt', 'tray.quit': 'Quit OpenAlt', 'top.exitFullscreen': 'Exit full screen (Esc)',

  'conn.title': 'Connection',
  'conn.setup': 'Set up', 'conn.setup.sub': 'First time on this PC',
  'conn.off': 'Off', 'conn.off.sub': 'Nothing turns on unless you ask',
  'conn.starting': 'Starting…', 'conn.starting.sub': 'Starting Sunshine',
  'conn.waiting': 'Waiting', 'conn.waiting.sub': 'Scan the code with {dev}',
  'conn.connected': 'Connected', 'conn.mirroring': 'Mirroring {m}', 'conn.extra': 'One more screen',
  'stat.resolution': 'resolution', 'stat.rate': 'refresh', 'stat.connection': 'connection', 'stat.remote': 'Remote', 'stat.local': 'Local',
  'stat.monitor': 'monitor', 'stat.monitors': 'monitors', 'stat.mode': 'mode',
  'stat.mirror': 'Mirror', 'stat.new': 'New',
  'power.on': 'Turn on', 'power.off': 'Turn off',

  'mode.title': 'Mode', 'mode.extend': 'New screen', 'mode.extend.hint': 'One more monitor',
  'mode.mirror': 'Mirror', 'mode.mirror.hint': 'Shows one monitor',

  'pair.title': 'Pair', 'pair.hint': 'OpenAlt app → “Pair” → point at the code',
  'pair.qrAria': 'Pairing QR code', 'pair.expired': 'Code expired',
  'pair.validFor': 'Valid for {t} · single use', 'pair.newCode': 'New code',
  'pair.network': 'Same Wi-Fi as this PC, or Tailscale when away from home.',
  'pair.pinLabel': 'Using Moonlight? Type the PIN it shows:',
  'pair.namePlaceholder': 'Name (e.g. Tablet)', 'pair.nameAria': 'Device name (optional)', 'pair.submit': 'Pair',
  'pair.address': 'This PC’s address: {a}',
  'pin.format': 'The PIN has 4 digits.', 'pin.turnOn': 'Turn OpenAlt on first.',
  'pin.noRequest': 'No request yet. In Moonlight, tap this PC to get the PIN.',
  'pin.ok': 'Paired! In Moonlight, tap “OpenAlt”.', 'pin.rejected': 'PIN not accepted. Check it and try again.',

  'show.connected': 'Connected', 'show.preview': 'Preview', 'show.pairedAria': 'See paired devices',
  'show.none': 'No device', 'show.estimated': '(estimated)', 'show.kindAria': 'Device type in the preview',

  'prefs.title': 'How {dev} looks', 'prefs.hint': 'Orientation applies from the next connection.',
  'prefs.orientation': 'Orientation',
  'prefs.maximize': 'Maximize windows on {dev}', 'prefs.maximize.hint': 'When you move a window to the New screen',
  'prefs.remember': 'Remember the arrangement', 'prefs.remember.hint': 'Less flicker; saved in GNOME',

  'place.mirrorTitle': 'What {dev} mirrors', 'place.title': 'Where {dev} goes',
  'place.mirrorHint': 'Pick the monitor; it shows up exactly the same on the device.',
  'place.liveHint': 'Changes right away, no password. Click a monitor and pick a side.',
  'place.hint': 'Click a monitor and pick a side. Applies to the next connection.',
  'place.mirrorOf': 'Mirrored monitor', 'place.anchor': 'Next to which monitor',
  'place.stageAria': 'Desktop preview', 'place.side': 'Side', 'place.align': 'Align',
  'place.mirrorMsg': '{Dev} will show {m}.', 'place.tryOther': '{err}. Try another side or alignment.',
  'place.estimated': ' · estimated size; the real one comes from the device when it connects',
  'place.tileAria': '{name}, {w} by {h}', 'place.tilePrimaryAria': '{name}, primary, {w} by {h}',
  'place.deviceAria': '{kind}, {w} by {h}',

  'devs.title': 'Paired devices', 'devs.hint': 'Phones and tablets that have scanned this PC’s code.',
  'devs.device': 'Device', 'devs.resolution': 'Resolution', 'devs.orientation': 'Orientation', 'devs.network': 'Network',
  'devs.lastSeen': 'Last seen', 'devs.actions': 'Actions', 'devs.now': 'Now', 'devs.forget': 'Forget', 'devs.forgetAria': 'Forget {name}',
  'devs.empty': 'None yet. Turn on and scan the code with the OpenAlt app.',

  'home.off': 'A phone or tablet as one more screen — or a mirror of this PC.',
  'home.starting': 'Starting…', 'home.waiting': 'On · waiting for {dev}', 'home.connected': '{name} connected · {mode}',

  'setup.title': 'Let’s set up <em>this PC</em>', 'setup.sub': 'Two steps, just once. Nothing changes until you press the button.',
  'setup.sunshine.ok': 'Installed. OpenAlt uses its own configuration; yours stays untouched.',
  'setup.sunshine.todo': 'The program that streams the screen. From Flathub, no password.',
  'setup.helper': 'System permission', 'setup.helper.ok': 'Installed. Turning on and off no longer asks for a password.',
  'setup.helper.todo': 'To create the device’s monitor. Asks for your password once. “Mirror” works without it.',
  'setup.away': 'Away from home', 'setup.away.text': 'Optional: Tailscale on the PC and on the device. You can do it later.',
  'remote.title': 'Away from home', 'remote.checking': 'Checking Tailscale…',
  'remote.hint': 'To use the device away from home, the PC and the device need Tailscale, free, with your own account.',
  'remote.auto': 'This card updates by itself: just do the step that is left.',
  'remote.pill.install': 'Not installed', 'remote.pill.login': 'Sign-in needed', 'remote.pill.stopped': 'Tailscale stopped',
  'remote.pill.ready': 'Ready', 'remote.pill.relay': 'Indirect',
  'remote.step.install': 'Install on the PC', 'remote.step.install.ok': 'Tailscale is installed.', 'remote.step.install.todo': 'Download it from the official site and come back here.',
  'remote.howInstall': 'How to install',
  'remote.step.login': 'Sign in', 'remote.step.login.text': 'The PC asks for its password and the sign-in opens in the browser. OpenAlt never sees your account password.',
  'remote.step.start': 'Turn Tailscale on', 'remote.step.start.text': 'The Tailscale service is stopped. The PC asks for its password, turns the service on and opens the sign-in in the browser.',
  'remote.signin': 'Sign in', 'remote.signin.start': 'Turn on and sign in', 'remote.signin.waiting': 'Waiting…',
  'remote.signin.browser': 'Type the PC password if asked, then sign in to your account in the browser that opens.',
  'remote.signin.ok': 'Done: Tailscale is on.', 'remote.signin.nothing': 'Nothing to do: Tailscale is already on.',
  'remote.signin.busy': 'Sign-in is already in progress.', 'remote.signin.cancelled': 'Cancelled. Tap Sign in to try again.',
  'remote.signin.failed': 'That did not work. Try again, or run the command below in a terminal.',
  'remote.orTerminal': 'Or in a terminal:',
  'remote.copy': 'Copy', 'remote.copied': 'Copied',
  'remote.step.device': 'Install on the device', 'remote.step.device.text': 'Install the Tailscale app on the device and sign in with the same account.',
  'remote.getDevice': 'Get it for the device',
  'remote.ready': 'Away from home, the device finds this PC by itself and mirrors the screen (New screen is only on the same network). Pair at home once.',
  'remote.relay': 'The device is connected through a Tailscale relay server. There may be lag: for games, lower the quality on the device.',
  'remote.pcAddress': 'This PC\'s address', 'remote.devices': 'Devices on your account',
  'remote.noDevice': 'No phone or tablet on your account yet. Install Tailscale on the device and sign in with the same account.',
  'remote.dev.online': 'Online', 'remote.dev.offline': 'Off', 'remote.dev.relay': 'Indirect',
  'setup.install': 'Install', 'setup.seePc': 'See this PC', 'setup.continue': 'Continue',

  'devices.title': '<em>Devices</em>', 'devices.sub': 'Phones and tablets paired with this PC.',
  'pc.title': 'This <em>PC</em>', 'pc.sub': 'OpenAlt is for any PC, but every PC is different. This is about this one.',
  'pc.summary': 'Summary', 'pc.summary.text': '“New screen” and “Mirror” work here',
  'check.session': 'Session', 'check.desktop': 'Desktop', 'check.gpu': 'Graphics card', 'check.multi-gpu': 'Several cards',
  'check.free-output': 'Free video output', 'check.connector': 'Output identification', 'check.helper': 'System permission',
  'env.session.ok': 'X11 session.',
  'env.session.bad': '"{session}" session: for now OpenAlt only works on X11 (Wayland is planned).',
  'env.desktop.ok': 'GNOME desktop.', 'env.desktop.mute': 'GNOME found, but it did not report the monitors.',
  'env.desktop.bad': '"{desktop}" desktop: for now the "New screen" only works on GNOME.',
  'env.gpu.unknown': 'Graphics card not identified.',
  'env.gpu.untested': 'Graphics card ({drivers}) not yet tested with OpenAlt; it may work.',
  'env.gpu.ok': 'Tested graphics card ({drivers}).',
  'env.multi-gpu.untested': 'More than one graphics card: combination not yet tested.',
  'env.free-output.ok': 'Free video output: {output}.',
  'env.free-output.bad': 'No free video output (all in use). An HDMI/DisplayPort "dummy" adapter solves it.',
  'env.connector.ok': 'Free output identified in the system.',
  'env.connector.bad': 'Could not safely identify the free output in the system.',
  'env.helper.ok': 'System permission installed.',
  'env.helper.missing': 'The system permission still needs installing (asked once, during installation).',

  'about.title': 'About <em>OpenAlt</em>',
  'about.sub': 'A phone or tablet as an extra monitor, a mirror or a game screen. Open source (GPL-3.0).',
  'about.catta': 'Made with care, for everyone.', 'about.cattaSite': 'Catta Studios website',
  'about.ours': 'OpenAlt', 'about.ours.text': 'The code of this app and of the phone app. This is our repository.',
  'about.sunshine': 'Screen streaming, by LizardByte (GPL-3.0). Used unmodified.',
  'about.moonlight': 'The phone and tablet app is a fork of Moonlight Android (GPL-3.0).',
  'about.common': 'Streaming protocol used by Moonlight (GPL-3.0).',
  'about.tailscale': 'Access away from home, with your own account.',
  'about.repo': 'Repository', 'about.openAria': 'Open {name} in the browser',
  'about.language': 'Language', 'about.language.hint': 'The default is the system language.', 'lang.system': 'System',

  'err.sunshineExited': 'Sunshine closed by itself.',
  'err.pairRejected': 'Pairing was not accepted. Generate another code and try again.',
  'err.forget': 'Could not forget the device: {detail}',
  'err.helperCancelled': 'The permission was not installed: the password prompt was cancelled.',
  'layout.noMonitors': 'GNOME did not report the monitors', 'layout.badRequest': 'Invalid request',
  'layout.no-anchor': 'Reference monitor not found: {monitor}', 'layout.duplicate': 'There is already a monitor called {monitor}',
  'layout.overlap': 'Doesn’t fit there: it would cover {monitor}', 'layout.overlap-pair': 'Monitors {a} and {b} would overlap',
  'layout.loose': 'Monitor {monitor} would be left loose, not touching any other', 'layout.impossible': 'Arrangement impossible to solve',
  'tour.count': 'Step {n} of {total}', 'tour.back': 'Back', 'tour.next': 'Next', 'tour.done': 'Done', 'tour.skip': 'Skip tour',
  'tour.power.title': 'Turn on', 'tour.power.text': 'Turns OpenAlt on for this PC. Then open the app on your device and scan the QR code that shows up here.',
  'tour.mode.title': 'New screen or Mirror', 'tour.mode.text': 'New screen extends your desktop. Mirror shows the same as one of your monitors.',
  'tour.place.title': 'Where {dev} sits', 'tour.place.text': 'Pick which side of which monitor it is on, like on your desk. The mouse crosses over on that side.',
  'tour.prefs.title': 'Preferences', 'tour.prefs.text': 'Portrait or landscape, and whether windows open filling the whole device screen.',
  'tour.devices.title': 'Devices', 'tour.devices.text': 'Your paired devices live here. You can remove one at any time.',
  'tour.remote.title': 'Away from home', 'tour.remote.text': 'With Tailscale, your phone or tablet mirrors this PC from anywhere, even on mobile data.',
  'tour.tray.title': 'In the background', 'tour.tray.text': 'Send OpenAlt to the system tray and it keeps working. Or leave fullscreen.',
  'about.tour': 'Guided tour', 'about.tour.hint': 'Shows what each part of the app does, in a few steps.', 'about.tour.button': 'Take the tour again',
  'show.wallpaperTip': 'No wallpaper on the new screen? Restart GNOME: Alt+F2, type r and press Enter (your programs stay open).',
};

const DICTS: Record<Lang, Dict> = { pt: PT, es: ES, en: EN };

/** O idioma do sistema entre os três; se não for nenhum, inglês. */
function systemLang(): Lang {
  for (const l of navigator.languages?.length ? navigator.languages : [navigator.language]) {
    const base = (l || '').slice(0, 2).toLowerCase() as Lang;
    if (LANGS.includes(base)) return base;
  }
  return 'en';
}

function langPref(): LangPref {
  try {
    const v = localStorage.getItem('openalt-lang');
    return v === 'pt' || v === 'es' || v === 'en' ? v : 'system';
  } catch { return 'system'; }
}

let lang: Lang = langPref() === 'system' ? systemLang() : (langPref() as Lang);

function setLangPref(p: LangPref) {
  try {
    if (p === 'system') localStorage.removeItem('openalt-lang');
    else localStorage.setItem('openalt-lang', p);
  } catch { /* sem armazenamento: vale só nesta abertura */ }
  lang = p === 'system' ? systemLang() : p;
  applyStaticTexts();
}

/** Texto no idioma atual. Chave sem tradução: português; nem em português: a própria chave. */
function t(key: string, vars: Record<string, string | number> = {}): string {
  const s = DICTS[lang][key] ?? PT[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** Os textos fixos do index.html (trilho, tema): data-i18n-aria e data-i18n-tip. */
function applyStaticTexts() {
  document.documentElement.lang = HTML_LANG[lang];
  document.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria!)));
  document.querySelectorAll<HTMLElement>('[data-i18n-tip]').forEach((el) => { el.dataset.tip = t(el.dataset.i18nTip!); });
}
