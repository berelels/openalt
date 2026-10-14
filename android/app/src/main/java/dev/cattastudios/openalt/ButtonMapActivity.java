package dev.cattastudios.openalt;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.hardware.input.InputManager;
import android.os.Bundle;
import android.preference.PreferenceManager;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.View;
import android.widget.Button;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import com.limelight.R;
import com.limelight.utils.UiHelper;

import java.util.HashMap;
import java.util.Map;

/**
 * "Mapear botões": pede um botão por vez ("aperte o botão para A") e guarda o perfil do controle.
 * Gatilhos e direcional costumam ser eixos, não botões: ficam como o Android entrega.
 */
public class ButtonMapActivity extends Activity {
    /** O que o PC recebe, na ordem em que o assistente pergunta. */
    private static final int[] TARGETS = {
            KeyEvent.KEYCODE_BUTTON_A, KeyEvent.KEYCODE_BUTTON_B, KeyEvent.KEYCODE_BUTTON_X, KeyEvent.KEYCODE_BUTTON_Y,
            KeyEvent.KEYCODE_BUTTON_L1, KeyEvent.KEYCODE_BUTTON_R1, KeyEvent.KEYCODE_BUTTON_THUMBL, KeyEvent.KEYCODE_BUTTON_THUMBR,
            KeyEvent.KEYCODE_BUTTON_SELECT, KeyEvent.KEYCODE_BUTTON_START,
    };

    private final Map<Integer, Integer> map = new HashMap<>();
    private InputDevice device;
    private ControllerStyle.Style style;
    private int step;

    private TextView title;
    private TextView hint;
    private TextView stepLabel;
    private ProgressBar progress;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        UiHelper.setLocale(this);
        Immersive.prepare(this);
        setContentView(R.layout.oa_button_map);
        GridPaperDrawable.apply(((android.view.ViewGroup) findViewById(android.R.id.content)).getChildAt(0));
        title = findViewById(R.id.oaMapTitle);
        hint = findViewById(R.id.oaMapHint);
        stepLabel = findViewById(R.id.oaMapStep);
        progress = findViewById(R.id.oaMapProgress);
        UiSounds.attach(this);
        progress.setMax(TARGETS.length);
        ((Button) findViewById(R.id.oaMapSkip)).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                next();
            }
        });
        ((Button) findViewById(R.id.oaMapCancel)).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                UiSounds.play(ButtonMapActivity.this, UiSoundSynth.Sound.BACK);
                finish();
            }
        });

        device = firstGamepad(this);
        if (device == null) {
            title.setText(R.string.openalt_map_no_controller);
            hint.setText(R.string.openalt_map_no_controller_hint);
            stepLabel.setVisibility(View.GONE);
            progress.setVisibility(View.GONE);
            findViewById(R.id.oaMapSkip).setVisibility(View.GONE);
            return;
        }
        SharedPreferences prefs = PreferenceManager.getDefaultSharedPreferences(this);
        style = ControllerStyle.resolve(prefs.getString("openalt_controller_style", "auto"), device.getVendorId());
        showStep();
    }

    @Override
    protected void onResume() {
        super.onResume();
        Immersive.apply(this);
    }

    static InputDevice firstGamepad(Context c) {
        InputManager im = (InputManager) c.getSystemService(Context.INPUT_SERVICE);
        for (int id : im.getInputDeviceIds()) {
            InputDevice d = im.getInputDevice(id);
            if (d != null && !d.isVirtual() && (d.getSources() & InputDevice.SOURCE_GAMEPAD) == InputDevice.SOURCE_GAMEPAD) {
                return d;
            }
        }
        return null;
    }

    /** O nome do botão no estilo escolhido (Xbox, PlayStation, Nintendo). */
    private String name(int keyCode) {
        switch (keyCode) {
            case KeyEvent.KEYCODE_BUTTON_A:
                return ControllerStyle.glyph(style, ControllerStyle.Action.CONFIRM);
            case KeyEvent.KEYCODE_BUTTON_X:
                return ControllerStyle.glyph(style, ControllerStyle.Action.OPTIONS);
            case KeyEvent.KEYCODE_BUTTON_B:
                return style == ControllerStyle.Style.PLAYSTATION ? "○" : style == ControllerStyle.Style.NINTENDO ? "A" : "B";
            case KeyEvent.KEYCODE_BUTTON_Y:
                return style == ControllerStyle.Style.PLAYSTATION ? "△" : style == ControllerStyle.Style.NINTENDO ? "X" : "Y";
            case KeyEvent.KEYCODE_BUTTON_L1:
                return style == ControllerStyle.Style.PLAYSTATION ? "L1" : style == ControllerStyle.Style.NINTENDO ? "L" : "LB";
            case KeyEvent.KEYCODE_BUTTON_R1:
                return style == ControllerStyle.Style.PLAYSTATION ? "R1" : style == ControllerStyle.Style.NINTENDO ? "R" : "RB";
            case KeyEvent.KEYCODE_BUTTON_THUMBL:
                return style == ControllerStyle.Style.XBOX ? "LS" : "L3";
            case KeyEvent.KEYCODE_BUTTON_THUMBR:
                return style == ControllerStyle.Style.XBOX ? "RS" : "R3";
            case KeyEvent.KEYCODE_BUTTON_SELECT:
                return style == ControllerStyle.Style.PLAYSTATION ? "Share" : style == ControllerStyle.Style.NINTENDO ? "−" : "View";
            case KeyEvent.KEYCODE_BUTTON_START:
            default:
                return ControllerStyle.glyph(style, ControllerStyle.Action.MENU);
        }
    }

    private void showStep() {
        title.setText(getString(R.string.openalt_map_press, name(TARGETS[step])));
        hint.setText(getString(R.string.openalt_map_hint, device.getName()));
        stepLabel.setText(getString(R.string.openalt_map_step, step + 1, TARGETS.length));
        progress.setProgress(step);
    }

    private void next() {
        step++;
        if (step >= TARGETS.length) {
            String key = ButtonMap.deviceKey(device);
            if (key != null) {
                ButtonMap.save(this, key, map);
                UiSounds.play(this, UiSoundSynth.Sound.LAUNCH);
                Toast.makeText(this, R.string.openalt_map_saved, Toast.LENGTH_LONG).show();
            }
            finish();
            return;
        }
        UiSounds.play(this, UiSoundSynth.Sound.SELECT);
        showStep();
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        boolean fromThis = device != null && event.getDeviceId() == device.getId();
        if (!fromThis || !KeyEvent.isGamepadButton(event.getKeyCode())) {
            return super.dispatchKeyEvent(event);
        }
        if (event.getAction() == KeyEvent.ACTION_DOWN && event.getRepeatCount() == 0 && step < TARGETS.length) {
            int pressed = event.getKeyCode();
            // um botão físico vale para uma função só: apertar o mesmo de novo troca a função dele
            map.put(pressed, TARGETS[step]);
            next();
        }
        // os botões do controle não navegam nem fecham a tela enquanto o assistente pergunta
        return true;
    }
}
