// Extensão do GNOME do OpenAlt (GPL-3.0-or-later, Catta Studios).
//
// Quando a tela do aparelho entra ou sai, o GNOME no X11 perde o papel de parede (e extensões que
// guardam o monitor pelo número se perdem). Só reiniciar o GNOME resolve, e o serviço do Shell não
// aceita reinício por comando (RefuseManualStop) nem o Eval. Daqui de dentro, o reinício é o mesmo
// do Alt+F2 → r (Meta.restart), mas sem caixa e sem simular teclado.
//
// O app chama pelo D-Bus da sessão:
//   gdbus call --session --dest org.gnome.Shell --object-path /dev/cattastudios/OpenAlt \
//     --method dev.cattastudios.OpenAlt.Shell.Restart
//
// Segurança: qualquer programa da sessão fala com o D-Bus da sessão. Por isso o Restart só é
// aceito até 60 s depois de um monitor entrar ou sair, e uma vez por troca. Não reinicia à toa.
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const OBJECT_PATH = '/dev/cattastudios/OpenAlt';
const IFACE = `
<node>
  <interface name="dev.cattastudios.OpenAlt.Shell">
    <method name="Restart">
      <arg type="b" direction="out" name="accepted"/>
    </method>
    <method name="RefreshBackgrounds"/>
    <property name="Version" type="u" access="read"/>
    <property name="CanRestart" type="b" access="read"/>
  </interface>
</node>`;

const VERSION = 1;
const WINDOW_US = 60 * GLib.USEC_PER_SEC;

export default class OpenAltExtension extends Extension {
    enable() {
        this._monitorsChangedAt = 0;
        this._restartTimeout = 0;
        this._monitorsId = Main.layoutManager.connect('monitors-changed', () => {
            this._monitorsChangedAt = GLib.get_monotonic_time();
        });
        this._dbus = Gio.DBusExportedObject.wrapJSObject(IFACE, this);
        this._dbus.export(Gio.DBus.session, OBJECT_PATH);
    }

    disable() {
        this._dbus?.unexport();
        this._dbus = null;
        if (this._monitorsId)
            Main.layoutManager.disconnect(this._monitorsId);
        this._monitorsId = 0;
        if (this._restartTimeout)
            GLib.source_remove(this._restartTimeout);
        this._restartTimeout = 0;
    }

    get Version() {
        return VERSION;
    }

    /** No Wayland o GNOME não reinicia (cairia a sessão inteira). */
    get CanRestart() {
        return !Meta.is_wayland_compositor();
    }

    Restart() {
        if (!this.CanRestart || this._restartTimeout)
            return false;
        const since = GLib.get_monotonic_time() - this._monitorsChangedAt;
        if (!this._monitorsChangedAt || since > WINDOW_US)
            return false;
        this._monitorsChangedAt = 0; // uma vez por troca de monitor
        // responde antes: reiniciar no meio da chamada derruba a resposta
        this._restartTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => {
            this._restartTimeout = 0;
            Meta.restart(GLib.dgettext('gnome-shell', 'Restarting…'), global.context);
            return GLib.SOURCE_REMOVE;
        });
        return true;
    }

    /** Refaz os fundos de todos os monitores (para testar se basta, sem reiniciar). */
    RefreshBackgrounds() {
        Main.layoutManager._updateBackgrounds();
    }
}
