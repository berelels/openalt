package dev.cattastudios.openalt;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.DialogInterface;
import android.content.Intent;
import android.widget.Toast;

import com.limelight.AppView;
import com.limelight.R;
import com.limelight.computers.ComputerManagerService;
import com.limelight.grid.assets.DiskAssetLoader;
import com.limelight.nvstream.http.ComputerDetails;
import com.limelight.nvstream.http.NvApp;
import com.limelight.nvstream.http.PairingManager.PairState;
import com.limelight.nvstream.wol.WakeOnLanSender;
import com.limelight.utils.Dialog;
import com.limelight.utils.ServerHelper;
import com.limelight.utils.ShortcutHelper;
import com.limelight.utils.UiHelper;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/**
 * As opções de um PC (as do menu da lista do Moonlight) dentro da StartActivity, sem sair para a
 * lista: retomar ou fechar o que está aberto, ver os apps, acordar o PC, testar a rede, excluir e
 * ver os detalhes. Os textos são os do próprio Moonlight (já traduzidos).
 */
final class PcOptions {
    interface Host {
        ComputerManagerService.ComputerManagerBinder binder();
        void onComputerRemoved(ComputerDetails d);
    }

    private PcOptions() {}

    static void show(final Activity a, final ComputerDetails d, final Host host) {
        final List<String> labels = new ArrayList<>();
        final List<Runnable> actions = new ArrayList<>();
        boolean online = d.state == ComputerDetails.State.ONLINE;

        if (!online) {
            add(labels, actions, a.getString(R.string.pcview_menu_send_wol), new Runnable() {
                @Override
                public void run() {
                    wake(a, d);
                }
            });
        }
        else if (d.pairState != PairState.PAIRED) {
            add(labels, actions, a.getString(R.string.pcview_menu_pair_pc), new Runnable() {
                @Override
                public void run() {
                    a.startActivity(new Intent(a, PairQrActivity.class));
                }
            });
        }
        else {
            if (d.runningGameId != 0) {
                add(labels, actions, a.getString(R.string.applist_menu_resume), new Runnable() {
                    @Override
                    public void run() {
                        if (binder(a, host) != null) {
                            ServerHelper.doStart(a, new NvApp("app", d.runningGameId, false), d, host.binder());
                        }
                    }
                });
                add(labels, actions, a.getString(R.string.applist_menu_quit), new Runnable() {
                    @Override
                    public void run() {
                        if (binder(a, host) == null) {
                            return;
                        }
                        UiHelper.displayQuitConfirmationDialog(a, new Runnable() {
                            @Override
                            public void run() {
                                ServerHelper.doQuit(a, d, new NvApp("app", 0, false), host.binder(), null);
                            }
                        }, null);
                    }
                });
            }
            add(labels, actions, a.getString(R.string.pcview_menu_app_list), new Runnable() {
                @Override
                public void run() {
                    Intent i = new Intent(a, AppView.class);
                    i.putExtra(AppView.NAME_EXTRA, d.name);
                    i.putExtra(AppView.UUID_EXTRA, d.uuid);
                    i.putExtra(AppView.NEW_PAIR_EXTRA, false);
                    i.putExtra(AppView.SHOW_HIDDEN_APPS_EXTRA, true);
                    a.startActivity(i);
                }
            });
        }

        add(labels, actions, a.getString(R.string.pcview_menu_test_network), new Runnable() {
            @Override
            public void run() {
                ServerHelper.doNetworkTest(a);
            }
        });
        add(labels, actions, a.getString(R.string.pcview_menu_delete_pc), new Runnable() {
            @Override
            public void run() {
                UiHelper.displayDeletePcConfirmationDialog(a, d, new Runnable() {
                    @Override
                    public void run() {
                        delete(a, d, host);
                    }
                }, null);
            }
        });
        add(labels, actions, a.getString(R.string.pcview_menu_details), new Runnable() {
            @Override
            public void run() {
                Dialog.displayDialog(a, a.getString(R.string.title_details), d.toString(), false);
            }
        });

        new AlertDialog.Builder(a)
                .setTitle(d.name)
                .setItems(labels.toArray(new String[0]), new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        actions.get(which).run();
                    }
                })
                .show();
    }

    private static void add(List<String> labels, List<Runnable> actions, String label, Runnable action) {
        labels.add(label);
        actions.add(action);
    }

    private static ComputerManagerService.ComputerManagerBinder binder(Activity a, Host host) {
        ComputerManagerService.ComputerManagerBinder b = host.binder();
        if (b == null) {
            Toast.makeText(a, R.string.error_manager_not_running, Toast.LENGTH_LONG).show();
        }
        return b;
    }

    private static void wake(final Activity a, final ComputerDetails d) {
        if (d.macAddress == null) {
            Toast.makeText(a, R.string.wol_no_mac, Toast.LENGTH_SHORT).show();
            return;
        }
        new Thread(new Runnable() {
            @Override
            public void run() {
                int message;
                try {
                    WakeOnLanSender.sendWolPacket(d);
                    message = R.string.wol_waking_msg;
                } catch (IOException e) {
                    message = R.string.wol_fail;
                }
                final int m = message;
                a.runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        Toast.makeText(a, m, Toast.LENGTH_LONG).show();
                    }
                });
            }
        }, "OpenAlt WoL").start();
    }

    /** Igual ao "Excluir PC" da lista do Moonlight (PcView.removeComputer). */
    private static void delete(Activity a, ComputerDetails d, Host host) {
        if (binder(a, host) == null) {
            return;
        }
        host.binder().removeComputer(d);
        new DiskAssetLoader(a).deleteAssetsForComputer(d.uuid);
        a.getSharedPreferences(AppView.HIDDEN_APPS_PREF_FILENAME, Activity.MODE_PRIVATE).edit().remove(d.uuid).apply();
        new ShortcutHelper(a).disableComputerShortcut(d, a.getString(R.string.scut_deleted_pc));
        host.onComputerRemoved(d);
    }
}
