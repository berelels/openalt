package dev.cattastudios.openalt;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class SettingsModelTest {

    private static SettingsModel.Item bitrate() {
        SettingsModel.Item it = new SettingsModel.Item();
        it.min = 500;
        it.max = 150000;
        it.step = 500;
        it.divisor = 1000;
        it.suffix = "Mbps";
        return it;
    }

    @Test
    public void numeroComDivisorESufixo() {
        assertEquals("20 Mbps", SettingsModel.formatNumber(bitrate(), 20000));
        assertEquals("1.5 Mbps", SettingsModel.formatNumber(bitrate(), 1500).replace(',', '.'));
        SettingsModel.Item pct = new SettingsModel.Item();
        pct.suffix = "%";
        assertEquals("7 %", SettingsModel.formatNumber(pct, 7));
    }

    @Test
    public void passosDentroDosLimites() {
        SettingsModel.Item b = bitrate();
        assertEquals(21000, SettingsModel.stepValue(b, 20000, 1));
        assertEquals(500, SettingsModel.stepValue(b, 1000, -1));
        assertEquals(150000, SettingsModel.stepValue(b, 150000, 1));
        SettingsModel.Item dz = new SettingsModel.Item();
        dz.min = 0;
        dz.max = 20;
        dz.step = 1;
        assertEquals(8, SettingsModel.stepValue(dz, 7, 1));
        assertEquals(0, SettingsModel.stepValue(dz, 0, -1));
    }
}
