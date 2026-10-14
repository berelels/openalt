package dev.cattastudios.openalt;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;

public class UiSoundSynthTest {
    @Test
    public void everySoundIsShortLoudEnoughAndNeverClips() {
        for (UiSoundSynth.Sound s : UiSoundSynth.Sound.values()) {
            short[] pcm = UiSoundSynth.render(s);
            assertTrue(s + " curto", pcm.length > 0 && pcm.length <= UiSoundSynth.RATE);
            int peak = 0;
            for (short v : pcm) {
                peak = Math.max(peak, Math.abs((int) v));
            }
            // normalizado a 80%: nunca estoura e nunca sai mudo
            assertTrue(s + " pico " + peak, peak > Short.MAX_VALUE * 0.7 && peak <= Short.MAX_VALUE * 0.81);
            assertEquals(s + " termina em silêncio", 0, pcm[pcm.length - 1]);
        }
    }

    @Test
    public void wavHeaderDescribesMono16BitPcm() {
        short[] pcm = UiSoundSynth.render(UiSoundSynth.Sound.MOVE);
        ByteBuffer b = ByteBuffer.wrap(UiSoundSynth.wav(pcm)).order(ByteOrder.LITTLE_ENDIAN);
        assertEquals(44 + pcm.length * 2, b.capacity());
        assertEquals('R', b.get(0));
        assertEquals('W', b.get(8));
        assertEquals(1, b.getShort(20)); // PCM
        assertEquals(1, b.getShort(22)); // mono
        assertEquals(UiSoundSynth.RATE, b.getInt(24));
        assertEquals(16, b.getShort(34));
        assertEquals(pcm.length * 2, b.getInt(40));
        assertEquals(pcm[1], b.getShort(46));
    }
}
