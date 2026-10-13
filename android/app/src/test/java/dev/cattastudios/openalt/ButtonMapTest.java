package dev.cattastudios.openalt;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.util.HashMap;
import java.util.Map;

public class ButtonMapTest {

    @Test
    public void guardaEDevolveOsPares() {
        Map<Integer, Integer> m = new HashMap<>();
        m.put(96, 97);
        m.put(97, 96);
        Map<Integer, Integer> back = ButtonMap.decode(ButtonMap.encode(m));
        assertEquals(m, back);
    }

    @Test
    public void ignoraParesEstragados() {
        Map<Integer, Integer> m = ButtonMap.decode("96:97,x:1,97,-1:5,99:100");
        assertEquals(2, m.size());
        assertEquals(Integer.valueOf(97), m.get(96));
        assertEquals(Integer.valueOf(100), m.get(99));
        assertTrue(ButtonMap.decode(null).isEmpty());
        assertTrue(ButtonMap.decode("").isEmpty());
    }
}
