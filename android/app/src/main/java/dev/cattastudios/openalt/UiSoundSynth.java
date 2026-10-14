package dev.cattastudios.openalt;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;

/**
 * Os sons da interface, feitos aqui mesmo (sem gravações de terceiros): notas curtas com ataque
 * rápido e queda suave, como um xilofone de madeira bem baixinho. Saem em PCM 16 bits mono.
 */
final class UiSoundSynth {
    static final int RATE = 44100;

    enum Sound { MOVE, SELECT, BACK, TOGGLE_ON, TOGGLE_OFF, LAUNCH, ERROR }

    private UiSoundSynth() {}

    static short[] render(Sound s) {
        switch (s) {
            case MOVE:
                return build(0.06, new double[][]{{0, 1568, 0.04, 0.5}});
            case SELECT:
                return build(0.17, new double[][]{{0, 784, 0.08, 0.7}, {0.055, 1175, 0.11, 0.7}});
            case BACK:
                return build(0.17, new double[][]{{0, 1175, 0.08, 0.6}, {0.055, 784, 0.11, 0.6}});
            case TOGGLE_ON:
                return build(0.12, new double[][]{{0, 988, 0.05, 0.6}, {0.04, 1319, 0.08, 0.6}});
            case TOGGLE_OFF:
                return build(0.12, new double[][]{{0, 880, 0.05, 0.55}, {0.04, 659, 0.08, 0.55}});
            case LAUNCH:
                return build(0.72, new double[][]{
                        {0, 523, 0.12, 0.55}, {0.07, 659, 0.12, 0.55}, {0.14, 784, 0.14, 0.55}, {0.21, 1047, 0.5, 0.7}});
            case ERROR:
            default:
                return build(0.3, new double[][]{{0, 392, 0.12, 0.8}, {0.14, 370, 0.15, 0.8}});
        }
    }

    /** notes: {início em s, frequência em Hz, duração em s, volume 0..1} */
    private static short[] build(double seconds, double[][] notes) {
        int n = (int) (seconds * RATE);
        double[] mix = new double[n];
        for (double[] note : notes) {
            addNote(mix, note[0], note[1], note[2], note[3]);
        }
        double peak = 0;
        for (double v : mix) {
            peak = Math.max(peak, Math.abs(v));
        }
        double scale = peak > 0 ? 0.8 / peak : 0;
        int fade = Math.min(n, RATE / 200); // 5 ms no fim, sem estalo
        short[] out = new short[n];
        for (int i = 0; i < n; i++) {
            double v = mix[i] * scale;
            if (i >= n - fade) {
                v *= (n - 1 - i) / (double) fade;
            }
            out[i] = (short) Math.round(v * Short.MAX_VALUE);
        }
        return out;
    }

    private static void addNote(double[] mix, double start, double freq, double duration, double gain) {
        int from = (int) (start * RATE);
        int len = (int) (duration * RATE);
        int attack = RATE / 400; // 2,5 ms
        double decay = duration / 5;
        for (int i = 0; i < len && from + i < mix.length; i++) {
            double t = i / (double) RATE;
            double env = (i < attack ? i / (double) attack : 1) * Math.exp(-t / decay);
            double w = 2 * Math.PI * freq * t;
            // fundamental + um pouco do 2º e do 4º harmônico: som de madeira, não de bipe
            double v = Math.sin(w) + 0.25 * Math.sin(2 * w) * Math.exp(-t / (decay / 2)) + 0.08 * Math.sin(4 * w);
            mix[from + i] += gain * env * v;
        }
    }

    /** Um arquivo WAV (RIFF, PCM 16 bits mono), que é o que o SoundPool carrega. */
    static byte[] wav(short[] pcm) {
        int data = pcm.length * 2;
        ByteBuffer b = ByteBuffer.allocate(44 + data).order(ByteOrder.LITTLE_ENDIAN);
        b.put(new byte[]{'R', 'I', 'F', 'F'}).putInt(36 + data).put(new byte[]{'W', 'A', 'V', 'E'});
        b.put(new byte[]{'f', 'm', 't', ' '}).putInt(16).putShort((short) 1).putShort((short) 1)
                .putInt(RATE).putInt(RATE * 2).putShort((short) 2).putShort((short) 16);
        b.put(new byte[]{'d', 'a', 't', 'a'}).putInt(data);
        for (short s : pcm) {
            b.putShort(s);
        }
        return b.array();
    }
}
