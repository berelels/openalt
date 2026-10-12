package dev.cattastudios.openalt;

import android.app.Activity;
import android.widget.Toast;

import com.limelight.LimeLog;
import com.limelight.R;
import com.limelight.binding.PlatformBinding;
import com.limelight.computers.ComputerManagerService;
import com.limelight.nvstream.http.ComputerDetails;
import com.limelight.nvstream.http.NvApp;
import com.limelight.nvstream.http.NvHTTP;
import com.limelight.utils.ServerHelper;

import org.xmlpull.v1.XmlPullParserException;

import java.io.IOException;

/**
 * Tocar num PC pareado conecta direto no app "OpenAlt" que o app do PC registra no Sunshine
 * (core/src/sunshine/setup.ts), sem a grade de apps do Moonlight. O app "OpenAlt" segue o modo
 * escolhido no PC (Nova tela ou Espelhar).
 */
public final class OpenAltLauncher {
    /** Nome do app no apps.json do OpenAlt. */
    public static final String SUNSHINE_APP_NAME = "OpenAlt";

    private OpenAltLauncher() {}

    /**
     * Conecta no app "OpenAlt" do PC. Se o PC não tiver esse app, se outro app estiver aberto nele
     * (a grade deixa retomar ou fechar) ou se a lista de apps falhar, chama {@code showAppList}.
     */
    public static void connect(final Activity activity, final ComputerDetails computer,
                               final ComputerManagerService.ComputerManagerBinder managerBinder,
                               final Runnable showAppList) {
        Toast.makeText(activity, activity.getString(R.string.openalt_connecting, computer.name), Toast.LENGTH_SHORT).show();
        new Thread(new Runnable() {
            @Override
            public void run() {
                NvApp app = null;
                boolean listed = false;
                try {
                    NvHTTP http = new NvHTTP(ServerHelper.getCurrentAddressFromComputer(computer), computer.httpsPort,
                            managerBinder.getUniqueId(), computer.serverCert, PlatformBinding.getCryptoProvider(activity));
                    app = http.getAppByName(SUNSHINE_APP_NAME);
                    listed = true;
                } catch (IOException | XmlPullParserException e) {
                    LimeLog.warning("OpenAlt: could not read the app list: " + e.getMessage());
                }

                final NvApp found = app;
                final boolean appListRead = listed;
                activity.runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        if (activity.isFinishing()) {
                            return;
                        }
                        if (found == null) {
                            // Lista lida e sem o app: avisa. Erro de rede: a grade mostra o erro dela.
                            if (appListRead) {
                                Toast.makeText(activity, R.string.openalt_app_missing, Toast.LENGTH_LONG).show();
                            }
                            showAppList.run();
                        }
                        else if (computer.runningGameId != 0 && computer.runningGameId != found.getAppId()) {
                            showAppList.run();
                        }
                        else {
                            ServerHelper.doStart(activity, found, computer, managerBinder);
                        }
                    }
                });
            }
        }, "OpenAlt connect").start();
    }
}
