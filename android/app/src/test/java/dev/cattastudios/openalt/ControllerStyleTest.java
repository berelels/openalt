package dev.cattastudios.openalt;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

import dev.cattastudios.openalt.ControllerStyle.Action;
import dev.cattastudios.openalt.ControllerStyle.Style;

public class ControllerStyleTest {

    @Test
    public void escolhaDaPessoaVence() {
        assertEquals(Style.XBOX, ControllerStyle.resolve("xbox", ControllerStyle.VENDOR_SONY));
        assertEquals(Style.PLAYSTATION, ControllerStyle.resolve("playstation", 0));
        assertEquals(Style.NINTENDO, ControllerStyle.resolve("nintendo", 0x045E));
    }

    @Test
    public void automaticoPeloFabricante() {
        assertEquals(Style.PLAYSTATION, ControllerStyle.resolve("auto", ControllerStyle.VENDOR_SONY));
        assertEquals(Style.NINTENDO, ControllerStyle.resolve("auto", ControllerStyle.VENDOR_NINTENDO));
        assertEquals(Style.XBOX, ControllerStyle.resolve("auto", 0x045E));
        assertEquals(Style.XBOX, ControllerStyle.resolve(null, 0));
    }

    @Test
    public void nomesPelaPosicao() {
        assertEquals("A", ControllerStyle.glyph(Style.XBOX, Action.CONFIRM));
        assertEquals("✕", ControllerStyle.glyph(Style.PLAYSTATION, Action.CONFIRM));
        assertEquals("B", ControllerStyle.glyph(Style.NINTENDO, Action.CONFIRM));
        assertEquals("X", ControllerStyle.glyph(Style.XBOX, Action.OPTIONS));
        assertEquals("□", ControllerStyle.glyph(Style.PLAYSTATION, Action.OPTIONS));
        assertEquals("Y", ControllerStyle.glyph(Style.NINTENDO, Action.OPTIONS));
        assertEquals("+", ControllerStyle.glyph(Style.NINTENDO, Action.MENU));
    }
}
