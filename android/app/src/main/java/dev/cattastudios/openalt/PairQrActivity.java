package dev.cattastudios.openalt;

import android.app.Activity;
import android.app.Service;
import android.content.ComponentName;
import android.content.Intent;
import android.content.ServiceConnection;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.text.TextUtils;
import android.view.View;
import android.widget.Button;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import com.google.zxing.integration.android.IntentIntegrator;
import com.google.zxing.integration.android.IntentResult;
import com.limelight.LimeLog;
import com.limelight.R;
import com.limelight.binding.PlatformBinding;
import com.limelight.computers.ComputerManagerService;
import com.limelight.nvstream.http.ComputerDetails;
import com.limelight.nvstream.http.HostHttpResponseException;
import com.limelight.nvstream.http.NvHTTP;
import com.limelight.nvstream.http.PairingManager;
import com.limelight.nvstream.http.PairingManager.PairState;
import com.limelight.utils.UiHelper;

import org.xmlpull.v1.XmlPullParserException;

import java.io.IOException;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * Tela "Parear": lê o QR do app do PC e pareia sem digitar nada.
 *
 * 1. Lê e valida o QR (PairingUri): vencido ou malformado é recusado aqui.
 * 2. Tenta os endereços na ordem do QR; os 100.x (Tailscale) por último.
 * 3. Pareia pelo protocolo do Moonlight com o PIN do QR e o nome "OpenAlt-&lt;d&gt; &lt;modelo&gt;",
 *    que o PC reconhece e confirma sozinho (matchPending em core/src/pairing.ts).
 * 4. Antes de mandar qualquer dado derivado do PIN, confere o certificado do PC com o fp do QR.
 * 5. Guarda o PC na lista com o certificado fixado (como o pareamento por PIN do Moonlight faz).
 */
public class PairQrActivity extends Activity {
    /** Margem além da validade do QR antes de desistir de esperar o PC confirmar. */
    private static final long CONFIRM_GRACE_MS = 20_000;
    private static final long BINDER_WAIT_S = 15;

    private enum Screen { INTRO, WORKING, FAILED, DONE }

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final CountDownLatch binderReady = new CountDownLatch(1);
    private volatile ComputerManagerService.ComputerManagerBinder managerBinder;
    private boolean bound;

    /** Cada tentativa tem um número; resultados de tentativas antigas (timeout, cancelada) são ignorados. */
    private volatile int attempt;

    private TextView status;
    private ProgressBar progress;
    private Button primaryButton;
    private Button cancelButton;
    private Screen screen = Screen.INTRO;

    private final ServiceConnection serviceConnection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder binder) {
            final ComputerManagerService.ComputerManagerBinder localBinder =
                    (ComputerManagerService.ComputerManagerBinder) binder;
            new Thread(new Runnable() {
                @Override
                public void run() {
                    localBinder.waitForReady();
                    managerBinder = localBinder;
                    binderReady.countDown();
                }
            }, "OpenAlt binder").start();
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            managerBinder = null;
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        UiHelper.setLocale(this);
        setContentView(R.layout.activity_pair_qr);
        UiHelper.notifyNewRootView(this);

        status = findViewById(R.id.pairStatus);
        progress = findViewById(R.id.pairProgress);
        primaryButton = findViewById(R.id.pairPrimaryButton);
        cancelButton = findViewById(R.id.pairCancelButton);

        primaryButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (screen == Screen.DONE) {
                    finish();
                }
                else {
                    startScan();
                }
            }
        });
        cancelButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                finish();
            }
        });

        bound = bindService(new Intent(this, ComputerManagerService.class), serviceConnection, Service.BIND_AUTO_CREATE);

        showIntro();
        if (savedInstanceState == null && hasCamera()) {
            // Quem tocou em "Parear com QR" quer a câmera; a explicação fica na tela por trás dela
            startScan();
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        attempt++;
        handler.removeCallbacksAndMessages(null);
        if (bound) {
            unbindService(serviceConnection);
            bound = false;
        }
    }

    private boolean hasCamera() {
        return getPackageManager().hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY);
    }

    private void startScan() {
        if (!hasCamera()) {
            showFailure(getString(R.string.openalt_no_camera));
            return;
        }
        IntentIntegrator integrator = new IntentIntegrator(this);
        integrator.setDesiredBarcodeFormats(IntentIntegrator.QR_CODE);
        integrator.setPrompt(getString(R.string.openalt_scan_prompt));
        integrator.setBeepEnabled(false);
        // O aparelho pode estar em pé ou deitado (o manifesto libera a rotação da tela da câmera)
        integrator.setOrientationLocked(false);
        integrator.initiateScan();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        IntentResult result = IntentIntegrator.parseActivityResult(requestCode, resultCode, data);
        if (result == null) {
            super.onActivityResult(requestCode, resultCode, data);
            return;
        }
        if (result.getContents() == null) {
            // Voltou da câmera sem ler nada: fica na explicação, com o botão para tentar de novo
            if (screen != Screen.WORKING) {
                showIntro();
            }
            return;
        }
        handleQr(result.getContents());
    }

    private void handleQr(String text) {
        final PairingUri uri;
        try {
            uri = PairingUri.parse(text, System.currentTimeMillis() / 1000);
        } catch (PairingUri.InvalidPairingUriException e) {
            LimeLog.warning("OpenAlt: QR rejected: " + e.getMessage());
            showFailure(getString(messageFor(e.problem)));
            return;
        }
        startPairing(uri);
    }

    static int messageFor(PairingUri.Problem problem) {
        switch (problem) {
            case EXPIRED:
                return R.string.openalt_qr_expired;
            case UNSUPPORTED_VERSION:
                return R.string.openalt_qr_version;
            case NOT_OPENALT:
                return R.string.openalt_qr_not_openalt;
            case MISSING_FIELD:
            case INVALID_FIELD:
            default:
                return R.string.openalt_qr_invalid;
        }
    }

    /**
     * 409: o Sunshine já tem um pedido de pareamento aberto com o mesmo uniqueid. Todos os clientes
     * Moonlight do aparelho (este e o Moonlight original) usam o mesmo, então costuma ser um pedido
     * por PIN deixado aberto no Moonlight original. Desligar e Ligar no PC limpa o pedido.
     */
    static int messageForHttpError(int code) {
        return code == 409 ? R.string.openalt_pair_pending_elsewhere : R.string.openalt_pair_error;
    }

    private String pcLabel(PairingUri uri) {
        return uri.pcName.isEmpty() ? getString(R.string.openalt_pc_unnamed) : uri.pcName;
    }

    private void startPairing(final PairingUri uri) {
        final int myAttempt = ++attempt;
        showWorking(getString(R.string.openalt_pair_searching, pcLabel(uri)));

        // O PC só confirma enquanto o QR vale; depois disso o pedido fica parado no Sunshine
        long waitMs = uri.secondsLeft(System.currentTimeMillis() / 1000) * 1000 + CONFIRM_GRACE_MS;
        handler.postDelayed(new Runnable() {
            @Override
            public void run() {
                if (myAttempt == attempt && screen == Screen.WORKING) {
                    attempt++;
                    showFailure(getString(R.string.openalt_pair_timeout));
                }
            }
        }, waitMs);

        new Thread(new Runnable() {
            @Override
            public void run() {
                final String failure = pair(uri, myAttempt);
                handler.post(new Runnable() {
                    @Override
                    public void run() {
                        if (myAttempt != attempt || isFinishing()) {
                            return;
                        }
                        attempt++;
                        if (failure == null) {
                            showDone(getString(R.string.openalt_pair_success, pcLabel(uri)));
                        }
                        else {
                            showFailure(failure);
                        }
                    }
                });
            }
        }, "OpenAlt pair").start();
    }

    /** Roda fora da thread principal. Devolve null se pareou, ou a mensagem do problema. */
    private String pair(PairingUri uri, int myAttempt) {
        try {
            if (!binderReady.await(BINDER_WAIT_S, TimeUnit.SECONDS) || managerBinder == null) {
                return getString(R.string.error_manager_not_running);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return getString(R.string.openalt_pair_failed);
        }
        ComputerManagerService.ComputerManagerBinder binder = managerBinder;

        // 1. O primeiro endereço que responde (rede local antes do Tailscale)
        NvHTTP http = null;
        String serverInfo = null;
        String host = null;
        for (int i = 0; i < uri.hosts.size() && myAttempt == attempt; i++) {
            String candidate = uri.hosts.get(i);
            postStatus(myAttempt, getString(R.string.openalt_pair_trying, candidate, i + 1, uri.hosts.size()));
            try {
                NvHTTP candidateHttp = new NvHTTP(new ComputerDetails.AddressTuple(candidate, uri.port), 0,
                        binder.getUniqueId(), null, PlatformBinding.getCryptoProvider(this));
                serverInfo = candidateHttp.getServerInfo(true);
                http = candidateHttp;
                host = candidate;
                break;
            } catch (IOException | XmlPullParserException | IllegalArgumentException e) {
                LimeLog.info("OpenAlt: " + candidate + " did not answer: " + e.getMessage());
            }
        }
        if (http == null) {
            return getString(R.string.openalt_pair_unreachable, TextUtils.join(", ", uri.hosts));
        }

        // 2. Pareamento com o PIN e o nome que o PC espera, e o certificado conferido com o QR
        PairingManager pm = http.getPairingManager();
        http.setPairingDeviceName(uri.deviceName(Build.MODEL));
        pm.setExpectedServerCertSha256(uri.fingerprintBytes());
        postStatus(myAttempt, getString(R.string.openalt_pair_pairing, pcLabel(uri)));

        PairState state;
        try {
            state = pm.pair(serverInfo, uri.pin);
        } catch (HostHttpResponseException e) {
            LimeLog.warning("OpenAlt: pairing error: " + e.getErrorCode() + " " + e.getMessage());
            return getString(messageForHttpError(e.getErrorCode()), String.valueOf(e.getMessage()));
        } catch (IOException | XmlPullParserException e) {
            LimeLog.warning("OpenAlt: pairing error: " + e.getMessage());
            return getString(R.string.openalt_pair_error, String.valueOf(e.getMessage()));
        }

        switch (state) {
            case PAIRED:
                break;
            case CERT_MISMATCH:
                return getString(R.string.openalt_pair_cert_mismatch);
            case PIN_WRONG:
                return getString(R.string.openalt_pair_pin_wrong);
            case ALREADY_IN_PROGRESS:
                return getString(R.string.openalt_pair_in_progress);
            default:
                return getString(R.string.openalt_pair_failed);
        }

        // 3. Guarda o PC e fixa o certificado (mesmo caminho do pareamento por PIN em PcView)
        postStatus(myAttempt, getString(R.string.openalt_pair_saving));
        ComputerDetails details = new ComputerDetails();
        details.manualAddress = new ComputerDetails.AddressTuple(host, uri.port);
        try {
            if (!binder.addComputerBlocking(details) || details.uuid == null) {
                return getString(R.string.openalt_pair_save_failed);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return getString(R.string.openalt_pair_save_failed);
        }
        ComputerDetails stored = binder.getComputer(details.uuid);
        if (stored == null) {
            return getString(R.string.openalt_pair_save_failed);
        }
        stored.serverCert = pm.getPairedCert();
        binder.invalidateStateForComputer(details.uuid);
        return null;
    }

    private void postStatus(final int myAttempt, final String text) {
        handler.post(new Runnable() {
            @Override
            public void run() {
                if (myAttempt == attempt && screen == Screen.WORKING) {
                    status.setText(text);
                }
            }
        });
    }

    private void showIntro() {
        screen = Screen.INTRO;
        progress.setVisibility(View.GONE);
        status.setText(R.string.openalt_pair_intro);
        primaryButton.setText(R.string.openalt_pair_scan);
        primaryButton.setVisibility(View.VISIBLE);
        cancelButton.setText(R.string.openalt_pair_cancel);
        cancelButton.setVisibility(View.VISIBLE);
    }

    private void showWorking(String text) {
        screen = Screen.WORKING;
        progress.setVisibility(View.VISIBLE);
        status.setText(text);
        primaryButton.setVisibility(View.GONE);
        cancelButton.setText(R.string.openalt_pair_cancel);
        cancelButton.setVisibility(View.VISIBLE);
    }

    private void showFailure(String text) {
        screen = Screen.FAILED;
        progress.setVisibility(View.GONE);
        status.setText(text);
        primaryButton.setText(hasCamera() ? R.string.openalt_pair_scan_again : R.string.openalt_pair_done);
        primaryButton.setVisibility(hasCamera() ? View.VISIBLE : View.GONE);
        cancelButton.setText(R.string.openalt_pair_cancel);
        cancelButton.setVisibility(View.VISIBLE);
    }

    private void showDone(String text) {
        screen = Screen.DONE;
        progress.setVisibility(View.GONE);
        status.setText(text);
        primaryButton.setText(R.string.openalt_pair_done);
        primaryButton.setVisibility(View.VISIBLE);
        cancelButton.setVisibility(View.GONE);
        Toast.makeText(this, text, Toast.LENGTH_LONG).show();
        primaryButton.requestFocus();
    }
}
